import { create } from 'zustand'
import * as authService from '../services/authService'
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../services/backgroundSync'
import * as sessionService from '../services/sessionService'
import type { AuthUser } from '../types'

interface AuthStore {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser) => void
  clearUser: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user: AuthUser) => {
    set({ user, isAuthenticated: true })
  },

  clearUser: () => {
    set({ user: null, isAuthenticated: false })
  },

  login: async (email: string, password: string) => {
    const { user, session } = await authService.loginWithEmail(email, password)
    await sessionService.saveSession(session.accessToken, session.refreshToken)
    set({ user, isAuthenticated: true })
    await registerBackgroundSync()
  },

  register: async (email: string, password: string) => {
    const { user, session } = await authService.registerWithEmail(
      email,
      password
    )
    await sessionService.saveSession(session.accessToken, session.refreshToken)
    set({ user, isAuthenticated: true })
    await registerBackgroundSync()
  },

  logout: async () => {
    await unregisterBackgroundSync()
    await sessionService.clearSession()
    await authService.logout()
    set({ user: null, isAuthenticated: false })
  },
}))
