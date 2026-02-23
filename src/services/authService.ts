import { supabase } from '../config/supabase'
import type { AuthResponse, AuthUser } from '../types'

export async function registerWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user || !data.session) {
    throw new Error('Registration failed: no user or session returned')
  }

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email!,
    createdAt: data.user.created_at,
  }

  return {
    user,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    },
  }
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user || !data.session) {
    throw new Error('Login failed: no user or session returned')
  }

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email!,
    createdAt: data.user.created_at,
  }

  return {
    user,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    },
  }
}

export async function logout(): Promise<void> {
  // Fire-and-forget remote logout for offline-first support
  // Don't block local logout on network availability
  supabase.auth.signOut().catch(() => {
    // Silently ignore network errors - local logout already happened
  })
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email!,
    createdAt: data.user.created_at,
  }
}
