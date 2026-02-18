import { supabase } from '@/src/config/supabase'
import type { Session, User } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const AUTH_TOKENS_KEY = 'notessync_auth_tokens'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

async function storeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKENS_KEY, JSON.stringify(tokens))
}

async function getStoredTokens(): Promise<AuthTokens | null> {
  const stored = await SecureStore.getItemAsync(AUTH_TOKENS_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as AuthTokens
  } catch {
    return null
  }
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY)
}

export interface RegisterInput {
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export async function register(
  input: RegisterInput
): Promise<{ user: User; session: Session }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  })

  if (error) throw error
  if (!data.user || !data.session) {
    throw new Error('Registration failed: no user or session returned')
  }

  await storeTokens({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token ?? '',
  })

  return { user: data.user, session: data.session }
}

export async function login(
  input: LoginInput
): Promise<{ user: User; session: Session }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) throw error
  if (!data.user || !data.session) {
    throw new Error('Login failed: no user or session returned')
  }

  await storeTokens({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token ?? '',
  })

  return { user: data.user, session: data.session }
}

export async function loginWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'notessync://auth/callback',
    },
  })

  if (error) throw error
  if (!data.url) {
    throw new Error('Google OAuth failed: no redirect URL')
  }
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  await clearTokens()
  if (error) throw error
}

export async function restoreSession(): Promise<{ user: User; session: Session } | null> {
  try {
    const tokens = await getStoredTokens()
    if (!tokens) return null

    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })

    if (error) {
      await clearTokens()
      return null
    }

    if (!data.user || !data.session) {
      await clearTokens()
      return null
    }

    await storeTokens({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token ?? '',
    })

    return { user: data.user, session: data.session }
  } catch {
    await clearTokens()
    return null
  }
}
