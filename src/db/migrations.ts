import type { SyncMetaKey } from '@/src/types'
import { getDb } from './index'

export function ensureSyncMeta(): void {
  const db = getDb()
  db.runSync(
    'CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT)'
  )
  db.runSync(
    "INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('schema_version', '0')"
  )
  db.runSync(
    "INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('last_synced_at', NULL)"
  )
  db.runSync(
    "INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('device_id', NULL)"
  )
}

export function getSyncMeta(key: SyncMetaKey): string | null {
  const db = getDb()
  const row = db.getFirstSync<{ value: string | null }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    key
  )
  return row?.value ?? null
}

export function setSyncMeta(key: SyncMetaKey, value: string | null): void {
  const db = getDb()
  db.runSync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', key, value ?? null)
}

const NOTES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'checklist', 'bullets')),
    title TEXT NOT NULL DEFAULT '',
    body TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    color_label TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_error TEXT,
    remote_updated_at TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
  CREATE INDEX IF NOT EXISTS idx_notes_user_deleted ON notes(user_id, is_deleted);
`

function runMigrations(): void {
  const db = getDb()
  const version = parseInt(getSyncMeta('schema_version') ?? '0', 10)
  if (version < 1) {
    db.withTransactionSync(() => {
      const stmts = NOTES_TABLE_SQL.split(';').filter((s) => s.trim())
      for (const stmt of stmts) {
        if (stmt.trim()) db.runSync(stmt.trim())
      }
      setSyncMeta('schema_version', '1')
    })
  }
}

export function ensureMigrations(): void {
  ensureSyncMeta()
  runMigrations()
}
