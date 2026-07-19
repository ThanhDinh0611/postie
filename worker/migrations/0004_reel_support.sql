-- Reel Support Migration
-- Adds Reel-specific columns to posts table
-- D1 does not support ADD COLUMN with defaults for non-NULL, so we add nullable columns only

ALTER TABLE posts ADD COLUMN reel_duration INTEGER;
ALTER TABLE posts ADD COLUMN video_url TEXT;
ALTER TABLE posts ADD COLUMN script_segments TEXT; -- JSON array: [{visual, voiceover, durationSec}]
