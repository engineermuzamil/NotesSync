import * as SecureStore from 'expo-secure-store'
import type { AuthUser } from '../types'

const AUTH_TOKENS_KEY = 'notessync_auth_tokens'
const OFFLINE_AUTH_PROFILE_KEY = 'notessync_offline_auth_profile'
const OFFLINE_ACTIVE_USER_KEY = 'notessync_offline_active_user'

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

interface OfflineAuthProfile {
  userId: string
  email: string
  passwordSalt: string
  passwordHash: string
  createdAt: string
}

interface OfflineSessionUser {
  id: string
  email: string
  createdAt: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function createPasswordSalt(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function hashPassword(email: string, password: string, salt: string): string {
  const input = `${normalizeEmail(email)}|${password}|${salt}`
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function decodeBase64(base64: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let buffer = 0
  let bits = 0
  let output = ''

  for (let index = 0; index < base64.length; index += 1) {
    const char = base64[index]

    if (char === '=') {
      break
    }

    const value = chars.indexOf(char)
    if (value < 0) {
      continue
    }

    buffer = (buffer << 6) | value
    bits += 6

    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }

  return decodeURIComponent(
    output
      .split('')
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  )
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode the payload (second part) with base64url-safe logic
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    )
    const decoded = JSON.parse(decodeBase64(padded))

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

export async function saveOfflineAuthProfile(
  user: AuthUser,
  email: string,
  password: string
): Promise<void> {
  const passwordSalt = createPasswordSalt()
  const passwordHash = hashPassword(email, password, passwordSalt)

  const profile: OfflineAuthProfile = {
    userId: user.id,
    email: normalizeEmail(email),
    passwordSalt,
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  await SecureStore.setItemAsync(
    OFFLINE_AUTH_PROFILE_KEY,
    JSON.stringify(profile)
  )
}

async function loadOfflineAuthProfile(): Promise<OfflineAuthProfile | null> {
  const profileJson = await SecureStore.getItemAsync(OFFLINE_AUTH_PROFILE_KEY)

  if (!profileJson) {
    return null
  }

  try {
    const profile = JSON.parse(profileJson) as OfflineAuthProfile
    return profile
  } catch {
    await SecureStore.deleteItemAsync(OFFLINE_AUTH_PROFILE_KEY)
    return null
  }
}

export async function hasOfflineAuthProfileForEmail(
  email: string
): Promise<boolean> {
  const profile = await loadOfflineAuthProfile()

  if (!profile) {
    return false
  }

  return profile.email === normalizeEmail(email)
}

export async function verifyOfflineCredentials(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const profile = await loadOfflineAuthProfile()

  if (!profile) {
    return null
  }

  if (profile.email !== normalizeEmail(email)) {
    return null
  }

  const passwordHash = hashPassword(email, password, profile.passwordSalt)
  if (passwordHash !== profile.passwordHash) {
    return null
  }

  return {
    id: profile.userId,
    email: profile.email,
    createdAt: profile.createdAt,
  }
}

export async function saveOfflineSessionUser(user: AuthUser): Promise<void> {
  const offlineUser: OfflineSessionUser = {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  }

  await SecureStore.setItemAsync(
    OFFLINE_ACTIVE_USER_KEY,
    JSON.stringify(offlineUser)
  )
}

export async function loadOfflineSessionUser(): Promise<AuthUser | null> {
  const offlineUserJson = await SecureStore.getItemAsync(
    OFFLINE_ACTIVE_USER_KEY
  )

  if (!offlineUserJson) {
    return null
  }

  try {
    const offlineUser = JSON.parse(offlineUserJson) as OfflineSessionUser
    return {
      id: offlineUser.id,
      email: offlineUser.email,
      createdAt: offlineUser.createdAt,
    }
  } catch {
    await SecureStore.deleteItemAsync(OFFLINE_ACTIVE_USER_KEY)
    return null
  }
}

export async function clearOfflineSessionUser(): Promise<void> {
  await SecureStore.deleteItemAsync(OFFLINE_ACTIVE_USER_KEY)
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY)
  await clearOfflineSessionUser()
}
