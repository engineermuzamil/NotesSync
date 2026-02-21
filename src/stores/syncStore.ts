import { create } from 'zustand'

interface SyncStore {
  isSyncing: boolean
  lastSyncedAt: string | null
  syncError: string | null
  pendingCount: number
  setSyncing: (syncing: boolean) => void
  setSyncSuccess: (timestamp: string) => void
  setSyncError: (error: string | null) => void
  setPendingCount: (count: number) => void
  clearSyncError: () => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  pendingCount: 0,

  setSyncing: (syncing: boolean) => {
    set({ isSyncing: syncing })
  },

  setSyncSuccess: (timestamp: string) => {
    set({
      isSyncing: false,
      lastSyncedAt: timestamp,
      syncError: null,
    })
  },

  setSyncError: (error: string | null) => {
    set({
      isSyncing: false,
      syncError: error,
    })
  },

  setPendingCount: (count: number) => {
    set({ pendingCount: count })
  },

  clearSyncError: () => {
    set({ syncError: null })
  },
}))
