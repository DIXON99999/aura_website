import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Nav } from '@/components/layout'
import { useSeedData } from '@/hooks'
import { useInitialized, useAuthStore, useAuraStore } from '@/stores'
import {
  HomePage,
  PlayersPage,
  TeamsPage,
  GamesPage,
  RegionsPage,
  PeripheralsPage,
  GameMetaPage,
  EntityPage,
  ProfilePage,
  SignInPage,
  SignUpPage,
  EventsPage,
  EventPage,
  CreateEventPage,
  EditEventPage,
  MyEventsPage,
  AuraFarmsPage,
  AuraFarmPage,
  CreateAuraFarmPage,
  MyAuraFarmsPage,
  CreateTierListPage,
  PlayPage,
  ChatPage,
} from '@/pages'

function App() {
  useSeedData()
  const initialized = useInitialized()
  const error = useAuraStore((s) => s.error)
  const fetchAllData = useAuraStore((s) => s.fetchAllData)
  const checkSession = useAuthStore((s) => s.checkSession)
  const user = useAuthStore((s) => s.user)
  const loadUserProfile = useAuraStore((s) => s.loadUserProfile)
  const userProfiles = useAuraStore((s) => s.userProfiles)

  // Check session on mount
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Load user profile when user is available
  useEffect(() => {
    if (user && !userProfiles[user.id]) {
      loadUserProfile(user.id)
    }
  }, [user, userProfiles, loadUserProfile])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {error ? (
          <div className="text-center space-y-4">
            <div className="text-red-500">Failed to load: {error}</div>
            <button onClick={() => fetchAllData()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Retry
            </button>
          </div>
        ) : (
          <div className="text-muted-foreground">Loading...</div>
        )}
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/regions" element={<RegionsPage />} />
        <Route path="/peripherals" element={<PeripheralsPage />} />
        <Route path="/game-meta" element={<GameMetaPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        {/* Community (formerly Custom Leaderboards/Events) */}
        <Route path="/community" element={<EventsPage />} />
        <Route path="/community/:slug" element={<EventPage />} />
        <Route path="/community/:slug/sub/:subEventId" element={<EventPage />} />
        <Route path="/community/:slug/edit" element={<EditEventPage />} />
        <Route path="/create-event" element={<CreateEventPage />} />
        <Route path="/my-events" element={<MyEventsPage />} />
        {/* Legacy routes - redirect to new paths */}
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:slug" element={<EventPage />} />
        <Route path="/events/:slug/sub/:subEventId" element={<EventPage />} />
        <Route path="/events/:slug/edit" element={<EditEventPage />} />
        {/* Posts (formerly Aura Farms) */}
        <Route path="/posts" element={<AuraFarmsPage />} />
        <Route path="/posts/:slug" element={<AuraFarmPage />} />
        <Route path="/create-post" element={<CreateAuraFarmPage />} />
        <Route path="/my-posts" element={<MyAuraFarmsPage />} />
        {/* Legacy routes */}
        <Route path="/aura-farms" element={<AuraFarmsPage />} />
        <Route path="/aura-farms/:slug" element={<AuraFarmPage />} />
        <Route path="/create-aura-farm" element={<CreateAuraFarmPage />} />
        <Route path="/my-aura-farms" element={<MyAuraFarmsPage />} />
        {/* Tier Lists */}
        <Route path="/create-tier-list" element={<CreateTierListPage />} />
        {/* Play (Cookie Clicker) */}
        <Route path="/play" element={<PlayPage />} />
        {/* Chat */}
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/:entityType/:slug" element={<EntityPage />} />
      </Routes>
    </div>
  )
}

export default App
