ALTER TABLE roleplays ADD COLUMN IF NOT EXISTS published_at timestamp;

UPDATE roleplays
SET published_at = updated_at
WHERE published = true AND published_at IS NULL;
