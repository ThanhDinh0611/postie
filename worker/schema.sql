-- Postie D1 Database Schema
-- Initial schema for AI Facebook post generation & link management

CREATE TABLE IF NOT EXISTS pages (
  id               TEXT PRIMARY KEY,
  facebook_page_id TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  username         TEXT,             -- for permalink building (e.g., "MyPage")
  access_token     TEXT NOT NULL,
  avatar_url       TEXT,
  user_id          TEXT NOT NULL,
  is_active        INTEGER DEFAULT 0,
  created_at       INTEGER DEFAULT (unixepoch()),
  updated_at       INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#3b82f6',
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS posts (
  id                TEXT PRIMARY KEY,
  page_id           TEXT NOT NULL REFERENCES pages(id),
  facebook_post_id  TEXT,             -- returned by Graph API after publish
  permalink         TEXT,             -- constructed Facebook URL
  message           TEXT NOT NULL,
  media_url         TEXT,
  post_format       TEXT DEFAULT 'Post',  -- 'Post' | 'Reel' | 'Video'
  hook_type         TEXT,
  copywriting_formula TEXT,
  tone              TEXT DEFAULT 'Friendly',
  status            TEXT DEFAULT 'Draft', -- 'Draft' | 'Scheduled' | 'Published' | 'Failed'
  scheduled_for     INTEGER,
  created_at        INTEGER DEFAULT (unixepoch()),
  published_at      INTEGER,
  user_id           TEXT NOT NULL,
  campaign_id       TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  generation_id     TEXT REFERENCES generations(id) ON DELETE SET NULL,
  likes             INTEGER DEFAULT 0,
  comments_count    INTEGER DEFAULT 0,
  shares            INTEGER DEFAULT 0,
  views             INTEGER DEFAULT 0,
  engagement_fetched_at INTEGER,
  last_synced_at    INTEGER
);

CREATE TABLE IF NOT EXISTS post_variants (
  id        TEXT PRIMARY KEY,
  post_id   TEXT NOT NULL REFERENCES posts(id),
  content   TEXT NOT NULL,
  variant_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS generations (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  topic             TEXT NOT NULL,
  wiki_slug         TEXT,
  hook_type         TEXT,
  formula           TEXT,
  tone              TEXT,
  post_format       TEXT DEFAULT 'Post',
  generated_content TEXT NOT NULL,
  variants          TEXT,              -- JSON array of variant strings
  selected_variant  INTEGER,
  token_usage       TEXT,              -- JSON: {input, output, total}
  feedback          TEXT,              -- 'approved' | 'rejected' | null
  created_at        INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                TEXT PRIMARY KEY,
  tier                   TEXT NOT NULL DEFAULT 'free',
  subscription_status    TEXT NOT NULL DEFAULT 'active',
  role                   TEXT NOT NULL DEFAULT 'user',
  plan_expires_at        INTEGER,
  created_at             INTEGER DEFAULT (unixepoch()),
  updated_at             INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  plan         TEXT NOT NULL CHECK(plan IN ('pro', 'team')),
  amount       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'expired', 'cancelled')),
  created_at   INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_page_id ON posts(page_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Post Sync & Engagement Tables (added in migration 0002)
CREATE TABLE IF NOT EXISTS post_engagement (
  id               TEXT PRIMARY KEY,
  post_id          TEXT NOT NULL REFERENCES posts(id),
  likes            INTEGER DEFAULT 0,
  comments_count   INTEGER DEFAULT 0,
  shares           INTEGER DEFAULT 0,
  views            INTEGER DEFAULT 0,
  fetched_at       INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS post_comments (
  id                 TEXT PRIMARY KEY,
  facebook_comment_id TEXT NOT NULL,
  post_id            TEXT NOT NULL REFERENCES posts(id),
  from_name          TEXT,
  from_id            TEXT,
  message            TEXT NOT NULL,
  like_count         INTEGER DEFAULT 0,
  created_time       INTEGER,
  parent_id          TEXT,
  fetched_at         INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_post_engagement_post_id ON post_engagement(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_facebook_id ON post_comments(facebook_comment_id);
CREATE INDEX IF NOT EXISTS idx_posts_last_synced ON posts(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_facebook_id ON posts(facebook_post_id);

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

CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_generation_id ON posts(generation_id);
CREATE INDEX IF NOT EXISTS idx_page_analyses_page_id ON page_analyses(page_id);
CREATE INDEX IF NOT EXISTS idx_page_analyses_analyzed_at ON page_analyses(analyzed_at DESC);
