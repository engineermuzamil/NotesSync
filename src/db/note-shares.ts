import type {
  NoteId,
  NoteShare,
  ShareId,
  ShareToken,
  UserId,
} from '@/src/types'
import { getDb } from './index'
import { getNoteById } from './notes'

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function nowIso(): string {
  return new Date().toISOString()
}

function generateShareToken(): ShareToken {
  return uuidv4() as ShareToken
}

interface NoteShareRow {
  id: string
  note_id: string
  owner_user_id: string
  token: string
  visibility: string
  is_revoked: number
  access_count: number
  copy_count: number
  last_accessed_at: string | null
  last_copied_at: string | null
  created_at: string
  updated_at: string
  revoked_at: string | null
  sync_status: string
  sync_error: string | null
  retry_count: number
}

function rowToNoteShare(row: NoteShareRow): NoteShare {
  return {
    id: row.id,
    noteId: row.note_id,
    ownerUserId: row.owner_user_id,
    token: row.token,
    visibility: row.visibility as NoteShare['visibility'],
    isRevoked: row.is_revoked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
    syncStatus: row.sync_status as NoteShare['syncStatus'],
    syncError: row.sync_error,
    retryCount: row.retry_count,
  }
}

function getNoteShareByNoteIdInternal(noteId: NoteId): NoteShare | null {
  const db = getDb()
  const row = db.getFirstSync<NoteShareRow>(
    'SELECT * FROM note_shares WHERE note_id = ? LIMIT 1',
    noteId
  )

  return row ? rowToNoteShare(row) : null
}

export function getNoteShareById(id: ShareId): NoteShare | null {
  const db = getDb()
  const row = db.getFirstSync<NoteShareRow>(
    'SELECT * FROM note_shares WHERE id = ? LIMIT 1',
    id
  )

  return row ? rowToNoteShare(row) : null
}

export function getNoteShareByNoteId(noteId: NoteId): NoteShare | null {
  return getNoteShareByNoteIdInternal(noteId)
}

export function getPendingNoteShares(ownerUserId: UserId): NoteShare[] {
  const db = getDb()
  const rows = db.getAllSync<NoteShareRow>(
    `SELECT * FROM note_shares
     WHERE owner_user_id = ? AND sync_status IN ('pending', 'failed')
     ORDER BY updated_at ASC`,
    ownerUserId
  )

  return rows.map(rowToNoteShare)
}

export function createOrEnablePublicShare(
  noteId: NoteId,
  ownerUserId: UserId
): NoteShare | null {
  const note = getNoteById(noteId)
  if (!note || note.userId !== ownerUserId || note.isDeleted) {
    return null
  }

  const db = getDb()
  const now = nowIso()
  const existingShare = getNoteShareByNoteIdInternal(noteId)

  if (existingShare) {
    db.runSync(
      `UPDATE note_shares SET
        visibility = 'public',
        is_revoked = 0,
        updated_at = ?,
        revoked_at = NULL,
        sync_status = 'pending',
        sync_error = NULL
       WHERE id = ?`,
      now,
      existingShare.id
    )

    return getNoteShareById(existingShare.id)
  }

  const shareId = uuidv4() as ShareId
  const token = generateShareToken()

  db.runSync(
    `INSERT INTO note_shares (
      id, note_id, owner_user_id, token, visibility, is_revoked,
      access_count, copy_count, last_accessed_at, last_copied_at,
      created_at, updated_at, revoked_at, sync_status, sync_error, retry_count
    ) VALUES (?, ?, ?, ?, 'public', 0, 0, 0, NULL, NULL, ?, ?, NULL, 'pending', NULL, 0)`,
    shareId,
    noteId,
    ownerUserId,
    token,
    now,
    now
  )

  return getNoteShareById(shareId)
}

export function revokePublicShare(
  noteId: NoteId,
  ownerUserId: UserId
): NoteShare | null {
  const note = getNoteById(noteId)
  if (!note || note.userId !== ownerUserId || note.isDeleted) {
    return null
  }

  const existingShare = getNoteShareByNoteIdInternal(noteId)
  if (!existingShare) {
    return null
  }

  const db = getDb()
  const now = nowIso()

  db.runSync(
    `UPDATE note_shares SET
      visibility = 'private',
      is_revoked = 1,
      updated_at = ?,
      revoked_at = ?,
      sync_status = 'pending',
      sync_error = NULL
     WHERE id = ? AND owner_user_id = ?`,
    now,
    now,
    existingShare.id,
    ownerUserId
  )

  return getNoteShareById(existingShare.id)
}

export function updateNoteShareSyncStatus(
  id: ShareId,
  status: 'synced' | 'failed',
  error: string | null = null
): void {
  const db = getDb()
  const maxRetryCount = 5

  db.runSync(
    `UPDATE note_shares SET
      sync_status = ?,
      sync_error = ?,
      retry_count = CASE
        WHEN ? = 'failed' THEN MIN(retry_count + 1, ?)
        ELSE retry_count
      END
     WHERE id = ?`,
    status,
    error,
    status,
    maxRetryCount,
    id
  )
}
