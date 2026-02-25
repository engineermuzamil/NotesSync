import { supabase } from '@/src/config/supabase'
import { getDb } from '@/src/db'
import {
  getPendingNoteShares,
  updateNoteShareSyncStatus,
} from '@/src/db/note-shares'
import {
  getNoteById,
  getPendingNotes,
  updateNoteSyncStatus,
  upsertNoteFromRemote,
} from '@/src/db/notes'
import { getLastSyncedAt, setLastSyncedAt } from '@/src/db/syncMeta'
import { useSyncStore } from '@/src/stores/syncStore'
import type { Note, NoteShare, ShareId, UserId } from '@/src/types'

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

function noteShareToSupabaseRow(noteShare: NoteShare): Record<string, unknown> {
  return {
    id: noteShare.id,
    note_id: noteShare.noteId,
    owner_user_id: noteShare.ownerUserId,
    token: noteShare.token,
    visibility: noteShare.visibility,
    is_revoked: noteShare.isRevoked,
    created_at: noteShare.createdAt,
    updated_at: noteShare.updatedAt,
    revoked_at: noteShare.revokedAt,
  }
}

function supabaseRowToNoteShare(row: Record<string, unknown>): NoteShare {
  return {
    id: row.id as ShareId,
    noteId: row.note_id as string,
    ownerUserId: row.owner_user_id as string,
    token: row.token as string,
    visibility: row.visibility as NoteShare['visibility'],
    isRevoked: row.is_revoked as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    revokedAt: row.revoked_at as string | null,
    syncStatus: 'synced',
    syncError: null,
    retryCount: 0,
  }
}

function upsertNoteShareFromRemote(noteShare: NoteShare): void {
  const db = getDb()

  db.runSync(
    `INSERT INTO note_shares (
      id, note_id, owner_user_id, token, visibility, is_revoked,
      access_count, copy_count, last_accessed_at, last_copied_at,
      created_at, updated_at, revoked_at, sync_status, sync_error, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?,
      COALESCE((SELECT access_count FROM note_shares WHERE id = ?), 0),
      COALESCE((SELECT copy_count FROM note_shares WHERE id = ?), 0),
      COALESCE((SELECT last_accessed_at FROM note_shares WHERE id = ?), NULL),
      COALESCE((SELECT last_copied_at FROM note_shares WHERE id = ?), NULL),
      ?, ?, ?, 'synced', NULL, 0
    )
    ON CONFLICT(id) DO UPDATE SET
      note_id = excluded.note_id,
      owner_user_id = excluded.owner_user_id,
      token = excluded.token,
      visibility = excluded.visibility,
      is_revoked = excluded.is_revoked,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      revoked_at = excluded.revoked_at,
      sync_status = 'synced',
      sync_error = NULL`,
    noteShare.id,
    noteShare.noteId,
    noteShare.ownerUserId,
    noteShare.token,
    noteShare.visibility,
    noteShare.isRevoked ? 1 : 0,
    noteShare.id,
    noteShare.id,
    noteShare.id,
    noteShare.id,
    noteShare.createdAt,
    noteShare.updatedAt,
    noteShare.revokedAt
  )
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
  const pendingShares = getPendingNoteShares(userId)
  const errors: string[] = []
  let successCount = 0

  // Update pending count in store
  useSyncStore
    .getState()
    .setPendingCount(pendingNotes.length + pendingShares.length)

  for (const note of pendingNotes) {
    // Skip notes that exceeded max retry count
    if (note.retryCount >= MAX_RETRY_COUNT) {
      errors.push(
        `Retry limit reached for note ${note.id} (${MAX_RETRY_COUNT} attempts)`
      )
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
      const nextRetryCount = note.retryCount + 1
      const finalErrorMessage =
        nextRetryCount >= MAX_RETRY_COUNT
          ? `Retry limit reached: ${errorMessage}`
          : errorMessage

      updateNoteSyncStatus(note.id, 'failed', finalErrorMessage)
      errors.push(`Failed to sync note ${note.id}: ${errorMessage}`)
    }
  }

  for (const noteShare of pendingShares) {
    if (noteShare.retryCount >= MAX_RETRY_COUNT) {
      errors.push(
        `Retry limit reached for share ${noteShare.id} (${MAX_RETRY_COUNT} attempts)`
      )
      continue
    }

    try {
      const row = noteShareToSupabaseRow(noteShare)

      const { error } = await supabase.from('note_shares').upsert(row, {
        onConflict: 'id',
      })

      if (error) {
        throw error
      }

      updateNoteShareSyncStatus(noteShare.id, 'synced')
      successCount++
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const nextRetryCount = noteShare.retryCount + 1
      const finalErrorMessage =
        nextRetryCount >= MAX_RETRY_COUNT
          ? `Retry limit reached: ${errorMessage}`
          : errorMessage

      updateNoteShareSyncStatus(noteShare.id, 'failed', finalErrorMessage)
      errors.push(`Failed to sync share ${noteShare.id}: ${errorMessage}`)
    }
  }

  // Update pending count after push
  const remainingPending = getPendingNotes(userId)
  const remainingPendingShares = getPendingNoteShares(userId)
  useSyncStore
    .getState()
    .setPendingCount(remainingPending.length + remainingPendingShares.length)

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

    let noteQuery = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)

    if (lastSyncedAt) {
      noteQuery = noteQuery.gt('updated_at', lastSyncedAt)
    }

    const { data, error } = await noteQuery

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      for (const remoteRow of data) {
        try {
          const remoteNote = supabaseRowToNote(remoteRow)
          const localNote = getNoteById(remoteNote.id)

          if (localNote) {
            const resolution = resolveConflict(localNote, remoteNote)
            if (resolution.action === 'use_remote') {
              upsertNoteFromRemote(remoteNote)
              pulledCount++
            }
          } else {
            upsertNoteFromRemote(remoteNote)
            pulledCount++
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to merge note ${remoteRow.id}: ${errorMessage}`)
        }
      }
    }

    let shareQuery = supabase
      .from('note_shares')
      .select('*')
      .eq('owner_user_id', userId)

    if (lastSyncedAt) {
      shareQuery = shareQuery.gt('updated_at', lastSyncedAt)
    }

    const { data: shareData, error: shareError } = await shareQuery

    if (shareError) {
      throw shareError
    }

    if (shareData && shareData.length > 0) {
      for (const remoteShareRow of shareData) {
        try {
          const remoteNoteShare = supabaseRowToNoteShare(remoteShareRow)
          upsertNoteShareFromRemote(remoteNoteShare)
          pulledCount++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          errors.push(
            `Failed to merge note share ${remoteShareRow.id}: ${errorMessage}`
          )
        }
      }
    }

    return {
      success: errors.length === 0,
      count: pulledCount,
      errors,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
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

  // Mark sync as started
  useSyncStore.getState().setSyncing(true)

  try {
    // Step 1: Push local changes
    const pushResult = await pushChanges(userId)
    errors.push(...pushResult.errors)

    // Step 2: Pull remote changes
    const pullResult = await pullChanges(userId)
    errors.push(...pullResult.errors)

    // Step 3: Update last synced timestamp if both succeeded
    if (pushResult.success && pullResult.success) {
      const now = new Date().toISOString()
      setLastSyncedAt(now)
      useSyncStore.getState().setSyncSuccess(now)
    } else {
      const errorMessage = errors.join('; ')
      useSyncStore.getState().setSyncError(errorMessage)
    }

    return {
      success: pushResult.success && pullResult.success,
      pushedCount: pushResult.count,
      pulledCount: pullResult.count,
      errors,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    useSyncStore.getState().setSyncError(errorMessage)
    throw error
  }
}
