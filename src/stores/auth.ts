import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import * as authService from '@/src/services/auth'
import type { RegisterInput, LoginInput } from '@/src/services/auth'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  initialize: () => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  login: (input: LoginInput) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  initialize: async () => {
    set({ isLoading: true })
    try {
      const result = await authService.restoreSession()
      if (result) {
        set({ user: result.user, session: result.session, isLoading: false })
      } else {
        set({ user: null, session: null, isLoading: false })
      }
    } catch {
      set({ user: null, session: null, isLoading: false })
    }
  },
  register: async (input) => {
    const result = await authService.register(input)
    set({ user: result.user, session: result.session })
  },
  login: async (input) => {
    const result = await authService.login(input)
    set({ user: result.user, session: result.session })
  },
  loginWithGoogle: async () => {
    await authService.loginWithGoogle()
  },
  logout: async () => {
    await authService.logout()
    set({ user: null, session: null })
  },
}))
