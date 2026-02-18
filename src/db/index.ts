import * as SQLite from 'expo-sqlite'

const DB_NAME = 'notessync.db'

let db: SQLite.SQLiteDatabase | null = null

export function getDb(): SQLite.SQLiteDatabase {
  if (db == null) {
    db = SQLite.openDatabaseSync(DB_NAME)
  }
  return db
}
