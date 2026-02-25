import NetInfo from '@react-native-community/netinfo'
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
    const normalizedEmail = email.trim().toLowerCase()
    const networkState = await NetInfo.fetch()
    const isOnline =
      networkState.isConnected === true &&
      networkState.isInternetReachable !== false

    if (!isOnline) {
      const offlineUser = await sessionService.verifyOfflineCredentials(
        normalizedEmail,
        password
      )

      if (!offlineUser) {
        throw new Error(
          'First login for this account requires internet. Connect once, then you can log in offline.'
        )
      }

      await sessionService.saveOfflineSessionUser(offlineUser)
      set({ user: offlineUser, isAuthenticated: true })
      await registerBackgroundSync()
      return
    }

    const { user, session } = await authService.loginWithEmail(
      normalizedEmail,
      password
    )
    await sessionService.saveSession(session.accessToken, session.refreshToken)
    await sessionService.saveOfflineAuthProfile(user, normalizedEmail, password)
    await sessionService.saveOfflineSessionUser(user)
    set({ user, isAuthenticated: true })
    await registerBackgroundSync()
  },

  register: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const { user, session } = await authService.registerWithEmail(
      normalizedEmail,
      password
    )
    await sessionService.saveSession(session.accessToken, session.refreshToken)
    await sessionService.saveOfflineAuthProfile(user, normalizedEmail, password)
    await sessionService.saveOfflineSessionUser(user)
    set({ user, isAuthenticated: true })
    await registerBackgroundSync()
  },

  logout: async () => {
    // Unregister sync and clear local session first (must succeed)
    await unregisterBackgroundSync()
    await sessionService.clearSession()
    set({ user: null, isAuthenticated: false })

    // Then attempt remote logout as fire-and-forget (offline-first)
    // Don't block local logout on network errors
    authService.logout().catch(() => {
      // Silently ignore network errors - local logout already happened
    })
  },
}))
