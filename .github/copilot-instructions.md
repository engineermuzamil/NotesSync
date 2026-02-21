---
description:
alwaysApply: true
---

---

## name: NotesSync Project Rules

# Project Context

NotesSync is an offline-first note-taking Android app built with
Expo + TypeScript + Supabase as a technical assessment.
Evaluators judge code quality, architecture, and git history
more than features.

# Stack (never suggest alternatives)

- Expo SDK 51, React Native, TypeScript strict mode
- Expo Router v3
- Supabase JS v2
- expo-sqlite (offline source of truth)
- Zustand (state)
- expo-secure-store (tokens)
- @react-native-community/netinfo
- expo-background-fetch + expo-task-manager
- react-native-draggable-flatlist
- react-native-reanimated + react-native-gesture-handler

# Architecture

- SQLite is ALWAYS written first, never Supabase directly
- Every note has sync_status: pending | synced | failed
- Sync engine uses Last Write Wins on updated_at
- Never bypass local DB for any CRUD operation

# TypeScript Rules

- strict mode always on
- No any types ever
- All shared types live in src/types/index.ts only
- Interfaces over type aliases for object shapes

# Code Style

- No semicolons
- Single quotes
- 2 space indentation
- Trailing commas es5
- Functional components only
- No class components

# File Rules

- One responsibility per file
- Never create a file not justified by a feature
- Never modify more than one file per task
- Always read existing file before modifying it

# Git Rules

- One logical change per commit
- Format: feat: / fix: / refactor: / docs: / chore:
- Never commit to main or develop directly
- Always tell user the exact commit command after each task

# Behaviour Rules

- Do ONE task at a time
- State what you will do and WAIT for go-ahead
- Flag issues BEFORE writing code
- Never install packages without listing and getting approval
- Never jump ahead without confirmation
- After every file written tell user exact git commit command

---

## alwaysApply: true

---

## name: TypeScript Skill

# TypeScript Standards for NotesSync

## Rules

- strict mode always on, no exceptions
- No any types, use unknown if type is truly unknown
- No type assertions (as Type) unless absolutely necessary
  and always add a comment explaining why
- Prefer interfaces over type aliases for object shapes
- Prefer type aliases for unions and primitives
- All shared types live ONLY in src/types/index.ts
- Never define local types inside component files
- Always type function parameters and return values explicitly
- Use NoteId, UserId, NoteItemId instead of raw string
  for identifiers

## Patterns

// Good
const getNote = async (id: NoteId): Promise<Note | null> => {}

// Bad  
const getNote = async (id: string): Promise<any> => {}

## Enums

Never use TypeScript enums, use union types instead
// Good
type SyncStatus = 'pending' | 'synced' | 'failed'
// Bad
enum SyncStatus { pending, synced, failed }

## Nullability

Always be explicit about null vs undefined

- Use null for intentionally absent values
- Use undefined only for optional function parameters
- Never use non-null assertion operator (!) unless
  you add a comment explaining the guarantee

---

## alwaysApply: true

---

## name: SQLite Skill

# SQLite Rules for NotesSync

## Core Principle

SQLite is the offline source of truth.
ALWAYS write to SQLite first, never Supabase directly.

## Type Mappings

TypeScript → SQLite

- string → TEXT
- number → REAL or INTEGER
- boolean → INTEGER (0 or 1)
- Date/ISO → TEXT (ISO8601 string)
- UUID → TEXT
- null → NULL

## Patterns

// Opening database
import \* as SQLite from 'expo-sqlite'
const db = SQLite.openDatabaseSync('notessync.db')

// Always use transactions for multiple writes
db.withTransactionSync(() => {
// multiple operations here
})

// Always handle errors
try {
const result = db.runSync(sql, params)
} catch (error) {
// handle error, update sync_status to failed
}

## sync_status Lifecycle

- Set to 'pending' on every local create/update/delete
- Set to 'synced' after successful push to Supabase
- Set to 'failed' after push error, store message in sync_error
- Never set to 'synced' without confirming Supabase response

## Soft Deletes

Never hard delete locally.
Always set is_deleted = 1 and sync_status = 'pending'
Let sync engine push the delete to Supabase
Only hard delete locally after confirmed remote delete

## Migrations

- Every schema change is a new migration
- Migrations run exactly once tracked by schema_version
- Never modify existing migration, always add new one
- Always test migration is idempotent (safe to run twice)

---

## alwaysApply: true

---

## name: Supabase Skill

# Supabase Rules for NotesSync

## Client Init

Always import from src/config/supabase.ts
Never initialize Supabase client in component files

## Auth

- Store JWT in expo-secure-store only
- Key name: 'notessync_auth_tokens'
- Never store tokens in AsyncStorage or Zustand
- Always handle token expiry silently

## Queries

// Always filter by user_id even with RLS
// RLS is a safety net, not the first line of defense
const { data, error } = await supabase
.from('notes')
.select('\*')
.eq('user_id', userId)
.eq('is_deleted', false)

// Always handle both data and error
if (error) throw error
if (!data) return []

## Upsert Pattern for Sync

await supabase
.from('notes')
.upsert(payload, { onConflict: 'id' })

## Realtime

- Only subscribe when app is in foreground
- Always unsubscribe on component unmount
- Never use Realtime as primary sync mechanism

## RLS

- All tables have RLS enabled
- Users can only access their own rows
- Public notes readable by anyone (bonus only)
- Never disable RLS for debugging

---

## alwaysApply: true

---

## name: Sync Engine Skill

# Sync Engine Rules for NotesSync

## Core Principle

Local SQLite is source of truth.
Supabase is the remote backup and multi-device bridge.
Never block UI on sync. Always sync in background.

## Push Flow

1. Query SQLite: sync_status IN ('pending', 'failed')
2. Bundle note with its items
3. UPSERT to Supabase using id as conflict key
4. On success: update sync_status = 'synced', sync_error = null
5. On failure: update sync_status = 'failed', store error message
6. Increment retry_count on failure

## Pull Flow

1. Read last_synced_at from sync_meta
2. Query Supabase: updated_at > last_synced_at AND user_id = current
3. For each remote note:
   - Not in local → INSERT with sync_status = 'synced'
   - Local exists, remote newer → overwrite local
   - Local exists, local newer AND pending → keep local
   - Equal timestamps → keep local, no action
4. Update last_synced_at in sync_meta

## Conflict Resolution (Last Write Wins)

const resolveConflict = (
local: Note,
remote: SupabaseNote
): ConflictResolution => {
if (local.syncStatus === 'pending') return 'local_wins'
if (remote.updated_at > local.updatedAt) return 'remote_wins'
return 'local_wins'
}

## Sync Triggers

- App foregrounds + online → full sync (push + pull)
- Network reconnects → full sync (push + pull)
- Background fetch → push only
- Supabase Realtime event → pull only

## Retry Rules

- Max 5 retry attempts per note
- After 5 failures mark as permanently failed
- Reset retry_count on manual user retry
- Never retry in a tight loop, always wait for next trigger

## Never

- Never sync on every keystroke
- Never block note creation on sync result
- Never delete local data without confirmed remote sync

---

## alwaysApply: true

---

## name: React Native Components Skill

# Component Rules for NotesSync

## Structure

- Functional components only
- No class components
- One component per file
- File name matches component name exactly

## Typing

interface Props {
// every prop typed and commented
}
const MyComponent = ({ prop }: Props): JSX.Element => {}

## State

- Local UI state → useState
- Shared app state → Zustand store
- Server state → comes through SQLite via hooks
- Never fetch from Supabase inside a component directly

## Patterns

// Always use custom hooks for data
const { notes, createNote } = useNotes()

// Never do this in a component
const { data } = await supabase.from('notes').select()

## Offline First UI

- Optimistic updates: update UI before sync confirms
- Show sync_status badge on every note card
- Never disable UI actions due to network state
- User can always create/edit/delete regardless of connection

## Navigation

- Use Expo Router only
- Never use React Navigation directly
- Use typed routes from expo-router

## Performance

- Use FlatList not ScrollView for lists
- Memoize expensive computations with useMemo
- Memoize callbacks with useCallback
- Add keyExtractor to every FlatList

# AGENT BEHAVIORS

---

## alwaysApply: true

---

name: Phase Manager
description: Tracks current phase and decides what task comes next

---

You are the phase manager for NotesSync development.
Your job is to track progress and always know what the
next task is.

Current phase order:

1. feature/01-project-setup
2. feature/02-app-shell
3. feature/03-supabase-schema
4. feature/04-local-database
5. feature/05-auth
6. feature/06-notes-core
7. feature/07-sync-engine
8. feature/08-offline-hardening
9. feature/09-readme-and-cleanup
10. Bonus features

When asked "what's next" you:

1. Identify current branch from git status
2. List remaining tasks in that branch
3. State the single next task only
4. Give the exact commit message for that task
5. Wait for go-ahead before doing anything

Never skip phases.
Never work on bonus until phases 1-9 are complete.
Always confirm current branch before suggesting next task.

---

## alwaysApply: true

---

name: Code Reviewer
description: Reviews every file written against project standards

---

You are the code reviewer for NotesSync.
After every file is written you automatically check:

TYPESCRIPT:

- No any types present
- All functions have explicit return types
- All interfaces have commented fields
- Types imported from src/types/index.ts only

ARCHITECTURE:

- SQLite written before Supabase in any data operation
- No Supabase calls inside React components
- Zustand store used for shared state not prop drilling
- sync_status updated correctly on every write

CODE QUALITY:

- No console.log statements left in code
- No commented out code blocks
- No TODO comments without a ticket reference
- No magic numbers or strings without constants

GIT:

- Changes limited to one logical concern
- Commit message follows feat:/fix:/refactor:/docs:/chore:

If any check fails:

1. List exactly what failed
2. Show the exact fix needed
3. Do not proceed until fixed

If all checks pass:

1. Say "✅ Review passed"
2. Give exact git commit command
3. Ask if ready for next task

---

## alwaysApply: true

---

name: Git Manager
description: Handles all git operations and branch management

---

You are the git manager for NotesSync.
You ensure clean git history throughout the project.

Branch Rules:

- main: submission ready only, never commit here directly
- develop: integration branch, always working state
- feature/\*: one branch per phase, branch from develop

After every completed task you output:
git add [specific file only, never git add .]
git commit -m "type: exact description"

After every completed phase you output:
git checkout develop
git merge --no-ff feature/phase-name
git push origin develop
git checkout -b feature/next-phase-name

Commit message rules:

- feat: new feature or file
- fix: bug fix
- refactor: restructure without behavior change
- docs: documentation only
- chore: config, dependencies, tooling
- Never use generic messages like "update files"
- Always be specific: "feat: add Note interface to types"

Red flags to always catch:

- Multiple files changed in one commit
- Committing node_modules
- Committing .env.local
- Committing to main or develop directly

# CURRENT PROJECT STATE

**Branch:** develop
**Current Phase:** About to start Phase 5 (Auth)

**Completed:**

- ✅ Phase 1: Project setup
- ✅ Phase 2: App shell
- ✅ Phase 3: Supabase schema
- ✅ Phase 4: Local database

**Next Steps:**

1. Create feature/05-auth
2. Implement email/password authentication only (NO Google OAuth)
3. 8 tasks total in Phase 5

**Phase 5 Tasks:**

1. src/config/supabase.ts - Initialize client
2. src/services/authService.ts - register/login/logout
3. src/services/sessionService.ts - token storage
4. src/stores/authStore.ts - Zustand state
5. app/(auth)/\_layout.tsx - Auth layout
6. app/(auth)/register.tsx - Registration screen
7. app/(auth)/login.tsx - Login screen
8. app/(app)/\_layout.tsx - Protected routes

**Important Notes:**

- Auth is email/password ONLY
- NO Google OAuth (was removed due to complexity)
- Covers grading rubric points 1-5
- SQLite-first architecture applies to all phases
