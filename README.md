# NotesSync

NotesSync is an offline-first note-taking app built as a technical assessment.
The app prioritizes local reliability by using SQLite as the source of truth and syncing to Supabase in the background.

## Stack

- Expo SDK 51
- React Native + Expo Router
- TypeScript (strict mode)
- expo-sqlite (local source of truth)
- Supabase JS v2 (remote sync target)
- Zustand (state)
- expo-secure-store (auth token storage)
- @react-native-community/netinfo
- expo-background-fetch + expo-task-manager

## Architecture

- Local-first writes: all create/update/delete operations are written to SQLite first
- Sync status per note: `pending | synced | failed`
- Conflict strategy: Last Write Wins based on `updated_at`
- Auth: email/password only
- Background behavior:
  - Foreground + reconnect triggers full sync (push + pull)
  - Background fetch triggers push-only sync

## Project Structure

- `app/` route-based screens and layouts
- `src/db/` SQLite access, migrations, and repositories
- `src/services/` auth/session/sync/background orchestration
- `src/stores/` Zustand app state
- `src/hooks/` UI-facing data and sync hooks
- `src/types/` shared TypeScript contracts

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Expo

   ```bash
   npx expo start
   ```

3. Run on Android (recommended for assessment)
   - Use Expo dev build or Android emulator/device

## Phase Progress

- ✅ Phase 1: Project setup
- ✅ Phase 2: App shell
- ✅ Phase 3: Supabase schema
- ✅ Phase 4: Local database
- ✅ Phase 5: Auth
- ✅ Phase 6: Notes core
- ✅ Phase 7: Sync engine
- ✅ Phase 8: Offline hardening
- 🚧 Phase 9: README and cleanup

## Phase 8 Hardening Summary

- Connectivity-gated sync startup and reconnect sync behavior
- Guard against concurrent full sync execution
- Retry cap enforcement with terminal failed state persistence
- Monotonic `last_synced_at` updates (prevents timestamp regression)
- Background sync lifecycle serialization (register/unregister race protection)
- Runtime console logging removed in sync/background path

## Validation Checklist

- Create/edit/delete notes while offline and verify local persistence
- Reconnect network and verify pending changes sync automatically
- Confirm failed sync entries stop retrying after retry cap
- Confirm `last_synced_at` only moves forward
- Verify logout clears session and background sync task lifecycle remains stable

## Notes for Evaluators

- Priority is architecture and reliability over feature volume
- Data integrity follows SQLite-first workflow
- Sync is non-blocking for UI actions
