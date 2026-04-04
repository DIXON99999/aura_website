// Shared game types for server-side simulation

export interface V2 { x: number; y: number }

export interface BarrelDef {
  angle: number; width: number; length: number
  widthEnd?: number; offset?: number
  reloadMul?: number; bulletSizeMul?: number; bulletSpeedMul?: number; bulletDamageMul?: number
}

export interface TankClass {
  id: string; name: string; tier: number; barrels: BarrelDef[]
  upgradesFrom?: string[]; fov?: number; recoil?: number
}

export interface Shape {
  id: number; x: number; y: number; vx: number; vy: number
  type: string; radius: number; hp: number; maxHp: number; xp: number
  rot: number; rotSpd: number; flash: number
  sides: number; fill: string; ol: string; bodyDmg: number
}

export interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number
  radius: number; hp: number; dmg: number; owner: number; team: number
  fill: string; ol: string; age: number; maxAge: number
}

export interface Tank {
  id: number; x: number; y: number; vx: number; vy: number
  angle: number; radius: number; hp: number; maxHp: number
  level: number; xp: number; xpNext: number; score: number
  stats: number[]; statPts: number; classId: string
  fill: string; ol: string; flash: number
  reloads: number[]; alive: boolean; name: string
  isPlayer: boolean; recoils: number[]; bodyDmg: number
  regenTimer: number
  aiTgtX: number; aiTgtY: number; aiTimer: number; aiShoot: number
  team: number
  playerId?: string // real user ID if player-controlled
  entityId?: string // linked entity ID for aura changes (e.g. player profile id)
  entityType?: string // entity type for aura changes
  auraScore: number // current aura score
  isPersonalBot?: boolean // deployed personal bot with enhanced stats
}

export interface TeamBase {
  id: number; x: number; y: number
  hp: number; maxHp: number
  radius: number; rot: number; rotSpd: number
  team: number; flash: number
  entityName: string; entityId: string; entityType: string
  entityImg?: string // URL, not HTMLImageElement on server
  destroyed: boolean
}

export interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; fill: string; alpha: number; life: number; maxLife: number
}

export type GameMode = 'ffa' | 'battle'

export interface GameState {
  tanks: Tank[]
  shapes: Shape[]
  bullets: Bullet[]
  particles: Particle[]
  bases: TeamBase[]
  mode: GameMode
  teamCount: number
  battleOver: boolean
  winningTeam: number
  baseDestroyedMsg: string
  baseDestroyedTimer: number
}

// What the client sends each tick
export interface PlayerInput {
  keys: string[] // currently held keys
  mouseX: number
  mouseY: number
  mouseDown: boolean
  viewW: number
  viewH: number
}

// Snapshot sent to clients for rendering
export interface GameSnapshot {
  tanks: SnapshotTank[]
  shapes: SnapshotShape[]
  bullets: SnapshotBullet[]
  particles: SnapshotParticle[]
  bases: SnapshotBase[]
  mode: GameMode
  teamCount: number
  battleOver: boolean
  winningTeam: number
  baseDestroyedMsg: string
  baseDestroyedTimer: number
}

export interface SnapshotTank {
  id: number; x: number; y: number; angle: number
  radius: number; hp: number; maxHp: number
  level: number; score: number; classId: string
  fill: string; ol: string; flash: number
  alive: boolean; name: string; isPlayer: boolean
  team: number; recoils: number[]
  stats: number[]; statPts: number
  xp: number; xpNext: number
  auraScore: number
  profileImg?: string
  playerId?: string
  entityId?: string
  isPersonalBot?: boolean
}

export interface SnapshotShape {
  id: number; x: number; y: number; radius: number
  rot: number; sides: number; fill: string; ol: string
  hp: number; maxHp: number; flash: number; type: string
}

export interface SnapshotBullet {
  id: number; x: number; y: number; radius: number
  fill: string; ol: string
}

export interface SnapshotParticle {
  x: number; y: number; r: number; fill: string; alpha: number
}

export interface SnapshotBase {
  id: number; x: number; y: number
  hp: number; maxHp: number
  radius: number; rot: number
  team: number; flash: number
  entityName: string; entityId: string; entityType: string
  entityImg?: string
  destroyed: boolean
}

// Lobby types
export interface LobbyPlayer {
  id: string
  name: string
  team: number
  profileImg?: string
  entityId?: string
  entityType?: string
  auraScore?: number
  ready: boolean
}

export interface PersonalBot {
  id: string
  userId: string
  entityId: string
  entityName: string
  entityType: string
  entityImg?: string
  auraScore: number
}

export interface LobbyInfo {
  id: string
  name: string
  mode: GameMode
  state: 'waiting' | 'playing' | 'finished'
  players: LobbyPlayer[]
  maxPlayers: number
  teamCount: number
  teams: { entityId: string; entityName: string; entityType: string; entityImg?: string; auraScore: number }[]
  createdAt: number
  hostId: string
}

// WS messages client → server
export type ClientMessage =
  | { type: 'input'; data: PlayerInput }
  | { type: 'upgrade_stat'; index: number }
  | { type: 'select_class'; classId: string }
  | { type: 'toggle_autofire' }
  | { type: 'respawn' }

// WS messages server → client
export type ServerMessage =
  | { type: 'snapshot'; data: GameSnapshot; you: number } // you = your tank id
  | { type: 'lobby_update'; lobby: LobbyInfo }
  | { type: 'game_start' }
  | { type: 'game_over'; winningTeam: number }
  | { type: 'error'; message: string }
  | { type: 'joined'; lobbyId: string; playerId: string }
  | { type: 'aura_change'; entityId: string; entityType: string; delta: number }
