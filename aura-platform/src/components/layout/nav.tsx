import { useState, useRef, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Users,
  Building2,
  Gamepad2,
  Globe,
  Mouse,
  Swords,
  User,
  Trophy,
  Plus,
  ChevronDown,
  LogOut,
  RefreshCw,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import { useAuthStore, useAuraStore } from '@/stores'

const navItems = [
  { to: '/players', label: 'Players', icon: Users },
  { to: '/teams', label: 'Teams', icon: Building2 },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/regions', label: 'Regions', icon: Globe },
  { to: '/peripherals', label: 'Peripherals', icon: Mouse },
  { to: '/game-meta', label: 'Meta', icon: Swords },
  { to: '/events', label: 'Events', icon: Trophy },
]

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
}

export function Nav() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const credits = useAuraStore((s) => s.credits)
  const loadCredits = useAuraStore((s) => s.loadCredits)
  const refreshCredits = useAuraStore((s) => s.refreshCredits)
  const userProfiles = useAuraStore((s) => s.userProfiles)
  const players = useAuraStore((s) => s.players)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadCredits(getVisitorId())
  }, [loadCredits])

  const handleRefreshCredits = async () => {
    setRefreshing(true)
    await refreshCredits(getVisitorId())
    setRefreshing(false)
  }

  // Get user's profile from aura store (created via profile page)
  const profileId = user ? userProfiles[user.id] : undefined
  const userProfile = profileId ? players[profileId] : undefined
  const displayName = userProfile?.name || user?.email?.split('@')[0] || 'User'

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="relative flex items-center h-16 px-6">
        <NavLink
          to="/"
          className="text-2xl font-bold tracking-tight hover:text-primary/80 transition-colors z-10"
        >
          Aura
        </NavLink>

        <div className="absolute inset-0 flex items-center justify-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
        </div>

        <div className="ml-auto z-10 flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/create-event"
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create</span>
              </Link>

              {/* Credits display */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
                <div className="flex items-center gap-1">
                  <ChevronUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">{credits.upvotesRemaining}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1">
                  <ChevronDownIcon className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">{credits.downvotesRemaining}</span>
                </div>
                <button
                  onClick={handleRefreshCredits}
                  disabled={refreshing}
                  className="ml-1 p-1 rounded hover:bg-accent transition-colors disabled:opacity-50"
                  title="Refresh credits"
                >
                  <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
                </button>
              </div>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-card shadow-lg py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-accent"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/my-events"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-accent"
                    >
                      My Events
                    </Link>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => {
                        signOut()
                        setDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/signin"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
