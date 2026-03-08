import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Nav } from '@/components/layout'
import { Button } from '@/components/ui/button'
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
} from '@/pages'

function App() {
  useSeedData()
  const initialized = useInitialized()
  const initializationError = useAuraStore((s) => s.initializationError)
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
    if (initializationError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-4">
            <div className="text-lg font-semibold">Could not load the app</div>
            <div className="text-sm text-muted-foreground">{initializationError}</div>
            <Button onClick={() => void fetchAllData()}>Retry</Button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Nav />
        <Routes>
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
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventPage />} />
          <Route path="/events/:id/sub/:subEventId" element={<EventPage />} />
          <Route path="/events/:id/edit" element={<EditEventPage />} />
          <Route path="/create-event" element={<CreateEventPage />} />
          <Route path="/my-events" element={<MyEventsPage />} />
          <Route path="/aura-farms" element={<AuraFarmsPage />} />
          <Route path="/aura-farms/:id" element={<AuraFarmPage />} />
          <Route path="/create-aura-farm" element={<CreateAuraFarmPage />} />
          <Route path="/my-aura-farms" element={<MyAuraFarmsPage />} />
          <Route path="/:entityType/:slug" element={<EntityPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
