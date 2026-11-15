import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Upcoming from './predict/Upcoming'
import History from './predict/History'
import Accuracy from './predict/Accuracy'

const tabs = [
  { to: '/', label: 'Matches', end: true },
  { to: '/history', label: 'History', end: false },
  { to: '/accuracy', label: 'Accuracy', end: false },
]

function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-[#0a0b0e] text-neutral-100 font-sans">
        {/* ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60rem 40rem at 50% -10%, rgba(16,185,129,0.10), transparent 60%),' +
              'radial-gradient(50rem 40rem at 90% 10%, rgba(56,189,248,0.06), transparent 55%)',
          }}
        />
        <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0b0e]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-400/15 ring-1 ring-emerald-400/30">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                CS<span className="text-emerald-400">Odds</span>
              </span>
            </div>
            <nav className="flex gap-1 text-sm">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-7">
          <Routes>
            <Route path="/" element={<Upcoming />} />
            <Route path="/history" element={<History />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="mx-auto max-w-4xl px-4 pb-10 pt-4 text-xs leading-relaxed text-neutral-600">
          Win probabilities are statistical estimates from a map-level Elo model with head-to-head
          adjustment — not betting advice. Match &amp; team data via PandaScore.
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
