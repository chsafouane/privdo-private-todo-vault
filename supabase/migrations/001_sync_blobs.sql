-- Privdo Sync: encrypted blob storage
-- Server is zero-knowledge — stores only opaque AES-256 encrypted data.

CREATE TABLE sync_blobs (
  channel_id TEXT PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  device_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security: authenticated users can only access their own channel
ALTER TABLE sync_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_user_select" ON sync_blobs FOR SELECT
  TO authenticated USING (channel_id = auth.uid()::text);

CREATE POLICY "email_user_insert" ON sync_blobs FOR INSERT
  TO authenticated WITH CHECK (channel_id = auth.uid()::text);

CREATE POLICY "email_user_update" ON sync_blobs FOR UPDATE
  TO authenticated USING (channel_id = auth.uid()::text)
  WITH CHECK (channel_id = auth.uid()::text);

CREATE POLICY "email_user_delete" ON sync_blobs FOR DELETE
  TO authenticated USING (channel_id = auth.uid()::text);

-- Passphrase mode uses Edge Functions (service role key), bypassing RLS.
-- No anonymous direct access to this table.
