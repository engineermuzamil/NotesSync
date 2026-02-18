import type { Note, NoteId, NoteType, UserId } from '@/src/types'
import { getDb } from './index'

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

export interface CreateNoteInput {
  userId: UserId
  type: NoteType
  title: string
  body?: string | null
  isPinned?: boolean
  isArchived?: boolean
  colorLabel?: string | null
}

export function createNote(input: CreateNoteInput): Note {
  const db = getDb()
  const id = uuidv4() as NoteId
  const now = nowIso()

  const note: Note = {
    id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    isPinned: input.isPinned ?? false,
    isArchived: input.isArchived ?? false,
    isDeleted: false,
    colorLabel: input.colorLabel ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    syncError: null,
    remoteUpdatedAt: null,
    retryCount: 0,
  }

  db.runSync(
    `INSERT INTO notes (
      id, user_id, type, title, body, is_pinned, is_archived, is_deleted,
      color_label, created_at, updated_at, sync_status, sync_error,
      remote_updated_at, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.userId,
    note.type,
    note.title,
    note.body,
    note.isPinned ? 1 : 0,
    note.isArchived ? 1 : 0,
    0,
    note.colorLabel,
    note.createdAt,
    note.updatedAt,
    note.syncStatus,
    note.syncError,
    note.remoteUpdatedAt,
    note.retryCount
  )

  return note
}

interface NoteRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  is_pinned: number
  is_archived: number
  is_deleted: number
  color_label: string | null
  created_at: string
  updated_at: string
  sync_status: string
  sync_error: string | null
  remote_updated_at: string | null
  retry_count: number
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as Note['type'],
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned === 1,
    isArchived: row.is_archived === 1,
    isDeleted: row.is_deleted === 1,
    colorLabel: row.color_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as Note['syncStatus'],
    syncError: row.sync_error,
    remoteUpdatedAt: row.remote_updated_at,
    retryCount: row.retry_count,
  }
}

export function getNotes(userId: UserId): Note[] {
  const db = getDb()
  const rows = db.getAllSync<NoteRow>(
    `SELECT * FROM notes
     WHERE user_id = ? AND is_deleted = 0 AND is_archived = 0
     ORDER BY is_pinned DESC, updated_at DESC`,
    userId
  )
  return rows.map(rowToNote)
}

export function getArchivedNotes(userId: UserId): Note[] {
  const db = getDb()
  const rows = db.getAllSync<NoteRow>(
    `SELECT * FROM notes
     WHERE user_id = ? AND is_deleted = 0 AND is_archived = 1
     ORDER BY is_pinned DESC, updated_at DESC`,
    userId
  )
  return rows.map(rowToNote)
}

export function getNoteById(id: NoteId): Note | null {
  const db = getDb()
  const row = db.getFirstSync<NoteRow>(
    'SELECT * FROM notes WHERE id = ? AND is_deleted = 0',
    id
  )
  return row ? rowToNote(row) : null
}

export interface UpdateNoteInput {
  title?: string
  body?: string | null
  isPinned?: boolean
  isArchived?: boolean
  type?: NoteType
  colorLabel?: string | null
}

export function updateNote(id: NoteId, input: UpdateNoteInput): Note | null {
  const existing = getNoteById(id)
  if (!existing) return null

  const db = getDb()
  const now = nowIso()
  const note: Note = {
    ...existing,
    ...input,
    updatedAt: now,
    syncStatus: 'pending',
    syncError: null,
  }

  db.runSync(
    `UPDATE notes SET
      title = ?, body = ?, is_pinned = ?, is_archived = ?,
      type = ?, color_label = ?, updated_at = ?,
      sync_status = ?, sync_error = ?
     WHERE id = ?`,
    note.title,
    note.body,
    note.isPinned ? 1 : 0,
    note.isArchived ? 1 : 0,
    note.type,
    note.colorLabel,
    note.updatedAt,
    note.syncStatus,
    note.syncError,
    id
  )

  return note
}
