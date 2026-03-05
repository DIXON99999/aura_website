import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  createdAt: Date
}

interface AuthState {
  user: User | null
  users: Record<string, { email: string; passwordHash: string; createdAt: Date }>

  signUp: (email: string, password: string) => { success: boolean; error?: string }
  signIn: (email: string, password: string) => { success: boolean; error?: string }
  signOut: () => void
  deleteAccount: () => void
}

// Simple hash function for demo (use bcrypt in production)
function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      users: {},

      signUp: (email: string, password: string) => {
        const state = get()
        const normalizedEmail = email.toLowerCase().trim()

        // Check if email already exists
        const existingUser = Object.values(state.users).find(
          u => u.email.toLowerCase() === normalizedEmail
        )
        if (existingUser) {
          return { success: false, error: 'Email already registered' }
        }

        // Validate email
        if (!normalizedEmail.includes('@')) {
          return { success: false, error: 'Invalid email address' }
        }

        // Validate password
        if (password.length < 6) {
          return { success: false, error: 'Password must be at least 6 characters' }
        }

        const userId = `user-${crypto.randomUUID().slice(0, 8)}`
        const passwordHash = hashPassword(password)

        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              email: normalizedEmail,
              passwordHash,
              createdAt: new Date(),
            },
          },
          user: {
            id: userId,
            email: normalizedEmail,
            createdAt: new Date(),
          },
        }))

        return { success: true }
      },

      signIn: (email: string, password: string) => {
        const state = get()
        const normalizedEmail = email.toLowerCase().trim()
        const passwordHash = hashPassword(password)

        // Find user by email
        const userEntry = Object.entries(state.users).find(
          ([, u]) => u.email.toLowerCase() === normalizedEmail
        )

        if (!userEntry) {
          return { success: false, error: 'Email not found' }
        }

        const [userId, userData] = userEntry

        if (userData.passwordHash !== passwordHash) {
          return { success: false, error: 'Incorrect password' }
        }

        set({
          user: {
            id: userId,
            email: userData.email,
            createdAt: userData.createdAt,
          },
        })

        return { success: true }
      },

      signOut: () => {
        set({ user: null })
      },

      deleteAccount: () => {
        const state = get()
        if (!state.user) return

        const userId = state.user.id
        const newUsers = { ...state.users }
        delete newUsers[userId]

        set({
          user: null,
          users: newUsers,
        })
      },
    }),
    {
      name: 'aura-auth',
    }
  )
)
