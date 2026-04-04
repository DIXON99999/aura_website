import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore, useAuraStore } from '@/stores'
import { Swords, Shield, ChevronRight, ChevronUp, Search, X, Users, Trophy, Plus, ArrowLeft, Play, Bot, Loader2, Crown } from 'lucide-react'

// ============================================================================
// TYPES (mirrors server types for rendering)
// ============================================================================

type GameMode = 'ffa' | 'battle'
type PageState = 'menu' | 'lobbies' | 'create-lobby' | 'waiting-room' | 'playing'

interface SnapshotTank {
  id: number; x: number; y: number; angle: number
  radius: number; hp: number; maxHp: number
  level: number; score: number; classId: string
  fill: string; ol: string; flash: number
  alive: boolean; name: string; isPlayer: boolean
  team: number; recoils: number[]
  stats: number[]; statPts: number
  xp: number; xpNext: number
  auraScore: number
  profileImg?: string; playerId?: string; entityId?: string; isPersonalBot?: boolean
  invisible: number; reloadBoost: number; invulnerable: number
}
interface SnapshotShape { id: number; x: number; y: number; radius: number; rot: number; sides: number; fill: string; ol: string; hp: number; maxHp: number; flash: number; type: string }
interface SnapshotBullet { id: number; x: number; y: number; radius: number; fill: string; ol: string }
interface SnapshotWall { id: number; x: number; y: number; width: number; height: number; angle: number; hp: number; maxHp: number; flash: number; fill: string; ol: string }
interface SnapshotParticle { x: number; y: number; r: number; fill: string; alpha: number }
interface SnapshotBase { id: number; x: number; y: number; hp: number; maxHp: number; radius: number; rot: number; team: number; flash: number; entityName: string; entityId: string; entityType: string; entityImg?: string; destroyed: boolean }

interface GameSnapshot {
  tanks: SnapshotTank[]; shapes: SnapshotShape[]; bullets: SnapshotBullet[]
  walls: SnapshotWall[]; particles: SnapshotParticle[]; bases: SnapshotBase[]
  mode: GameMode; teamCount: number; battleOver: boolean; winningTeam: number
  baseDestroyedMsg: string; baseDestroyedTimer: number
}

interface LobbyPlayer { id: string; name: string; team: number; profileImg?: string; ready: boolean }

interface LobbyInfo {
  id: string; name: string; mode: GameMode; state: 'waiting' | 'playing' | 'finished'
  players: LobbyPlayer[]; maxPlayers: number; teamCount: number
  teams: { entityId: string; entityName: string; entityType: string; entityImg?: string; auraScore: number }[]
  createdAt: number; hostId: string
}

interface PersonalBot {
  id: string; userId: string; entityId: string; entityName: string
  entityType: string; entityImg?: string; auraScore: number
}

interface BarrelDef {
  angle: number; width: number; length: number
  widthEnd?: number; offset?: number
  reloadMul?: number; bulletSizeMul?: number; bulletSpeedMul?: number; bulletDamageMul?: number; bulletPenMul?: number
}
interface TankClass { id: string; name: string; tier: number; barrels: BarrelDef[]; upgradesFrom?: string[]; fov?: number; recoil?: number; ability?: 'wall' | 'stealth' | 'scope' }

// ============================================================================
// CONSTANTS
// ============================================================================

const WORLD = 4000
const GRID = 24
const OL = 3.5
const BARREL_FILL = '#999999'
const BARREL_OL = '#727272'
const STAT_MAX = 7

const C = {
  bg: '#CDCDCD', grid: '#C2C2C2',
  player: '#00B2E1', playerOl: '#0085A8',
  hpGreen: '#85E37D', hpRed: '#E85555',
  xp: '#43FF91', xpOl: '#2FA86A',
}

const TEAM_COLORS = [
  { f: '#00B2E1', o: '#0085A8', name: 'Blue' },
  { f: '#F14E54', o: '#B03A3E', name: 'Red' },
  { f: '#00E16E', o: '#00A34F', name: 'Green' },
  { f: '#BF7FF5', o: '#8C5DB5', name: 'Purple' },
]

const STAT_COLORS = ['#F5B0CE', '#C980E3', '#9B6DCC', '#6B8DE3', '#66CCE0', '#E8EB6D', '#8AEB6D', '#EB866D']
const STAT_NAMES = ['Health Regen', 'Max Health', 'Body Damage', 'Bullet Speed', 'Bullet Penetration', 'Bullet Damage', 'Reload', 'Movement Speed']

const TC: Record<string, TankClass> = {
  basic: { id: 'basic', name: 'Tank', tier: 0, barrels: [{ angle: 0, width: 0.84, length: 1.8 }] },
  sniper: { id: 'sniper', name: 'Sniper', tier: 1, upgradesFrom: ['basic'], fov: 1.3, barrels: [{ angle: 0, width: 0.5, length: 3.6, bulletSpeedMul: 1.8, reloadMul: 2.2, bulletDamageMul: 1.8, bulletSizeMul: 0.85 }] },
  rifle: { id: 'rifle', name: 'Rifle', tier: 1, upgradesFrom: ['basic'], fov: 1.15, ability: 'wall', barrels: [{ angle: 0, width: 0.7, length: 2.2, bulletSpeedMul: 1.3, reloadMul: 0.75, bulletDamageMul: 1.2 }] },
  assassin: { id: 'assassin', name: 'Assassin', tier: 1, upgradesFrom: ['basic'], fov: 1.1, ability: 'stealth', barrels: [{ angle: 0, width: 0.4, length: 1.2, bulletSpeedMul: 0.9, reloadMul: 1.3, bulletDamageMul: 0.85, bulletSizeMul: 0.7 }] },
  phantom: { id: 'phantom', name: 'Phantom', tier: 2, upgradesFrom: ['assassin'], fov: 1.15, ability: 'stealth', barrels: [{ angle: 0, width: 0.45, length: 1.4, bulletSpeedMul: 1.1, reloadMul: 1.4, bulletDamageMul: 1.0, bulletSizeMul: 0.75 }] },
  superRifle: { id: 'superRifle', name: 'Super Rifle', tier: 2, upgradesFrom: ['rifle'], fov: 1.2, ability: 'wall', barrels: [{ angle: 0, width: 0.75, length: 2.6, bulletSpeedMul: 1.6, reloadMul: 0.55, bulletDamageMul: 1.5, bulletPenMul: 1.5 }] },
  scopeSniper: { id: 'scopeSniper', name: 'Scope', tier: 2, upgradesFrom: ['sniper'], fov: 1.6, ability: 'scope', barrels: [
    { angle: 0, width: 0.9, length: 1.8, reloadMul: 999999 }, // scope piece (visual only, draws first/behind)
    { angle: 0, width: 0.45, length: 4.5, bulletSpeedMul: 2.4, reloadMul: 2.8, bulletDamageMul: 2.4, bulletPenMul: 2.0, bulletSizeMul: 0.8 },
  ] },
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}
function getUpgrades(classId: string) { return Object.values(TC).filter(c => c.upgradesFrom?.includes(classId)) }
function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'm'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return Math.round(n).toString()
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/^http/, 'ws')

function getSessionToken(): string | null {
  return localStorage.getItem('aura_session')
}

// ============================================================================
// RENDERING (thin client - just draws snapshots)
// ============================================================================

function drawGrid(ctx: CanvasRenderingContext2D, cam: { x: number; y: number; zoom: number }, cw: number, ch: number) {
  const hw = cw / (2 * cam.zoom), hh = ch / (2 * cam.zoom)
  const l = cam.x - hw, t = cam.y - hh, r = cam.x + hw, b = cam.y + hh
  ctx.strokeStyle = '#C2C2C2'; ctx.lineWidth = 1; ctx.beginPath()
  for (let x = Math.floor(l / GRID) * GRID; x <= r; x += GRID) { ctx.moveTo(x, t); ctx.lineTo(x, b) }
  for (let y = Math.floor(t / GRID) * GRID; y <= b; y += GRID) { ctx.moveTo(l, y); ctx.lineTo(r, y) }
  ctx.stroke()
}

function drawShape(ctx: CanvasRenderingContext2D, s: SnapshotShape) {
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
  if (s.hp < s.maxHp) {
    const ratio = clamp(s.hp / s.maxHp, 0, 1), bw = s.radius * 2, bh = 7, br = 3.5
    ctx.fillStyle = '#333'; fillRoundRect(ctx, s.x - bw / 2, s.y + s.radius + 6, bw, bh, br)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed; fillRoundRect(ctx, s.x - bw / 2, s.y + s.radius + 6, bw * ratio, bh, br)
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: SnapshotBullet) {
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
  ctx.fillStyle = b.fill; ctx.fill(); ctx.strokeStyle = b.ol; ctx.lineWidth = OL * 0.7; ctx.stroke()
}

function drawWall(ctx: CanvasRenderingContext2D, w: SnapshotWall) {
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.angle)
  const hw = w.width / 2, hh = w.height / 2, r = 3
  ctx.beginPath(); ctx.roundRect(-hw, -hh, w.width, w.height, r); ctx.closePath()
  ctx.fillStyle = w.flash > 0 ? '#FFFFFF' : w.fill; ctx.fill()
  ctx.strokeStyle = w.ol; ctx.lineWidth = OL; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
  if (w.hp < w.maxHp) {
    const ratio = clamp(w.hp / w.maxHp, 0, 1), bw = w.width * 0.8
    ctx.save(); ctx.translate(w.x, w.y)
    fillRoundRect(ctx, -bw / 2, w.height / 2 + 4, bw, 5, 2.5)
    ctx.fillStyle = '#333'; fillRoundRect(ctx, -bw / 2, w.height / 2 + 4, bw, 5, 2.5)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed; fillRoundRect(ctx, -bw / 2, w.height / 2 + 4, bw * ratio, 5, 2.5)
    ctx.restore()
  }
}

function drawBarrel(ctx: CanvasRenderingContext2D, b: BarrelDef, r: number, recoil: number) {
  const w = r * b.width, l = r * b.length - recoil, off = (b.offset || 0) * r
  ctx.save(); ctx.rotate(b.angle)
  if (b.widthEnd) {
    const we = r * b.widthEnd
    ctx.beginPath(); ctx.moveTo(0, off - w / 2); ctx.lineTo(l, off - we / 2)
    ctx.lineTo(l, off + we / 2); ctx.lineTo(0, off + w / 2); ctx.closePath()
  } else { ctx.beginPath(); ctx.rect(0, off - w / 2, l, w) }
  ctx.fillStyle = BARREL_FILL; ctx.fill()
  ctx.strokeStyle = BARREL_OL; ctx.lineWidth = OL; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
}

const imgCache = new Map<string, HTMLImageElement>()
function getCachedImg(url: string): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  imgCache.set(url, img)
  return img.complete ? img : null
}

function drawTank(ctx: CanvasRenderingContext2D, t: SnapshotTank, myId: number, myTeam: number) {
  if (!t.alive) return
  // Invisibility: hide enemies, semi-transparent for self/teammates
  if ((t.invisible || 0) > 0) {
    if (t.id === myId) {
      ctx.globalAlpha = 0.35
    } else if (myTeam >= 0 && t.team === myTeam) {
      ctx.globalAlpha = 0.35
    } else {
      return // completely hidden to enemies
    }
  }
  const r = t.radius
  const tc = TC[t.classId] || TC.basic

  ctx.save(); ctx.translate(t.x, t.y)
  ctx.save(); ctx.rotate(t.angle)
  for (let i = 0; i < tc.barrels.length; i++) drawBarrel(ctx, tc.barrels[i], r, t.recoils[i] || 0)
  // Super Rifle: decorative lines across barrel
  if (t.classId === 'superRifle') {
    const b = tc.barrels[0], w = r * b.width, l = r * b.length
    const lineCount = 4
    ctx.strokeStyle = BARREL_OL; ctx.lineWidth = 1.5
    for (let j = 1; j <= lineCount; j++) {
      const px = l * (j / (lineCount + 1))
      ctx.beginPath(); ctx.moveTo(px, -w / 2 - 1); ctx.lineTo(px, w / 2 + 1); ctx.stroke()
    }
  }
  ctx.restore()

  const profileImg = t.profileImg ? getCachedImg(t.profileImg) : null
  if (profileImg && profileImg.complete && t.isPlayer) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(profileImg, -r, -r, r * 2, r * 2); ctx.restore()
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = t.ol; ctx.lineWidth = OL; ctx.stroke()
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = t.flash > 0 ? '#FFFFFF' : t.fill; ctx.fill()
    ctx.strokeStyle = t.ol; ctx.lineWidth = OL; ctx.stroke()
  }
  ctx.restore()

  // Name + aura score (inline)
  const baseName = t.isPersonalBot ? `★ ${t.name}` : t.name
  const label = t.isPlayer && t.auraScore > 0 ? `${baseName}  🔥${formatCompact(t.auraScore)}` : baseName
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = t.isPersonalBot ? '#FFD700' : '#FFF'
  ctx.strokeText(label, t.x, t.y - r - 10); ctx.fillText(label, t.x, t.y - r - 10)

  if (t.hp < t.maxHp) {
    const ratio = clamp(t.hp / t.maxHp, 0, 1), bw = r * 2.5, bh = 7, br = 3.5
    ctx.fillStyle = '#333'; fillRoundRect(ctx, t.x - bw / 2, t.y + r + 6, bw, bh, br)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
    fillRoundRect(ctx, t.x - bw / 2, t.y + r + 6, bw * ratio, bh, br)
  }

  // Reload boost: animated up-arrows
  if ((t.reloadBoost || 0) > 0) {
    const time = performance.now() / 1000
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let i = 0; i < 3; i++) {
      const phase = (time * 1.5 + i * 0.33) % 1
      const ax = t.x + (i - 1) * 18
      const ay = t.y - r - 22 - phase * 20
      ctx.globalAlpha = 1 - phase
      ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5
      ctx.strokeText('\u2191', ax, ay); ctx.fillText('\u2191', ax, ay)
    }
  }

  // Invulnerable text
  if ((t.invulnerable || 0) > 0) {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 150)
    ctx.globalAlpha = pulse
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#A78BFA'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3
    ctx.strokeText('INVULNERABLE', t.x, t.y - r - 26)
    ctx.fillText('INVULNERABLE', t.x, t.y - r - 26)
  }

  ctx.globalAlpha = 1
}

function drawBase(ctx: CanvasRenderingContext2D, base: SnapshotBase) {
  if (base.destroyed) return
  const tc = TEAM_COLORS[base.team] || TEAM_COLORS[0]
  const sides = 6

  ctx.save(); ctx.translate(base.x, base.y); ctx.rotate(base.rot)
  ctx.shadowColor = tc.f; ctx.shadowBlur = 30
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides - Math.PI / 2
    const px = base.radius * Math.cos(a), py = base.radius * Math.sin(a)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = base.flash > 0 ? '#FFFFFF' : tc.f
  ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1
  ctx.strokeStyle = tc.o; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.shadowBlur = 0

  // Entity image clipped to hexagon
  if (base.entityImg) {
    const entityImg = getCachedImg(base.entityImg)
    if (entityImg && entityImg.complete) {
      ctx.save()
      ctx.rotate(-base.rot)
      const imgR = base.radius * 0.92
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const a = (i * Math.PI * 2) / sides - Math.PI / 2 + base.rot
        const px = imgR * Math.cos(a), py = imgR * Math.sin(a)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.clip()
      ctx.drawImage(entityImg, -imgR, -imgR, imgR * 2, imgR * 2)
      ctx.restore()
    }
  }
  ctx.restore()

  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = tc.f
  ctx.strokeText(base.entityName, base.x, base.y - base.radius - 12)
  ctx.fillText(base.entityName, base.x, base.y - base.radius - 12)

  const ratio = clamp(base.hp / base.maxHp, 0, 1), bw = base.radius * 2.2, bh = 10, br = 5
  ctx.fillStyle = '#333'; fillRoundRect(ctx, base.x - bw / 2, base.y + base.radius + 10, bw, bh, br)
  ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
  fillRoundRect(ctx, base.x - bw / 2, base.y + base.radius + 10, bw * ratio, bh, br)
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#FFF'
  ctx.strokeText(`${Math.ceil(base.hp)} / ${base.maxHp}`, base.x, base.y + base.radius + 30)
  ctx.fillText(`${Math.ceil(base.hp)} / ${base.maxHp}`, base.x, base.y + base.radius + 30)
}

function drawHUD(ctx: CanvasRenderingContext2D, snap: GameSnapshot, me: SnapshotTank | undefined, cw: number, ch: number) {
  // Minimap only — rest is HTML overlay
  const sz = 200, mx = cw - sz - 15, my = ch - sz - 15, sc = sz / WORLD
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(mx, my, sz, sz)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, sz, sz)
  for (const t of snap.tanks) {
    if (!t.alive) continue
    const tx = mx + t.x * sc, ty = my + t.y * sc
    if (me && t.id === me.id) {
      // Draw directional arrow for player's tank
      const r = 6
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(t.angle)
      ctx.beginPath()
      ctx.moveTo(r * 1.5, 0) // pointy tip
      ctx.lineTo(-r, -r)
      ctx.lineTo(-r * 0.4, 0)
      ctx.lineTo(-r, r)
      ctx.closePath()
      ctx.fillStyle = t.fill; ctx.fill()
      ctx.strokeStyle = t.ol; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    } else {
      ctx.fillStyle = t.fill; ctx.beginPath()
      ctx.arc(tx, ty, t.playerId ? 4 : 2.5, 0, Math.PI * 2); ctx.fill()
    }
  }
  for (const base of snap.bases) {
    if (base.destroyed) continue
    ctx.fillStyle = TEAM_COLORS[base.team]?.f || '#FFF'; ctx.globalAlpha = 0.6
    ctx.beginPath()
    const bx2 = mx + base.x * sc, by2 = my + base.y * sc
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6 - Math.PI / 2
      const px = bx2 + 6 * Math.cos(a), py = by2 + 6 * Math.sin(a)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1
  }

  // Base destroyed message
  if (snap.baseDestroyedTimer > 0) {
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'
    ctx.globalAlpha = Math.min(1, snap.baseDestroyedTimer)
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#F14E54'
    ctx.strokeText(snap.baseDestroyedMsg, cw / 2, ch * 0.25)
    ctx.fillText(snap.baseDestroyedMsg, cw / 2, ch * 0.25)
    ctx.globalAlpha = 1
  }
}

const SNAP_INTERVAL = 1000 / 45 // server sends at 45fps

function lerpSnap(prev: GameSnapshot, curr: GameSnapshot, t: number): GameSnapshot {
  const lerp = (a: number, b: number) => a + (b - a) * t
  // Lerp angle handling shortest path
  const lerpAngle = (a: number, b: number) => {
    let d = b - a
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    return a + d * t
  }

  const prevTankMap = new Map(prev.tanks.map(tk => [tk.id, tk]))
  const prevShapeMap = new Map(prev.shapes.map(s => [s.id, s]))
  const prevBulletMap = new Map(prev.bullets.map(b => [b.id, b]))
  const prevWallMap = new Map((prev.walls || []).map(w => [w.id, w]))
  const prevBaseMap = new Map(prev.bases.map(b => [b.id, b]))

  return {
    ...curr,
    tanks: curr.tanks.map(tk => {
      const p = prevTankMap.get(tk.id)
      if (!p) return tk
      return { ...tk, x: lerp(p.x, tk.x), y: lerp(p.y, tk.y), angle: lerpAngle(p.angle, tk.angle) }
    }),
    shapes: curr.shapes.map(s => {
      const p = prevShapeMap.get(s.id)
      if (!p) return s
      return { ...s, x: lerp(p.x, s.x), y: lerp(p.y, s.y), rot: lerpAngle(p.rot, s.rot) }
    }),
    bullets: curr.bullets.map(b => {
      const p = prevBulletMap.get(b.id)
      if (!p) return b
      return { ...b, x: lerp(p.x, b.x), y: lerp(p.y, b.y) }
    }),
    walls: (curr.walls || []).map(w => {
      const p = prevWallMap.get(w.id)
      if (!p) return w
      return { ...w, x: lerp(p.x, w.x), y: lerp(p.y, w.y) }
    }),
    bases: curr.bases.map(b => {
      const p = prevBaseMap.get(b.id)
      if (!p) return b
      return { ...b, rot: lerpAngle(p.rot, b.rot) }
    }),
    particles: curr.particles.map((p, i) => {
      const pp = prev.particles[i]
      if (!pp) return p
      return { ...p, x: lerp(pp.x, p.x), y: lerp(pp.y, p.y) }
    }),
  }
}

function renderSnapshot(ctx: CanvasRenderingContext2D, snap: GameSnapshot, myTankId: number, cw: number, ch: number, scopeOffset?: { dx: number; dy: number }) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, ch)

  const me = snap.tanks.find(t => t.id === myTankId)
  let camX = me?.x ?? WORLD / 2
  let camY = me?.y ?? WORLD / 2
  const camZoom = me ? (1 - (me.level - 1) * 0.004) / (TC[me.classId]?.fov || 1) : 1

  // Scope ability: offset camera toward cursor
  if (scopeOffset && me) {
    camX += scopeOffset.dx
    camY += scopeOffset.dy
  }

  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.scale(camZoom, camZoom)
  ctx.translate(-camX, -camY)

  drawGrid(ctx, { x: camX, y: camY, zoom: camZoom }, cw, ch)
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 5; ctx.setLineDash([])
  ctx.strokeRect(0, 0, WORLD, WORLD)

  for (const b of snap.bullets) drawBullet(ctx, b)
  for (const s of snap.shapes) drawShape(ctx, s)
  for (const w of (snap.walls || [])) drawWall(ctx, w)
  for (const base of snap.bases) drawBase(ctx, base)
  for (const t of snap.tanks) { ctx.save(); try { drawTank(ctx, t, myTankId, me?.team ?? -1) } catch (e) { console.warn('drawTank error:', e) } ctx.restore() }
  for (const p of snap.particles) {
    ctx.globalAlpha = p.alpha; ctx.fillStyle = p.fill
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.restore()
  drawHUD(ctx, snap, me, cw, ch)
}

// ============================================================================
// TANK PREVIEW
// ============================================================================

function TankPreview({ classId, size }: { classId: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr; canvas.height = size * dpr; ctx.scale(dpr, dpr)
    const tc = TC[classId]; if (!tc) return
    const r = size * 0.25
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(size / 2, size / 2)
    for (const b of tc.barrels) {
      const w = r * b.width, l = r * b.length, off = (b.offset || 0) * r
      ctx.save(); ctx.rotate(b.angle)
      if (b.widthEnd) { const we = r * b.widthEnd; ctx.beginPath(); ctx.moveTo(0, off - w / 2); ctx.lineTo(l, off - we / 2); ctx.lineTo(l, off + we / 2); ctx.lineTo(0, off + w / 2); ctx.closePath() }
      else { ctx.beginPath(); ctx.rect(0, off - w / 2, l, w) }
      ctx.fillStyle = BARREL_FILL; ctx.fill(); ctx.strokeStyle = BARREL_OL; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = C.player; ctx.fill(); ctx.strokeStyle = C.playerOl; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
  }, [classId, size])
  return <canvas ref={ref} style={{ width: size, height: size }} />
}

// ============================================================================
// ENTITY SEARCH
// ============================================================================

function EntitySearch({ onSelect }: { onSelect: (entity: { id: string; name: string; auraScore: number; imageUrl?: string; type: string }) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const players = useAuraStore(s => s.players)
  const games = useAuraStore(s => s.games)
  const organisations = useAuraStore(s => s.organisations)
  const characters = useAuraStore(s => s.characters)

  const allEntities = useMemo(() => {
    const entities: { id: string; name: string; auraScore: number; imageUrl?: string; type: string }[] = []
    for (const [id, p] of Object.entries(players)) entities.push({ id, name: p.name, auraScore: p.auraScore, imageUrl: p.imageUrl, type: 'player' })
    for (const [id, g] of Object.entries(games)) entities.push({ id, name: g.name, auraScore: g.auraScore, imageUrl: g.imageUrl, type: 'game' })
    for (const [id, o] of Object.entries(organisations)) entities.push({ id, name: o.name, auraScore: o.auraScore, imageUrl: o.imageUrl, type: 'organisation' })
    for (const [id, c] of Object.entries(characters)) entities.push({ id, name: c.name, auraScore: c.auraScore, imageUrl: c.imageUrl, type: 'character' })
    return entities.sort((a, b) => b.auraScore - a.auraScore)
  }, [players, games, organisations, characters])

  const filtered = useMemo(() => {
    if (!query) return allEntities.slice(0, 8)
    const q = query.toLowerCase()
    return allEntities.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, allEntities])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/20">
        <Search className="w-4 h-4 text-white/50" />
        <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          placeholder="Search entities..." className="bg-transparent text-white text-sm outline-none w-full placeholder:text-white/30" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {filtered.map(e => (
            <button key={e.id} onClick={() => { onSelect(e); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 text-left">
              {e.imageUrl ? <img src={e.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs text-white/60">{e.name[0]}</div>}
              <div className="flex-1 min-w-0"><div className="text-white text-sm font-medium truncate">{e.name}</div><div className="text-white/40 text-xs capitalize">{e.type}</div></div>
              <div className="text-yellow-400 text-xs font-medium">{formatCompact(e.auraScore)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PLAY PAGE
// ============================================================================

export function PlayPage() {
  const [page, setPage] = useState<PageState>('menu')
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([])
  const [currentLobby, setCurrentLobby] = useState<LobbyInfo | null>(null)
  const [myBots, setMyBots] = useState<PersonalBot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create lobby form
  const [createMode, setCreateMode] = useState<GameMode>('ffa')
  const [createName, setCreateName] = useState('')
  const [createTeamCount, setCreateTeamCount] = useState(2)
  const [createTeams, setCreateTeams] = useState<({ entityId: string; entityName: string; entityType: string; entityImg?: string; auraScore: number } | null)[]>([null, null, null, null])
  const [joinTeam, setJoinTeam] = useState(0)
  const [joinPickerLobbyId, setJoinPickerLobbyId] = useState<string | null>(null)

  // Game state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const prevSnapshotRef = useRef<GameSnapshot | null>(null)
  const snapTimeRef = useRef(0)
  const myTankIdRef = useRef(-1)
  const animRef = useRef(0)
  const keysRef = useRef(new Set<string>())
  const mouseRef = useRef({ x: 0, y: 0, down: false })
  const auraFloatsRef = useRef<{ x: number; y: number; text: string; color: string; life: number }[]>([])
  const abilityCooldownRef = useRef(0)

  const user = useAuthStore(s => s.user)
  const players = useAuraStore(s => s.players)
  const userProfiles = useAuraStore(s => s.userProfiles)

  const playerData = useMemo(() => {
    if (!user) return null
    const pid = user.playerId || userProfiles[user.id]
    if (!pid) return null
    return players[pid] || null
  }, [user, players, userProfiles])

  // UI state synced from snapshots
  const [ui, setUi] = useState({
    stats: [0, 0, 0, 0, 0, 0, 0, 0], statPts: 0, level: 1, score: 0,
    className: 'Tank', classId: 'basic', dead: false, showUpgrade: false,
    availableUpgrades: [] as TankClass[], autoFire: false,
    battleOver: false, winningTeam: -1, myTeam: -1, mode: 'ffa' as GameMode,
    xp: 0, xpNext: 5, auraScore: 0, abilityCooldown: 0,
  })
  const [placingWall, _setPlacingWall] = useState(false)
  const placingWallRef = useRef(false)
  const setPlacingWall = (v: boolean | ((prev: boolean) => boolean)) => {
    _setPlacingWall(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      placingWallRef.current = next
      return next
    })
  }

  // ==================== API CALLS ====================

  const fetchLobbies = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lobbies`)
      const data = await res.json()
      setLobbies(Array.isArray(data) ? data : [])
    } catch { setLobbies([]) }
  }, [])

  const fetchMyBots = useCallback(async () => {
    try {
      const token = getSessionToken()
      if (!token) return
      const res = await fetch(`${API_BASE}/lobbies/bots/my`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setMyBots(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  // Poll lobbies when on lobby list page
  useEffect(() => {
    if (page === 'lobbies') {
      fetchLobbies()
      const interval = setInterval(fetchLobbies, 3000)
      return () => clearInterval(interval)
    }
  }, [page, fetchLobbies])

  // Load bots when in waiting room
  useEffect(() => {
    if (page === 'waiting-room') fetchMyBots()
  }, [page, fetchMyBots])

  const handleCreateLobby = useCallback(async () => {
    const token = getSessionToken()
    if (!token) { setError('Please sign in'); return }
    setLoading(true); setError('')
    try {
      const teams = createMode === 'battle' ? createTeams.slice(0, createTeamCount).map(t => t || { entityId: '', entityName: 'Team', entityType: 'player', auraScore: 0 }) : []
      const res = await fetch(`${API_BASE}/lobbies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: createName || `${playerData?.name || 'Player'}'s Game`, mode: createMode, teamCount: createMode === 'battle' ? createTeamCount : 0, teams }),
      })
      const lobby = await res.json()
      if (lobby.error) throw new Error(lobby.error)

      // Auto-join
      await fetch(`${API_BASE}/lobbies/${lobby.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ team: joinTeam }),
      })

      setCurrentLobby(lobby)
      setPage('waiting-room')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [createMode, createName, createTeamCount, createTeams, joinTeam, playerData])

  const handleJoinLobby = useCallback(async (lobbyId: string, team: number) => {
    const token = getSessionToken()
    if (!token) { setError('Please sign in'); return }
    try {
      const res = await fetch(`${API_BASE}/lobbies/${lobbyId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ team }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const lobbyRes = await fetch(`${API_BASE}/lobbies/${lobbyId}`)
      const lobby = await lobbyRes.json()
      setCurrentLobby(lobby)
      setPage('waiting-room')
    } catch (e: any) { setError(e.message) }
  }, [])

  const handleStartGame = useCallback(async () => {
    if (!currentLobby) return
    const token = getSessionToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/lobbies/${currentLobby.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
    } catch (e: any) { setError(e.message) }
  }, [currentLobby])

  const handleLeaveLobby = useCallback(async () => {
    if (!currentLobby) return
    const token = getSessionToken()
    if (!token) return
    try {
      await fetch(`${API_BASE}/lobbies/${currentLobby.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
    } catch {}
    wsRef.current?.close()
    wsRef.current = null
    setCurrentLobby(null)
    setPage('lobbies')
  }, [currentLobby])

  const handleDeployBot = useCallback(async (botId: string) => {
    if (!currentLobby) return
    const token = getSessionToken()
    if (!token) return
    const myPlayer = currentLobby.players.find(p => p.id === user?.id)
    try {
      await fetch(`${API_BASE}/lobbies/${currentLobby.id}/deploy-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ botId, team: myPlayer?.team ?? 0 }),
      })
    } catch {}
  }, [currentLobby, user])

  // ==================== WEBSOCKET ====================

  const connectWS = useCallback(() => {
    if (!currentLobby || !user) return
    const token = getSessionToken()
    if (!token) return

    const ws = new WebSocket(`${WS_BASE}/ws/lobby/${currentLobby.id}?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'snapshot':
          prevSnapshotRef.current = snapshotRef.current
          snapshotRef.current = msg.data
          snapTimeRef.current = performance.now()
          myTankIdRef.current = msg.you
          abilityCooldownRef.current = msg.abilityCooldown || 0
          // If we receive a snapshot while still in waiting-room, the game is already running (late join)
          setPage(prev => prev === 'waiting-room' ? 'playing' : prev)
          break
        case 'lobby_update':
          setCurrentLobby(msg.lobby)
          break
        case 'game_start':
          setUi({ stats: [0,0,0,0,0,0,0,0], statPts: 0, level: 1, score: 0, className: 'Tank', classId: 'basic', dead: false, showUpgrade: false, availableUpgrades: [], autoFire: false, battleOver: false, winningTeam: -1, myTeam: -1, mode: 'ffa' as GameMode, xp: 0, xpNext: 5, auraScore: 0, abilityCooldown: 0 })
          setPage('playing')
          break
        case 'aura_change': {
          const snap = snapshotRef.current
          if (snap) {
            const tank = snap.tanks.find(tk => tk.playerId && tk.entityId === msg.entityId)
            if (tank) {
              auraFloatsRef.current.push({
                x: tank.x, y: tank.y - tank.radius - 35,
                text: msg.delta > 0 ? `+${msg.delta} Aura` : `${msg.delta} Aura`,
                color: msg.delta > 0 ? '#00FF88' : '#FF4444',
                life: 1.5,
              })
            }
          }
          break
        }
        case 'game_over':
          setUi(prev => ({ ...prev, battleOver: true, winningTeam: msg.winningTeam }))
          break
      }
    }

    ws.onerror = (e) => {
      console.error('WebSocket error:', e)
    }
    ws.onclose = () => {
      wsRef.current = null
    }
  }, [currentLobby, user])

  // Connect WS when entering waiting room
  useEffect(() => {
    if (page === 'waiting-room' && currentLobby && user && !wsRef.current) {
      connectWS()
    }
    return () => {
      // Don't close WS when transitioning to playing
    }
  }, [page, currentLobby, user, connectWS])

  // Send inputs at 20fps
  useEffect(() => {
    if (page !== 'playing') return
    const interval = setInterval(() => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({
        type: 'input',
        data: {
          keys: Array.from(keysRef.current),
          mouseX: mouseRef.current.x,
          mouseY: mouseRef.current.y,
          mouseDown: mouseRef.current.down,
          viewW: containerRef.current?.clientWidth || 1200,
          viewH: containerRef.current?.clientHeight || 800,
        },
      }))
    }, 1000 / 45)
    return () => clearInterval(interval)
  }, [page])

  // ==================== GAME RENDERING ====================

  useEffect(() => {
    if (page !== 'playing') return
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let syncTimer = 0
    let lastTime = performance.now()
    const loop = (time: number) => {
      try {
        const dt = (time - lastTime) / 1000
        lastTime = time
        const dpr = window.devicePixelRatio || 1
        // Reset canvas state each frame to recover from any prior errors
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.globalAlpha = 1
        ctx.setLineDash([])
        const currSnap = snapshotRef.current
        if (currSnap) {
          // Interpolate between previous and current snapshot
          const elapsed = time - snapTimeRef.current
          const t = Math.min(elapsed / SNAP_INTERVAL, 1)
          const prev = prevSnapshotRef.current
          const snap = prev ? lerpSnap(prev, currSnap, t) : currSnap

          const rect = container.getBoundingClientRect()

          // Scope ability: shift key offsets camera toward cursor
          let scopeOffset: { dx: number; dy: number } | undefined
          const meForScope = snap.tanks.find(tk => tk.id === myTankIdRef.current)
          if (meForScope && keysRef.current.has('shift') && TC[meForScope.classId]?.ability === 'scope') {
            const camZoomScope = (1 - (meForScope.level - 1) * 0.004) / (TC[meForScope.classId]?.fov || 1)
            const mx = mouseRef.current.x - rect.width / 2
            const my = mouseRef.current.y - rect.height / 2
            // Offset camera toward cursor in world space, max ~600 units
            const worldMx = mx / camZoomScope
            const worldMy = my / camZoomScope
            const dist = Math.hypot(worldMx, worldMy)
            const maxOffset = 600
            const scale = dist > 0 ? Math.min(maxOffset, dist) / dist : 0
            scopeOffset = { dx: worldMx * scale, dy: worldMy * scale }
          }

          renderSnapshot(ctx, snap, myTankIdRef.current, rect.width, rect.height, scopeOffset)

          // Draw floating aura texts (in world space)
          const me = snap.tanks.find(tk => tk.id === myTankIdRef.current)
          let camX = me?.x ?? WORLD / 2, camY = me?.y ?? WORLD / 2
          if (scopeOffset) { camX += scopeOffset.dx; camY += scopeOffset.dy }
          const camZoom = me ? (1 - (me.level - 1) * 0.004) / (TC[me.classId]?.fov || 1) : 1
          const floats = auraFloatsRef.current
          for (let i = floats.length - 1; i >= 0; i--) {
            const f = floats[i]
            f.life -= dt
            f.y -= 40 * dt // drift up
            if (f.life <= 0) { floats.splice(i, 1); continue }
            const alpha = Math.min(1, f.life / 0.5)
            const sx = (f.x - camX) * camZoom + rect.width / 2
            const sy = (f.y - camY) * camZoom + rect.height / 2
            ctx.globalAlpha = alpha
            ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'
            ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = f.color
            ctx.strokeText(f.text, sx, sy); ctx.fillText(f.text, sx, sy)
            ctx.globalAlpha = 1
          }

          // Wall placement preview
          if (placingWallRef.current && me && TC[me.classId]?.ability === 'wall') {
            const mx = mouseRef.current.x, my2 = mouseRef.current.y
            const worldMX = camX + (mx - rect.width / 2) / camZoom
            const worldMY = camY + (my2 - rect.height / 2) / camZoom
            const dist = Math.sqrt((worldMX - me.x) ** 2 + (worldMY - me.y) ** 2)
            const inRange = dist <= 250

            // Draw range circle (screen space)
            const rangeScreenR = 250 * camZoom
            const meCenterX = rect.width / 2 + (me.x - camX) * camZoom
            const meCenterY = rect.height / 2 + (me.y - camY) * camZoom
            ctx.save()
            ctx.beginPath(); ctx.arc(meCenterX, meCenterY, rangeScreenR, 0, Math.PI * 2)
            ctx.fillStyle = inRange ? 'rgba(139,115,85,0.08)' : 'rgba(255,80,80,0.05)'
            ctx.fill()
            ctx.strokeStyle = inRange ? 'rgba(139,115,85,0.6)' : 'rgba(255,80,80,0.6)'
            ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([])
            ctx.restore()

            // Draw wall preview (world space)
            ctx.save()
            ctx.translate(rect.width / 2, rect.height / 2)
            ctx.scale(camZoom, camZoom)
            ctx.translate(-camX, -camY)
            if (inRange) {
              ctx.save()
              ctx.translate(worldMX, worldMY); ctx.rotate(me.angle + Math.PI / 2)
              ctx.globalAlpha = 0.6
              ctx.fillStyle = '#8B7355'
              ctx.beginPath(); ctx.roundRect(-50, -6, 100, 12, 3); ctx.fill()
              ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2; ctx.stroke()
              ctx.globalAlpha = 1
              ctx.restore()
            } else {
              // Show red ghost when out of range
              ctx.save()
              ctx.translate(worldMX, worldMY); ctx.rotate(me.angle + Math.PI / 2)
              ctx.globalAlpha = 0.3
              ctx.fillStyle = '#FF4444'
              ctx.beginPath(); ctx.roundRect(-50, -6, 100, 12, 3); ctx.fill()
              ctx.strokeStyle = '#FF0000'; ctx.lineWidth = 2; ctx.stroke()
              ctx.globalAlpha = 1
              ctx.restore()
            }
            ctx.restore()
          }

          // Sync UI periodically
          syncTimer += dt
          if (syncTimer > 0.15) {
            syncTimer = 0
            const me = currSnap.tanks.find(t => t.id === myTankIdRef.current)
            if (me) {
              const currentTier = TC[me.classId]?.tier ?? 0
              const qualifiedTier = me.level >= 45 ? 3 : me.level >= 30 ? 2 : me.level >= 15 ? 1 : 0
              const ups = qualifiedTier > currentTier ? getUpgrades(me.classId) : []
              setUi({
                stats: [...me.stats], statPts: me.statPts, level: me.level, score: me.score,
                className: TC[me.classId]?.name || 'Tank', classId: me.classId,
                dead: !me.alive,
                showUpgrade: ups.length > 0 && me.alive,
                availableUpgrades: ups,
                autoFire: false,
                battleOver: snap.battleOver, winningTeam: snap.winningTeam,
                myTeam: me.team, mode: snap.mode,
                xp: me.xp, xpNext: me.xpNext, auraScore: me.auraScore, abilityCooldown: abilityCooldownRef.current,
              })
            }
          }
        }
      } catch (e) {
        console.error('Render error:', e)
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [page])

  // Input handling
  useEffect(() => {
    if (page !== 'playing') return
    const canvas = canvasRef.current; if (!canvas) return

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (key === 'e') ws.send(JSON.stringify({ type: 'toggle_autofire' }))
      if (key >= '1' && key <= '8') ws.send(JSON.stringify({ type: 'upgrade_stat', index: parseInt(key) - 1 }))
      if (key === ']') ws.send(JSON.stringify({ type: 'set_level', delta: 1 }))
      if (key === '[') ws.send(JSON.stringify({ type: 'set_level', delta: -1 }))
      if (key === 'q') {
        const snap = snapshotRef.current
        const me = snap?.tanks.find(t => t.id === myTankIdRef.current)
        const tc = me ? TC[me.classId] : null
        if (tc?.ability === 'wall') setPlacingWall(prev => !prev)
        else if (tc?.ability === 'stealth') ws.send(JSON.stringify({ type: 'activate_stealth' }))
      }
      if (key === 'escape') setPlacingWall(false)
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()) }
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left; mouseRef.current.y = e.clientY - rect.top
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // If placing wall, convert screen coords to world coords and send
        const snap = snapshotRef.current
        const me = snap?.tanks.find(t => t.id === myTankIdRef.current)
        if (me && placingWallRef.current) {
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            const camZoom = (1 - (me.level - 1) * 0.004) / (TC[me.classId]?.fov || 1)
            const worldX = me.x + (e.clientX - rect.left - rect.width / 2) / camZoom
            const worldY = me.y + (e.clientY - rect.top - rect.height / 2) / camZoom
            wsRef.current?.send(JSON.stringify({ type: 'place_wall', x: worldX, y: worldY }))
            setPlacingWall(false)
          }
        } else {
          mouseRef.current.down = true
        }
      }
    }
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = false }
    const onCtx = (e: Event) => e.preventDefault()

    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp); canvas.addEventListener('contextmenu', onCtx)
    return () => {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp); canvas.removeEventListener('contextmenu', onCtx)
    }
  }, [page])

  const sendWS = useCallback((msg: any) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  // ==================== MENU ====================
  if (page === 'menu') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-2xl w-full">
          <h1 className="text-5xl font-black text-center text-white mb-2 tracking-tight">AURA ARENA</h1>
          <p className="text-center text-white/50 mb-10 text-sm">Choose your game mode</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button onClick={() => { setCreateMode('ffa'); setPage('lobbies'); fetchLobbies() }}
              className="group relative bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6 text-left hover:border-cyan-400/60 hover:from-cyan-500/30 hover:to-blue-600/30 transition-all duration-300">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Swords className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Free For All</h2>
              <p className="text-white/50 text-sm mb-4">Fight with your aura on the line</p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm"><span className="text-green-400 font-bold">+20</span><span className="text-white/60">aura per kill</span></div>
                <div className="flex items-center gap-2 text-sm"><span className="text-red-400 font-bold">-10</span><span className="text-white/60">aura per death</span></div>
              </div>
              <div className="flex items-center gap-1 text-cyan-400 font-semibold text-sm">Browse Lobbies <ChevronRight className="w-4 h-4" /></div>
            </button>
            <button onClick={() => { setCreateMode('battle'); setPage('lobbies'); fetchLobbies() }}
              className="group relative bg-gradient-to-br from-red-500/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-6 text-left hover:border-red-400/60 hover:from-red-500/30 hover:to-orange-600/30 transition-all duration-300">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Battle Mode</h2>
              <p className="text-white/50 text-sm mb-4">Teams defend their entity's aura</p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-white/40" /><span className="text-white/60">2-4 teams</span></div>
                <div className="flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-white/40" /><span className="text-white/60">Destroy enemy hexagons: -100 aura</span></div>
              </div>
              <div className="flex items-center gap-1 text-red-400 font-semibold text-sm">Browse Lobbies <ChevronRight className="w-4 h-4" /></div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== LOBBY BROWSER ====================
  if (page === 'lobbies') {
    const filteredLobbies = lobbies.filter(l => l.mode === createMode)
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage('menu')} className="text-white/50 hover:text-white p-2"><ArrowLeft className="w-5 h-5" /></button>
              <h1 className="text-2xl font-bold text-white">{createMode === 'ffa' ? 'FFA' : 'Battle'} Lobbies</h1>
            </div>
            <button onClick={() => setPage('create-lobby')}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium text-sm transition-colors">
              <Plus className="w-4 h-4" /> Create Lobby
            </button>
          </div>

          {error && <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-red-300 text-sm mb-4">{error}</div>}

          {filteredLobbies.length === 0 ? (
            <div className="text-center py-16 text-white/40">
              <p className="text-lg mb-2">No lobbies found</p>
              <p className="text-sm">Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLobbies.map(lobby => (
                <div key={lobby.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{lobby.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lobby.state === 'waiting' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {lobby.state === 'waiting' ? 'Waiting' : 'In Game'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-white/40 text-sm">
                        <span><Users className="w-3.5 h-3.5 inline mr-1" />{lobby.players.length}/{lobby.maxPlayers}</span>
                        {lobby.mode === 'battle' && <span>{lobby.teamCount} teams</span>}
                      </div>
                      {/* Player list */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {lobby.players.map(p => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2 py-1 text-xs">
                            {p.profileImg ? <img src={p.profileImg} className="w-4 h-4 rounded-full" /> : <Users className="w-3 h-3 text-white/40" />}
                            <span className="text-white/80">{p.name}</span>
                            {p.id === lobby.hostId && <Crown className="w-3 h-3 text-yellow-400" />}
                            {lobby.mode === 'battle' && (
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[p.team]?.f }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {(lobby.state === 'waiting' || lobby.state === 'playing') && (
                      lobby.mode === 'battle' ? (
                        joinPickerLobbyId === lobby.id ? (
                          <div className="flex flex-col gap-1 shrink-0">
                            {Array.from({ length: lobby.teamCount }, (_, i) => (
                              <button key={i} onClick={() => { setJoinPickerLobbyId(null); handleJoinLobby(lobby.id, i) }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors hover:brightness-110"
                                style={{ backgroundColor: TEAM_COLORS[i]?.f + '40' }}>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[i]?.f }} />
                                {lobby.teams[i]?.entityName || TEAM_COLORS[i]?.name}
                              </button>
                            ))}
                            <button onClick={() => setJoinPickerLobbyId(null)} className="text-white/40 hover:text-white/60 text-xs text-center mt-0.5">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setJoinPickerLobbyId(lobby.id)}
                            className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors shrink-0 ${lobby.state === 'playing' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {lobby.state === 'playing' ? 'Join Game' : 'Join'}
                          </button>
                        )
                      ) : (
                        <button onClick={() => handleJoinLobby(lobby.id, 0)}
                          className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors shrink-0 ${lobby.state === 'playing' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                          {lobby.state === 'playing' ? 'Join Game' : 'Join'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==================== CREATE LOBBY ====================
  if (page === 'create-lobby') {
    const canStart = createMode === 'ffa' || createTeams.slice(0, createTeamCount).every(t => t)
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-lg mx-auto">
          <button onClick={() => setPage('lobbies')} className="text-white/50 hover:text-white text-sm mb-6 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back</button>
          <h1 className="text-3xl font-bold text-white mb-6">Create {createMode === 'ffa' ? 'FFA' : 'Battle'} Lobby</h1>

          {error && <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-red-300 text-sm mb-4">{error}</div>}

          <div className="mb-4">
            <label className="text-white/60 text-sm font-medium mb-2 block">Lobby Name</label>
            <input type="text" value={createName} onChange={e => setCreateName(e.target.value)} placeholder={`${playerData?.name || 'Player'}'s Game`}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none placeholder:text-white/30 focus:border-white/40" />
          </div>

          {createMode === 'battle' && (
            <>
              <div className="mb-6">
                <label className="text-white/60 text-sm font-medium mb-2 block">Number of Teams</label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => { setCreateTeamCount(n); if (joinTeam >= n) setJoinTeam(0) }}
                      className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${createTeamCount === n ? 'bg-white text-gray-900' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                      {n} Teams
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {Array.from({ length: createTeamCount }, (_, i) => {
                  const tc = TEAM_COLORS[i]; const team = createTeams[i]
                  return (
                    <div key={i} className="rounded-xl border p-4" style={{ borderColor: tc.f + '40', backgroundColor: tc.f + '10' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: tc.f }} /><span className="text-white font-semibold">{tc.name} Team</span></div>
                        <button onClick={() => setJoinTeam(i)} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${joinTeam === i ? 'bg-white text-gray-900' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                          {joinTeam === i ? 'Your Team' : 'Join'}
                        </button>
                      </div>
                      {team ? (
                        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-2">
                          {team.entityImg ? <img src={team.entityImg} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">{team.entityName[0]}</div>}
                          <div className="flex-1"><div className="text-white font-medium text-sm">{team.entityName}</div><div className="text-yellow-400 text-xs">{formatCompact(team.auraScore)} aura</div></div>
                          <button onClick={() => setCreateTeams(prev => { const n = [...prev]; n[i] = null; return n })} className="text-white/40 hover:text-white/80 p-1"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <EntitySearch onSelect={(e) => setCreateTeams(prev => { const n = [...prev]; n[i] = { entityId: e.id, entityName: e.name, entityType: e.type, entityImg: e.imageUrl, auraScore: e.auraScore }; return n })} />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <button onClick={handleCreateLobby} disabled={loading || !canStart}
            className="w-full py-3 rounded-xl font-bold text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Lobby'}
          </button>
        </div>
      </div>
    )
  }

  // ==================== WAITING ROOM ====================
  if (page === 'waiting-room' && currentLobby) {
    const isHost = currentLobby.hostId === user?.id
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">{currentLobby.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${currentLobby.mode === 'ffa' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
              {currentLobby.mode === 'ffa' ? 'Free For All' : 'Battle Mode'}
            </span>
          </div>

          {/* Players */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <h2 className="text-white/60 text-sm font-medium mb-3">Players ({currentLobby.players.length}/{currentLobby.maxPlayers})</h2>
            <div className="space-y-2">
              {currentLobby.players.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                  {p.profileImg ? <img src={p.profileImg} className="w-8 h-8 rounded-full" /> : <Users className="w-5 h-5 text-white/40" />}
                  <span className="text-white font-medium flex-1">{p.name}</span>
                  {p.id === currentLobby.hostId && <Crown className="w-4 h-4 text-yellow-400" />}
                  {currentLobby.mode === 'battle' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[p.team]?.f + '30', color: TEAM_COLORS[p.team]?.f }}>
                      {TEAM_COLORS[p.team]?.name}
                    </span>
                  )}
                </div>
              ))}
              {/* Bot slots */}
              {Array.from({ length: Math.max(0, 4 - currentLobby.players.length) }, (_, i) => (
                <div key={`bot-${i}`} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 opacity-40">
                  <Bot className="w-5 h-5 text-white/40" />
                  <span className="text-white/60 text-sm">[BOT] Slot</span>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Bots */}
          {myBots.length > 0 && currentLobby.state === 'playing' && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
              <h2 className="text-white/60 text-sm font-medium mb-3">Your Personal Bots</h2>
              <div className="space-y-2">
                {myBots.map(bot => (
                  <div key={bot.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                    {bot.entityImg ? <img src={bot.entityImg} className="w-7 h-7 rounded-full" /> : <Bot className="w-5 h-5 text-yellow-400" />}
                    <div className="flex-1"><div className="text-white text-sm font-medium">{bot.entityName}</div><div className="text-yellow-400 text-xs">{formatCompact(bot.auraScore)} aura</div></div>
                    <button onClick={() => handleDeployBot(bot.id)} className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium">Deploy</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Battle teams info */}
          {currentLobby.mode === 'battle' && currentLobby.teams.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
              <h2 className="text-white/60 text-sm font-medium mb-3">Teams</h2>
              <div className="space-y-2">
                {currentLobby.teams.map((team, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: TEAM_COLORS[i]?.f + '10' }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TEAM_COLORS[i]?.f }} />
                    <span className="text-white font-medium flex-1">{team.entityName}</span>
                    <span className="text-yellow-400 text-xs">{formatCompact(team.auraScore)} aura</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleLeaveLobby} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white transition-colors">Leave</button>
            {isHost && currentLobby.state === 'waiting' && (
              <button onClick={handleStartGame}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400 transition-all flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==================== PLAYING ====================

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
      <canvas ref={canvasRef} className="block" style={{ cursor: placingWall ? 'pointer' : 'crosshair' }} />

      {/* Leave button */}
      <button onClick={handleLeaveLobby}
        className="absolute top-2 left-2 text-white/40 hover:text-white text-xs bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded transition-colors z-10"
        style={{ pointerEvents: 'auto' }}>Leave</button>

      {/* Stat panel — diep.io style: bottom-left */}
      <div className="absolute left-3 bottom-10" style={{ userSelect: 'none', pointerEvents: 'auto' }}>
        <div className="flex flex-col gap-[3px]">
          {STAT_NAMES.map((name, i) => {
            const canUpgrade = ui.statPts > 0 && ui.stats[i] < STAT_MAX
            return (
              <div key={i} className="flex items-center gap-1.5 h-[26px]">
                {/* Pill body */}
                <div className="relative flex gap-[1px] h-full items-center bg-[#111] rounded-full px-[4px]">
                  {Array.from({ length: STAT_MAX }, (_, j) => (
                    <div key={j} style={{
                      width: 28, height: 18,
                      backgroundColor: j < ui.stats[i] ? STAT_COLORS[i] : '#333',
                      borderRadius: j === 0 ? '9px 2px 2px 9px' : j === STAT_MAX - 1 ? '2px 9px 9px 2px' : 2,
                    }} />
                  ))}
                  {/* Name overlay */}
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold pointer-events-none" style={{ textShadow: '0 1px 2px #000, 0 0 4px #000' }}>{name}</span>
                </div>
                {/* Upgrade button — matching upvote style */}
                <div className="relative shrink-0">
                  {i === 0 && ui.statPts > 0 && (
                    <span className="absolute -top-9 -right-4 rotate-12 text-2xl font-black" style={{ color: '#FFD700', textShadow: '0 1px 3px rgba(0,0,0,0.7)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {ui.statPts}x
                    </span>
                  )}
                  <button onClick={() => sendWS({ type: 'upgrade_stat', index: i })}
                    disabled={!canUpgrade}
                    className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:cursor-default hover:scale-110 active:scale-90"
                    style={{ backgroundColor: canUpgrade ? '#4a4a4a' : '#333' }}>
                    <ChevronUp className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Level pill + ability button — bottom, aligned with last stat row */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ userSelect: 'none' }}>
        {/* Ability button — for classes with abilities */}
        {TC[ui.classId]?.ability && (() => {
          const ability = TC[ui.classId]!.ability!
          if (ability === 'scope') {
            return (
              <div className="w-[44px] h-[34px] rounded-lg border-2 border-white/20 bg-black/60 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-black text-white/70" style={{ textShadow: '0 1px 2px #000' }}>SHIFT</span>
              </div>
            )
          }
          const onCooldown = ui.abilityCooldown > 0
          const maxCd = ability === 'wall' ? 3 : ui.classId === 'phantom' ? 9 : 10
          const cdPct = onCooldown ? (ui.abilityCooldown / maxCd) * 100 : 0
          const isActive = ability === 'wall' ? placingWall : (ui.abilityCooldown > 5)
          const handleClick = () => {
            if (onCooldown) return
            if (ability === 'wall') setPlacingWall(prev => !prev)
            else if (ability === 'stealth') wsRef.current?.send(JSON.stringify({ type: 'activate_stealth' }))
          }
          return (
            <button onClick={handleClick}
              disabled={onCooldown}
              className={`relative w-[34px] h-[34px] rounded-lg border-2 flex items-center justify-center transition-all shrink-0 overflow-hidden ${isActive ? 'border-amber-400 bg-amber-500/30' : onCooldown ? 'border-white/10 bg-black/70 cursor-not-allowed' : 'border-white/20 bg-black/60 hover:border-white/40'}`}
              style={{ pointerEvents: 'auto' }}>
              {onCooldown && (
                <div className="absolute bottom-0 left-0 right-0 bg-white/20 transition-all" style={{ height: `${cdPct}%` }} />
              )}
              <span className={`relative text-xs font-black ${onCooldown ? 'text-white/40' : 'text-white'}`} style={{ textShadow: '0 1px 2px #000' }}>
                {onCooldown ? Math.ceil(ui.abilityCooldown) : 'Q'}
              </span>
            </button>
          )
        })()}
        {/* Level pill */}
        <div className="relative h-[26px] w-[320px] rounded-full overflow-hidden bg-[#111] border-2 border-black" style={{ pointerEvents: 'none' }}>
          <div className="h-full rounded-full transition-all duration-200"
            style={{ width: `${ui.xpNext > 0 ? (ui.xp / ui.xpNext) * 100 : 100}%`, backgroundColor: '#722F37' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white" style={{ textShadow: '0 1px 2px #000' }}>
              Lvl {ui.level} {ui.className}
            </span>
          </div>
        </div>
      </div>

      {/* Class upgrade — top left boxes */}
      {ui.showUpgrade && (
        <div className="absolute top-10 left-3 flex flex-col gap-2" style={{ pointerEvents: 'auto', userSelect: 'none' }}>
          {ui.availableUpgrades.map(tc => (
            <button key={tc.id} onClick={() => sendWS({ type: 'select_class', classId: tc.id })}
              className="flex items-center gap-2.5 bg-black/60 hover:bg-black/80 border border-white/20 hover:border-white/50 rounded-lg px-3 py-2 text-white transition-all">
              <TankPreview classId={tc.id} size={36} />
              <span className="text-xs font-bold">{tc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Death screen */}
      {ui.dead && !ui.battleOver && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-white" style={{ textShadow: '0 2px 4px #000' }}>You were destroyed!</h2>
            <p className="text-white/60 text-sm">Score: {formatCompact(ui.score)}</p>
            <button onClick={() => sendWS({ type: 'respawn' })}
              className="px-8 py-2.5 bg-[#4A7AEC] hover:bg-[#5A8AFF] rounded text-white font-bold text-lg transition-colors">Respawn</button>
          </div>
        </div>
      )}

      {/* Battle over */}
      {ui.battleOver && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="text-center space-y-4">
            {ui.winningTeam === ui.myTeam ? (
              <><h2 className="text-4xl font-black text-green-400" style={{ textShadow: '0 2px 4px #000' }}>VICTORY!</h2><p className="text-white/60">Your team's base survived!</p></>
            ) : (
              <><h2 className="text-4xl font-black text-red-400" style={{ textShadow: '0 2px 4px #000' }}>DEFEAT</h2><p className="text-white/60">{ui.winningTeam >= 0 ? `${TEAM_COLORS[ui.winningTeam].name} team wins!` : 'All bases destroyed!'}</p></>
            )}
            <button onClick={handleLeaveLobby} className="px-8 py-2.5 bg-[#4A7AEC] hover:bg-[#5A8AFF] rounded text-white font-bold text-lg transition-colors">Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  )
}
