import { describe, it, expect, beforeAll, vi } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import { configureRoleplayAi, MINIMAL_ROLEPLAY_PAYLOAD } from "../helpers/fixtures.ts";
import { gradeTranscript } from "../../roleplay/grading.ts";
import type { GradingContext } from "../../roleplay/grading.ts";

/**
 * Fix 1 (docs/phase-2-remediation.md): a manual re-grade must flow through to
 * activity_log so it reaches /api/points/me/stats and the team star-map, and it
 * must NOT award points (award eligibility is decided once, at recordResult).
 *
 * Note on the "auto-grade fails" wording in the brief: the only manual-grade API
 * (POST /criterion-scores/:id/override) needs an existing criterion-score row,
 * which a hard grader failure (gradingStatus="failed") never persists. We
 * therefore reproduce the observable regression with an auto-graded-but-not-passed
 * attempt (score below the pass threshold, logged with passed=false) and then
 * manually pass it — exercising the exact updateResult path the fix adds.
 */

function gradeWith(score: number) {
  return async (_model: unknown, ctx: GradingContext) => ({
    overallFeedback: "Regrade test.",
    criteria: ctx.criteria.map((c) => ({
      criterionId: c.id,
      score,
      feedback: "",
      strengths: "",
      improvements: "",
    })),
  });
}

describe("Gamification manual re-grade (Fix 1)", () => {
  let admin: TestUser;
  let learner: TestUser;
  let teamId: number;
  let categorySlug: string;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
    await configureRoleplayAi(admin.token);

    const teamRes = await api()
      .post("/api/teams")
      .set(authHeader(admin.token))
      .send({ name: "Regrade Team" })
      .expect(201);
    teamId = teamRes.body.team.id;

    await api()
      .put(`/api/teams/${teamId}/members`)
      .set(authHeader(admin.token))
      .send({ memberIds: [learner.id] })
      .expect(200);

    const classifications = await api()
      .get("/api/roleplay-classifications")
      .set(authHeader(admin.token))
      .expect(200);
    const categoryDimension = classifications.body.dimensions.find(
      (d: { slug: string }) => d.slug === "category",
    );
    categorySlug = categoryDimension?.options?.[0]?.slug;
    expect(categorySlug).toBeTruthy();
  });

  async function createClassifiedRoleplay(title: string): Promise<number> {
    const res = await api()
      .post("/api/roleplays")
      .set(authHeader(admin.token))
      .send({
        ...MINIMAL_ROLEPLAY_PAYLOAD,
        roleplay: { ...MINIMAL_ROLEPLAY_PAYLOAD.roleplay, title },
        rewardTiers: [
          { starLevel: 1, tierName: "Bronze", minScorePercent: 70, rewardPoints: 10, orderIndex: 0 },
          { starLevel: 2, tierName: "Silver", minScorePercent: 85, rewardPoints: 25, orderIndex: 1 },
          { starLevel: 3, tierName: "Gold", minScorePercent: 95, rewardPoints: 50, orderIndex: 2 },
        ],
        classifications: { category: categorySlug },
      })
      .expect(201);
    return res.body.id as number;
  }

  async function completeAttempt(roleplayId: number): Promise<number> {
    const start = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const attemptId = start.body.attempt.id as number;

    await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${attemptId}/turn`)
      .set(authHeader(learner.token))
      .send({ message: "Practicing the scenario." })
      .expect(202);

    await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${attemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);

    return attemptId;
  }

  async function overrideScore(roleplayId: number, attemptId: number, score: number): Promise<void> {
    const grading = await api()
      .get(`/api/roleplays/${roleplayId}/grading/${attemptId}`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(grading.body.criterionScores.length).toBeGreaterThan(0);
    const scoreId = grading.body.criterionScores[0].id as number;

    await api()
      .post(`/api/roleplays/${roleplayId}/criterion-scores/${scoreId}/override`)
      .set(authHeader(admin.token))
      .send({ score })
      .expect(200);
  }

  async function bestScoreFor(roleplayId: number): Promise<number | null> {
    const res = await api()
      .get(`/api/teams/${teamId}/members/${learner.id}/scenario-history`)
      .set(authHeader(admin.token))
      .expect(200);
    for (const category of res.body.categories) {
      for (const scenario of category.scenarios) {
        if (scenario.contentId === roleplayId) return scenario.bestScore;
      }
    }
    return null;
  }

  async function stats() {
    const res = await api()
      .get("/api/points/me/stats")
      .set(authHeader(learner.token))
      .expect(200);
    return res.body as { totalPoints: number; passedCount: number };
  }

  it("manual pass reaches passedCount and star-map bestScore without awarding points", async () => {
    const roleplayId = await createClassifiedRoleplay("Regrade Fail Then Pass");

    // Auto-grade to 30% — below the 70% pass threshold and below every tier.
    vi.mocked(gradeTranscript).mockImplementationOnce(gradeWith(30));
    const attemptId = await completeAttempt(roleplayId);

    const before = await stats();
    expect(before.totalPoints).toBe(0);
    expect(await bestScoreFor(roleplayId)).toBe(30);
    const passedBefore = before.passedCount;

    await overrideScore(roleplayId, attemptId, 90);

    const after = await stats();
    expect(after.passedCount).toBe(passedBefore + 1);
    // 90% would earn Silver, but manual grades never award points.
    expect(after.totalPoints).toBe(0);
    expect(await bestScoreFor(roleplayId)).toBe(90);
  });

  it("manual re-grade of an auto-graded attempt raises star-map bestScore without extra points", async () => {
    const roleplayId = await createClassifiedRoleplay("Regrade Higher");

    // Default grader mock returns 80% — passes and earns Bronze (10 pts).
    const attemptId = await completeAttempt(roleplayId);

    const afterAuto = await stats();
    expect(await bestScoreFor(roleplayId)).toBe(80);
    const pointsAfterAuto = afterAuto.totalPoints;

    await overrideScore(roleplayId, attemptId, 95);

    // 95% crosses into Gold, but the manual re-grade must not award more points.
    expect(await bestScoreFor(roleplayId)).toBe(95);
    const afterOverride = await stats();
    expect(afterOverride.totalPoints).toBe(pointsAfterAuto);
  });
});
