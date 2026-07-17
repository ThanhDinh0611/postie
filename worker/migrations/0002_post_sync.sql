-- Postie D1 Migration 0002: Post Sync & Engagement Tracking
-- Adds tables for syncing Facebook posts, engagement metrics, and comments.

-- Post engagement tracking table
CREATE TABLE IF NOT EXISTS post_engagement (
  id               TEXT PRIMARY KEY,
  post_id          TEXT NOT NULL REFERENCES posts(id),
  likes            INTEGER DEFAULT 0,
  comments_count   INTEGER DEFAULT 0,
  shares           INTEGER DEFAULT 0,
  views            INTEGER DEFAULT 0,
  fetched_at       INTEGER DEFAULT (unixepoch())
);

-- Synced Facebook comments
CREATE TABLE IF NOT EXISTS post_comments (
  id                 TEXT PRIMARY KEY,
  facebook_comment_id TEXT NOT NULL,
  post_id            TEXT NOT NULL REFERENCES posts(id),
  from_name          TEXT,
  from_id            TEXT,
  message            TEXT NOT NULL,
  like_count         INTEGER DEFAULT 0,
  created_time       INTEGER,
  parent_id          TEXT,         -- for replies (references another comment's facebook_comment_id)
  fetched_at         INTEGER DEFAULT (unixepoch())
);

-- Add last_synced_at column to posts table
ALTER TABLE posts ADD COLUMN last_synced_at INTEGER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_engagement_post_id ON post_engagement(post_id);
CREATE INDEX IF NOT EXISTS idx_post_engagement_fetched_at ON post_engagement(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_facebook_id ON post_comments(facebook_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created ON post_comments(created_time DESC);
CREATE INDEX IF NOT EXISTS idx_posts_last_synced ON posts(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_facebook_id ON posts(facebook_post_id);
