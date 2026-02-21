import * as authService from '@/src/services/authService'
import * as sessionService from '@/src/services/sessionService'
import { pushChanges } from '@/src/services/syncService'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'

const BACKGROUND_SYNC_TASK = 'background-notes-sync'

/**
 * Background task definition - performs push-only sync
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Get current user from session
    const tokens = await sessionService.loadSession()
    if (!tokens) {
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    const user = await authService.getCurrentUser()
    if (!user) {
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    // Perform push-only sync (no pull to save resources)
    const result = await pushChanges(user.id)

    if (result.success) {
      return result.count > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData
    }

    return BackgroundFetch.BackgroundFetchResult.Failed
  } catch (error) {
    console.error('Background sync failed:', error)
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

/**
 * Register background fetch task
 * Should be called once when the app starts and user is authenticated
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync()

    // Check if background fetch is available
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      const isRegistered =
        await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)

      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: 60 * 15, // 15 minutes minimum interval
          stopOnTerminate: false, // Continue after app termination
          startOnBoot: true, // Start on device boot
        })
        console.log('Background sync registered')
      }
    } else {
      console.warn('Background fetch not available:', status)
    }
  } catch (error) {
    console.error('Failed to register background sync:', error)
  }
}

/**
 * Unregister background fetch task
 * Should be called on logout
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)

    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK)
      console.log('Background sync unregistered')
    }
  } catch (error) {
    console.error('Failed to unregister background sync:', error)
  }
}

/**
 * Check if background sync is currently registered
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)
  } catch {
    return false
  }
}
