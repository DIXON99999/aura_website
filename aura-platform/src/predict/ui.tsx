import { useState, type ReactNode } from 'react'
import { stageOf, type Stage } from './stage'


// Organizer themes, matched on the PandaScore league name. Each card gets a
// solid header in the organizer's own colours (sampled from their logos) with
// the logo recoloured to sit on it. Logos live in public/orgs/ (via Liquipedia).
type LogoTone = 'white' | 'black' | 'original'
interface OrgTheme {
  key: string
  label: string
  bg: string          // solid header colour
  fg: string          // header text colour
  stripe?: string     // secondary brand colour, drawn under the header
  logo?: string
  logoTone: LogoTone
  logoH: number       // logo height in px (logos have very different aspect ratios)
  match: RegExp
  prefix: RegExp      // stripped from the event name so the org isn't repeated
}
const ORGS: OrgTheme[] = [
  { key: 'blast', label: 'BLAST', bg: '#3d6dff', fg: '#ffffff', stripe: '#000000', logo: '/orgs/blast.png',
    logoTone: 'white', logoH: 13, match: /^blast\b/i, prefix: /^blast\s+/i },
  { key: 'esl', label: 'ESL', bg: '#e5ff00', fg: '#000000', stripe: '#2fa8de', logo: '/orgs/esl.png',
    logoTone: 'black', logoH: 18, match: /^(esl|iem|intel extreme masters)\b/i, prefix: /^esl\s+/i },
  { key: 'esea', label: 'ESEA', bg: '#189048', fg: '#ffffff', logo: '/orgs/esea.png',
    logoTone: 'white', logoH: 11, match: /^esea\b/i, prefix: /^esea\s+/i },
  { key: 'pgl', label: 'PGL', bg: '#e30613', fg: '#ffffff', stripe: '#000000', logo: '/orgs/pgl.png',
    logoTone: 'white', logoH: 13, match: /^pgl\b/i, prefix: /^pgl\s+/i },
  { key: 'cct', label: 'CCT', bg: '#ffd800', fg: '#000000', logo: '/orgs/cct.png',
    logoTone: 'black', logoH: 18, match: /^cct\b/i, prefix: /^cct\s+/i },
  { key: 'starladder', label: 'StarLadder', bg: '#d80000', fg: '#ffffff', logo: '/orgs/starladder.png',
    logoTone: 'white', logoH: 11, match: /^starladder\b/i, prefix: /^starladder\s+/i },
  { key: 'pw', label: 'PERFECT WORLD', bg: '#f09018', fg: '#000000', stripe: '#000000',
    logoTone: 'original', logoH: 0, match: /^perfect world\b/i, prefix: /^perfect world\s+/i },
]
export function orgTheme(league: string | null): OrgTheme | null {
  return (league && ORGS.find((o) => o.match.test(league))) || null
}

const LOGO_FILTER: Record<LogoTone, string | undefined> = {
  white: 'brightness(0) invert(1)',
  black: 'brightness(0)',
  original: undefined,
}

/** Small pill switch (used for the tier filters on Matches and History). */
export function Segmented<T>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-xs">
      {options.map((o) => (
        <button
          key={o.label}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
            value === o.value ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const CUT = 14 // px — horizontal run of the tab's diagonal edge

/** Organizer tab: a diagonal-cut block of solid brand colour holding the logo,
 *  tucked into the card's top-left corner. The secondary brand colour (if any)
 *  peeks out as a thin parallel sliver behind the cut. */
function OrgTab({ t }: { t: OrgTheme }) {
  const clip = (extra: number) =>
    `polygon(0 0, 100% 0, calc(100% - ${CUT + extra}px) 100%, 0 100%)`
  const showStripe = t.stripe && t.stripe !== '#000000'
  return (
    <span className="relative flex shrink-0 self-stretch" title={t.label}>
      {showStripe && (
        <span className="absolute inset-y-0 left-0" style={{ right: -5, background: t.stripe, clipPath: clip(-5) }} />
      )}
      <span
        className="relative flex items-center pl-3.5"
        style={{ background: t.bg, color: t.fg, clipPath: clip(0), paddingRight: CUT + 10 }}
      >
        {t.logo ? (
          <img src={t.logo} alt={t.label} style={{ height: t.logoH, filter: LOGO_FILTER[t.logoTone] }} />
        ) : (
          <span className="font-display text-[10px] font-black tracking-wider">{t.label}</span>
        )}
      </span>
    </span>
  )
}


function StageBadge({ s }: { s: Stage }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-[3px] text-[10px] font-extrabold leading-none tracking-wider text-black ${
        s.level === 'gf' ? 'shadow-[0_0_10px_rgba(255,201,60,0.45)]' : ''
      }`}
      style={{ background: s.bg }}
    >
      {s.label}
    </span>
  )
}

/** Match card; organizer shown as a corner tab. `event` is the full event
 *  name; `right` sits at the header's right edge (time, tier badge...);
 *  `matchName` (if given) adds a QF / SF / Grand Final badge. */
const TONE_BG = {
  neutral: 'bg-white/[0.035] hover:bg-white/[0.055]',
  good: 'bg-emerald-500/[0.13] hover:bg-emerald-500/[0.17]',
  bad: 'bg-rose-500/[0.13] hover:bg-rose-500/[0.17]',
}

export function ThemedCard({ league, event, matchName, right, tone = 'neutral', bodyClassName = '', children }: {
  league: string | null; event: string; matchName?: string | null; right?: ReactNode
  /** tints the whole card — used on History for a correct / wrong pick */
  tone?: keyof typeof TONE_BG
  bodyClassName?: string; children: ReactNode
}) {
  const t = orgTheme(league)
  const shown = t ? event.replace(t.prefix, '') : event
  const stage = stageOf(matchName)
  return (
    <div
      className={`overflow-hidden rounded-2xl transition-colors ${TONE_BG[tone]} ${
        stage?.level === 'gf' ? 'ring-1 ring-[#ffc93c]/70 shadow-[0_0_24px_-6px_rgba(255,201,60,0.35)]' : ''
      }`}
    >
      <div
        className="flex min-h-[32px] items-stretch justify-between gap-3 pr-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
        title={matchName ? `${event} — ${matchName}` : event}
      >
        <span className="flex min-w-0 items-stretch">
          {t && <OrgTab t={t} />}
          <span className={`flex min-w-0 items-center gap-2 ${t ? 'pl-2' : 'pl-4'}`}>
            {stage && <StageBadge s={stage} />}
            <span className="truncate">{shown}</span>
          </span>
        </span>
        {right && <span className="flex shrink-0 items-center gap-2 text-neutral-400">{right}</span>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

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
      // real logos sit unframed (no rounding/clipping, so wide marks like MOUZ
      // aren't cut at the corners); only the monogram fallback gets a tile
      className={`grid shrink-0 place-items-center ${show ? '' : 'overflow-hidden rounded-xl ring-1 ring-white/10'}`}
      style={{ width: size, height: size, background: show ? 'transparent' : bg }}
      aria-hidden
    >
      {show ? (
        <img
          src={logo!}
          alt=""
          onError={() => setBroken(true)}
          className="h-[90%] w-[90%] object-contain"
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
