import { GameInstance, TEAM_COLORS, type GameConfig, type KillEvent, type BaseDestroyEvent } from './engine.js'
import type { LobbyInfo, LobbyPlayer, GameMode, ClientMessage, ServerMessage, GameSnapshot, PersonalBot } from './types.js'
import { pool } from '../db/index.js'

const INACTIVITY_TIMEOUT = 2 * 60 * 1000 // 2 minutes

// ============================================================================
// LOBBY MANAGER
// ============================================================================

interface ConnectedPlayer {
  ws: any // Bun WebSocket
  playerId: string
  userId: string
  name: string
  profileImg?: string
  tankId: number
}

interface Lobby {
  info: LobbyInfo
  game: GameInstance | null
  connections: Map<string, ConnectedPlayer> // playerId -> connection
  lastRealUserActivity: number
  inactivityTimer: ReturnType<typeof setInterval> | null
  snapshotInterval: ReturnType<typeof setInterval> | null
}

const lobbies = new Map<string, Lobby>()

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function broadcastToLobby(lobby: Lobby, msg: ServerMessage) {
  const data = JSON.stringify(msg)
  for (const conn of lobby.connections.values()) {
    try { conn.ws.send(data) } catch {}
  }
}

function sendTo(ws: any, msg: ServerMessage) {
  try { ws.send(JSON.stringify(msg)) } catch {}
}

function buildLobbyInfo(lobby: Lobby): LobbyInfo {
  return { ...lobby.info }
}

function broadcastLobbyUpdate(lobby: Lobby) {
  broadcastToLobby(lobby, { type: 'lobby_update', lobby: buildLobbyInfo(lobby) })
}

// Apply aura change to database
async function applyAuraChange(entityId: string, entityType: string, delta: number) {
  const tableMap: Record<string, string> = {
    player: 'players', game: 'games', country: 'countries',
    organisation: 'organisations', character: 'characters',
    brand: 'brands', peripheral: 'peripherals', role: 'roles',
    weapon: 'weapons', region: 'regions',
  }
  const table = tableMap[entityType]
  if (!table) return
  try {
    await pool.query(`UPDATE ${table} SET aura_score = ROUND((GREATEST(0, aura_score + $1))::numeric, 2) WHERE id = $2`, [delta, entityId])
  } catch (e) {
    console.error('Failed to apply aura change:', e)
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function createLobby(hostId: string, hostName: string, mode: GameMode, teamCount: number, teams: LobbyInfo['teams'], name: string): LobbyInfo {
  const id = generateId()
  const maxPlayers = (mode === 'battle' || mode === 'dust2') ? teamCount * 4 : 8

  const info: LobbyInfo = {
    id, name, mode,
    state: 'waiting',
    players: [],
    maxPlayers,
    teamCount,
    teams,
    createdAt: Date.now(),
    hostId,
  }

  const lobby: Lobby = {
    info,
    game: null,
    connections: new Map(),
    lastRealUserActivity: Date.now(),
    inactivityTimer: null,
    snapshotInterval: null,
  }

  lobbies.set(id, lobby)
  return info
}

export function listLobbies(): LobbyInfo[] {
  return Array.from(lobbies.values())
    .filter(l => l.info.state !== 'finished')
    .map(l => buildLobbyInfo(l))
}

export function getLobby(id: string): LobbyInfo | null {
  const lobby = lobbies.get(id)
  return lobby ? buildLobbyInfo(lobby) : null
}

export function joinLobby(lobbyId: string, userId: string, playerName: string, team: number, profileImg?: string, entityId?: string, entityType?: string, auraScore?: number): { success: boolean; error?: string } {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return { success: false, error: 'Lobby not found' }
  if (lobby.info.state === 'finished') return { success: false, error: 'Lobby has ended' }
  // Clamp team to valid range
  if (lobby.info.mode === 'battle') {
    team = Math.max(0, Math.min(team, lobby.info.teamCount - 1))
  }

  const existing = lobby.info.players.find(p => p.id === userId)
  if (existing) {
    // Rejoin: update team if changed
    existing.team = team
    existing.profileImg = profileImg
    existing.entityId = entityId
    existing.entityType = entityType
    existing.auraScore = auraScore
    lobby.lastRealUserActivity = Date.now()
    return { success: true }
  }

  if (lobby.info.players.length >= lobby.info.maxPlayers) return { success: false, error: 'Lobby is full' }

  const player: LobbyPlayer = { id: userId, name: playerName, team, profileImg, entityId, entityType, auraScore, ready: false }
  lobby.info.players.push(player)
  lobby.lastRealUserActivity = Date.now()

  // If game is already running, add the player to the game instance
  if (lobby.info.state === 'playing' && lobby.game) {
    lobby.game.addPlayer(userId, playerName, team, profileImg, entityId, entityType, auraScore)
  }

  return { success: true }
}

export function leaveLobby(lobbyId: string, userId: string) {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return

  lobby.info.players = lobby.info.players.filter(p => p.id !== userId)

  if (lobby.game) {
    lobby.game.removePlayer(userId)
    lobby.connections.delete(userId)
  }

  // If host left, transfer or close
  if (lobby.info.hostId === userId) {
    if (lobby.info.players.length > 0) {
      lobby.info.hostId = lobby.info.players[0].id
    } else {
      closeLobby(lobbyId)
    }
  }

  broadcastLobbyUpdate(lobby)
}

export function closeLobby(lobbyId: string) {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return

  lobby.info.state = 'finished'
  lobby.game?.stop()
  if (lobby.inactivityTimer) clearInterval(lobby.inactivityTimer)
  if (lobby.snapshotInterval) clearInterval(lobby.snapshotInterval)

  broadcastToLobby(lobby, { type: 'game_over', winningTeam: -1 })
  lobbies.delete(lobbyId)
}

export function startGame(lobbyId: string): { success: boolean; error?: string } {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return { success: false, error: 'Lobby not found' }
  if (lobby.info.state !== 'waiting') return { success: false, error: 'Game already started' }
  if (lobby.info.players.length === 0) return { success: false, error: 'No players' }

  lobby.info.state = 'playing'

  const config: GameConfig = {
    mode: lobby.info.mode,
    teamCount: lobby.info.teamCount,
    teams: lobby.info.teams,
  }

  const game = new GameInstance(config)
  lobby.game = game

  // Add all players
  for (const p of lobby.info.players) {
    game.addPlayer(p.id, p.name, p.team, p.profileImg, p.entityId, p.entityType, p.auraScore)
  }

  // Game event handlers
  game.onKill = async (event: KillEvent) => {
    if (lobby.info.mode === 'ffa') {
      const killer = game.gs.tanks.find(t => t.id === event.killerTankId)
      const victim = game.gs.tanks.find(t => t.id === event.victimTankId)

      // +20 aura for player killer
      if (killer?.playerId && killer.entityId && killer.entityType) {
        killer.auraScore += 20
        await applyAuraChange(killer.entityId, killer.entityType, 20)
        broadcastToLobby(lobby, { type: 'aura_change', entityId: killer.entityId, entityType: killer.entityType, delta: 20 })
      }

      // -10 aura for player victim
      if (victim?.playerId && victim.entityId && victim.entityType) {
        victim.auraScore = Math.max(0, victim.auraScore - 10)
        await applyAuraChange(victim.entityId, victim.entityType, -10)
        broadcastToLobby(lobby, { type: 'aura_change', entityId: victim.entityId, entityType: victim.entityType, delta: -10 })
      }
    }
  }

  game.onBaseDestroy = async (event: BaseDestroyEvent) => {
    // Apply -100 aura to the entity
    await applyAuraChange(event.entityId, event.entityType, -100)
    broadcastToLobby(lobby, {
      type: 'aura_change',
      entityId: event.entityId,
      entityType: event.entityType,
      delta: -100,
    })
  }

  game.onGameOver = (winningTeam: number) => {
    lobby.info.state = 'finished'
    broadcastToLobby(lobby, { type: 'game_over', winningTeam })
    // Clean up after a delay
    setTimeout(() => closeLobby(lobbyId), 10000)
  }

  game.start()

  // Send snapshots at 45fps
  lobby.snapshotInterval = setInterval(() => {
    if (!lobby.game) return
    const snapshot = lobby.game.buildSnapshot()
    for (const [playerId, conn] of lobby.connections) {
      const pInfo = lobby.game.playerInputs.get(playerId)
      const tankId = pInfo?.tankId ?? -1
      const abilityCooldown = pInfo?.abilityCooldown ?? 0
      sendTo(conn.ws, { type: 'snapshot', data: snapshot, you: tankId, abilityCooldown })
    }
  }, 1000 / 45)

  // Inactivity check
  lobby.lastRealUserActivity = Date.now()
  lobby.inactivityTimer = setInterval(() => {
    const realPlayers = lobby.connections.size
    if (realPlayers === 0 && Date.now() - lobby.lastRealUserActivity > INACTIVITY_TIMEOUT) {
      console.log(`Lobby ${lobbyId} closing due to inactivity`)
      closeLobby(lobbyId)
    }
  }, 10000)

  broadcastToLobby(lobby, { type: 'game_start' })
  broadcastLobbyUpdate(lobby)

  return { success: true }
}

export function deployPersonalBotInLobby(lobbyId: string, bot: PersonalBot, team: number): { success: boolean; error?: string } {
  const lobby = lobbies.get(lobbyId)
  if (!lobby || !lobby.game) return { success: false, error: 'Game not running' }

  const name = `[${bot.entityName}] BOT`
  lobby.game.deployPersonalBot(name, team, bot.entityImg)
  return { success: true }
}

// ============================================================================
// WEBSOCKET HANDLING
// ============================================================================

export function handleWebSocketUpgrade(ws: any, lobbyId: string, userId: string) {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) {
    sendTo(ws, { type: 'error', message: 'Lobby not found' })
    return
  }

  const player = lobby.info.players.find(p => p.id === userId)
  if (!player) {
    sendTo(ws, { type: 'error', message: 'Not in this lobby' })
    return
  }

  const conn: ConnectedPlayer = {
    ws, playerId: userId, userId, name: player.name,
    profileImg: player.profileImg, tankId: -1,
  }

  lobby.connections.set(userId, conn)
  lobby.lastRealUserActivity = Date.now()

  sendTo(ws, { type: 'joined', lobbyId, playerId: userId })
  sendTo(ws, { type: 'lobby_update', lobby: buildLobbyInfo(lobby) })

  // If game already running, the player's tank is already created
  if (lobby.game) {
    const info = lobby.game.playerInputs.get(userId)
    if (info) conn.tankId = info.tankId
  }
}

export function handleWebSocketMessage(ws: any, lobbyId: string, userId: string, raw: string) {
  const lobby = lobbies.get(lobbyId)
  if (!lobby || !lobby.game) return

  lobby.lastRealUserActivity = Date.now()

  let msg: ClientMessage
  try { msg = JSON.parse(raw) } catch { return }

  switch (msg.type) {
    case 'input': {
      const info = lobby.game.playerInputs.get(userId)
      if (info) info.input = msg.data
      break
    }
    case 'upgrade_stat':
      lobby.game.upgradeStat(userId, msg.index)
      break
    case 'select_class':
      lobby.game.selectClass(userId, msg.classId)
      break
    case 'toggle_autofire':
      lobby.game.toggleAutofire(userId)
      break
    case 'set_level':
      lobby.game.adjustPlayerLevel(userId, msg.delta || 0)
      break
    case 'place_wall':
      lobby.game.placeWall(userId, msg.x, msg.y)
      break
    case 'activate_stealth':
      lobby.game.activateStealth(userId)
      break
    case 'respawn': {
      lobby.game.respawnPlayer(userId)
      const info = lobby.game.playerInputs.get(userId)
      const conn = lobby.connections.get(userId)
      if (info && conn) conn.tankId = info.tankId
      break
    }
  }
}

export function handleWebSocketClose(lobbyId: string, userId: string) {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return

  lobby.connections.delete(userId)

  // Don't remove from game immediately - they might reconnect
  // But update activity tracking
  if (lobby.connections.size === 0) {
    lobby.lastRealUserActivity = Date.now() // Start the 2-min countdown
  }
}
