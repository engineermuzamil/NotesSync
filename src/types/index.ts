// src/types/index.ts

export type NoteId = string
export type UserId = string
export type NoteItemId = string

export type NoteType = 'text' | 'checklist' | 'bullets'
export type SyncStatus = 'pending' | 'synced' | 'failed'
export type SyncMetaKey = 'schema_version' | 'last_synced_at' | 'device_id'

export interface Note {
  id: NoteId
  userId: UserId
  type: NoteType
  title: string
  body: string | null
  isPinned: boolean
  isArchived: boolean
  isDeleted: boolean
  colorLabel: string | null
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
  syncError: string | null
  remoteUpdatedAt: string | null
  retryCount: number
}

export interface NoteItem {
  id: NoteItemId
  noteId: NoteId
  userId: UserId
  type: NoteType
  content: string
  isChecked: boolean
  position: number
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
  syncError: string | null
  remoteUpdatedAt: string | null
  retryCount: number
  isDeleted: boolean
}

export interface NoteWithItems {
  note: Note
  items: NoteItem[]
}

export interface AuthUser {
  id: UserId
  email: string
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface AuthResponse {
  user: AuthUser
  session: AuthSession
}

export type AuthMode = 'cloud' | 'local'
