// src/types/index.ts

export type NoteId = string
export type UserId = string
export type NoteItemId = string
export type ShareId = string
export type ShareToken = string

export type NoteType = 'text' | 'checklist' | 'bullets'
export type SyncStatus = 'pending' | 'synced' | 'failed'
export type SyncMetaKey = 'schema_version' | 'last_synced_at' | 'device_id'
export type ShareVisibility = 'private' | 'public'
export type ShareSyncStatus = 'pending' | 'synced' | 'failed'

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

export interface NoteShare {
  id: ShareId
  noteId: NoteId
  ownerUserId: UserId
  token: ShareToken
  visibility: ShareVisibility
  isRevoked: boolean
  createdAt: string
  updatedAt: string
  revokedAt: string | null
  syncStatus: ShareSyncStatus
  syncError: string | null
  retryCount: number
}

export interface ShareAnalytics {
  shareId: ShareId
  accessCount: number
  copyCount: number
  lastAccessedAt: string | null
  lastCopiedAt: string | null
}

export interface PublicSharedNote {
  shareId: ShareId
  token: ShareToken
  note: Note
  items: NoteItem[]
  analytics: ShareAnalytics
}
