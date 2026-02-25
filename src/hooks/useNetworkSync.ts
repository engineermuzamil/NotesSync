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
  const { setSyncSuccess, setPendingCount, setSyncError } = useSyncStore()
  const appState = useRef(AppState.currentState)
  const isOnline = useRef(false)
  const isSyncInProgress = useRef(false)

  useEffect(() => {
    if (!user) return

    // Initialize sync store with persisted state
    const lastSyncedAt = getLastSyncedAt()
    if (lastSyncedAt) {
      setSyncSuccess(lastSyncedAt)
    }

    const pendingNotes = getPendingNotes(user.id)
    setPendingCount(pendingNotes.length)

    const triggerSync = (reason: string): void => {
      if (!isOnline.current || isSyncInProgress.current) {
        return
      }

      isSyncInProgress.current = true
      fullSync(user.id)
        .catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          setSyncError(`${reason} sync failed: ${errorMessage}`)
        })
        .finally(() => {
          isSyncInProgress.current = false
        })
    }

    NetInfo.fetch()
      .then((state) => {
        isOnline.current = Boolean(
          state.isConnected && state.isInternetReachable !== false
        )
        triggerSync('Initial')
      })
      .catch(() => {
        isOnline.current = false
      })

    // Handle app state changes (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      // Trigger sync when app comes to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isOnline.current
      ) {
        triggerSync('Foreground')
      }

      appState.current = nextAppState
    }

    // Handle network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOffline = !isOnline.current
      isOnline.current = Boolean(
        state.isConnected && state.isInternetReachable !== false
      )

      // Trigger sync when network reconnects (only if app is active)
      if (wasOffline && isOnline.current && appState.current === 'active') {
        triggerSync('Reconnect')
      }
    })

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    // Cleanup
    return () => {
      appStateSubscription.remove()
      unsubscribeNetInfo()
    }
  }, [user, setSyncSuccess, setPendingCount, setSyncError])
}
