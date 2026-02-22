import { getSyncMeta, setSyncMeta } from './migrations'

/**
 * Get the last successful sync timestamp for the current user
 * @returns ISO 8601 timestamp string or null if never synced
 */
export function getLastSyncedAt(): string | null {
  return getSyncMeta('last_synced_at')
}

/**
 * Update the last successful sync timestamp
 * @param timestamp ISO 8601 timestamp string
 */
export function setLastSyncedAt(timestamp: string): void {
  const currentTimestamp = getLastSyncedAt()

  if (!currentTimestamp) {
    setSyncMeta('last_synced_at', timestamp)
    return
  }

  const currentTime = Date.parse(currentTimestamp)
  const nextTime = Date.parse(timestamp)

  if (Number.isNaN(nextTime)) {
    return
  }

  if (Number.isNaN(currentTime) || nextTime >= currentTime) {
    setSyncMeta('last_synced_at', timestamp)
  }
}

/**
 * Clear the last synced timestamp (useful for full resync)
 */
export function clearLastSyncedAt(): void {
  setSyncMeta('last_synced_at', null)
}

/**
 * Get the device ID for this installation
 * @returns Device ID string or null if not set
 */
export function getDeviceId(): string | null {
  return getSyncMeta('device_id')
}

/**
 * Set the device ID for this installation
 * @param deviceId Unique device identifier
 */
export function setDeviceId(deviceId: string): void {
  setSyncMeta('device_id', deviceId)
}

/**
 * Check if this device has ever synced
 * @returns true if device has synced at least once
 */
export function hasEverSynced(): boolean {
  return getLastSyncedAt() !== null
}
