import type { V2, Tank, Shape, Bullet, Particle, TeamBase, GameState, GameMode, TankClass, BarrelDef, GameSnapshot } from './types.js'

// ============================================================================
// CONSTANTS
// ============================================================================

export const WORLD = 4000
const GRID = 24
const BASE_R = 30
const MAX_SHAPES = 200
const STAT_MAX = 7
const MAX_LEVEL = 45
const BASE_RADIUS = 120
const BASE_HP = 5000
const MAX_BOTS_PER_SERVER = 4
const MAX_BOTS_PER_TEAM = 2

const C = {
  player: '#00B2E1', playerOl: '#0085A8',
  sq: '#FFE869', sqOl: '#B5A642',
  tri: '#FC7677', triOl: '#B04E4F',
  pent: '#768DFC', pentOl: '#535F9E',
  crash: '#F177DD', crashOl: '#B05AA0',
}

export const TEAM_COLORS = [
  { f: '#00B2E1', o: '#0085A8', name: 'Blue' },
  { f: '#F14E54', o: '#B03A3E', name: 'Red' },
  { f: '#00E16E', o: '#00A34F', name: 'Green' },
  { f: '#BF7FF5', o: '#8C5DB5', name: 'Purple' },
]

const AI_COLORS = [
  { f: '#F14E54', o: '#B03A3E' }, { f: '#00E16E', o: '#00A34F' },
  { f: '#BF7FF5', o: '#8C5DB5' }, { f: '#FCC376', o: '#C49B5C' },
  { f: '#FF6B6B', o: '#CC5555' }, { f: '#6BFFB8', o: '#55CC93' },
  { f: '#FF6BFF', o: '#CC55CC' }, { f: '#FFB86B', o: '#CC9355' },
]

const STAT_BASE = [0, 50, 3, 300, 5, 7, 400, 150]
const STAT_GAIN = [4, 15, 3, 42, 2, 3, -40, 17]

const AI_NAMES = [
  'noscope360', 'xX_pro_Xx', 'AuraKing', 'ShapeSlayer', 'BulletStorm',
  'TankGod', 'RektU', 'GGnoRE', 'EZclap', 'tryhard',
  'Bot_5000', 'unnamed', 'DESTROY3R', 'sn1per', 'rush_B',
  'clutchKing', 'aim_bot', 'n00bMaster', 'QwErTy', 'yolo',
]

function statVal(idx: number, pts: number) { return STAT_BASE[idx] + STAT_GAIN[idx] * pts }

// ============================================================================
// TANK CLASSES
// ============================================================================

export const TC: Record<string, TankClass> = {
  basic: { id: 'basic', name: 'Tank', tier: 0,
    barrels: [{ angle: 0, width: 0.84, length: 2.4 }] },
  twin: { id: 'twin', name: 'Twin', tier: 1, upgradesFrom: ['basic'], recoil: 0.7,
    barrels: [
      { angle: 0, width: 0.6, length: 2.4, offset: 0.5 },
      { angle: 0, width: 0.6, length: 2.4, offset: -0.5 },
    ] },
  sniper: { id: 'sniper', name: 'Sniper', tier: 1, upgradesFrom: ['basic'], fov: 1.25,
    barrels: [{ angle: 0, width: 0.65, length: 3.2, bulletSpeedMul: 1.5, reloadMul: 1.6, bulletDamageMul: 1.4 }] },
  machineGun: { id: 'machineGun', name: 'Machine Gun', tier: 1, upgradesFrom: ['basic'],
    barrels: [{ angle: 0, width: 0.6, length: 2.4, widthEnd: 1.1, reloadMul: 0.55, bulletDamageMul: 0.65 }] },
  flankGuard: { id: 'flankGuard', name: 'Flank Guard', tier: 1, upgradesFrom: ['basic'],
    barrels: [
      { angle: 0, width: 0.84, length: 2.4 },
      { angle: Math.PI, width: 0.65, length: 2.0 },
    ] },
  tripleShot: { id: 'tripleShot', name: 'Triple Shot', tier: 2, upgradesFrom: ['twin'],
    barrels: [
      { angle: -0.45, width: 0.65, length: 2.2 },
      { angle: 0, width: 0.65, length: 2.5 },
      { angle: 0.45, width: 0.65, length: 2.2 },
    ] },
  quadTank: { id: 'quadTank', name: 'Quad Tank', tier: 2, upgradesFrom: ['twin', 'flankGuard'],
    barrels: [
      { angle: 0, width: 0.72, length: 2.2 },
      { angle: Math.PI / 2, width: 0.72, length: 2.2 },
      { angle: Math.PI, width: 0.72, length: 2.2 },
      { angle: -Math.PI / 2, width: 0.72, length: 2.2 },
    ] },
  assassin: { id: 'assassin', name: 'Assassin', tier: 2, upgradesFrom: ['sniper'], fov: 1.45,
    barrels: [{ angle: 0, width: 0.6, length: 3.8, bulletSpeedMul: 1.8, reloadMul: 2.0, bulletDamageMul: 1.7 }] },
  destroyer: { id: 'destroyer', name: 'Destroyer', tier: 2, upgradesFrom: ['machineGun'], recoil: 2.5,
    barrels: [{ angle: 0, width: 1.1, length: 2.4, reloadMul: 3.0, bulletDamageMul: 3.0, bulletSizeMul: 2.0, bulletSpeedMul: 0.8 }] },
  sprayer: { id: 'sprayer', name: 'Sprayer', tier: 2, upgradesFrom: ['machineGun'],
    barrels: [
      { angle: 0, width: 0.72, length: 2.2, reloadMul: 0.5, bulletDamageMul: 0.6 },
      { angle: 0, width: 0.42, length: 2.8, reloadMul: 0.5, bulletDamageMul: 0.4, bulletSizeMul: 0.7 },
    ] },
  triAngle: { id: 'triAngle', name: 'Tri-Angle', tier: 2, upgradesFrom: ['flankGuard'], recoil: 0.4,
    barrels: [
      { angle: 0, width: 0.84, length: 2.4 },
      { angle: 2.6, width: 0.55, length: 1.9 },
      { angle: -2.6, width: 0.55, length: 1.9 },
    ] },
  octoTank: { id: 'octoTank', name: 'Octo Tank', tier: 3, upgradesFrom: ['quadTank'],
    barrels: Array.from({ length: 8 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 8, width: 0.65, length: 2.1,
      reloadMul: 0.8, bulletDamageMul: 0.6,
    })) },
  pentaShot: { id: 'pentaShot', name: 'Penta Shot', tier: 3, upgradesFrom: ['tripleShot'],
    barrels: [
      { angle: -0.7, width: 0.55, length: 2.0 },
      { angle: -0.35, width: 0.55, length: 2.3 },
      { angle: 0, width: 0.55, length: 2.5 },
      { angle: 0.35, width: 0.55, length: 2.3 },
      { angle: 0.7, width: 0.55, length: 2.0 },
    ] },
  annihilator: { id: 'annihilator', name: 'Annihilator', tier: 3, upgradesFrom: ['destroyer'], recoil: 3.5,
    barrels: [{ angle: 0, width: 1.3, length: 2.6, reloadMul: 4.0, bulletDamageMul: 5.0, bulletSizeMul: 2.5, bulletSpeedMul: 0.7 }] },
  booster: { id: 'booster', name: 'Booster', tier: 3, upgradesFrom: ['triAngle'], recoil: 0.3,
    barrels: [
      { angle: 0, width: 0.72, length: 2.4 },
      { angle: 2.4, width: 0.48, length: 1.8 },
      { angle: Math.PI, width: 0.48, length: 1.8, offset: 0.42 },
      { angle: Math.PI, width: 0.48, length: 1.8, offset: -0.42 },
      { angle: -2.4, width: 0.48, length: 1.8 },
    ] },
}

// ============================================================================
// HELPERS
// ============================================================================

let _nid = 0
function nid() { return ++_nid }
function vdist(a: V2, b: V2) { return Math.hypot(a.x - b.x, a.y - b.y) }
function vangle(a: V2, b: V2) { return Math.atan2(b.y - a.y, b.x - a.x) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo) }
function xpFor(level: number) { return level <= 1 ? 5 : Math.floor(10 * level * level + 20 * level) }
function tankR(t: Tank) { return BASE_R * (1 + (t.level - 1) * 0.008) }
function getUpgrades(classId: string) { return Object.values(TC).filter(c => c.upgradesFrom?.includes(classId)) }
function randomName() { return '[BOT] ' + AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] }

export function getBasePositions(teamCount: number): V2[] {
  if (teamCount === 2) return [{ x: 800, y: WORLD / 2 }, { x: WORLD - 800, y: WORLD / 2 }]
  if (teamCount === 3) return [{ x: WORLD / 2, y: 700 }, { x: 700, y: WORLD - 700 }, { x: WORLD - 700, y: WORLD - 700 }]
  return [{ x: 800, y: 800 }, { x: WORLD - 800, y: 800 }, { x: 800, y: WORLD - 800 }, { x: WORLD - 800, y: WORLD - 800 }]
}

// ============================================================================
// FACTORIES
// ============================================================================

function mkShape(): Shape {
  const r = Math.random()
  const x = rand(100, WORLD - 100), y = rand(100, WORLD - 100)
  const dc = Math.hypot(x - WORLD / 2, y - WORLD / 2)
  if (dc < 400 && Math.random() < 0.015)
    return { id: nid(), x, y, vx: 0, vy: 0, type: 'alpha', radius: 90, hp: 3000, maxHp: 3000, xp: 3000, rot: rand(0, 6.28), rotSpd: rand(-0.008, 0.008), flash: 0, sides: 5, fill: C.pent, ol: C.pentOl, bodyDmg: 20 }
  if (r < 0.55)
    return { id: nid(), x, y, vx: 0, vy: 0, type: 'sq', radius: 14, hp: 10, maxHp: 10, xp: 10, rot: rand(0, 6.28), rotSpd: rand(-0.02, 0.02), flash: 0, sides: 4, fill: C.sq, ol: C.sqOl, bodyDmg: 3 }
  if (r < 0.8)
    return { id: nid(), x, y, vx: 0, vy: 0, type: 'tri', radius: 22, hp: 30, maxHp: 30, xp: 25, rot: rand(0, 6.28), rotSpd: rand(-0.015, 0.015), flash: 0, sides: 3, fill: C.tri, ol: C.triOl, bodyDmg: 5 }
  if (r < 0.95)
    return { id: nid(), x, y, vx: 0, vy: 0, type: 'pent', radius: 38, hp: 100, maxHp: 100, xp: 130, rot: rand(0, 6.28), rotSpd: rand(-0.01, 0.01), flash: 0, sides: 5, fill: C.pent, ol: C.pentOl, bodyDmg: 8 }
  return { id: nid(), x, y, vx: 0, vy: 0, type: 'crash', radius: 16, hp: 15, maxHp: 15, xp: 25, rot: rand(0, 6.28), rotSpd: rand(-0.03, 0.03), flash: 0, sides: 3, fill: C.crash, ol: C.crashOl, bodyDmg: 8 }
}

export function mkTank(x: number, y: number, name: string, isPlayer: boolean, color?: { f: string; o: string }, team = -1): Tank {
  const c = color || { f: C.player, o: C.playerOl }
  return {
    id: nid(), x, y, vx: 0, vy: 0, angle: 0, radius: BASE_R,
    hp: 50, maxHp: 50, level: 1, xp: 0, xpNext: xpFor(2), score: 0,
    stats: [0, 0, 0, 0, 0, 0, 0, 0], statPts: 0, classId: 'basic',
    fill: c.f, ol: c.o, flash: 0, reloads: [0], alive: true, name,
    isPlayer, recoils: [0], bodyDmg: 3, regenTimer: 0,
    aiTgtX: x, aiTgtY: y, aiTimer: 0, aiShoot: 0, team,
  }
}

function mkBase(team: number, x: number, y: number, entityName: string, entityId: string, entityType: string, entityImg?: string): TeamBase {
  return {
    id: nid(), x, y,
    hp: BASE_HP, maxHp: BASE_HP,
    radius: BASE_RADIUS, rot: 0, rotSpd: 0.15,
    team, flash: 0,
    entityName, entityId, entityType,
    entityImg, destroyed: false,
  }
}

// ============================================================================
// GAME LOGIC
// ============================================================================

function checkLevelUp(tank: Tank) {
  while (tank.xp >= tank.xpNext && tank.level < MAX_LEVEL) {
    tank.xp -= tank.xpNext
    tank.level++
    tank.xpNext = xpFor(tank.level + 1)
    if (tank.statPts + tank.stats.reduce((a, b) => a + b, 0) < 33) tank.statPts++
    tank.maxHp = statVal(1, tank.stats[1])
    tank.hp = tank.maxHp
  }
}

function levelUpAI(tank: Tank, targetLevel: number) {
  while (tank.level < targetLevel) {
    tank.xp = tank.xpNext
    checkLevelUp(tank)
  }
  tank.xp = 0
  tank.score = Math.floor(targetLevel * targetLevel * 5)
  while (tank.statPts > 0) {
    const idx = Math.floor(Math.random() * 8)
    if (tank.stats[idx] < STAT_MAX) { tank.stats[idx]++; tank.statPts-- }
  }
  tank.maxHp = statVal(1, tank.stats[1])
  tank.hp = tank.maxHp
  const tier = targetLevel >= 45 ? 3 : targetLevel >= 30 ? 2 : targetLevel >= 15 ? 1 : 0
  let classId = 'basic'
  for (let t = 1; t <= tier; t++) {
    const ups = getUpgrades(classId)
    if (ups.length > 0) classId = ups[Math.floor(Math.random() * ups.length)].id
  }
  tank.classId = classId
  const tc = TC[tank.classId]
  tank.reloads = tc.barrels.map(() => rand(0, 200))
  tank.recoils = tc.barrels.map(() => 0)
}

function spawnDeathParticles(gs: GameState, x: number, y: number, color: string, size: number) {
  const count = Math.min(12, Math.max(4, Math.floor(size / 5)))
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2), spd = rand(50, 200)
    gs.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      r: rand(2, Math.min(8, size * 0.2)), fill: color, alpha: 1, life: rand(0.3, 0.8), maxLife: 0.8 })
  }
}

function tryShoot(gs: GameState, tank: Tank) {
  const tc = TC[tank.classId] || TC.basic
  const baseReload = Math.max(50, statVal(6, tank.stats[6]))
  for (let i = 0; i < tc.barrels.length; i++) {
    if (tank.reloads[i] > 0) continue
    const b = tc.barrels[i]
    tank.reloads[i] = Math.max(50, baseReload * (b.reloadMul || 1))
    const r = tankR(tank)
    const bAngle = tank.angle + b.angle
    const off = (b.offset || 0) * r
    const perpX = -Math.sin(bAngle) * off
    const perpY = Math.cos(bAngle) * off
    const spawnDist = r * b.length * 0.95
    const bx = tank.x + Math.cos(bAngle) * spawnDist + perpX
    const by = tank.y + Math.sin(bAngle) * spawnDist + perpY
    const bSpeed = statVal(3, tank.stats[3]) * (b.bulletSpeedMul || 1)
    const bDmg = statVal(5, tank.stats[5]) * (b.bulletDamageMul || 1)
    const bPen = statVal(4, tank.stats[4])
    const bSize = 10 * (b.bulletSizeMul || 1)
    let fireAngle = bAngle
    if (b.widthEnd) fireAngle += rand(-0.15, 0.15)
    gs.bullets.push({
      id: nid(), x: bx, y: by,
      vx: Math.cos(fireAngle) * bSpeed + tank.vx * 0.15,
      vy: Math.sin(fireAngle) * bSpeed + tank.vy * 0.15,
      radius: bSize, hp: bPen, dmg: bDmg, owner: tank.id, team: tank.team,
      fill: tank.fill, ol: tank.ol, age: 0, maxAge: 2,
    })
    tank.recoils[i] = 8
    const recoilForce = (tc.recoil || 1) * 15
    tank.vx -= Math.cos(bAngle) * recoilForce
    tank.vy -= Math.sin(bAngle) * recoilForce
  }
}

export interface KillEvent {
  killerTankId: number
  victimTankId: number
  victimIsPlayer: boolean
  killerIsPlayer: boolean
}

export interface BaseDestroyEvent {
  team: number
  entityId: string
  entityType: string
  entityName: string
}

function killTank(gs: GameState, t: Tank, killerName: string, events: { kills: KillEvent[], baseDestroys: BaseDestroyEvent[] }) {
  t.alive = false
  spawnDeathParticles(gs, t.x, t.y, t.fill, tankR(t))
}

function checkCollisions(gs: GameState, events: { kills: KillEvent[], baseDestroys: BaseDestroyEvent[] }) {
  const allTanks = gs.tanks
  const isBattle = gs.mode === 'battle'

  // Bullets vs shapes
  for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
    const b = gs.bullets[bi]
    for (let si = gs.shapes.length - 1; si >= 0; si--) {
      const s = gs.shapes[si]
      if (vdist(b, s) < b.radius + s.radius) {
        s.hp -= b.dmg; s.flash = 0.1
        const pushF = 2 / Math.max(1, s.radius * 0.1)
        s.vx += (s.x - b.x) * pushF; s.vy += (s.y - b.y) * pushF
        b.hp -= 1
        if (s.hp <= 0) {
          const owner = allTanks.find(t => t.id === b.owner)
          if (owner && owner.alive) { owner.xp += s.xp; owner.score += s.xp; checkLevelUp(owner) }
          spawnDeathParticles(gs, s.x, s.y, s.fill, s.radius)
          gs.shapes.splice(si, 1)
        }
        if (b.hp <= 0) { gs.bullets.splice(bi, 1); break }
      }
    }
  }

  // Bullets vs bases
  if (isBattle) {
    for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
      const b = gs.bullets[bi]
      for (const base of gs.bases) {
        if (base.destroyed || b.team === base.team) continue
        if (vdist(b, base) < b.radius + base.radius) {
          base.hp -= b.dmg; base.flash = 0.15
          b.hp -= 1
          if (base.hp <= 0 && !base.destroyed) {
            base.destroyed = true
            spawnDeathParticles(gs, base.x, base.y, TEAM_COLORS[base.team].f, base.radius)
            gs.baseDestroyedMsg = `${base.entityName}'s base destroyed! -100 Aura`
            gs.baseDestroyedTimer = 3
            events.baseDestroys.push({ team: base.team, entityId: base.entityId, entityType: base.entityType, entityName: base.entityName })
            for (const t of allTanks) {
              if (t.team === base.team && t.alive) killTank(gs, t, 'Base Destroyed', events)
            }
            const remaining = gs.bases.filter(b2 => !b2.destroyed)
            if (remaining.length <= 1) {
              gs.battleOver = true
              gs.winningTeam = remaining.length === 1 ? remaining[0].team : -1
            }
          }
          if (b.hp <= 0) { gs.bullets.splice(bi, 1); break }
        }
      }
    }
  }

  // Bullets vs tanks
  for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
    const b = gs.bullets[bi]
    for (const t of allTanks) {
      if (!t.alive || t.id === b.owner) continue
      if (isBattle && b.team === t.team && b.team >= 0) continue
      const r = tankR(t)
      if (vdist(b, t) < b.radius + r) {
        t.hp -= b.dmg; t.flash = 0.1; t.regenTimer = 0
        const push = 3 / Math.max(1, r * 0.05)
        t.vx += (t.x - b.x) * push; t.vy += (t.y - b.y) * push
        b.hp -= 1
        if (t.hp <= 0 && t.alive) {
          const owner = allTanks.find(o => o.id === b.owner)
          const xpGain = Math.floor(t.score * 0.3 + t.level * 20)
          if (owner && owner.alive) { owner.xp += xpGain; owner.score += xpGain; checkLevelUp(owner) }
          events.kills.push({
            killerTankId: owner?.id || -1,
            victimTankId: t.id,
            victimIsPlayer: !!t.playerId,
            killerIsPlayer: !!owner?.playerId,
          })
          killTank(gs, t, owner?.name || 'Unknown', events)
        }
        if (b.hp <= 0) { gs.bullets.splice(bi, 1); break }
      }
    }
  }

  // Tanks vs shapes
  for (const t of allTanks) {
    if (!t.alive) continue
    const tr = tankR(t)
    for (let si = gs.shapes.length - 1; si >= 0; si--) {
      const s = gs.shapes[si]
      const d = vdist(t, s)
      if (d < tr + s.radius && d > 0) {
        const overlap = tr + s.radius - d
        const nx = (t.x - s.x) / d, ny = (t.y - s.y) / d
        t.x += nx * overlap * 0.6; t.y += ny * overlap * 0.6
        s.x -= nx * overlap * 0.4; s.y -= ny * overlap * 0.4
        const tbd = statVal(2, t.stats[2])
        s.hp -= tbd * 0.5; t.hp -= s.bodyDmg * 0.3
        t.regenTimer = 0; s.flash = 0.05; t.flash = 0.05
        if (s.hp <= 0) {
          t.xp += s.xp; t.score += s.xp; checkLevelUp(t)
          spawnDeathParticles(gs, s.x, s.y, s.fill, s.radius)
          gs.shapes.splice(si, 1)
        }
        if (t.hp <= 0 && t.alive) killTank(gs, t, s.type, events)
      }
    }
  }

  // Tanks vs bases
  if (isBattle) {
    for (const t of allTanks) {
      if (!t.alive) continue
      const tr = tankR(t)
      for (const base of gs.bases) {
        if (base.destroyed || t.team === base.team) continue
        const d = vdist(t, base)
        if (d < tr + base.radius && d > 0) {
          const overlap = tr + base.radius - d
          const nx = (t.x - base.x) / d, ny = (t.y - base.y) / d
          t.x += nx * overlap; t.y += ny * overlap
          const tbd = statVal(2, t.stats[2])
          base.hp -= tbd * 0.3; base.flash = 0.05
          t.hp -= 15 * 0.3; t.regenTimer = 0; t.flash = 0.05
          if (base.hp <= 0 && !base.destroyed) {
            base.destroyed = true
            spawnDeathParticles(gs, base.x, base.y, TEAM_COLORS[base.team].f, base.radius)
            gs.baseDestroyedMsg = `${base.entityName}'s base destroyed! -100 Aura`
            gs.baseDestroyedTimer = 3
            events.baseDestroys.push({ team: base.team, entityId: base.entityId, entityType: base.entityType, entityName: base.entityName })
            for (const t2 of allTanks) {
              if (t2.team === base.team && t2.alive) killTank(gs, t2, 'Base Destroyed', events)
            }
            const remaining = gs.bases.filter(b2 => !b2.destroyed)
            if (remaining.length <= 1) {
              gs.battleOver = true
              gs.winningTeam = remaining.length === 1 ? remaining[0].team : -1
            }
          }
          if (t.hp <= 0 && t.alive) killTank(gs, t, 'Base', events)
        }
      }
    }
  }

  // Tank vs tank
  for (let i = 0; i < allTanks.length; i++) {
    for (let j = i + 1; j < allTanks.length; j++) {
      const a = allTanks[i], b2 = allTanks[j]
      if (!a.alive || !b2.alive) continue
      if (isBattle && a.team === b2.team && a.team >= 0) {
        const ar = tankR(a), br = tankR(b2)
        const d = vdist(a, b2)
        if (d < ar + br && d > 0) {
          const overlap = ar + br - d
          const nx = (a.x - b2.x) / d, ny = (a.y - b2.y) / d
          a.x += nx * overlap * 0.5; a.y += ny * overlap * 0.5
          b2.x -= nx * overlap * 0.5; b2.y -= ny * overlap * 0.5
        }
        continue
      }
      const ar = tankR(a), br = tankR(b2)
      const d = vdist(a, b2)
      if (d < ar + br && d > 0) {
        const overlap = ar + br - d
        const nx = (a.x - b2.x) / d, ny = (a.y - b2.y) / d
        a.x += nx * overlap * 0.5; a.y += ny * overlap * 0.5
        b2.x -= nx * overlap * 0.5; b2.y -= ny * overlap * 0.5
        const aDmg = statVal(2, a.stats[2]) * 0.3
        const bDmg = statVal(2, b2.stats[2]) * 0.3
        a.hp -= bDmg; b2.hp -= aDmg
        a.regenTimer = 0; b2.regenTimer = 0
        a.flash = 0.05; b2.flash = 0.05
        if (a.hp <= 0 && a.alive) {
          events.kills.push({ killerTankId: b2.id, victimTankId: a.id, victimIsPlayer: !!a.playerId, killerIsPlayer: !!b2.playerId })
          killTank(gs, a, b2.name, events)
        }
        if (b2.hp <= 0 && b2.alive) {
          events.kills.push({ killerTankId: a.id, victimTankId: b2.id, victimIsPlayer: !!b2.playerId, killerIsPlayer: !!a.playerId })
          killTank(gs, b2, a.name, events)
        }
      }
    }
  }
}

function updateAI(gs: GameState, ai: Tank, dt: number) {
  if (!ai.alive) return
  ai.aiTimer -= dt
  const isBattle = gs.mode === 'battle'

  let target: V2 | null = null
  let targetDist = 800

  // Target enemy players/tanks
  for (const t of gs.tanks) {
    if (!t.alive || t.id === ai.id) continue
    if (isBattle && t.team === ai.team) continue
    const d = vdist(ai, t)
    if (d < targetDist) { target = t; targetDist = d }
  }

  // Target enemy bases
  if (isBattle && !target) {
    for (const base of gs.bases) {
      if (base.destroyed || base.team === ai.team) continue
      const d = vdist(ai, base)
      if (d < 1200 && d < targetDist) { target = base; targetDist = d }
    }
  }

  // Shapes
  if (!target) {
    for (const s of gs.shapes) {
      const d = vdist(ai, s)
      if (d < 400 && d < targetDist) { target = s; targetDist = d }
    }
  }

  if (ai.aiTimer <= 0) {
    if (isBattle && ai.team >= 0) {
      const ownBase = gs.bases.find(b => b.team === ai.team && !b.destroyed)
      if (ownBase) {
        ai.aiTgtX = ownBase.x + rand(-600, 600)
        ai.aiTgtY = ownBase.y + rand(-600, 600)
      } else {
        ai.aiTgtX = rand(200, WORLD - 200)
        ai.aiTgtY = rand(200, WORLD - 200)
      }
    } else {
      ai.aiTgtX = rand(200, WORLD - 200)
      ai.aiTgtY = rand(200, WORLD - 200)
    }
    ai.aiTimer = rand(3, 8)
  }

  const moveTarget = target || { x: ai.aiTgtX, y: ai.aiTgtY }
  const maxSpeed = statVal(7, ai.stats[7])
  const a = vangle(ai, moveTarget)
  const smooth = 1 - Math.pow(0.0001, dt)
  const dvx = Math.cos(a) * maxSpeed, dvy = Math.sin(a) * maxSpeed
  ai.vx = ai.vx + (dvx - ai.vx) * smooth
  ai.vy = ai.vy + (dvy - ai.vy) * smooth
  ai.x += ai.vx * dt; ai.y += ai.vy * dt
  const r = tankR(ai)
  ai.x = clamp(ai.x, r, WORLD - r); ai.y = clamp(ai.y, r, WORLD - r)

  if (target) {
    ai.angle = vangle(ai, target)
    tryShoot(gs, ai)
  } else {
    if (Math.hypot(ai.vx, ai.vy) > 5) ai.angle = Math.atan2(ai.vy, ai.vx)
  }
}

// ============================================================================
// GAME INSTANCE
// ============================================================================

export interface GameConfig {
  mode: GameMode
  teamCount: number
  teams: { entityId: string; entityName: string; entityType: string; entityImg?: string; auraScore: number }[]
}

export class GameInstance {
  gs: GameState
  playerInputs: Map<string, { tankId: number; input: import('./types.js').PlayerInput; autoFire: boolean }> = new Map()
  config: GameConfig
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private lastTick = Date.now()
  onSnapshot?: (snapshot: GameSnapshot) => void
  onKill?: (event: KillEvent) => void
  onBaseDestroy?: (event: BaseDestroyEvent) => void
  onGameOver?: (winningTeam: number) => void

  constructor(config: GameConfig) {
    _nid = 0
    this.config = config
    this.gs = {
      tanks: [],
      shapes: [],
      bullets: [],
      particles: [],
      bases: [],
      mode: config.mode,
      teamCount: config.teamCount,
      battleOver: false,
      winningTeam: -1,
      baseDestroyedMsg: '',
      baseDestroyedTimer: 0,
    }

    // Spawn shapes
    for (let i = 0; i < MAX_SHAPES; i++) this.gs.shapes.push(mkShape())

    // Create bases for battle mode
    if (config.mode === 'battle') {
      const positions = getBasePositions(config.teamCount)
      for (let t = 0; t < config.teamCount; t++) {
        const team = config.teams[t]
        const pos = positions[t]
        this.gs.bases.push(mkBase(t, pos.x, pos.y, team?.entityName || `Team ${t + 1}`, team?.entityId || '', team?.entityType || 'player', team?.entityImg))
      }
    }
  }

  addPlayer(playerId: string, name: string, team: number, profileImg?: string): number {
    const color = this.gs.mode === 'battle' ? TEAM_COLORS[team] : { f: C.player, o: C.playerOl }
    let spawnX = rand(200, WORLD - 200), spawnY = rand(200, WORLD - 200)

    if (this.gs.mode === 'battle') {
      const base = this.gs.bases.find(b => b.team === team && !b.destroyed)
      if (base) {
        spawnX = clamp(base.x + rand(-200, 200), 100, WORLD - 100)
        spawnY = clamp(base.y + rand(-200, 200), 100, WORLD - 100)
      }
      // Remove a bot from this team to make room
      const bots = this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot && t.team === team && t.alive)
      if (bots.length > 0) {
        const removedBot = bots[0]
        removedBot.alive = false
        this.gs.tanks = this.gs.tanks.filter(t => t.id !== removedBot.id)
      }
    } else {
      // FFA: remove a random bot
      const bots = this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot && t.alive)
      if (bots.length > 0) {
        const removedBot = bots[0]
        removedBot.alive = false
        this.gs.tanks = this.gs.tanks.filter(t => t.id !== removedBot.id)
      }
    }

    const tank = mkTank(spawnX, spawnY, name, true, color, team)
    tank.playerId = playerId
    this.gs.tanks.push(tank)
    this.playerInputs.set(playerId, { tankId: tank.id, input: { keys: [], mouseX: 0, mouseY: 0, mouseDown: false, viewW: 1200, viewH: 800 }, autoFire: false })
    return tank.id
  }

  removePlayer(playerId: string) {
    const info = this.playerInputs.get(playerId)
    if (info) {
      const tank = this.gs.tanks.find(t => t.id === info.tankId)
      if (tank) {
        tank.alive = false
        this.gs.tanks = this.gs.tanks.filter(t => t.id !== info.tankId)
      }
      this.playerInputs.delete(playerId)
    }
    // Backfill with a bot
    this.fillBots()
  }

  deployPersonalBot(name: string, team: number, entityImg?: string): number {
    const color = this.gs.mode === 'battle' ? TEAM_COLORS[team] : AI_COLORS[Math.floor(Math.random() * AI_COLORS.length)]
    const base = this.gs.bases.find(b => b.team === team && !b.destroyed)
    const sx = base ? clamp(base.x + rand(-300, 300), 100, WORLD - 100) : rand(100, WORLD - 100)
    const sy = base ? clamp(base.y + rand(-300, 300), 100, WORLD - 100) : rand(100, WORLD - 100)
    const tank = mkTank(sx, sy, name, false, color, team)
    tank.isPersonalBot = true
    // Enhanced stats for personal bots: start at level 20 with better stats
    levelUpAI(tank, 25)
    // Boost stats further
    for (let i = 0; i < 8; i++) {
      tank.stats[i] = Math.min(STAT_MAX, tank.stats[i] + 1)
    }
    tank.maxHp = statVal(1, tank.stats[1])
    tank.hp = tank.maxHp
    this.gs.tanks.push(tank)
    return tank.id
  }

  fillBots() {
    const totalBots = this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot).length
    if (totalBots >= MAX_BOTS_PER_SERVER) return

    if (this.gs.mode === 'battle') {
      for (let team = 0; team < this.config.teamCount; team++) {
        const base = this.gs.bases.find(b => b.team === team && !b.destroyed)
        if (!base) continue
        const teamBots = this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot && t.team === team && t.alive)
        const teamPlayers = this.gs.tanks.filter(t => t.playerId && t.team === team)
        const wantBots = Math.max(0, MAX_BOTS_PER_TEAM - teamPlayers.length)
        while (teamBots.length < wantBots && this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot).length < MAX_BOTS_PER_SERVER) {
          const tc = TEAM_COLORS[team]
          const sx = clamp(base.x + rand(-400, 400), 100, WORLD - 100)
          const sy = clamp(base.y + rand(-400, 400), 100, WORLD - 100)
          const ai = mkTank(sx, sy, randomName(), false, tc, team)
          levelUpAI(ai, Math.floor(rand(5, 20)))
          this.gs.tanks.push(ai)
          teamBots.push(ai)
        }
      }
    } else {
      // FFA: fill to MAX_BOTS_PER_SERVER
      let bots = this.gs.tanks.filter(t => !t.playerId && !t.isPersonalBot && t.alive)
      while (bots.length < MAX_BOTS_PER_SERVER) {
        const color = AI_COLORS[Math.floor(Math.random() * AI_COLORS.length)]
        const ai = mkTank(rand(100, WORLD - 100), rand(100, WORLD - 100), randomName(), false, color)
        const maxPlayerLevel = Math.max(1, ...this.gs.tanks.filter(t => t.playerId).map(t => t.level))
        levelUpAI(ai, Math.floor(rand(1, Math.min(45, maxPlayerLevel * 0.7 + 10))))
        this.gs.tanks.push(ai)
        bots.push(ai)
      }
    }
  }

  respawnPlayer(playerId: string): number | null {
    const info = this.playerInputs.get(playerId)
    if (!info) return null

    // Remove old dead tank
    this.gs.tanks = this.gs.tanks.filter(t => t.id !== info.tankId)

    const oldTank = this.gs.tanks.find(t => t.id === info.tankId)
    const team = oldTank?.team ?? -1

    let spawnX = rand(200, WORLD - 200), spawnY = rand(200, WORLD - 200)
    if (this.gs.mode === 'battle') {
      const base = this.gs.bases.find(b => b.team === team && !b.destroyed)
      if (!base) return null // can't respawn if base destroyed
      spawnX = clamp(base.x + rand(-200, 200), 100, WORLD - 100)
      spawnY = clamp(base.y + rand(-200, 200), 100, WORLD - 100)
    }

    const color = this.gs.mode === 'battle' ? TEAM_COLORS[team] : { f: C.player, o: C.playerOl }
    const name = oldTank?.name || 'Player'
    const tank = mkTank(spawnX, spawnY, name, true, color, team)
    tank.playerId = playerId
    this.gs.tanks.push(tank)
    info.tankId = tank.id
    return tank.id
  }

  start() {
    this.fillBots()
    this.lastTick = Date.now()
    // 30 ticks per second
    this.tickInterval = setInterval(() => this.tick(), 1000 / 30)
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }

  tick() {
    const now = Date.now()
    const dt = Math.min((now - this.lastTick) / 1000, 0.05)
    this.lastTick = now

    if (this.gs.battleOver) return

    const events = { kills: [] as KillEvent[], baseDestroys: [] as BaseDestroyEvent[] }

    // Apply player inputs
    for (const [playerId, info] of this.playerInputs) {
      const tank = this.gs.tanks.find(t => t.id === info.tankId)
      if (!tank || !tank.alive) continue

      const inp = info.input
      const maxSpeed = statVal(7, tank.stats[7])
      let ax = 0, ay = 0
      if (inp.keys.includes('w') || inp.keys.includes('arrowup')) ay -= 1
      if (inp.keys.includes('s') || inp.keys.includes('arrowdown')) ay += 1
      if (inp.keys.includes('a') || inp.keys.includes('arrowleft')) ax -= 1
      if (inp.keys.includes('d') || inp.keys.includes('arrowright')) ax += 1
      if (ax !== 0 && ay !== 0) { const l = Math.hypot(ax, ay); ax /= l; ay /= l }
      const dvx = ax * maxSpeed, dvy = ay * maxSpeed
      const smooth = 1 - Math.pow(0.0001, dt)
      tank.vx = tank.vx + (dvx - tank.vx) * smooth
      tank.vy = tank.vy + (dvy - tank.vy) * smooth
      tank.x += tank.vx * dt; tank.y += tank.vy * dt
      const r = tankR(tank)
      tank.x = clamp(tank.x, r, WORLD - r); tank.y = clamp(tank.y, r, WORLD - r)
      tank.angle = Math.atan2(inp.mouseY - inp.viewH / 2, inp.mouseX - inp.viewW / 2)
      if (inp.mouseDown || info.autoFire) tryShoot(this.gs, tank)
    }

    // Reload timers
    for (const t of this.gs.tanks) {
      for (let i = 0; i < t.reloads.length; i++) t.reloads[i] = Math.max(0, t.reloads[i] - dt * 1000)
    }

    // AI
    for (const t of this.gs.tanks) {
      if (t.playerId || !t.alive) continue
      updateAI(this.gs, t, dt)
    }

    // Bullets
    for (let i = this.gs.bullets.length - 1; i >= 0; i--) {
      const b = this.gs.bullets[i]
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt
      if (b.age > b.maxAge || b.x < -50 || b.x > WORLD + 50 || b.y < -50 || b.y > WORLD + 50) {
        this.gs.bullets.splice(i, 1)
      }
    }

    // Shapes
    for (const s of this.gs.shapes) {
      s.rot += s.rotSpd; s.vx *= Math.pow(0.05, dt); s.vy *= Math.pow(0.05, dt)
      s.x += s.vx * dt; s.y += s.vy * dt; s.flash = Math.max(0, s.flash - dt)
      s.x = clamp(s.x, s.radius, WORLD - s.radius); s.y = clamp(s.y, s.radius, WORLD - s.radius)
    }

    // Bases
    for (const base of this.gs.bases) {
      if (base.destroyed) continue
      base.rot += base.rotSpd * dt
      base.flash = Math.max(0, base.flash - dt)
    }
    if (this.gs.baseDestroyedTimer > 0) this.gs.baseDestroyedTimer -= dt

    // Collisions
    checkCollisions(this.gs, events)

    // Spawn shapes
    while (this.gs.shapes.length < MAX_SHAPES) this.gs.shapes.push(mkShape())

    // Respawn dead bots
    this.gs.tanks = this.gs.tanks.filter(t => t.alive || t.playerId || t.flash > 0)
    this.fillBots()

    // Particles
    this.gs.particles = this.gs.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt
      p.vx *= Math.pow(0.1, dt); p.vy *= Math.pow(0.1, dt)
      p.alpha = Math.max(0, p.life / p.maxLife)
      return p.life > 0
    })

    // Regen
    for (const t of this.gs.tanks) {
      if (!t.alive) continue
      t.regenTimer += dt; t.flash = Math.max(0, t.flash - dt)
      for (let i = 0; i < t.recoils.length; i++) { t.recoils[i] *= Math.pow(0.001, dt) }
      if (t.regenTimer > 4) {
        const regen = statVal(0, t.stats[0])
        t.hp = Math.min(t.maxHp, t.hp + regen * dt)
      }
    }

    // Emit events
    for (const k of events.kills) this.onKill?.(k)
    for (const b of events.baseDestroys) this.onBaseDestroy?.(b)
    if (this.gs.battleOver) this.onGameOver?.(this.gs.winningTeam)

    // Build and emit snapshot
    this.onSnapshot?.(this.buildSnapshot())
  }

  buildSnapshot(): GameSnapshot {
    return {
      tanks: this.gs.tanks.map(t => ({
        id: t.id, x: t.x, y: t.y, angle: t.angle,
        radius: tankR(t), hp: t.hp, maxHp: t.maxHp,
        level: t.level, score: t.score, classId: t.classId,
        fill: t.fill, ol: t.ol, flash: t.flash,
        alive: t.alive, name: t.name, isPlayer: t.isPlayer,
        team: t.team, recoils: [...t.recoils],
        stats: [...t.stats], statPts: t.statPts,
        xp: t.xp, xpNext: t.xpNext,
        playerId: t.playerId,
        isPersonalBot: t.isPersonalBot,
      })),
      shapes: this.gs.shapes.map(s => ({
        id: s.id, x: s.x, y: s.y, radius: s.radius,
        rot: s.rot, sides: s.sides, fill: s.fill, ol: s.ol,
        hp: s.hp, maxHp: s.maxHp, flash: s.flash, type: s.type,
      })),
      bullets: this.gs.bullets.map(b => ({
        id: b.id, x: b.x, y: b.y, radius: b.radius,
        fill: b.fill, ol: b.ol,
      })),
      particles: this.gs.particles.map(p => ({
        x: p.x, y: p.y, r: p.r, fill: p.fill, alpha: p.alpha,
      })),
      bases: this.gs.bases.map(b => ({
        id: b.id, x: b.x, y: b.y,
        hp: b.hp, maxHp: b.maxHp,
        radius: b.radius, rot: b.rot,
        team: b.team, flash: b.flash,
        entityName: b.entityName, entityId: b.entityId,
        entityType: b.entityType, entityImg: b.entityImg,
        destroyed: b.destroyed,
      })),
      mode: this.gs.mode,
      teamCount: this.gs.teamCount,
      battleOver: this.gs.battleOver,
      winningTeam: this.gs.winningTeam,
      baseDestroyedMsg: this.gs.baseDestroyedMsg,
      baseDestroyedTimer: this.gs.baseDestroyedTimer,
    }
  }

  upgradeStat(playerId: string, index: number) {
    const info = this.playerInputs.get(playerId)
    if (!info) return
    const tank = this.gs.tanks.find(t => t.id === info.tankId)
    if (!tank || tank.statPts <= 0 || tank.stats[index] >= STAT_MAX) return
    tank.stats[index]++; tank.statPts--
    tank.maxHp = statVal(1, tank.stats[1])
    tank.hp = Math.min(tank.hp, tank.maxHp)
  }

  selectClass(playerId: string, classId: string) {
    const info = this.playerInputs.get(playerId)
    if (!info) return
    const tank = this.gs.tanks.find(t => t.id === info.tankId)
    if (!tank || !TC[classId]) return
    tank.classId = classId
    const tc = TC[classId]
    tank.reloads = tc.barrels.map(() => 0)
    tank.recoils = tc.barrels.map(() => 0)
  }

  toggleAutofire(playerId: string) {
    const info = this.playerInputs.get(playerId)
    if (info) info.autoFire = !info.autoFire
  }

  getPlayerCount(): number {
    return this.playerInputs.size
  }

  getTankForPlayer(playerId: string): Tank | undefined {
    const info = this.playerInputs.get(playerId)
    if (!info) return undefined
    return this.gs.tanks.find(t => t.id === info.tankId)
  }
}
