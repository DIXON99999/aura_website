// The correct-prediction moment: a card that flips from its live state to the
// final result, with a green burst when the model called it (CSS in index.css;
// motion is skipped under prefers-reduced-motion).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { eventName, type MatchDetail } from './api'
import { TeamLogo, ThemedCard, CardLink } from './ui'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Two faces in one grid cell; `flipped` rotates to the back. The hidden face
 *  ignores clicks so links on it can't be hit through the other side. */
export function FlipCard({ flipped, front, back }: { flipped: boolean; front: ReactNode; back: ReactNode }) {
  return (
    <div className={`flip-card ${flipped ? 'flipped' : ''}`}>
      <div className="flip-card-inner">
        <div className={flipped ? 'pointer-events-none' : ''} aria-hidden={flipped}>{front}</div>
        <div className={`flip-card-back ${flipped ? '' : 'pointer-events-none'}`} aria-hidden={!flipped}>{back}</div>
      </div>
    </div>
  )
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.17
  const dist = 70 + (i % 3) * 28
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist * 0.75}px`,
    size: `${5 + (i % 3) * 2}px`,
    delay: `${(i % 4) * 35}ms`,
    color: ['#34d399', '#10b981', '#a7f3d0', '#ffffff'][i % 4],
  }
})

/** Particles radiating from the centre of the parent (which must be `relative`). */
export function Burst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible" aria-hidden>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="burst-particle"
          style={{ '--dx': p.dx, '--dy': p.dy, '--size': p.size, '--delay': p.delay, background: p.color } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** Final-result face: score, winner, and whether the model called it. */
export function ResultFace({ d, onDismiss }: { d: MatchDetail; onDismiss?: () => void }) {
  const a = d.teamA, b = d.teamB
  const aWon = d.winnerId != null && d.winnerId === a?.id
  const fav = d.probA == null ? null : d.probA >= 0.5 ? a : b
  const favPct = d.probA == null ? null : Math.max(d.probA, 1 - d.probA)
  const Side = ({ name, logo, score, won, right }: { name: string; logo: string | null; score: number | null | undefined; won: boolean; right?: boolean }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <TeamLogo name={name} logo={logo} />
      <div className="min-w-0">
        <div className={`truncate font-display font-semibold ${won ? 'text-white' : 'text-neutral-400'}`}>{name}</div>
        <div className={`font-display text-2xl font-bold tabular-nums ${won ? 'text-white' : 'text-neutral-500'}`}>{score ?? '–'}</div>
      </div>
    </div>
  )
  return (
    <CardLink to={`/match/${d.matchId}`} label={`Result: ${a?.name ?? 'TBD'} vs ${b?.name ?? 'TBD'}`}>
      <ThemedCard
        league={d.league}
        event={`${eventName(d.league, d.serie)}${d.bo ? ` · BO${d.bo}` : ''}`}
        matchName={d.name}
        right={
          <span className="flex items-center gap-2">
            <span className="font-bold text-neutral-300">FINAL</span>
            {onDismiss && (
              <button
                onClick={(e) => { e.preventDefault(); onDismiss() }}
                className="relative z-20 -mr-1 rounded px-1 text-base leading-none text-neutral-500 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >×</button>
            )}
          </span>
        }
        tone={d.correct == null ? 'neutral' : d.correct ? 'good' : 'bad'}
        bodyClassName="p-4"
      >
        <div className="flex items-center gap-2">
          <Side name={a?.name ?? 'TBD'} logo={a?.logo ?? null} score={d.score?.[0]} won={aWon} />
          <span className="font-display text-xs font-medium text-neutral-600">FT</span>
          <Side name={b?.name ?? 'TBD'} logo={b?.logo ?? null} score={d.score?.[1]} won={!aWon} right />
        </div>
        {d.correct != null && fav && favPct != null && (
          <div className={`mt-3.5 rounded-lg px-3 py-2 text-center text-sm font-semibold ${
            d.correct ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}>
            {d.correct ? `✓ Model called it — ${fav.name} at ${pct(favPct)}` : `Upset — model had ${fav.name} at ${pct(favPct)}`}
          </div>
        )}
      </ThemedCard>
    </CardLink>
  )
}

/** Shows `front` (the last live view), then flips to the result; a burst plays
 *  if the model was right, a small shake if it wasn't. */
export function FinishedCard({ front, result, onDismiss }: { front: ReactNode; result: MatchDetail; onDismiss: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const [effect, setEffect] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 350)
    const t2 = setTimeout(() => setEffect(true), 1000) // as the flip lands
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const good = result.correct === true
  return (
    <div className={`relative min-w-0 rounded-2xl ${effect && result.correct === false ? 'upset-shake' : ''}`}>
      <FlipCard
        flipped={flipped}
        front={front}
        // the ring sits on the result face itself (the flip cell is as tall as the taller live face)
        back={<div className={`rounded-2xl ${effect && good ? 'burst-ring' : ''}`}><ResultFace d={result} onDismiss={onDismiss} /></div>}
      />
      {effect && good && <Burst />}
    </div>
  )
}
