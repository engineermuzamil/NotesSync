import NetInfo from '@react-native-community/netinfo'
import { create } from 'zustand'
import * as authService from '../services/authService'
import {
  registerBackgroundSync,
  unregisterBackgroundSync,
} from '../services/backgroundSync'
import * as sessionService from '../services/sessionService'
import type { AuthMode, AuthUser } from '../types'

interface AuthStore {
  user: AuthUser | null
  authMode: AuthMode | null
  isAuthenticated: boolean
  setUser: (user: AuthUser, authMode?: AuthMode) => void
  clearUser: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  authMode: null,
  isAuthenticated: false,

  setUser: (user: AuthUser, authMode: AuthMode = 'cloud') => {
    set({ user, authMode, isAuthenticated: true })
  },

  clearUser: () => {
    set({ user: null, authMode: null, isAuthenticated: false })
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
      set({ user: offlineUser, authMode: 'local', isAuthenticated: true })
      return
    }

    try {
      const { user, session } = await authService.loginWithEmail(
        normalizedEmail,
        password
      )
      await sessionService.saveSession(
        session.accessToken,
        session.refreshToken
      )
      await sessionService.saveOfflineAuthProfile(
        user,
        normalizedEmail,
        password
      )
      await sessionService.saveOfflineSessionUser(user)
      set({ user, authMode: 'cloud', isAuthenticated: true })
      await registerBackgroundSync()
      return
    } catch (error) {
      const offlineUser = await sessionService.verifyOfflineCredentials(
        normalizedEmail,
        password
      )

      if (!offlineUser) {
        throw error
      }

      await sessionService.clearSession()
      await sessionService.saveOfflineSessionUser(offlineUser)
      set({ user: offlineUser, authMode: 'local', isAuthenticated: true })
    }
  },

  register: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    const networkState = await NetInfo.fetch()
    const isOnline =
      networkState.isConnected === true &&
      networkState.isInternetReachable !== false

    if (!isOnline) {
      const hasOfflineProfile =
        await sessionService.hasOfflineAuthProfileForEmail(normalizedEmail)

      if (hasOfflineProfile) {
        throw new Error(
          'An offline account for this email already exists on this device. Please log in instead.'
        )
      }

      const offlineUser: AuthUser = {
        id: `offline-${Date.now().toString(36)}`,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      }

      await sessionService.saveOfflineAuthProfile(
        offlineUser,
        normalizedEmail,
        password
      )
      await sessionService.saveOfflineSessionUser(offlineUser)
      set({ user: offlineUser, authMode: 'local', isAuthenticated: true })
      return
    }

    const { user, session } = await authService.registerWithEmail(
      normalizedEmail,
      password
    )
    await sessionService.saveSession(session.accessToken, session.refreshToken)
    await sessionService.saveOfflineAuthProfile(user, normalizedEmail, password)
    await sessionService.saveOfflineSessionUser(user)
    set({ user, authMode: 'cloud', isAuthenticated: true })
    await registerBackgroundSync()
  },

  logout: async () => {
    // Unregister sync and clear local session first (must succeed)
    await unregisterBackgroundSync()
    await sessionService.clearSession()
    set({ user: null, authMode: null, isAuthenticated: false })

    // Then attempt remote logout as fire-and-forget (offline-first)
    // Don't block local logout on network errors
    authService.logout().catch(() => {
      // Silently ignore network errors - local logout already happened
    })
  },
}))
