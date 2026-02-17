export type NoteId = string
export type UserId = string
export type NoteItemId = string

export type NoteType = 'text' | 'checklist' | 'bullets'
export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface Note {
  id: NoteId
  userId: UserId
  title: string
  type: NoteType
  body: string | null
  isPinned: boolean
  isArchived: boolean
  isDeleted: boolean
  syncStatus: SyncStatus
  syncError: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface NoteItem {
  id: NoteItemId
  noteId: NoteId
  sortOrder: number
  text: string
  checked: boolean | null
  createdAt: string
  updatedAt: string
}
