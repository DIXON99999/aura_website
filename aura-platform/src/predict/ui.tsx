import { useState } from 'react'

// A muted, dark-friendly palette for monogram fallbacks — picked by name so a
// team always gets the same tile color even before its real logo loads.
const TILE = [
  ['#1f3a34', '#5eead4'], ['#22303f', '#7dd3fc'], ['#332036', '#f0abfc'],
  ['#3a2a1e', '#fdba74'], ['#2a2440', '#c4b5fd'], ['#132f24', '#86efac'],
  ['#3a1f29', '#fda4af'], ['#2b3320', '#bef264'],
]
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function initials(name: string) {
  const parts = name.replace(/[.\-_]/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?'
}

export function TeamLogo({ name, logo, size = 44 }: { name: string; logo?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  const [bg, fg] = TILE[hash(name) % TILE.length]
  const show = logo && !broken
  return (
    <div
      className="grid place-items-center overflow-hidden rounded-xl shrink-0 ring-1 ring-white/10"
      style={{ width: size, height: size, background: show ? 'rgba(255,255,255,0.04)' : bg }}
      aria-hidden
    >
      {show ? (
        <img
          src={logo!}
          alt=""
          onError={() => setBroken(true)}
          className="h-[78%] w-[78%] object-contain"
          loading="lazy"
        />
      ) : (
        <span className="font-display font-semibold leading-none" style={{ color: fg, fontSize: size * 0.4 }}>
          {initials(name)}
        </span>
      )}
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-neutral-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-400" />
      {label}
    </div>
  )
}

export function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="my-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      Couldn't reach the prediction API ({msg}). Is the backend running on :3001?
    </div>
  )
}
