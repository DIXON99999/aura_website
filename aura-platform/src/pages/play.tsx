import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore, useAuraStore } from '@/stores'

// ============================================================================
// CONSTANTS
// ============================================================================

const WORLD = 4000
const GRID = 24
const BASE_R = 30
const OL = 3.5
const BARREL_FILL = '#999999'
const BARREL_OL = '#727272'
const MAX_SHAPES = 200
const MAX_AI = 8
const STAT_MAX = 7
const MAX_LEVEL = 45

const C = {
  bg: '#CDCDCD', grid: '#C2C2C2',
  player: '#00B2E1', playerOl: '#0085A8',
  hpGreen: '#85E37D', hpRed: '#E85555',
  xp: '#43FF91', xpOl: '#2FA86A',
  sq: '#FFE869', sqOl: '#B5A642',
  tri: '#FC7677', triOl: '#B04E4F',
  pent: '#768DFC', pentOl: '#535F9E',
  crash: '#F177DD', crashOl: '#B05AA0',
}

const AI_COLORS = [
  { f: '#F14E54', o: '#B03A3E' }, { f: '#00E16E', o: '#00A34F' },
  { f: '#BF7FF5', o: '#8C5DB5' }, { f: '#FCC376', o: '#C49B5C' },
  { f: '#FF6B6B', o: '#CC5555' }, { f: '#6BFFB8', o: '#55CC93' },
  { f: '#FF6BFF', o: '#CC55CC' }, { f: '#FFB86B', o: '#CC9355' },
]

const STAT_COLORS = ['#F5B0CE', '#C980E3', '#9B6DCC', '#6B8DE3', '#66CCE0', '#E8EB6D', '#8AEB6D', '#EB866D']
const STAT_NAMES = ['Health Regen', 'Max Health', 'Body Damage', 'Bullet Speed', 'Bullet Penetration', 'Bullet Damage', 'Reload', 'Movement Speed']

// idx: 0=regen(hp/s), 1=maxHp, 2=bodyDmg, 3=bulletSpd(px/s), 4=bulletPen(hp), 5=bulletDmg, 6=reload(ms), 7=moveSpd(px/s)
const STAT_BASE = [0, 50, 3, 300, 5, 7, 400, 150]
const STAT_GAIN = [4, 15, 3, 42, 2, 3, -40, 17]

function statVal(idx: number, pts: number) { return STAT_BASE[idx] + STAT_GAIN[idx] * pts }

const AI_NAMES = [
  'noscope360', 'xX_pro_Xx', 'AuraKing', 'ShapeSlayer', 'BulletStorm',
  'TankGod', 'RektU', 'GGnoRE', 'EZclap', 'tryhard',
  'Bot_5000', 'unnamed', 'DESTROY3R', 'sn1per', 'rush_B',
  'clutchKing', 'aim_bot', 'n00bMaster', 'QwErTy', 'yolo',
]

// ============================================================================
// TYPES
// ============================================================================

interface V2 { x: number; y: number }

interface BarrelDef {
  angle: number; width: number; length: number
  widthEnd?: number; offset?: number
  reloadMul?: number; bulletSizeMul?: number; bulletSpeedMul?: number; bulletDamageMul?: number
}

interface TankClass {
  id: string; name: string; tier: number; barrels: BarrelDef[]
  upgradesFrom?: string[]; fov?: number; recoil?: number
}

interface Shape {
  id: number; x: number; y: number; vx: number; vy: number
  type: string; radius: number; hp: number; maxHp: number; xp: number
  rot: number; rotSpd: number; flash: number
  sides: number; fill: string; ol: string; bodyDmg: number
}

interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number
  radius: number; hp: number; dmg: number; owner: number
  fill: string; ol: string; age: number; maxAge: number
}

interface Tank {
  id: number; x: number; y: number; vx: number; vy: number
  angle: number; radius: number; hp: number; maxHp: number
  level: number; xp: number; xpNext: number; score: number
  stats: number[]; statPts: number; classId: string
  fill: string; ol: string; flash: number
  reloads: number[]; alive: boolean; name: string
  isPlayer: boolean; recoils: number[]; bodyDmg: number
  regenTimer: number; profileImg?: HTMLImageElement | null
  aiTgtX: number; aiTgtY: number; aiTimer: number; aiShoot: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; fill: string; alpha: number; life: number; maxLife: number
}

interface GS {
  player: Tank; shapes: Shape[]; bullets: Bullet[]
  ai: Tank[]; particles: Particle[]
  cam: { x: number; y: number; zoom: number }
  keys: Set<string>; mouse: { x: number; y: number; down: boolean }
  autoFire: boolean; dead: boolean
  deathScore: number; deathLevel: number; deathKiller: string
  started: boolean
}

// ============================================================================
// TANK CLASSES
// ============================================================================

const TC: Record<string, TankClass> = {
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
function randomName() { return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] }

function darken(hex: string, f = 0.7) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 0xff) * f)
  const g = Math.round(((n >> 8) & 0xff) * f)
  const b = Math.round((n & 0xff) * f)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ============================================================================
// ENTITY FACTORIES
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

function mkTank(x: number, y: number, name: string, isPlayer: boolean, color?: { f: string; o: string }): Tank {
  const c = color || { f: C.player, o: C.playerOl }
  return {
    id: nid(), x, y, vx: 0, vy: 0, angle: 0, radius: BASE_R,
    hp: 50, maxHp: 50, level: 1, xp: 0, xpNext: xpFor(2), score: 0,
    stats: [0, 0, 0, 0, 0, 0, 0, 0], statPts: 0, classId: 'basic',
    fill: c.f, ol: c.o, flash: 0, reloads: [0], alive: true, name,
    isPlayer, recoils: [0], bodyDmg: 3, regenTimer: 0,
    aiTgtX: x, aiTgtY: y, aiTimer: 0, aiShoot: 0,
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

function spawnDeathParticles(gs: GS, x: number, y: number, color: string, size: number) {
  const count = Math.min(12, Math.max(4, Math.floor(size / 5)))
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2), spd = rand(50, 200)
    gs.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      r: rand(2, Math.min(8, size * 0.2)), fill: color, alpha: 1, life: rand(0.3, 0.8), maxLife: 0.8 })
  }
}

function tryShoot(gs: GS, tank: Tank) {
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
    if (b.widthEnd) fireAngle += rand(-0.15, 0.15) // machine gun spread

    gs.bullets.push({
      id: nid(), x: bx, y: by,
      vx: Math.cos(fireAngle) * bSpeed + tank.vx * 0.15,
      vy: Math.sin(fireAngle) * bSpeed + tank.vy * 0.15,
      radius: bSize, hp: bPen, dmg: bDmg, owner: tank.id,
      fill: tank.fill, ol: tank.ol, age: 0, maxAge: 2,
    })

    tank.recoils[i] = 8
    const recoilForce = (tc.recoil || 1) * 15
    tank.vx -= Math.cos(bAngle) * recoilForce
    tank.vy -= Math.sin(bAngle) * recoilForce
  }
}

function killTank(gs: GS, t: Tank, killerName: string) {
  t.alive = false
  spawnDeathParticles(gs, t.x, t.y, t.fill, tankR(t))
  if (t.isPlayer) {
    gs.dead = true
    gs.deathScore = t.score
    gs.deathLevel = t.level
    gs.deathKiller = killerName
  }
}

function checkCollisions(gs: GS) {
  const allTanks = [gs.player, ...gs.ai]

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

  // Bullets vs tanks
  for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
    const b = gs.bullets[bi]
    for (const t of allTanks) {
      if (!t.alive || t.id === b.owner) continue
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
          killTank(gs, t, owner?.name || 'Unknown')
        }
        if (b.hp <= 0) { gs.bullets.splice(bi, 1); break }
      }
    }
  }

  // Tanks vs shapes (body collision)
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
        if (t.hp <= 0 && t.alive) killTank(gs, t, s.type)
      }
    }
  }

  // Tank vs tank
  for (let i = 0; i < allTanks.length; i++) {
    for (let j = i + 1; j < allTanks.length; j++) {
      const a = allTanks[i], b2 = allTanks[j]
      if (!a.alive || !b2.alive) continue
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
        if (a.hp <= 0 && a.alive) killTank(gs, a, b2.name)
        if (b2.hp <= 0 && b2.alive) killTank(gs, b2, a.name)
      }
    }
  }
}

function updateAI(gs: GS, ai: Tank, dt: number) {
  if (!ai.alive) return
  ai.aiTimer -= dt

  // Find target
  let target: V2 | null = null
  let targetDist = 800

  if (gs.player.alive) {
    const d = vdist(ai, gs.player)
    if (d < targetDist) { target = gs.player; targetDist = d }
  }
  for (const s of gs.shapes) {
    const d = vdist(ai, s)
    if (d < 400 && d < targetDist) { target = s; targetDist = d }
  }

  if (ai.aiTimer <= 0) {
    ai.aiTgtX = rand(200, WORLD - 200)
    ai.aiTgtY = rand(200, WORLD - 200)
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

function updateGame(gs: GS, dt: number, cw: number, ch: number) {
  if (gs.dead || !gs.started) return
  const p = gs.player

  // Reload timers
  for (const t of [p, ...gs.ai]) {
    for (let i = 0; i < t.reloads.length; i++) t.reloads[i] = Math.max(0, t.reloads[i] - dt * 1000)
  }

  // Player movement
  if (p.alive) {
    const maxSpeed = statVal(7, p.stats[7])
    let ax = 0, ay = 0
    if (gs.keys.has('w') || gs.keys.has('arrowup')) ay -= 1
    if (gs.keys.has('s') || gs.keys.has('arrowdown')) ay += 1
    if (gs.keys.has('a') || gs.keys.has('arrowleft')) ax -= 1
    if (gs.keys.has('d') || gs.keys.has('arrowright')) ax += 1
    if (ax !== 0 && ay !== 0) { const l = Math.hypot(ax, ay); ax /= l; ay /= l }
    const dvx = ax * maxSpeed, dvy = ay * maxSpeed
    const smooth = 1 - Math.pow(0.0001, dt)
    p.vx = p.vx + (dvx - p.vx) * smooth
    p.vy = p.vy + (dvy - p.vy) * smooth
    p.x += p.vx * dt; p.y += p.vy * dt
    const r = tankR(p)
    p.x = clamp(p.x, r, WORLD - r); p.y = clamp(p.y, r, WORLD - r)
    p.angle = Math.atan2(gs.mouse.y - ch / 2, gs.mouse.x - cw / 2)
    if (gs.mouse.down || gs.autoFire) tryShoot(gs, p)
  }

  // AI
  for (const ai of gs.ai) updateAI(gs, ai, dt)

  // Bullets
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i]
    b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt
    if (b.age > b.maxAge || b.x < -50 || b.x > WORLD + 50 || b.y < -50 || b.y > WORLD + 50) {
      gs.bullets.splice(i, 1)
    }
  }

  // Shapes
  for (const s of gs.shapes) {
    s.rot += s.rotSpd; s.vx *= Math.pow(0.05, dt); s.vy *= Math.pow(0.05, dt)
    s.x += s.vx * dt; s.y += s.vy * dt; s.flash = Math.max(0, s.flash - dt)
    if (s.type === 'crash' && p.alive) {
      const a = vangle(s, p)
      s.vx += Math.cos(a) * 40 * dt; s.vy += Math.sin(a) * 40 * dt
    }
    s.x = clamp(s.x, s.radius, WORLD - s.radius); s.y = clamp(s.y, s.radius, WORLD - s.radius)
  }

  // Collisions
  checkCollisions(gs)

  // Spawn shapes
  while (gs.shapes.length < MAX_SHAPES) gs.shapes.push(mkShape())

  // Spawn AI
  const aliveAI = gs.ai.filter(a => a.alive)
  while (aliveAI.length < MAX_AI) {
    const lvl = Math.min(MAX_LEVEL, Math.floor(rand(1, Math.min(45, p.level * 0.7 + 10))))
    const color = AI_COLORS[Math.floor(Math.random() * AI_COLORS.length)]
    const ai = mkTank(rand(100, WORLD - 100), rand(100, WORLD - 100), randomName(), false, color)
    levelUpAI(ai, lvl)
    gs.ai.push(ai)
    aliveAI.push(ai)
  }
  // Clean dead AI
  gs.ai = gs.ai.filter(a => a.alive || a.flash > 0)

  // Particles
  gs.particles = gs.particles.filter(p2 => {
    p2.x += p2.vx * dt; p2.y += p2.vy * dt; p2.life -= dt
    p2.vx *= Math.pow(0.1, dt); p2.vy *= Math.pow(0.1, dt)
    p2.alpha = Math.max(0, p2.life / p2.maxLife)
    return p2.life > 0
  })

  // Camera
  if (p.alive) {
    gs.cam.x += (p.x - gs.cam.x) * (1 - Math.pow(0.01, dt))
    gs.cam.y += (p.y - gs.cam.y) * (1 - Math.pow(0.01, dt))
    const fov = TC[p.classId]?.fov || 1
    const targetZoom = (1 - (p.level - 1) * 0.004) / fov
    gs.cam.zoom += (targetZoom - gs.cam.zoom) * (1 - Math.pow(0.05, dt))
  }

  // Regen
  for (const t of [p, ...gs.ai]) {
    if (!t.alive) continue
    t.regenTimer += dt; t.flash = Math.max(0, t.flash - dt)
    for (let i = 0; i < t.recoils.length; i++) { t.recoils[i] *= Math.pow(0.001, dt) }
    if (t.regenTimer > 4) {
      const regen = statVal(0, t.stats[0])
      t.hp = Math.min(t.maxHp, t.hp + regen * dt)
    }
  }
}

// ============================================================================
// DRAWING
// ============================================================================

function drawGrid(ctx: CanvasRenderingContext2D, cam: GS['cam'], cw: number, ch: number) {
  const hw = cw / (2 * cam.zoom), hh = ch / (2 * cam.zoom)
  const l = cam.x - hw, t = cam.y - hh, r = cam.x + hw, b = cam.y + hh
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath()
  for (let x = Math.floor(l / GRID) * GRID; x <= r; x += GRID) { ctx.moveTo(x, t); ctx.lineTo(x, b) }
  for (let y = Math.floor(t / GRID) * GRID; y <= b; y += GRID) { ctx.moveTo(l, y); ctx.lineTo(r, y) }
  ctx.stroke()
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot)
  ctx.beginPath()
  for (let i = 0; i < s.sides; i++) {
    const a = (i * Math.PI * 2) / s.sides - Math.PI / 2
    const px = s.radius * Math.cos(a), py = s.radius * Math.sin(a)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = s.flash > 0 ? '#FFFFFF' : s.fill; ctx.fill()
  ctx.strokeStyle = s.ol; ctx.lineWidth = OL; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
  // Health bar
  if (s.hp < s.maxHp) {
    const ratio = clamp(s.hp / s.maxHp, 0, 1), bw = s.radius * 1.8
    ctx.fillStyle = '#333'; ctx.fillRect(s.x - bw / 2, s.y + s.radius + 6, bw, 5)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed; ctx.fillRect(s.x - bw / 2, s.y + s.radius + 6, bw * ratio, 5)
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
  ctx.fillStyle = b.fill; ctx.fill()
  ctx.strokeStyle = b.ol; ctx.lineWidth = OL * 0.7; ctx.stroke()
}

function drawBarrel(ctx: CanvasRenderingContext2D, b: BarrelDef, r: number, recoil: number) {
  const w = r * b.width, l = r * b.length - recoil, off = (b.offset || 0) * r
  ctx.save(); ctx.rotate(b.angle)
  if (b.widthEnd) {
    const we = r * b.widthEnd
    ctx.beginPath(); ctx.moveTo(0, off - w / 2); ctx.lineTo(l, off - we / 2)
    ctx.lineTo(l, off + we / 2); ctx.lineTo(0, off + w / 2); ctx.closePath()
  } else {
    ctx.beginPath(); ctx.rect(0, off - w / 2, l, w)
  }
  ctx.fillStyle = BARREL_FILL; ctx.fill()
  ctx.strokeStyle = BARREL_OL; ctx.lineWidth = OL; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
}

function drawTank(ctx: CanvasRenderingContext2D, t: Tank) {
  if (!t.alive) return
  const r = tankR(t)
  const tc = TC[t.classId] || TC.basic

  ctx.save(); ctx.translate(t.x, t.y)

  // Barrels (rotated with tank angle)
  ctx.save(); ctx.rotate(t.angle)
  for (let i = 0; i < tc.barrels.length; i++) drawBarrel(ctx, tc.barrels[i], r, t.recoils[i] || 0)
  ctx.restore()

  // Body (not rotated so profile pic stays upright)
  if (t.profileImg && t.isPlayer) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(t.profileImg, -r, -r, r * 2, r * 2); ctx.restore()
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = t.ol; ctx.lineWidth = OL; ctx.stroke()
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = t.flash > 0 ? '#FFFFFF' : t.fill; ctx.fill()
    ctx.strokeStyle = t.ol; ctx.lineWidth = OL; ctx.stroke()
  }

  ctx.restore()

  // Name
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#FFF'
  ctx.strokeText(t.name, t.x, t.y - r - 8); ctx.fillText(t.name, t.x, t.y - r - 8)

  // Health bar
  if (t.hp < t.maxHp) {
    const ratio = clamp(t.hp / t.maxHp, 0, 1), bw = r * 2.2
    ctx.fillStyle = '#333'; ctx.fillRect(t.x - bw / 2, t.y + r + 5, bw, 5)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
    ctx.fillRect(t.x - bw / 2, t.y + r + 5, bw * ratio, 5)
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.alpha; ctx.fillStyle = p.fill
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, cw: number, ch: number) {
  const p = gs.player

  // XP Bar (bottom center)
  const barW = Math.min(350, cw * 0.4), barH = 25
  const bx = (cw - barW) / 2, by = ch - barH - 20
  const xpRatio = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx, by, barW, barH)
  ctx.fillStyle = C.xp; ctx.fillRect(bx, by, barW * xpRatio, barH)
  ctx.strokeStyle = C.xpOl; ctx.lineWidth = 2; ctx.strokeRect(bx, by, barW, barH)
  const cn = TC[p.classId]?.name || 'Tank'
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#FFF'
  ctx.strokeText(`Level ${p.level} ${cn}`, cw / 2, by + barH / 2)
  ctx.fillText(`Level ${p.level} ${cn}`, cw / 2, by + barH / 2)
  ctx.font = 'bold 15px sans-serif'
  ctx.strokeText(`Score: ${p.score.toLocaleString()}`, cw / 2, by - 14)
  ctx.fillText(`Score: ${p.score.toLocaleString()}`, cw / 2, by - 14)

  // Leaderboard (top right)
  const allTanks = [gs.player, ...gs.ai].filter(t => t.alive).sort((a, b) => b.score - a.score).slice(0, 10)
  const topScore = allTanks[0]?.score || 1
  const lw = 200, lx = cw - lw - 10, ly = 10, rowH = 22
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(lx, ly, lw, allTanks.length * rowH + 30)
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'
  ctx.fillText('Leaderboard', lx + lw / 2, ly + 15)
  ctx.font = '12px sans-serif'; ctx.textAlign = 'left'
  for (let i = 0; i < allTanks.length; i++) {
    const t = allTanks[i], ey = ly + 30 + i * rowH
    const bW = (lw - 40) * Math.max(0.05, t.score / topScore)
    ctx.fillStyle = t.fill; ctx.globalAlpha = t.isPlayer ? 0.5 : 0.25
    ctx.fillRect(lx + 5, ey, bW, rowH - 4); ctx.globalAlpha = 1
    ctx.fillStyle = '#FFF'
    ctx.fillText(`${i + 1}. ${t.name}`, lx + 8, ey + rowH / 2 + 3)
    ctx.textAlign = 'right'
    ctx.fillText(t.score.toLocaleString(), lx + lw - 8, ey + rowH / 2 + 3)
    ctx.textAlign = 'left'
  }

  // Minimap (bottom right)
  const sz = 140, mx = cw - sz - 10, my = ch - sz - 60, sc = sz / WORLD
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(mx, my, sz, sz)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, sz, sz)
  if (p.alive) {
    ctx.fillStyle = C.player; ctx.beginPath()
    ctx.arc(mx + p.x * sc, my + p.y * sc, 4, 0, Math.PI * 2); ctx.fill()
  }
  for (const t of gs.ai) {
    if (!t.alive) continue
    ctx.fillStyle = t.fill; ctx.beginPath()
    ctx.arc(mx + t.x * sc, my + t.y * sc, 2.5, 0, Math.PI * 2); ctx.fill()
  }

  // Auto-fire indicator
  if (gs.autoFire) {
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFD700'
    ctx.fillText('AUTO FIRE [E]', cw / 2, by - 36)
  }
}

function renderGame(ctx: CanvasRenderingContext2D, gs: GS, cw: number, ch: number) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, ch)

  // Camera transform
  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.scale(gs.cam.zoom, gs.cam.zoom)
  ctx.translate(-gs.cam.x, -gs.cam.y)

  drawGrid(ctx, gs.cam, cw, ch)

  // Arena boundary
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 5; ctx.setLineDash([])
  ctx.strokeRect(0, 0, WORLD, WORLD)

  // Render order: bullets → shapes → tanks → particles
  for (const b of gs.bullets) drawBullet(ctx, b)
  for (const s of gs.shapes) drawShape(ctx, s)
  for (const t of gs.ai) drawTank(ctx, t)
  if (gs.player.alive) drawTank(ctx, gs.player)
  for (const p of gs.particles) drawParticle(ctx, p)

  ctx.restore()

  // HUD (screen space)
  drawHUD(ctx, gs, cw, ch)
}

// ============================================================================
// TANK PREVIEW (for class upgrade panel)
// ============================================================================

function TankPreview({ classId, size }: { classId: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr; canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    const tc = TC[classId]
    if (!tc) return
    const r = size * 0.25, cx = size / 2, cy = size / 2
    ctx.clearRect(0, 0, size, size)
    ctx.save(); ctx.translate(cx, cy)
    for (const b of tc.barrels) {
      const w = r * b.width, l = r * b.length, off = (b.offset || 0) * r
      ctx.save(); ctx.rotate(b.angle)
      if (b.widthEnd) {
        const we = r * b.widthEnd
        ctx.beginPath(); ctx.moveTo(0, off - w / 2); ctx.lineTo(l, off - we / 2)
        ctx.lineTo(l, off + we / 2); ctx.lineTo(0, off + w / 2); ctx.closePath()
      } else { ctx.beginPath(); ctx.rect(0, off - w / 2, l, w) }
      ctx.fillStyle = BARREL_FILL; ctx.fill()
      ctx.strokeStyle = BARREL_OL; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()
      ctx.restore()
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = C.player; ctx.fill()
    ctx.strokeStyle = C.playerOl; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  }, [classId, size])
  return <canvas ref={ref} style={{ width: size, height: size }} />
}

// ============================================================================
// PLAY PAGE COMPONENT
// ============================================================================

export function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gsRef = useRef<GS | null>(null)
  const animRef = useRef(0)
  const lastTimeRef = useRef(0)
  const cwRef = useRef(0)
  const chRef = useRef(0)

  // Profile data
  const user = useAuthStore(s => s.user)
  const players = useAuraStore(s => s.players)
  const userProfiles = useAuraStore(s => s.userProfiles)

  const playerData = useMemo(() => {
    if (!user) return null
    const pid = user.playerId || userProfiles[user.id]
    if (!pid) return null
    return players[pid] || null
  }, [user, players, userProfiles])

  // React UI state (synced from game loop)
  const [ui, setUi] = useState({
    stats: [0, 0, 0, 0, 0, 0, 0, 0], statPts: 0, level: 1, score: 0,
    className: 'Tank', dead: false, deathScore: 0, deathLevel: 0, deathKiller: '',
    showUpgrade: false, availableUpgrades: [] as TankClass[], autoFire: false,
  })

  const syncUI = useCallback(() => {
    const gs = gsRef.current
    if (!gs) return
    const p = gs.player
    const currentTier = TC[p.classId]?.tier ?? 0
    const qualifiedTier = p.level >= 45 ? 3 : p.level >= 30 ? 2 : p.level >= 15 ? 1 : 0
    const ups = qualifiedTier > currentTier ? getUpgrades(p.classId) : []
    setUi({
      stats: [...p.stats], statPts: p.statPts, level: p.level, score: p.score,
      className: TC[p.classId]?.name || 'Tank', dead: gs.dead,
      deathScore: gs.deathScore, deathLevel: gs.deathLevel, deathKiller: gs.deathKiller,
      showUpgrade: ups.length > 0 && p.alive, availableUpgrades: ups, autoFire: gs.autoFire,
    })
  }, [])

  // Init game
  const initGame = useCallback(() => {
    _nid = 0
    const gs: GS = {
      player: mkTank(WORLD / 2, WORLD / 2, playerData?.name || 'You', true),
      shapes: [], bullets: [], ai: [], particles: [],
      cam: { x: WORLD / 2, y: WORLD / 2, zoom: 1 },
      keys: new Set(), mouse: { x: 0, y: 0, down: false },
      autoFire: false, dead: false, deathScore: 0, deathLevel: 0, deathKiller: '', started: true,
    }
    if (playerData?.imageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { gs.player.profileImg = img }
      img.src = playerData.imageUrl
    }
    for (let i = 0; i < MAX_SHAPES; i++) gs.shapes.push(mkShape())
    for (let i = 0; i < MAX_AI; i++) {
      const color = AI_COLORS[i % AI_COLORS.length]
      const ai = mkTank(rand(100, WORLD - 100), rand(100, WORLD - 100), randomName(), false, color)
      levelUpAI(ai, Math.floor(rand(1, 15)))
      gs.ai.push(ai)
    }
    gsRef.current = gs
    return gs
  }, [playerData])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')!
    let syncTimer = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cwRef.current = rect.width; chRef.current = rect.height
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const gs = initGame()
    lastTimeRef.current = performance.now()

    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time
      updateGame(gs, dt, cwRef.current, chRef.current)
      renderGame(ctx, gs, cwRef.current, chRef.current)
      syncTimer += dt
      if (syncTimer > 0.1) { syncTimer = 0; syncUI() }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)

    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [initGame, syncUI])

  // Input handling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onKeyDown = (e: KeyboardEvent) => {
      const gs = gsRef.current
      if (!gs) return
      const key = e.key.toLowerCase()
      gs.keys.add(key)
      if (key === 'e') { gs.autoFire = !gs.autoFire; syncUI() }
      if (key >= '1' && key <= '8' && gs.player.statPts > 0) {
        const idx = parseInt(key) - 1
        if (gs.player.stats[idx] < STAT_MAX) {
          gs.player.stats[idx]++; gs.player.statPts--
          gs.player.maxHp = statVal(1, gs.player.stats[1])
          gs.player.hp = Math.min(gs.player.hp, gs.player.maxHp)
          syncUI()
        }
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => { gsRef.current?.keys.delete(e.key.toLowerCase()) }
    const onMouseMove = (e: MouseEvent) => {
      const gs = gsRef.current; if (!gs) return
      const rect = canvas.getBoundingClientRect()
      gs.mouse.x = e.clientX - rect.left; gs.mouse.y = e.clientY - rect.top
    }
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0 && gsRef.current) gsRef.current.mouse.down = true }
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0 && gsRef.current) gsRef.current.mouse.down = false }
    const onCtx = (e: Event) => e.preventDefault()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('contextmenu', onCtx)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onCtx)
    }
  }, [syncUI])

  const upgradeStat = useCallback((idx: number) => {
    const gs = gsRef.current
    if (!gs || gs.player.statPts <= 0 || gs.player.stats[idx] >= STAT_MAX) return
    gs.player.stats[idx]++; gs.player.statPts--
    gs.player.maxHp = statVal(1, gs.player.stats[1])
    gs.player.hp = Math.min(gs.player.hp, gs.player.maxHp)
    syncUI()
  }, [syncUI])

  const selectClass = useCallback((classId: string) => {
    const gs = gsRef.current
    if (!gs) return
    gs.player.classId = classId
    const tc = TC[classId]
    gs.player.reloads = tc.barrels.map(() => 0)
    gs.player.recoils = tc.barrels.map(() => 0)
    syncUI()
  }, [syncUI])

  const respawn = useCallback(() => {
    const gs = gsRef.current
    if (!gs) return
    const oldImg = gs.player.profileImg
    gs.player = mkTank(rand(200, WORLD - 200), rand(200, WORLD - 200), playerData?.name || 'You', true)
    gs.player.profileImg = oldImg
    gs.dead = false; gs.cam.x = gs.player.x; gs.cam.y = gs.player.y; gs.cam.zoom = 1
    syncUI()
  }, [playerData, syncUI])

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
      <canvas ref={canvasRef} className="block cursor-crosshair" />

      {/* Stat panel - left side */}
      <div className="absolute left-2 bottom-20 flex flex-col gap-1" style={{ userSelect: 'none', pointerEvents: 'auto' }}>
        {ui.statPts > 0 && (
          <div className="text-yellow-300 text-xs font-bold bg-black/50 px-2 py-1 rounded text-center mb-1">
            x{ui.statPts} Stat Points
          </div>
        )}
        {STAT_NAMES.map((name, i) => (
          <div key={i} className="flex items-center gap-1">
            <button onClick={() => upgradeStat(i)}
              disabled={ui.statPts <= 0 || ui.stats[i] >= STAT_MAX}
              className="w-5 h-5 rounded text-white font-bold text-xs bg-black/40 hover:bg-black/60 disabled:opacity-20 disabled:cursor-default flex items-center justify-center shrink-0">
              +
            </button>
            <div className="flex gap-0.5">
              {Array.from({ length: STAT_MAX }, (_, j) => (
                <div key={j} className="w-[14px] h-3 rounded-sm" style={{
                  backgroundColor: j < ui.stats[i] ? STAT_COLORS[i] : 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(0,0,0,0.15)',
                }} />
              ))}
            </div>
            <span className="text-white text-[10px] font-medium ml-1" style={{ textShadow: '0 1px 2px #000' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Class upgrade panel */}
      {ui.showUpgrade && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 flex gap-3" style={{ pointerEvents: 'auto', userSelect: 'none' }}>
          {ui.availableUpgrades.map(tc => (
            <button key={tc.id} onClick={() => selectClass(tc.id)}
              className="w-[88px] h-[88px] bg-black/60 hover:bg-black/80 border border-white/30 hover:border-white/60 rounded-lg flex flex-col items-center justify-center text-white transition-all">
              <TankPreview classId={tc.id} size={44} />
              <span className="text-[10px] font-bold mt-1">{tc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Death screen */}
      {ui.dead && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="bg-gray-900/90 text-white rounded-xl p-8 text-center space-y-4 min-w-[300px]">
            <h2 className="text-2xl font-bold">You were destroyed!</h2>
            {ui.deathKiller && (
              <p className="text-gray-400">Killed by: <span className="text-red-400 font-bold">{ui.deathKiller}</span></p>
            )}
            <div className="space-y-1 text-lg">
              <p>Score: <span className="font-bold text-yellow-400">{ui.deathScore.toLocaleString()}</span></p>
              <p>Level: <span className="font-bold">{ui.deathLevel}</span></p>
            </div>
            <button onClick={respawn}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors">
              Respawn
            </button>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-1 right-2 text-white/30 text-[10px]" style={{ pointerEvents: 'none' }}>
        WASD move · Mouse aim · Click shoot · E auto-fire · 1-8 stats
      </div>
    </div>
  )
}
