-- Star tier model: add star_level, migrate legacy tiers, pad to 3 where rewards exist

ALTER TABLE scenario_reward_tiers ADD COLUMN IF NOT EXISTS star_level integer;

-- Rank existing tiers by order_index within each roleplay → star levels 1–3
WITH ranked AS (
  SELECT
    id,
    roleplay_id,
    ROW_NUMBER() OVER (
      PARTITION BY roleplay_id
      ORDER BY order_index ASC, min_score_percent ASC, id ASC
    ) AS rn
  FROM scenario_reward_tiers
)
UPDATE scenario_reward_tiers AS t
SET star_level = r.rn
FROM ranked AS r
WHERE t.id = r.id AND r.rn <= 3;

-- Remove tiers beyond the lowest three by order
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY roleplay_id
      ORDER BY order_index ASC, min_score_percent ASC, id ASC
    ) AS rn
  FROM scenario_reward_tiers
)
DELETE FROM scenario_reward_tiers
WHERE id IN (SELECT id FROM ranked WHERE rn > 3);

-- Pad missing tiers for roleplays that already have at least one tier
INSERT INTO scenario_reward_tiers (
  roleplay_id,
  tier_name,
  min_score_percent,
  reward_points,
  order_index,
  star_level
)
SELECT
  r.id,
  CASE gs.star_level
    WHEN 1 THEN 'Bronze'
    WHEN 2 THEN 'Silver'
    WHEN 3 THEN 'Gold'
  END,
  CASE gs.star_level
    WHEN 1 THEN 50
    WHEN 2 THEN 70
    WHEN 3 THEN 90
  END,
  CASE gs.star_level
    WHEN 1 THEN 10
    WHEN 2 THEN 25
    WHEN 3 THEN 50
  END,
  gs.star_level - 1,
  gs.star_level
FROM roleplays AS r
CROSS JOIN (
  SELECT 1 AS star_level
  UNION ALL SELECT 2
  UNION ALL SELECT 3
) AS gs
WHERE EXISTS (
  SELECT 1 FROM scenario_reward_tiers AS srt WHERE srt.roleplay_id = r.id
)
AND NOT EXISTS (
  SELECT 1
  FROM scenario_reward_tiers AS srt
  WHERE srt.roleplay_id = r.id AND srt.star_level = gs.star_level
);

-- Normalize tier names to canonical Bronze/Silver/Gold
UPDATE scenario_reward_tiers
SET tier_name = CASE star_level
  WHEN 1 THEN 'Bronze'
  WHEN 2 THEN 'Silver'
  WHEN 3 THEN 'Gold'
  ELSE tier_name
END
WHERE star_level IS NOT NULL;

ALTER TABLE scenario_reward_tiers ALTER COLUMN star_level SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scenario_reward_tiers_roleplay_star
  ON scenario_reward_tiers (roleplay_id, star_level);
