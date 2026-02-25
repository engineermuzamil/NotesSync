# NotesSync

NotesSync is an offline-first note-taking app built with Expo + TypeScript.
SQLite is the local source of truth. Supabase is used for authentication, cloud sync, and share endpoints.

## How to run the app

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root with:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (present in env set, not used for auth flow)

### 3) Start development server

```bash
npx expo start
```

### 4) Run target

- Web: press `w` in Expo terminal
- Android dev: press `a` (emulator) or open on device
- Lint: `npm run lint`

### 5) Build APK (preview)

Cloud build:

```bash
eas build --platform android --profile preview
```

Local build (Linux with Android SDK set up):

```bash
eas build --platform android --profile preview --local
```

## Auth backend used

- Backend: Supabase Auth
- Method: email/password only
- Session tokens stored in `expo-secure-store`
- Auth client initialized in `src/config/supabase.ts`

## How sync works

### Local-first write path

1. All note CRUD writes happen in SQLite first.
2. Records are marked with `sync_status` (`pending`, `synced`, `failed`).
3. UI is never blocked by remote sync.

### Sync triggers

- App foreground + online: full sync (push then pull)
- Network reconnect: full sync (push then pull)
- Background task: push-focused sync behavior

### Conflict strategy

- Last Write Wins using `updated_at`
- If local row is still pending, local data is preserved

### Sharing sync

- Public share metadata is stored locally and synced to Supabase
- Public preview/copy is served by Supabase Edge Function

## Known issues

- Sync status messaging can be noisy or stale in some screens (UI state vs DB timing)
- Existing migration history has multiple schema iterations; fresh environments must run migrations in order
- Long free-tier EAS queues slow down build feedback loops
- Development build requires Metro running; preview build is better for offline testing

## What I would improve with more time

- Add a dedicated sync diagnostics screen with per-entity retry/error details
- Improve session restoration to explicitly rehydrate Supabase auth session every app launch
- Normalize migration history into one clean baseline + forward-only migrations
- Add e2e tests for offline edits, reconnect sync, and share link lifecycle
- Add stronger telemetry around background sync failures

## Project structure

- `app/`: Expo Router screens/layouts
- `src/db/`: SQLite repositories and migrations
- `src/services/`: auth/session/sync/background logic
- `src/stores/`: Zustand stores
- `src/hooks/`: app hooks for notes/sync/network
- `supabase/`: SQL migrations and edge functions
