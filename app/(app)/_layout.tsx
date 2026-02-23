import { useNetworkSync } from '@/src/hooks/useNetworkSync'
import { registerBackgroundSync } from '@/src/services/backgroundSync'
import * as sessionService from '@/src/services/sessionService'
import { useAuthStore } from '@/src/stores/authStore'
import { Redirect, Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

export default function AppLayout() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { isAuthenticated, setUser } = useAuthStore()

  // Enable automatic sync on app foreground and network reconnect
  useNetworkSync()

  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      try {
        // Trust cached session tokens for offline-first support
        // Decode JWT to get user info without requiring network
        const user = await sessionService.loadUserFromSession()

        if (user) {
          setUser(user)
          // Register background sync after successful auth
          await registerBackgroundSync()
        }
      } catch {
        // Session restoration failed, user will need to log in
        await sessionService.clearSession()
      } finally {
        setIsCheckingAuth(false)
      }
    }

    restoreSession()
  }, [setUser])

  if (isCheckingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="notes" />
    </Stack>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
})
