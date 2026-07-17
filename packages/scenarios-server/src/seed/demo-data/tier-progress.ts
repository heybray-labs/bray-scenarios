import type { DemoScenario, ScoreBandId } from "./types.ts";

/** Canonical star tiers: 1 = Bronze, 2 = Silver, 3 = Gold */
export type StarTier = 1 | 2 | 3;

/** Fixed scores that reliably map to each tier (50 / 70 / 90 thresholds). */
export const STAR_TIER_SCORE: Record<StarTier, number> = {
  1: 58,
  2: 78,
  3: 93,
};

const HIGH_LEARNER_PATTERN: StarTier[] = [3, 3, 3, 2, 3, 2, 3, 2, 1, 3, 2, 2];
const MID_LEARNER_PATTERN: StarTier[] = [2, 2, 1, 2, 3, 2, 1, 2, 2, 1, 2, 1];
const LOW_LEARNER_PATTERN: StarTier[] = [1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1];

/** Deterministic pseudo-random in [0, 1). */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.123) * 10000;
  return x - Math.floor(x);
}

export function intendedStarTier(
  preferredBand: ScoreBandId,
  scenarioIndex: number,
  attemptNum: number,
): StarTier {
  const pattern =
    preferredBand === "high"
      ? HIGH_LEARNER_PATTERN
      : preferredBand === "mid"
        ? MID_LEARNER_PATTERN
        : LOW_LEARNER_PATTERN;

  let tier = pattern[scenarioIndex % pattern.length] ?? 2;

  // Second attempt on a scenario: earn the next tier up (shows improvement + incremental points).
  if (attemptNum === 2) {
    tier = Math.min(3, tier + 1) as StarTier;
  }

  return tier;
}

/**
 * Top performers attempt every scenario; others cover each category at least once
 * so category mastery bars have meaningful numerators and denominators.
 */
export function pickScenariosForLearner(
  learnerIndex: number,
  allScenarios: DemoScenario[],
): DemoScenario[] {
  if (learnerIndex < 3) {
    return [...allScenarios].sort((a, b) => a.slug.localeCompare(b.slug));
  }

  const targetCount = 8 + (learnerIndex % 3);
  const byCategory = new Map<string, DemoScenario[]>();

  for (const scenario of allScenarios) {
    const list = byCategory.get(scenario.category) ?? [];
    list.push(scenario);
    byCategory.set(scenario.category, list);
  }

  const picked: DemoScenario[] = [];
  const usedSlugs = new Set<string>();

  for (const [category, items] of byCategory) {
    const pickIndex = Math.floor(seededRandom(learnerIndex * 17 + category.length) * items.length);
    const pick = items[pickIndex]!;
    if (!usedSlugs.has(pick.slug)) {
      picked.push(pick);
      usedSlugs.add(pick.slug);
    }
  }

  const remaining = allScenarios
    .filter((s) => !usedSlugs.has(s.slug))
    .sort(
      (a, b) =>
        seededRandom(learnerIndex * 100 + a.slug.length) -
        seededRandom(learnerIndex * 100 + b.slug.length),
    );

  for (const scenario of remaining) {
    if (picked.length >= targetCount) break;
    picked.push(scenario);
    usedSlugs.add(scenario.slug);
  }

  return picked.sort((a, b) => a.slug.localeCompare(b.slug));
}
