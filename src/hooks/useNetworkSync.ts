import { getPendingNotes } from '@/src/db/notes'
import { getLastSyncedAt } from '@/src/db/syncMeta'
import { fullSync } from '@/src/services/syncService'
import { useAuthStore } from '@/src/stores/authStore'
import { useSyncStore } from '@/src/stores/syncStore'
import NetInfo from '@react-native-community/netinfo'
import { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'

/**
 * Hook that automatically triggers sync on app foreground and network reconnect
 */
export function useNetworkSync(): void {
  const user = useAuthStore((state) => state.user)
  const { setSyncSuccess, setPendingCount } = useSyncStore()
  const appState = useRef(AppState.currentState)
  const isOnline = useRef(true)

  useEffect(() => {
    if (!user) return

    // Initialize sync store with persisted state
    const lastSyncedAt = getLastSyncedAt()
    if (lastSyncedAt) {
      setSyncSuccess(lastSyncedAt)
    }

    const pendingNotes = getPendingNotes(user.id)
    setPendingCount(pendingNotes.length)

    // Handle app state changes (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      // Trigger sync when app comes to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isOnline.current
      ) {
        fullSync(user.id).catch((error) => {
          console.error('Foreground sync failed:', error)
        })
      }

      appState.current = nextAppState
    }

    // Handle network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOffline = !isOnline.current
      isOnline.current = state.isConnected ?? false

      // Trigger sync when network reconnects (only if app is active)
      if (wasOffline && isOnline.current && appState.current === 'active') {
        fullSync(user.id).catch((error) => {
          console.error('Reconnect sync failed:', error)
        })
      }
    })

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    // Trigger initial sync if online
    if (isOnline.current) {
      fullSync(user.id).catch((error) => {
        console.error('Initial sync failed:', error)
      })
    }

    // Cleanup
    return () => {
      appStateSubscription.remove()
      unsubscribeNetInfo()
    }
  }, [user, setSyncSuccess, setPendingCount])
}
