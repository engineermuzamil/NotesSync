import * as SecureStore from 'expo-secure-store'
import type { AuthUser } from '../types'

const AUTH_TOKENS_KEY = 'notessync_auth_tokens'

interface StoredTokens {
  accessToken: string
  refreshToken: string
}

interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode the payload (second part) using atob for React Native compatibility
    const payload = parts[1]
    // Add padding if needed for base64url
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    )
    const decoded = JSON.parse(atob(padded))

    return decoded as JWTPayload
  } catch {
    return null
  }
}

export async function saveSession(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const tokens: StoredTokens = {
    accessToken,
    refreshToken,
  }

  await SecureStore.setItemAsync(AUTH_TOKENS_KEY, JSON.stringify(tokens))
}

export async function loadSession(): Promise<StoredTokens | null> {
  const tokensJson = await SecureStore.getItemAsync(AUTH_TOKENS_KEY)

  if (!tokensJson) {
    return null
  }

  try {
    const tokens = JSON.parse(tokensJson) as StoredTokens
    return tokens
  } catch {
    // If JSON parsing fails, clear corrupted data
    await clearSession()
    return null
  }
}

export async function loadUserFromSession(): Promise<AuthUser | null> {
  const tokens = await loadSession()

  if (!tokens) {
    return null
  }

  const payload = decodeJWT(tokens.accessToken)

  if (!payload) {
    return null
  }

  return {
    id: payload.sub,
    email: payload.email,
    createdAt: new Date(payload.iat * 1000).toISOString(),
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY)
}
