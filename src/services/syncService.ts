import type { Note, UserId } from '@/src/types'
import { supabase } from '@/src/config/supabase'
import {
  getPendingNotes,
  updateNoteSyncStatus,
  upsertNoteFromRemote,
  getNoteById,
} from '@/src/db/notes'
import { getLastSyncedAt, setLastSyncedAt } from '@/src/db/syncMeta'

const MAX_RETRY_COUNT = 5

interface SyncResult {
  success: boolean
  pushedCount: number
  pulledCount: number
  errors: string[]
}

interface ConflictResolution {
  action: 'keep_local' | 'use_remote'
  winner: Note
}

/**
 * Resolve conflict between local and remote note using Last Write Wins
 */
function resolveConflict(local: Note, remote: Note): ConflictResolution {
  // If local has pending changes, always keep local
  if (local.syncStatus === 'pending') {
    return { action: 'keep_local', winner: local }
  }

  // Otherwise, use timestamps to determine winner
  const localTime = new Date(local.updatedAt).getTime()
  const remoteTime = new Date(remote.updatedAt).getTime()

  if (remoteTime > localTime) {
    return { action: 'use_remote', winner: remote }
  }

  return { action: 'keep_local', winner: local }
}

/**
 * Convert local Note to Supabase row format
 */
function noteToSupabaseRow(note: Note): Record<string, unknown> {
  return {
    id: note.id,
    user_id: note.userId,
    type: note.type,
    title: note.title,
    body: note.body,
    is_pinned: note.isPinned,
    is_archived: note.isArchived,
    is_deleted: note.isDeleted,
    color_label: note.colorLabel,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  }
}

/**
 * Convert Supabase row to local Note format
 */
function supabaseRowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as Note['type'],
    title: row.title as string,
    body: row.body as string | null,
    isPinned: row.is_pinned as boolean,
    isArchived: row.is_archived as boolean,
    isDeleted: row.is_deleted as boolean,
    colorLabel: row.color_label as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncStatus: 'synced',
    syncError: null,
    remoteUpdatedAt: row.updated_at as string,
    retryCount: 0,
  }
}

/**
 * Push local pending changes to Supabase
 */
export async function pushChanges(userId: UserId): Promise<{
  success: boolean
  count: number
  errors: string[]
}> {
  const pendingNotes = getPendingNotes(userId)
  const errors: string[] = []
  let successCount = 0

  for (const note of pendingNotes) {
    // Skip notes that exceeded max retry count
    if (note.retryCount >= MAX_RETRY_COUNT) {
      continue
    }

    try {
      const row = noteToSupabaseRow(note)

      const { error } = await supabase.from('notes').upsert(row, {
        onConflict: 'id',
      })

      if (error) {
        throw error
      }

      // Mark as synced
      updateNoteSyncStatus(note.id, 'synced', null, note.updatedAt)
      successCount++
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      updateNoteSyncStatus(note.id, 'failed', errorMessage)
      errors.push(`Failed to sync note ${note.id}: ${errorMessage}`)
    }
  }

  return {
    success: errors.length === 0,
    count: successCount,
    errors,
  }
}

/**
 * Pull remote changes from Supabase since last sync
 */
export async function pullChanges(userId: UserId): Promise<{
  success: boolean
  count: number
  errors: string[]
}> {
  const errors: string[] = []
  let pulledCount = 0

  try {
    const lastSyncedAt = getLastSyncedAt()

    // Build query
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)

    // Only fetch notes updated after last sync
    if (lastSyncedAt) {
      query = query.gt('updated_at', lastSyncedAt)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      return { success: true, count: 0, errors: [] }
    }

    // Process each remote note
    for (const remoteRow of data) {
      try {
        const remoteNote = supabaseRowToNote(remoteRow)
        const localNote = getNoteById(remoteNote.id)

        // If local note exists, resolve conflict
        if (localNote) {
          const resolution = resolveConflict(localNote, remoteNote)
          if (resolution.action === 'use_remote') {
            upsertNoteFromRemote(remoteNote)
            pulledCount++
          }
          // If keep_local, do nothing (local wins)
        } else {
          // New note from remote, insert it
          upsertNoteFromRemote(remoteNote)
          pulledCount++
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to merge note ${remoteRow.id}: ${errorMessage}`)
      }
    }

    return {
      success: errors.length === 0,
      count: pulledCount,
      errors,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Pull sync failed: ${errorMessage}`)
    return {
      success: false,
      count: pulledCount,
      errors,
    }
  }
}

/**
 * Perform full bidirectional sync (push then pull)
 */
export async function fullSync(userId: UserId): Promise<SyncResult> {
  const errors: string[] = []

  // Step 1: Push local changes
  const pushResult = await pushChanges(userId)
  errors.push(...pushResult.errors)

  // Step 2: Pull remote changes
  const pullResult = await pullChanges(userId)
  errors.push(...pullResult.errors)

  // Step 3: Update last synced timestamp if both succeeded
  if (pushResult.success && pullResult.success) {
    setLastSyncedAt(new Date().toISOString())
  }

  return {
    success: pushResult.success && pullResult.success,
    pushedCount: pushResult.count,
    pulledCount: pullResult.count,
    errors,
  }
}
