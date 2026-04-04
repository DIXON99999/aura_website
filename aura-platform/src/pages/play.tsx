import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore, useAuraStore } from '@/stores'
import { Swords, Shield, ChevronRight, Search, X, Users, Trophy, Plus, ArrowLeft, Play, Bot, Loader2, Crown } from 'lucide-react'

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
  profileImg?: string; playerId?: string; isPersonalBot?: boolean
}
interface SnapshotShape { id: number; x: number; y: number; radius: number; rot: number; sides: number; fill: string; ol: string; hp: number; maxHp: number; flash: number; type: string }
interface SnapshotBullet { id: number; x: number; y: number; radius: number; fill: string; ol: string }
interface SnapshotParticle { x: number; y: number; r: number; fill: string; alpha: number }
interface SnapshotBase { id: number; x: number; y: number; hp: number; maxHp: number; radius: number; rot: number; team: number; flash: number; entityName: string; entityId: string; entityType: string; entityImg?: string; destroyed: boolean }

interface GameSnapshot {
  tanks: SnapshotTank[]; shapes: SnapshotShape[]; bullets: SnapshotBullet[]
  particles: SnapshotParticle[]; bases: SnapshotBase[]
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
  reloadMul?: number; bulletSizeMul?: number; bulletSpeedMul?: number; bulletDamageMul?: number
}
interface TankClass { id: string; name: string; tier: number; barrels: BarrelDef[]; upgradesFrom?: string[]; fov?: number; recoil?: number }

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
  basic: { id: 'basic', name: 'Tank', tier: 0, barrels: [{ angle: 0, width: 0.84, length: 2.4 }] },
  twin: { id: 'twin', name: 'Twin', tier: 1, upgradesFrom: ['basic'], recoil: 0.7, barrels: [{ angle: 0, width: 0.6, length: 2.4, offset: 0.5 }, { angle: 0, width: 0.6, length: 2.4, offset: -0.5 }] },
  sniper: { id: 'sniper', name: 'Sniper', tier: 1, upgradesFrom: ['basic'], fov: 1.25, barrels: [{ angle: 0, width: 0.65, length: 3.2, bulletSpeedMul: 1.5, reloadMul: 1.6, bulletDamageMul: 1.4 }] },
  machineGun: { id: 'machineGun', name: 'Machine Gun', tier: 1, upgradesFrom: ['basic'], barrels: [{ angle: 0, width: 0.6, length: 2.4, widthEnd: 1.1, reloadMul: 0.55, bulletDamageMul: 0.65 }] },
  flankGuard: { id: 'flankGuard', name: 'Flank Guard', tier: 1, upgradesFrom: ['basic'], barrels: [{ angle: 0, width: 0.84, length: 2.4 }, { angle: Math.PI, width: 0.65, length: 2.0 }] },
  tripleShot: { id: 'tripleShot', name: 'Triple Shot', tier: 2, upgradesFrom: ['twin'], barrels: [{ angle: -0.45, width: 0.65, length: 2.2 }, { angle: 0, width: 0.65, length: 2.5 }, { angle: 0.45, width: 0.65, length: 2.2 }] },
  quadTank: { id: 'quadTank', name: 'Quad Tank', tier: 2, upgradesFrom: ['twin', 'flankGuard'], barrels: [{ angle: 0, width: 0.72, length: 2.2 }, { angle: Math.PI / 2, width: 0.72, length: 2.2 }, { angle: Math.PI, width: 0.72, length: 2.2 }, { angle: -Math.PI / 2, width: 0.72, length: 2.2 }] },
  assassin: { id: 'assassin', name: 'Assassin', tier: 2, upgradesFrom: ['sniper'], fov: 1.45, barrels: [{ angle: 0, width: 0.6, length: 3.8, bulletSpeedMul: 1.8, reloadMul: 2.0, bulletDamageMul: 1.7 }] },
  destroyer: { id: 'destroyer', name: 'Destroyer', tier: 2, upgradesFrom: ['machineGun'], recoil: 2.5, barrels: [{ angle: 0, width: 1.1, length: 2.4, reloadMul: 3.0, bulletDamageMul: 3.0, bulletSizeMul: 2.0, bulletSpeedMul: 0.8 }] },
  sprayer: { id: 'sprayer', name: 'Sprayer', tier: 2, upgradesFrom: ['machineGun'], barrels: [{ angle: 0, width: 0.72, length: 2.2, reloadMul: 0.5, bulletDamageMul: 0.6 }, { angle: 0, width: 0.42, length: 2.8, reloadMul: 0.5, bulletDamageMul: 0.4, bulletSizeMul: 0.7 }] },
  triAngle: { id: 'triAngle', name: 'Tri-Angle', tier: 2, upgradesFrom: ['flankGuard'], recoil: 0.4, barrels: [{ angle: 0, width: 0.84, length: 2.4 }, { angle: 2.6, width: 0.55, length: 1.9 }, { angle: -2.6, width: 0.55, length: 1.9 }] },
  octoTank: { id: 'octoTank', name: 'Octo Tank', tier: 3, upgradesFrom: ['quadTank'], barrels: Array.from({ length: 8 }, (_, i) => ({ angle: (i * Math.PI * 2) / 8, width: 0.65, length: 2.1, reloadMul: 0.8, bulletDamageMul: 0.6 })) },
  pentaShot: { id: 'pentaShot', name: 'Penta Shot', tier: 3, upgradesFrom: ['tripleShot'], barrels: [{ angle: -0.7, width: 0.55, length: 2.0 }, { angle: -0.35, width: 0.55, length: 2.3 }, { angle: 0, width: 0.55, length: 2.5 }, { angle: 0.35, width: 0.55, length: 2.3 }, { angle: 0.7, width: 0.55, length: 2.0 }] },
  annihilator: { id: 'annihilator', name: 'Annihilator', tier: 3, upgradesFrom: ['destroyer'], recoil: 3.5, barrels: [{ angle: 0, width: 1.3, length: 2.6, reloadMul: 4.0, bulletDamageMul: 5.0, bulletSizeMul: 2.5, bulletSpeedMul: 0.7 }] },
  booster: { id: 'booster', name: 'Booster', tier: 3, upgradesFrom: ['triAngle'], recoil: 0.3, barrels: [{ angle: 0, width: 0.72, length: 2.4 }, { angle: 2.4, width: 0.48, length: 1.8 }, { angle: Math.PI, width: 0.48, length: 1.8, offset: 0.42 }, { angle: Math.PI, width: 0.48, length: 1.8, offset: -0.42 }, { angle: -2.4, width: 0.48, length: 1.8 }] },
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
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
    const ratio = clamp(s.hp / s.maxHp, 0, 1), bw = s.radius * 1.8
    ctx.fillStyle = '#333'; ctx.fillRect(s.x - bw / 2, s.y + s.radius + 6, bw, 5)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed; ctx.fillRect(s.x - bw / 2, s.y + s.radius + 6, bw * ratio, 5)
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: SnapshotBullet) {
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
  ctx.fillStyle = b.fill; ctx.fill(); ctx.strokeStyle = b.ol; ctx.lineWidth = OL * 0.7; ctx.stroke()
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

function drawTank(ctx: CanvasRenderingContext2D, t: SnapshotTank) {
  if (!t.alive) return
  const r = t.radius
  const tc = TC[t.classId] || TC.basic

  ctx.save(); ctx.translate(t.x, t.y)
  ctx.save(); ctx.rotate(t.angle)
  for (let i = 0; i < tc.barrels.length; i++) drawBarrel(ctx, tc.barrels[i], r, t.recoils[i] || 0)
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

  // Name + bot badge
  const label = t.isPersonalBot ? `★ ${t.name}` : t.name
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = t.isPersonalBot ? '#FFD700' : '#FFF'
  ctx.strokeText(label, t.x, t.y - r - 8); ctx.fillText(label, t.x, t.y - r - 8)

  if (t.hp < t.maxHp) {
    const ratio = clamp(t.hp / t.maxHp, 0, 1), bw = r * 2.2
    ctx.fillStyle = '#333'; ctx.fillRect(t.x - bw / 2, t.y + r + 5, bw, 5)
    ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
    ctx.fillRect(t.x - bw / 2, t.y + r + 5, bw * ratio, 5)
  }
}

function drawBase(ctx: CanvasRenderingContext2D, base: SnapshotBase) {
  if (base.destroyed) return
  const tc = TEAM_COLORS[base.team]
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

  const ratio = clamp(base.hp / base.maxHp, 0, 1), bw = base.radius * 2
  ctx.fillStyle = '#333'; ctx.fillRect(base.x - bw / 2, base.y + base.radius + 10, bw, 8)
  ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
  ctx.fillRect(base.x - bw / 2, base.y + base.radius + 10, bw * ratio, 8)
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#FFF'
  ctx.strokeText(`${Math.ceil(base.hp)} / ${base.maxHp}`, base.x, base.y + base.radius + 30)
  ctx.fillText(`${Math.ceil(base.hp)} / ${base.maxHp}`, base.x, base.y + base.radius + 30)
}

function drawHUD(ctx: CanvasRenderingContext2D, snap: GameSnapshot, me: SnapshotTank | undefined, cw: number, ch: number) {
  if (!me) return

  // XP Bar
  const barW = Math.min(350, cw * 0.4), barH = 25
  const bx = (cw - barW) / 2, by = ch - barH - 20
  const xpRatio = me.xpNext > 0 ? clamp(me.xp / me.xpNext, 0, 1) : 0
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx, by, barW, barH)
  ctx.fillStyle = C.xp; ctx.fillRect(bx, by, barW * xpRatio, barH)
  ctx.strokeStyle = C.xpOl; ctx.lineWidth = 2; ctx.strokeRect(bx, by, barW, barH)
  const cn = TC[me.classId]?.name || 'Tank'
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#FFF'
  ctx.strokeText(`Level ${me.level} ${cn}`, cw / 2, by + barH / 2)
  ctx.fillText(`Level ${me.level} ${cn}`, cw / 2, by + barH / 2)
  ctx.font = 'bold 15px sans-serif'
  ctx.strokeText(`Score: ${me.score.toLocaleString()}`, cw / 2, by - 14)
  ctx.fillText(`Score: ${me.score.toLocaleString()}`, cw / 2, by - 14)

  // Leaderboard (FFA)
  if (snap.mode === 'ffa') {
    const allTanks = snap.tanks.filter(t => t.alive).sort((a, b) => b.score - a.score).slice(0, 10)
    const topScore = allTanks[0]?.score || 1
    const lw = 200, lx = cw - lw - 10, ly = 10, rowH = 22
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(lx, ly, lw, allTanks.length * rowH + 30)
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'
    ctx.fillText('Leaderboard', lx + lw / 2, ly + 15)
    ctx.font = '12px sans-serif'; ctx.textAlign = 'left'
    for (let i = 0; i < allTanks.length; i++) {
      const t = allTanks[i], ey = ly + 30 + i * rowH
      const bW = (lw - 40) * Math.max(0.05, t.score / topScore)
      ctx.fillStyle = t.fill; ctx.globalAlpha = t.playerId ? 0.5 : 0.25
      ctx.fillRect(lx + 5, ey, bW, rowH - 4); ctx.globalAlpha = 1
      ctx.fillStyle = '#FFF'
      ctx.fillText(`${i + 1}. ${t.name}`, lx + 8, ey + rowH / 2 + 3)
      ctx.textAlign = 'right'
      ctx.fillText(t.score.toLocaleString(), lx + lw - 8, ey + rowH / 2 + 3)
      ctx.textAlign = 'left'
    }
  }

  // Battle: team base status
  if (snap.mode === 'battle') {
    const lw = 220, lx = cw - lw - 10, ly = 10
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(lx, ly, lw, snap.bases.length * 45 + 35)
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'
    ctx.fillText('Team Bases', lx + lw / 2, ly + 18)
    for (let i = 0; i < snap.bases.length; i++) {
      const base = snap.bases[i]
      const tc = TEAM_COLORS[base.team]
      const ey = ly + 30 + i * 45
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'
      ctx.fillStyle = base.destroyed ? '#666' : tc.f
      const teamLabel = base.team === me.team ? ' (You)' : ''
      ctx.fillText(`${tc.name}: ${base.entityName}${teamLabel}`, lx + 8, ey + 12)
      if (!base.destroyed) {
        const ratio = clamp(base.hp / base.maxHp, 0, 1)
        ctx.fillStyle = '#333'; ctx.fillRect(lx + 8, ey + 18, lw - 16, 8)
        ctx.fillStyle = ratio > 0.3 ? C.hpGreen : C.hpRed
        ctx.fillRect(lx + 8, ey + 18, (lw - 16) * ratio, 8)
      } else {
        ctx.font = '10px sans-serif'; ctx.fillStyle = '#F14E54'
        ctx.fillText('DESTROYED', lx + 8, ey + 28)
      }
    }
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

  // Minimap
  const sz = 140, mx = cw - sz - 10, my = ch - sz - 60, sc = sz / WORLD
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(mx, my, sz, sz)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, sz, sz)
  for (const t of snap.tanks) {
    if (!t.alive) continue
    ctx.fillStyle = t.fill; ctx.beginPath()
    ctx.arc(mx + t.x * sc, my + t.y * sc, t.playerId ? 4 : 2.5, 0, Math.PI * 2); ctx.fill()
  }
  for (const base of snap.bases) {
    if (base.destroyed) continue
    ctx.fillStyle = TEAM_COLORS[base.team].f; ctx.globalAlpha = 0.6
    ctx.beginPath()
    const bx2 = mx + base.x * sc, by2 = my + base.y * sc
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6 - Math.PI / 2
      const px = bx2 + 6 * Math.cos(a), py = by2 + 6 * Math.sin(a)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1
  }
}

function renderSnapshot(ctx: CanvasRenderingContext2D, snap: GameSnapshot, myTankId: number, cw: number, ch: number) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, ch)

  const me = snap.tanks.find(t => t.id === myTankId)
  const camX = me?.x ?? WORLD / 2
  const camY = me?.y ?? WORLD / 2
  const camZoom = me ? (1 - (me.level - 1) * 0.004) / (TC[me.classId]?.fov || 1) : 1

  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.scale(camZoom, camZoom)
  ctx.translate(-camX, -camY)

  drawGrid(ctx, { x: camX, y: camY, zoom: camZoom }, cw, ch)
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 5; ctx.setLineDash([])
  ctx.strokeRect(0, 0, WORLD, WORLD)

  for (const b of snap.bullets) drawBullet(ctx, b)
  for (const s of snap.shapes) drawShape(ctx, s)
  for (const base of snap.bases) drawBase(ctx, base)
  for (const t of snap.tanks) drawTank(ctx, t)
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

  // Game state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const myTankIdRef = useRef(-1)
  const animRef = useRef(0)
  const keysRef = useRef(new Set<string>())
  const mouseRef = useRef({ x: 0, y: 0, down: false })

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
    className: 'Tank', dead: false, showUpgrade: false,
    availableUpgrades: [] as TankClass[], autoFire: false,
    battleOver: false, winningTeam: -1, myTeam: -1, mode: 'ffa' as GameMode,
  })

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
          snapshotRef.current = msg.data
          myTankIdRef.current = msg.you
          // If we receive a snapshot while still in waiting-room, the game is already running (late join)
          setPage(prev => prev === 'waiting-room' ? 'playing' : prev)
          break
        case 'lobby_update':
          setCurrentLobby(msg.lobby)
          break
        case 'game_start':
          setPage('playing')
          break
        case 'game_over':
          setUi(prev => ({ ...prev, battleOver: true, winningTeam: msg.winningTeam }))
          break
      }
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
    }, 1000 / 20)
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
      const dt = (time - lastTime) / 1000
      lastTime = time
      const snap = snapshotRef.current
      if (snap) {
        const rect = container.getBoundingClientRect()
        renderSnapshot(ctx, snap, myTankIdRef.current, rect.width, rect.height)

        // Sync UI periodically
        syncTimer += dt
        if (syncTimer > 0.15) {
          syncTimer = 0
          const me = snap.tanks.find(t => t.id === myTankIdRef.current)
          if (me) {
            const currentTier = TC[me.classId]?.tier ?? 0
            const qualifiedTier = me.level >= 45 ? 3 : me.level >= 30 ? 2 : me.level >= 15 ? 1 : 0
            const ups = qualifiedTier > currentTier ? getUpgrades(me.classId) : []
            setUi({
              stats: [...me.stats], statPts: me.statPts, level: me.level, score: me.score,
              className: TC[me.classId]?.name || 'Tank',
              dead: !me.alive,
              showUpgrade: ups.length > 0 && me.alive,
              availableUpgrades: ups,
              autoFire: false,
              battleOver: snap.battleOver, winningTeam: snap.winningTeam,
              myTeam: me.team, mode: snap.mode,
            })
          }
        }
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
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()) }
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left; mouseRef.current.y = e.clientY - rect.top
    }
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = true }
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
                      <button onClick={() => handleJoinLobby(lobby.id, 0)}
                        className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors shrink-0 ${lobby.state === 'playing' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {lobby.state === 'playing' ? 'Join Game' : 'Join'}
                      </button>
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
      <canvas ref={canvasRef} className="block cursor-crosshair" />

      {/* Back to menu */}
      <button onClick={handleLeaveLobby}
        className="absolute top-2 left-2 text-white/40 hover:text-white text-xs bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-lg transition-colors"
        style={{ pointerEvents: 'auto' }}>Leave</button>

      {/* Stat panel */}
      <div className="absolute left-2 bottom-20 flex flex-col gap-1" style={{ userSelect: 'none', pointerEvents: 'auto' }}>
        {ui.statPts > 0 && <div className="text-yellow-300 text-xs font-bold bg-black/50 px-2 py-1 rounded text-center mb-1">x{ui.statPts} Stat Points</div>}
        {STAT_NAMES.map((name, i) => (
          <div key={i} className="flex items-center gap-1">
            <button onClick={() => sendWS({ type: 'upgrade_stat', index: i })}
              disabled={ui.statPts <= 0 || ui.stats[i] >= STAT_MAX}
              className="w-5 h-5 rounded text-white font-bold text-xs bg-black/40 hover:bg-black/60 disabled:opacity-20 disabled:cursor-default flex items-center justify-center shrink-0">+</button>
            <div className="flex gap-0.5">
              {Array.from({ length: STAT_MAX }, (_, j) => (
                <div key={j} className="w-[14px] h-3 rounded-sm" style={{ backgroundColor: j < ui.stats[i] ? STAT_COLORS[i] : 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.15)' }} />
              ))}
            </div>
            <span className="text-white text-[10px] font-medium ml-1" style={{ textShadow: '0 1px 2px #000' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Class upgrade */}
      {ui.showUpgrade && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 flex gap-3" style={{ pointerEvents: 'auto', userSelect: 'none' }}>
          {ui.availableUpgrades.map(tc => (
            <button key={tc.id} onClick={() => sendWS({ type: 'select_class', classId: tc.id })}
              className="w-[88px] h-[88px] bg-black/60 hover:bg-black/80 border border-white/30 hover:border-white/60 rounded-lg flex flex-col items-center justify-center text-white transition-all">
              <TankPreview classId={tc.id} size={44} />
              <span className="text-[10px] font-bold mt-1">{tc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Death screen */}
      {ui.dead && !ui.battleOver && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="bg-gray-900/90 text-white rounded-xl p-8 text-center space-y-4 min-w-[300px]">
            <h2 className="text-2xl font-bold">You were destroyed!</h2>
            <button onClick={() => sendWS({ type: 'respawn' })}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors">Respawn</button>
          </div>
        </div>
      )}

      {/* Battle over */}
      {ui.battleOver && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="bg-gray-900/90 text-white rounded-xl p-8 text-center space-y-4 min-w-[340px]">
            {ui.winningTeam === ui.myTeam ? (
              <><h2 className="text-3xl font-black text-green-400">VICTORY!</h2><p className="text-white/60">Your team's base survived!</p></>
            ) : (
              <><h2 className="text-3xl font-black text-red-400">DEFEAT</h2><p className="text-white/60">{ui.winningTeam >= 0 ? `${TEAM_COLORS[ui.winningTeam].name} team wins!` : 'All bases destroyed!'}</p></>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={handleLeaveLobby} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors">Back to Menu</button>
            </div>
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
