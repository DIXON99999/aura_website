import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  Database,
  MessageSquare,
  Users,
  Lightbulb,
  X,
  Menu,
} from 'lucide-react'
import { useAuthStore, useAuraStore } from '@/stores'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NotificationBell } from '@/components/ui/notification-bell'
import { InventoryBar } from '@/components/ui/inventory-bar'

const navItems = [
  { to: '/', label: 'Database', icon: Database },
  { to: '/community', label: 'Community', icon: Users },
  { to: '/posts', label: 'Posts', icon: MessageSquare },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [suggestModalOpen, setSuggestModalOpen] = useState(false)
  const [suggestionType, setSuggestionType] = useState('player')
  const [suggestionName, setSuggestionName] = useState('')
  const [suggestionDescription, setSuggestionDescription] = useState('')
  const [suggestionLinks, setSuggestionLinks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const handleSubmitSuggestion = async () => {
    if (!suggestionName.trim()) return
    setSubmitting(true)
    try {
      await api.submitSuggestion({
        type: suggestionType,
        name: suggestionName.trim(),
        description: suggestionDescription.trim() || undefined,
        links: suggestionLinks.trim() || undefined,
        visitorId: getVisitorId(),
        userId: user?.id,
        submittedByName: userProfile?.name || user?.email?.split('@')[0],
      })
      setSubmitSuccess(true)
      setTimeout(() => {
        setSuggestModalOpen(false)
        setSubmitSuccess(false)
        setSuggestionName('')
        setSuggestionDescription('')
        setSuggestionLinks('')
        setSuggestionType('player')
      }, 1500)
    } catch (error) {
      console.error('Failed to submit suggestion:', error)
    }
    setSubmitting(false)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setCreateDropdownOpen(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
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

        {/* Desktop nav - centered */}
        <div className="absolute inset-0 hidden md:flex items-center justify-center gap-1">
            {navItems.map((item) => (
              <div key={item.to} className="relative">
                <NavLink
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
                  <span>{item.label}</span>
                </NavLink>
              </div>
            ))}
        </div>

        {/* Mobile menu area */}
        <div className="flex md:hidden ml-auto z-10 items-center gap-2">
          {/* Credits display - compact on mobile */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-card text-xs">
            <ChevronUp className="w-3 h-3 text-green-500" />
            <span className="font-medium text-green-500">{credits.upvotesRemaining}</span>
            <ChevronDownIcon className="w-3 h-3 text-red-500" />
            <span className="font-medium text-red-500">{credits.downvotesRemaining}</span>
          </div>

          {/* Notification bell for mobile */}
          {user && <NotificationBell userId={user.id} />}

          {/* Hamburger menu */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-card shadow-lg py-1 z-50">
                {/* Navigation */}
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent',
                        isActive ? 'text-primary font-medium' : 'text-foreground'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                ))}

                {user ? (
                  <>
                    <div className="border-t my-1" />
                    {/* Create options */}
                    <Link
                      to="/create-event"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <Trophy className="w-4 h-4" />
                      Create Leaderboard
                    </Link>
                    <Link
                      to="/create-post"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Create Post
                    </Link>

                    <div className="border-t my-1" />
                    {/* Account options */}
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      to="/my-events"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <Trophy className="w-4 h-4" />
                      My Leaderboards
                    </Link>
                    <Link
                      to="/my-posts"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <MessageSquare className="w-4 h-4" />
                      My Posts
                    </Link>

                    <div className="border-t my-1" />
                    <button
                      onClick={() => {
                        signOut()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="border-t my-1" />
                    <Link
                      to="/signin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary hover:bg-accent"
                    >
                      <User className="w-4 h-4" />
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex ml-auto z-10 items-center gap-2">
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
                      to="/create-post"
                      onClick={() => setCreateDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Post
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

              {/* Notification Bell */}
              <NotificationBell userId={user.id} />

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
                  <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-card shadow-lg py-1">
                    {/* Perks Inventory */}
                    <div className="px-3 py-2 border-b">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 text-center">Perks</div>
                      <div className="flex justify-center">
                        <InventoryBar />
                      </div>
                    </div>
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
                      to="/my-posts"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-accent"
                    >
                      My Posts
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

      {/* Floating Suggest Button - bottom right */}
      {createPortal(
        <button
          onClick={() => setSuggestModalOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-yellow-500 text-black font-medium shadow-lg transition-all hover:bg-yellow-400 hover:scale-105"
          style={{
            boxShadow: '0 0 20px rgba(234, 179, 8, 0.5), 0 0 40px rgba(234, 179, 8, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Lightbulb className="w-5 h-5" />
          <span>Suggest</span>
        </button>,
        document.body
      )}

      {/* Suggestion Modal - rendered via portal to escape nav stacking context */}
      {suggestModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Suggest an Addition</h2>
              <button
                onClick={() => setSuggestModalOpen(false)}
                className="p-1 rounded hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center">
                <div className="text-green-500 text-lg font-medium mb-2">Thank you!</div>
                <p className="text-muted-foreground">Your suggestion has been submitted.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Type</label>
                  <select
                    value={suggestionType}
                    onChange={(e) => setSuggestionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  >
                    <option value="player">Player</option>
                    <option value="team">Team / Organisation</option>
                    <option value="game">Game</option>
                    <option value="peripheral">Peripheral (Mouse, Keyboard, etc.)</option>
                    <option value="feature">Feature / Idea</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Name</label>
                  <Input
                    value={suggestionName}
                    onChange={(e) => setSuggestionName(e.target.value)}
                    placeholder="e.g. TenZ, Sentinels, Valorant..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
                  <textarea
                    value={suggestionDescription}
                    onChange={(e) => setSuggestionDescription(e.target.value)}
                    placeholder="Any additional details..."
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Links (optional)</label>
                  <Input
                    value={suggestionLinks}
                    onChange={(e) => setSuggestionLinks(e.target.value)}
                    placeholder="Liquipedia, Twitter, etc."
                  />
                </div>

                <Button
                  onClick={handleSubmitSuggestion}
                  disabled={!suggestionName.trim() || submitting}
                  className="w-full"
                >
                  {submitting ? 'Submitting...' : 'Submit Suggestion'}
                </Button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </nav>
  )
}
