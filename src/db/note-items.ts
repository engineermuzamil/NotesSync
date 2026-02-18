import type { NoteId, NoteItem, NoteItemId, NoteType, UserId } from '@/src/types'
import { getNoteById } from './notes'
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

interface NoteItemRow {
  id: string
  note_id: string
  user_id: string
  type: string
  content: string
  is_checked: number
  position: number
  created_at: string
  updated_at: string
  sync_status: string
  sync_error: string | null
  remote_updated_at: string | null
  retry_count: number
  is_deleted: number
}

function rowToNoteItem(row: NoteItemRow): NoteItem {
  return {
    id: row.id,
    noteId: row.note_id,
    userId: row.user_id,
    type: row.type as NoteItem['type'],
    content: row.content,
    isChecked: row.is_checked === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as NoteItem['syncStatus'],
    syncError: row.sync_error,
    remoteUpdatedAt: row.remote_updated_at,
    retryCount: row.retry_count,
    isDeleted: row.is_deleted === 1,
  }
}

export interface CreateNoteItemInput {
  noteId: NoteId
  userId: UserId
  type: NoteType
  content: string
  position?: number
  isChecked?: boolean
}

export function createNoteItem(input: CreateNoteItemInput): NoteItem | null {
  const note = getNoteById(input.noteId)
  if (!note) return null

  const db = getDb()
  const id = uuidv4() as NoteItemId
  const now = nowIso()
  const position = input.position ?? (getMaxPosition(input.noteId) + 1)

  const item: NoteItem = {
    id,
    noteId: input.noteId,
    userId: input.userId,
    type: input.type,
    content: input.content,
    isChecked: input.isChecked ?? false,
    position,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    syncError: null,
    remoteUpdatedAt: null,
    retryCount: 0,
    isDeleted: false,
  }

  db.runSync(
    `INSERT INTO note_items (
      id, note_id, user_id, type, content, is_checked, position,
      created_at, updated_at, sync_status, sync_error,
      remote_updated_at, retry_count, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.noteId,
    item.userId,
    item.type,
    item.content,
    item.isChecked ? 1 : 0,
    item.position,
    item.createdAt,
    item.updatedAt,
    item.syncStatus,
    item.syncError,
    item.remoteUpdatedAt,
    item.retryCount,
    0
  )

  return item
}

function getMaxPosition(noteId: NoteId): number {
  const db = getDb()
  const row = db.getFirstSync<{ max: number | null }>(
    'SELECT MAX(position) as max FROM note_items WHERE note_id = ? AND is_deleted = 0',
    noteId
  )
  return row?.max ?? -1
}

export function getNoteItems(noteId: NoteId): NoteItem[] {
  const db = getDb()
  const rows = db.getAllSync<NoteItemRow>(
    'SELECT * FROM note_items WHERE note_id = ? AND is_deleted = 0 ORDER BY position ASC',
    noteId
  )
  return rows.map(rowToNoteItem)
}

export function getNoteItemById(id: NoteItemId): NoteItem | null {
  const db = getDb()
  const row = db.getFirstSync<NoteItemRow>(
    'SELECT * FROM note_items WHERE id = ? AND is_deleted = 0',
    id
  )
  return row ? rowToNoteItem(row) : null
}

export interface UpdateNoteItemInput {
  content?: string
  isChecked?: boolean
  position?: number
}

export function updateNoteItem(
  id: NoteItemId,
  input: UpdateNoteItemInput
): NoteItem | null {
  const existing = getNoteItemById(id)
  if (!existing) return null

  const db = getDb()
  const now = nowIso()
  const item: NoteItem = {
    ...existing,
    ...input,
    updatedAt: now,
    syncStatus: 'pending',
    syncError: null,
  }

  db.runSync(
    `UPDATE note_items SET
      content = ?, is_checked = ?, position = ?, updated_at = ?,
      sync_status = 'pending', sync_error = NULL
     WHERE id = ?`,
    item.content,
    item.isChecked ? 1 : 0,
    item.position,
    item.updatedAt,
    id
  )

  return item
}

export function deleteNoteItem(id: NoteItemId): boolean {
  const existing = getNoteItemById(id)
  if (!existing) return false

  const db = getDb()
  const now = nowIso()

  db.runSync(
    `UPDATE note_items SET
      is_deleted = 1, updated_at = ?, sync_status = 'pending', sync_error = NULL
     WHERE id = ?`,
    now,
    id
  )

  return true
}

export function reorderNoteItems(noteId: NoteId, itemIds: NoteItemId[]): void {
  const db = getDb()
  db.withTransactionSync(() => {
    itemIds.forEach((id, index) => {
      db.runSync(
        `UPDATE note_items SET position = ?, updated_at = ?, sync_status = 'pending'
         WHERE id = ? AND note_id = ?`,
        index,
        nowIso(),
        id,
        noteId
      )
    })
  })
}
