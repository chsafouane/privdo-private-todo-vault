-- Remove email-auth RLS policies: email mode no longer creates Supabase Auth users.
-- All access now goes through the Edge Function (service role key), bypassing RLS.

DROP POLICY IF EXISTS "email_user_select" ON sync_blobs;
DROP POLICY IF EXISTS "email_user_insert" ON sync_blobs;
DROP POLICY IF EXISTS "email_user_update" ON sync_blobs;
DROP POLICY IF EXISTS "email_user_delete" ON sync_blobs;
