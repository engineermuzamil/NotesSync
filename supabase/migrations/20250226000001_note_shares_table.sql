-- Create note_shares table for public share links
CREATE TABLE note_shares (
  id TEXT PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  access_count INTEGER NOT NULL DEFAULT 0,
  copy_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  last_copied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX idx_note_shares_owner_user_id ON note_shares(owner_user_id);
CREATE INDEX idx_note_shares_token ON note_shares(token);
CREATE INDEX idx_note_shares_sync_status ON note_shares(sync_status);

-- Enable RLS
ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view their own shares (owner_user_id)
CREATE POLICY "Users can manage own shares"
  ON note_shares FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Public shares are readable by anyone (for the public preview)
CREATE POLICY "Public shares are readable"
  ON note_shares FOR SELECT
  USING (visibility = 'public' AND is_revoked = false);
