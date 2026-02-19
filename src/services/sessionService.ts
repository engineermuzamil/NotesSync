import * as SecureStore from 'expo-secure-store'

const AUTH_TOKENS_KEY = 'notessync_auth_tokens'

interface StoredTokens {
  accessToken: string
  refreshToken: string
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

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY)
}
