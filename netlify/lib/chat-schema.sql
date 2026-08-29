-- Chat history for signed-in accounts ---------------------------------------
--
-- Guests keep everything in their own browser and touch none of this. An
-- account exists so a conversation can follow you to another device, so these
-- two tables mirror the browser's IndexedDB stores closely enough that syncing
-- is a straight id-by-id comparison of updated_at.
--
-- deleted_at is a tombstone rather than a real delete: a chat removed on your
-- phone has to be removable on your laptop, and the laptop only finds out by
-- seeing the row.

CREATE TABLE IF NOT EXISTS chat_session (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'New chat',
  title_locked  BOOLEAN NOT NULL DEFAULT FALSE,
  system_prompt TEXT NOT NULL DEFAULT '',
  temperature   DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL,
  deleted_at    BIGINT
);

CREATE INDEX IF NOT EXISTS chat_session_user_idx
  ON chat_session (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_message (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  -- Attachment metadata only. The image bytes never leave the browser that
  -- picked them; see netlify/functions/chats.mts for why.
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_message_session_idx
  ON chat_message (session_id, created_at);
