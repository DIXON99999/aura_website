import { useState, useRef, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  User,
  Trophy,
  Plus,
  ChevronDown,
  LogOut,
  RefreshCw,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  Home,
  Sprout,
} from 'lucide-react'
import { useAuthStore, useAuraStore } from '@/stores'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/events', label: 'Custom Leaderboards', icon: Trophy },
  { to: '/aura-farms', label: 'Aura Farms', icon: Sprout },
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
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const createDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setCreateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadCredits(getVisitorId())
  }, [loadCredits])

  const handleRefreshCredits = async () => {
    if (!user) return
    setRefreshing(true)
    try {
      await refreshCredits(getVisitorId(), user.id)
    } catch {
      // Error handled in store
    }
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
              <div className="relative" ref={createDropdownRef}>
                <button
                  onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {createDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-card shadow-lg py-1 z-50">
                    <Link
                      to="/create-event"
                      onClick={() => setCreateDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    >
                      <Trophy className="w-4 h-4" />
                      Custom Leaderboard
                    </Link>
                    <Link
                      to="/create-aura-farm"
                      onClick={() => setCreateDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    >
                      <Sprout className="w-4 h-4" />
                      Aura Farm
                    </Link>
                  </div>
                )}
              </div>

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
                      My Leaderboards
                    </Link>
                    <Link
                      to="/my-aura-farms"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-accent"
                    >
                      My Aura Farms
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
            <div className="relative flex items-center gap-2">
              {/* Credits display for non-signed in users */}
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
              </div>
              {/* Hint text based on tokens remaining */}
              <div className="hidden md:flex items-center gap-1 text-xs bg-accent/50 px-2 py-1 rounded">
                {credits.upvotesRemaining === 0 && credits.downvotesRemaining === 0 ? (
                  <span className="text-primary">Sign in for more tokens!</span>
                ) : (
                  <span className="text-muted-foreground">Use your aura tokens!</span>
                )}
              </div>
              <Link
                to="/signin"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
