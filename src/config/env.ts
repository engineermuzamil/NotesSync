interface Env {
  supabaseUrl: string
  supabaseAnonKey: string
}

function requireEnv(value: string | undefined, key: string): string {
  if (value == null || value === '') {
    throw new Error(`Missing required env: ${key}`)
  }
  return value
}

export function getEnv(): Env {
  return {
    supabaseUrl: requireEnv(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      'EXPO_PUBLIC_SUPABASE_URL'
    ),
    supabaseAnonKey: requireEnv(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    ),
  }
}
