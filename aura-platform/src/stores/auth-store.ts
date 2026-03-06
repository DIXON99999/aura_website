import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setSessionToken, type User, type Entity } from '@/lib/api'

interface LinkedPlayer {
  id: string
  name: string
  slug: string
}

interface AuthState {
  user: User | null
  linkedPlayer: LinkedPlayer | null
  loading: boolean

  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ success: boolean; error?: string }>
  checkSession: () => Promise<void>
  linkPlayer: (playerId: string) => Promise<void>
  loadLinkedPlayer: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      linkedPlayer: null,
      loading: false,

      signUp: async (email: string, password: string) => {
        try {
          const result = await api.signUp(email, password)
          setSessionToken(result.session.id)
          set({ user: result.user })
          get().loadLinkedPlayer()
          return { success: true }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      },

      signIn: async (email: string, password: string) => {
        try {
          const result = await api.signIn(email, password)
          setSessionToken(result.session.id)
          set({ user: result.user })
          get().loadLinkedPlayer()
          return { success: true }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      },

      signOut: async () => {
        try {
          await api.signOut()
        } catch {
          // Ignore errors
        }
        setSessionToken(null)
        set({ user: null, linkedPlayer: null })
      },

      deleteAccount: async () => {
        try {
          await api.deleteAccount()
          setSessionToken(null)
          set({ user: null })
          return { success: true }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      },

      checkSession: async () => {
        set({ loading: true })
        try {
          const result = await api.getMe()
          set({ user: result.user, loading: false })
          // Load linked player if user has playerId
          get().loadLinkedPlayer()
        } catch {
          setSessionToken(null)
          set({ user: null, linkedPlayer: null, loading: false })
        }
      },

      linkPlayer: async (playerId: string) => {
        try {
          const result = await api.linkPlayer(playerId)
          set({ user: result.user })
          // Load the linked player data
          get().loadLinkedPlayer()
        } catch (error) {
          console.error('Failed to link player:', error)
        }
      },

      loadLinkedPlayer: async () => {
        const user = get().user
        if (!user?.playerId) {
          set({ linkedPlayer: null })
          return
        }
        try {
          const player = await api.getPlayer(user.playerId)
          set({ linkedPlayer: { id: player.id, name: player.name, slug: player.slug } })
        } catch (error) {
          console.error('Failed to load linked player:', error)
          set({ linkedPlayer: null })
        }
      },
    }),
    {
      name: 'aura-auth',
      partialize: (state) => ({ user: state.user, linkedPlayer: state.linkedPlayer }),
    }
  )
)
