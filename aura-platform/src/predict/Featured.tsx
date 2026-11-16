// Spotlight strip at the top of Matches: the featured match (next grand final,
// else the next match) with the site's only countdown, plus "upset watch".
import { useEffect, useState } from 'react'
import { eventName, type Prediction } from './api'
import { TeamLogo, ThemedCard, CardLink } from './ui'
import { dayAndClock, timeUntil } from './time'
import { pickFeatured, pickUpset } from './spotlight'

const pct = (x: number) => `${Math.round(x * 100)}%`

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState(Date.now())
  const finalHour = Date.parse(iso) - now < 3_600_000
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), finalHour ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [finalHour])
  const left = timeUntil(iso, now)
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{left ? 'Starts in' : 'Starting'}</div>
      <div className="font-display text-2xl font-bold tabular-nums text-white">{left ?? 'now'}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{dayAndClock(iso)}</div>
    </div>
  )
}

function FeaturedCard({ m, reason }: { m: Prediction; reason: 'grand-final' | 'next' }) {
  const Side = ({ t, prob, align }: { t: Prediction['teamA']; prob: number | null; align: 'left' | 'right' }) => (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center`}>
      {t ? <TeamLogo name={t.name} logo={t.logo} size={60} /> : <div className="grid h-[60px] w-[60px] place-items-center rounded-xl border border-dashed border-white/15 text-xl text-neutral-600">?</div>}
      <div className="max-w-full truncate font-display text-base font-bold text-white">{t?.name ?? 'TBD'}</div>
      {prob != null && (
        <div className={`font-display text-xl font-bold tabular-nums ${prob >= 0.5 ? (align === 'left' ? 'text-emerald-400' : 'text-sky-400') : 'text-neutral-500'}`}>{pct(prob)}</div>
      )}
    </div>
  )
  return (
    <CardLink to={`/match/${m.matchId}`} label={`Featured: ${m.teamA?.name ?? 'TBD'} vs ${m.teamB?.name ?? 'TBD'}`}>
      <ThemedCard
        league={m.league}
        event={`${eventName(m.league, m.serie)} · BO${m.bo}`}
        matchName={m.name}
        right={<span className="font-bold text-neutral-300">{reason === 'grand-final' ? 'FEATURED FINAL' : 'NEXT UP'}</span>}
        bodyClassName="p-5"
      >
        <div className="flex items-center gap-3">
          <Side t={m.teamA} prob={m.probA} align="left" />
          <div className="shrink-0 px-2"><Countdown iso={m.scheduledAt} /></div>
          <Side t={m.teamB} prob={m.probB} align="right" />
        </div>
        {m.probA != null && (
          <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-neutral-800/80">
            <div className="bg-emerald-500/90" style={{ width: `${m.probA * 100}%` }} />
            <div className="bg-sky-500/90" style={{ width: `${(1 - m.probA) * 100}%` }} />
          </div>
        )}
      </ThemedCard>
    </CardLink>
  )
}

function UpsetCard({ m, underdog, chance }: { m: Prediction; underdog: 'a' | 'b'; chance: number }) {
  const dog = underdog === 'a' ? m.teamA! : m.teamB!
  const fav = underdog === 'a' ? m.teamB! : m.teamA!
  return (
    <CardLink to={`/match/${m.matchId}`} label={`Upset watch: ${dog.name} vs ${fav.name}`}>
      <div className="flex items-center gap-3 rounded-2xl bg-amber-500/[0.08] px-4 py-3 ring-1 ring-amber-400/20">
        <span className="shrink-0 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">Upset watch</span>
        <TeamLogo name={dog.name} logo={dog.logo} size={28} />
        <p className="min-w-0 flex-1 text-sm leading-snug text-neutral-300">
          <b className="text-white">{dog.name}</b> has a <b className="text-amber-300">{pct(chance)}</b> shot at beating favourite <b className="text-white">{fav.name}</b>
        </p>
        <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:block">{dayAndClock(m.scheduledAt)}</span>
      </div>
    </CardLink>
  )
}

export default function FeaturedStrip({ matches }: { matches: Prediction[] }) {
  const featured = pickFeatured(matches)
  const upset = pickUpset(matches, featured?.match.matchId)
  if (!featured && !upset) return null
  return (
    <section className="mb-7 space-y-3">
      {featured && <FeaturedCard m={featured.match} reason={featured.reason} />}
      {upset && <UpsetCard m={upset.match} underdog={upset.underdog} chance={upset.chance} />}
    </section>
  )
}
