import * as authService from '@/src/services/authService'
import * as sessionService from '@/src/services/sessionService'
import { pushChanges } from '@/src/services/syncService'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

const BACKGROUND_SYNC_TASK = 'background-notes-sync'
let registerInFlight: Promise<void> | null = null
let unregisterInFlight: Promise<void> | null = null

/**
 * Background task definition - performs push-only sync
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Get current user from session
    const tokens = await sessionService.loadSession()
    if (!tokens) {
      return BackgroundTask.BackgroundTaskResult.Success
    }

    const user = await authService.getCurrentUser()
    if (!user) {
      return BackgroundTask.BackgroundTaskResult.Success
    }

    // Perform push-only sync (no pull to save resources)
    const result = await pushChanges(user.id)

    if (result.success) {
      return BackgroundTask.BackgroundTaskResult.Success
    }

    return BackgroundTask.BackgroundTaskResult.Failed
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

/**
 * Register background sync task
 * Should be called once when the app starts and user is authenticated
 */
export async function registerBackgroundSync(): Promise<void> {
  if (registerInFlight) {
    await registerInFlight
    return
  }

  registerInFlight = (async () => {
    try {
      if (unregisterInFlight) {
        await unregisterInFlight
      }

      const status = await BackgroundTask.getStatusAsync()

      if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
        return
      }

      const isRegistered =
        await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)

      if (!isRegistered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: 60 * 15,
        })
      }
    } catch {
      return
    }
  })()

  try {
    await registerInFlight
  } finally {
    registerInFlight = null
  }
}

/**
 * Unregister background sync task
 * Should be called on logout
 */
export async function unregisterBackgroundSync(): Promise<void> {
  if (unregisterInFlight) {
    await unregisterInFlight
    return
  }

  unregisterInFlight = (async () => {
    try {
      if (registerInFlight) {
        await registerInFlight
      }

      const isRegistered =
        await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)

      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK)
      }
    } catch {
      return
    }
  })()

  try {
    await unregisterInFlight
  } finally {
    unregisterInFlight = null
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
