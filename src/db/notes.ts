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
