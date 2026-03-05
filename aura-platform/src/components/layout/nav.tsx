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
} from 'lucide-react'
import { useAuthStore } from '@/stores'

const navItems = [
  { to: '/players', label: 'Players', icon: Users },
  { to: '/teams', label: 'Teams', icon: Building2 },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/regions', label: 'Regions', icon: Globe },
  { to: '/peripherals', label: 'Peripherals', icon: Mouse },
  { to: '/game-meta', label: 'Meta', icon: Swords },
]

export function Nav() {
  const user = useAuthStore((s) => s.user)

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

        {user ? (
          <Link
            to="/profile"
            className="ml-auto z-10 p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
          >
            <User className="w-5 h-5" />
          </Link>
        ) : (
          <Link
            to="/signin"
            className="ml-auto z-10 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
