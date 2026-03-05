import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Nav } from '@/components/layout'
import { useSeedData } from '@/hooks'
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
} from '@/pages'

function App() {
  useSeedData()

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
          <Route path="/:entityType/:slug" element={<EntityPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
