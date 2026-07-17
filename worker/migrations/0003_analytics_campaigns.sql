-- Postie D1 Migration 0003: Analytics and Campaigns Redesign
-- Creates campaigns and page_analyses tables, and denormalizes engagement metrics into posts table.

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#3b82f6',
  created_at  INTEGER DEFAULT (unixepoch())
);

-- Create page_analyses table for AI strategy audits
CREATE TABLE IF NOT EXISTS page_analyses (
  id               TEXT PRIMARY KEY,
  page_id          TEXT NOT NULL REFERENCES pages(id),
  user_id          TEXT NOT NULL,
  analyzed_at      INTEGER DEFAULT (unixepoch()),
  summary          TEXT NOT NULL,
  writing_style    TEXT NOT NULL,
  suggestions      TEXT NOT NULL, -- JSON array
  charts_data      TEXT NOT NULL, -- JSON object
  metrics_summary  TEXT NOT NULL  -- JSON object
);

-- Alter posts table to add campaigns, generations tracking and denormalized engagement metrics
ALTER TABLE posts ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN generation_id TEXT REFERENCES generations(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN comments_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN shares INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN engagement_fetched_at INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_generation_id ON posts(generation_id);
CREATE INDEX IF NOT EXISTS idx_page_analyses_page_id ON page_analyses(page_id);
CREATE INDEX IF NOT EXISTS idx_page_analyses_analyzed_at ON page_analyses(analyzed_at DESC);

-- Migrate existing engagement data from post_engagement to posts table
UPDATE posts
SET 
  likes = COALESCE((SELECT likes FROM post_engagement WHERE post_engagement.post_id = posts.id), 0),
  comments_count = COALESCE((SELECT comments_count FROM post_engagement WHERE post_engagement.post_id = posts.id), 0),
  shares = COALESCE((SELECT shares FROM post_engagement WHERE post_engagement.post_id = posts.id), 0),
  views = COALESCE((SELECT views FROM post_engagement WHERE post_engagement.post_id = posts.id), 0),
  engagement_fetched_at = (SELECT fetched_at FROM post_engagement WHERE post_engagement.post_id = posts.id)
WHERE EXISTS (SELECT 1 FROM post_engagement WHERE post_engagement.post_id = posts.id);
