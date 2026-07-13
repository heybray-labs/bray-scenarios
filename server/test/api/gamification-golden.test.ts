import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { api, authHeader } from "../helpers/request.ts";
import { loginAs } from "../helpers/auth.ts";
import { seedDemo } from "../../init-db/seed-demo.ts";
import { DEMO_PASSWORD } from "../../init-db/demo-data/users.ts";
import { db } from "../../db.ts";
import { users } from "@heybray/identity/schema";
import {
  classificationDimensions,
  classificationOptions,
} from "@heybray/taxonomy/schema";
import { roleplayAttempts } from "../../../shared/schemas/roleplay-core.ts";

/**
 * Golden-output baseline for the gamification surface (points, leaderboard,
 * team star-map). This test is captured on the CURRENT (pre-Phase-2) code and
 * must keep passing byte-for-byte after every subsequent Phase 2 step, proving
 * the package extraction and payload renames change zero observable behavior.
 *
 * Determinism strategy:
 * - Scores / tiers / scenario selection are already deterministic (tier-progress.ts).
 * - Row IDs are deterministic: the truncate step (test/db.ts) RESTART IDENTITYs
 *   every gamification table, and seed-demo inserts in a fixed order.
 * - Time is frozen (vi.setSystemTime) so JS-side streak math is stable. The
 *   frozen epoch sits > 1 year in the past, so DB-side "this month" filters
 *   (which use the real Postgres now()) are DETERMINISTICALLY EMPTY. That keeps
 *   the month-scoped snapshots stable across calendar dates at the cost of them
 *   being empty — the all-time / structural paths carry the parity coverage.
 * - normalize() strips volatile timestamps and applies FIELD_SHIM so the Step 6
 *   payload renames (roleplayId → contentId, scenarioTitle/roleplayTitle →
 *   contentTitle) can be absorbed by editing only the shim, not the snapshots.
 */

const FROZEN_NOW = new Date("2025-06-16T12:00:00.000Z");

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Maps current payload field names to their canonical (post-rename) names.
 * Step 6 renames these fields in the API; update this map then, and the
 * committed snapshots keep validating unchanged.
 */
const FIELD_SHIM: Record<string, string> = {
  roleplayId: "contentId",
  scenarioTitle: "contentTitle",
  roleplayTitle: "contentTitle",
};

type Json = unknown;

function normalize(value: Json): Json {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return "<timestamp>";
  if (typeof value === "string") {
    return ISO_DATE_RE.test(value) ? "<timestamp>" : value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const shimmed: Record<string, Json> = {};
    for (const key of Object.keys(value as Record<string, Json>)) {
      const name = FIELD_SHIM[key] ?? key;
      shimmed[name] = normalize((value as Record<string, Json>)[key]);
    }
    return Object.fromEntries(
      Object.entries(shimmed).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return value;
}

interface LeaderboardEntry {
  userId: number;
  points: number;
  rank: number;
  isCurrentUser: boolean;
  [key: string]: unknown;
}

interface LeaderboardBody {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
}

/**
 * Leaderboard rows tie-break unstably in SQL (ORDER BY SUM(points) DESC only).
 * Re-sort by (points desc, userId asc) and re-derive rank so ties are stable;
 * done identically before and after the refactor, so parity is preserved.
 */
function normalizeLeaderboard(body: LeaderboardBody): Json {
  const entries = [...body.entries]
    .sort((a, b) => b.points - a.points || a.userId - b.userId)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  let currentUser = body.currentUser;
  if (currentUser) {
    const match = entries.find((e) => e.userId === currentUser!.userId);
    currentUser = match ? { ...match, isCurrentUser: true } : currentUser;
  }
  return normalize({ entries, currentUser });
}

function sortById<T extends { id: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id - b.id);
}

describe("Gamification golden output", () => {
  let adminToken: string;
  let learnerToken: string;
  let learnerId: number;
  let sampleRoleplayId: number;
  let categorySlug: string;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FROZEN_NOW);

    await seedDemo();

    adminToken = await loginAs("admin@demo.local", DEMO_PASSWORD);
    learnerToken = await loginAs("sarah.chen@demo.local", DEMO_PASSWORD);

    const [learner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "sarah.chen@demo.local"))
      .limit(1);
    learnerId = learner!.id;

    const [attempt] = await db
      .select({ roleplayId: roleplayAttempts.roleplayId })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.userId, learnerId),
          eq(roleplayAttempts.status, "completed"),
        ),
      )
      .orderBy(asc(roleplayAttempts.roleplayId))
      .limit(1);
    sampleRoleplayId = attempt!.roleplayId;

    const [category] = await db
      .select({ slug: classificationOptions.slug })
      .from(classificationOptions)
      .innerJoin(
        classificationDimensions,
        eq(classificationOptions.dimensionId, classificationDimensions.id),
      )
      .where(
        and(
          eq(classificationDimensions.slug, "category"),
          eq(classificationOptions.isActive, true),
        ),
      )
      .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label))
      .limit(1);
    categorySlug = category!.slug;
  }, 180_000);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("GET /api/points/me/stats", async () => {
    const res = await api()
      .get("/api/points/me/stats")
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalize(res.body)).toMatchSnapshot();
  });

  it("GET /api/points/me/history (page 1)", async () => {
    const res = await api()
      .get("/api/points/me/history?page=1&limit=20")
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalize({ ...res.body, items: sortById(res.body.items) })).toMatchSnapshot();
  });

  it("GET /api/points/recent-stars", async () => {
    const res = await api()
      .get("/api/points/recent-stars?limit=15")
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalize({ items: sortById(res.body.items) })).toMatchSnapshot();
  });

  it("GET /api/points/leaderboard (global, all_time)", async () => {
    const res = await api()
      .get("/api/points/leaderboard?scope=global&period=all_time")
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalizeLeaderboard(res.body)).toMatchSnapshot();
  });

  it("GET /api/points/leaderboard (global, month)", async () => {
    const res = await api()
      .get("/api/points/leaderboard?scope=global&period=month")
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalizeLeaderboard(res.body)).toMatchSnapshot();
  });

  it("GET /api/points/leaderboard (category, all_time)", async () => {
    const res = await api()
      .get(`/api/points/leaderboard?scope=category&category=${categorySlug}&period=all_time`)
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalizeLeaderboard(res.body)).toMatchSnapshot();
  });

  it("GET /api/points/leaderboard (category, month)", async () => {
    const res = await api()
      .get(`/api/points/leaderboard?scope=category&category=${categorySlug}&period=month`)
      .set(authHeader(learnerToken))
      .expect(200);
    expect(normalizeLeaderboard(res.body)).toMatchSnapshot();
  });

  it("GET /api/teams/all/star-map (manager view)", async () => {
    const res = await api()
      .get("/api/teams/all/star-map")
      .set(authHeader(adminToken))
      .expect(200);
    expect(normalize(res.body)).toMatchSnapshot();
  });

  it("GET /api/teams/all/members/:userId/scenario-history", async () => {
    const res = await api()
      .get(`/api/teams/all/members/${learnerId}/scenario-history`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(normalize(res.body)).toMatchSnapshot();
  });

  it("GET /api/teams/all/members/:userId/roleplays/:roleplayId/attempts", async () => {
    const res = await api()
      .get(
        `/api/teams/all/members/${learnerId}/roleplays/${sampleRoleplayId}/attempts`,
      )
      .set(authHeader(adminToken))
      .expect(200);
    expect(normalize(res.body)).toMatchSnapshot();
  });
});
