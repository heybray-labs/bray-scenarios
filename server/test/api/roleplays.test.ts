import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import {
  seedFixtures,
  MINIMAL_ROLEPLAY_PAYLOAD,
  createMinimalRoleplay,
} from "../helpers/fixtures.ts";

describe("Roleplays API", () => {
  let admin: TestUser;
  let learner: TestUser;
  let roleplayId: number;
  let attemptId: number;
  let runId: number;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
    const fixtures = await seedFixtures(admin, learner);
    roleplayId = fixtures.roleplayId;

    const attemptRes = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    attemptId = attemptRes.body.attempt.id;

    const turnRes = await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${attemptId}/turn`)
      .set(authHeader(learner.token))
      .send({ message: "Hello, I would like to practice." })
      .expect(202);
    runId = turnRes.body.runId;

    const submitRes = await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${attemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);
    expect(submitRes.body).toHaveProperty("criterionScores");
  });

  it("GET /api/roleplays requires auth", async () => {
    await api().get("/api/roleplays").expect(401);
  });

  it("GET /api/roleplays/config-status", async () => {
    const res = await api()
      .get("/api/roleplays/config-status")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("isReady");
    expect(res.body).toHaveProperty("cheatModeEnabled");
  });

  it("GET /api/roleplays/available-models", async () => {
    const res = await api()
      .get("/api/roleplays/available-models")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("models");
  });

  it("GET /api/roleplays", async () => {
    const res = await api().get("/api/roleplays").set(authHeader(learner.token)).expect(200);
    expect(res.body).toHaveProperty("items");
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays includes myPointsEarned and myInProgressAttempt", async () => {
    const res = await api()
      .get("/api/roleplays")
      .set(authHeader(learner.token))
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    const item = res.body.items[0];
    expect(item).toHaveProperty("myPointsEarned");
    expect(item).toHaveProperty("myInProgressAttempt");
  });

  it("GET /api/roleplays?myStatus=passed filters results", async () => {
    const res = await api()
      .get("/api/roleplays?myStatus=passed")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expectNotServerError(res.status);
  });

  it("POST /api/roleplays", async () => {
    const id = await createMinimalRoleplay(admin.token);
    expect(id).toBeGreaterThan(0);
  });

  it("GET /api/roleplays/:id", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}`)
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("title");
  });

  it("PUT /api/roleplays/:id", async () => {
    const res = await api()
      .put(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .send({
        ...MINIMAL_ROLEPLAY_PAYLOAD,
        roleplay: { ...MINIMAL_ROLEPLAY_PAYLOAD.roleplay, title: "Updated Smoke Test" },
      })
      .expect(200);
    expect(res.body.title).toBe("Updated Smoke Test");
  });

  it("PUT /api/roleplays/:id saves canonical star tiers", async () => {
    await api()
      .put(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .send({
        ...MINIMAL_ROLEPLAY_PAYLOAD,
        rewardTiers: [
          { starLevel: 1, tierName: "Bronze", minScorePercent: 55, rewardPoints: 10, orderIndex: 0 },
          { starLevel: 2, tierName: "Silver", minScorePercent: 75, rewardPoints: 25, orderIndex: 1 },
          { starLevel: 3, tierName: "Gold", minScorePercent: 92, rewardPoints: 50, orderIndex: 2 },
        ],
      })
      .expect(200);

    const getRes = await api()
      .get(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .expect(200);

    expect(getRes.body.rewardTiers).toHaveLength(3);
    expect(getRes.body.rewardTiers.map((t: { starLevel: number }) => t.starLevel)).toEqual([1, 2, 3]);
    expect(getRes.body.rewardTiers[0].tierName).toBe("Bronze");
  });

  it("POST /api/roleplays/import pads legacy two-tier packs to three", async () => {
    const res = await api()
      .post("/api/roleplays/import")
      .set(authHeader(admin.token))
      .send({
        scenarios: [
          {
            roleplay: {
              ...MINIMAL_ROLEPLAY_PAYLOAD.roleplay,
              title: "Legacy Two Tier Import",
            },
            settings: MINIMAL_ROLEPLAY_PAYLOAD.settings,
            persona: MINIMAL_ROLEPLAY_PAYLOAD.persona,
            criteria: MINIMAL_ROLEPLAY_PAYLOAD.criteria,
            rewardTiers: [
              { tierName: "Bronze", minScorePercent: 60, rewardPoints: 15, orderIndex: 0 },
              { tierName: "Silver", minScorePercent: 80, rewardPoints: 30, orderIndex: 1 },
            ],
          },
        ],
      })
      .expect(201);

    const importedId = res.body.created[0].id as number;
    const getRes = await api()
      .get(`/api/roleplays/${importedId}`)
      .set(authHeader(admin.token))
      .expect(200);

    expect(getRes.body.rewardTiers).toHaveLength(3);
    expect(getRes.body.rewardTiers[2].tierName).toBe("Gold");
  });

  it("GET /api/roleplays/:id/stats", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/stats`)
      .set(authHeader(admin.token))
      .expect(200);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/:id/my-attempts", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/my-attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/roleplays/:id/attempts", async () => {
    const res = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("attempt");
  });

  it("GET /api/roleplays/:id/attempts/:attemptId", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/attempts/${attemptId}`)
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("attempt");
    expect(res.body).toHaveProperty("messages");
  });

  it("POST /api/roleplays/:id/attempts/:attemptId/turn", async () => {
    const start = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const newAttemptId = start.body.attempt.id;

    const res = await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${newAttemptId}/turn`)
      .set(authHeader(learner.token))
      .send({ message: "Another turn for smoke test." })
      .expect(202);
    expect(res.body).toHaveProperty("runId");
  });

  it("GET /api/roleplays/:id/stream/:runId", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = api()
        .get(`/api/roleplays/${roleplayId}/stream/${runId}`)
        .set(authHeader(learner.token))
        .buffer(true)
        .parse((res, callback) => {
          const stream = res as unknown as NodeJS.ReadableStream & { destroy?: () => void };
          stream.on("data", () => {
            stream.destroy?.();
            callback(null, Buffer.from(""));
          });
          stream.on("error", (err: Error) => callback(err, null));
        })
        .expect(200)
        .expect("Content-Type", /text\/event-stream/)
        .end((err) => {
          if (err) reject(err);
          else resolve();
        });
      setTimeout(() => {
        (req as { abort?: () => void }).abort?.();
      }, 200);
    });
  });

  it("POST /api/roleplays/:id/attempts/:attemptId/submit", async () => {
    const start = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const newAttemptId = start.body.attempt.id;

    const res = await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${newAttemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/:id/attempts/:attemptId/results", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/attempts/${attemptId}/results`)
      .set(authHeader(learner.token))
      .expect(200);
    expectNotServerError(res.status);
    expect(res.body).toHaveProperty("attempt");
    expect(res.body).toHaveProperty("criterionScores");
    expect(res.body).toHaveProperty("previousBestScore");
    expect(res.body).toHaveProperty("isNewBest");
    expect(res.body).toHaveProperty("bestScoreAfter");
    expect(res.body).toHaveProperty("rewardTiers");
    expect(res.body).toHaveProperty("nextTier");
    expect(res.body).toHaveProperty("topImprovement");
    expect(res.body).toHaveProperty("attemptContext");
    expect(res.body.attemptContext).toMatchObject({
      attemptNumber: expect.any(Number),
      usedCount: expect.any(Number),
      isOutOfAttempts: expect.any(Boolean),
    });
    expect(res.body).toHaveProperty("totalPoints");
    expect(typeof res.body.totalPoints).toBe("number");
  });

  it("GET /api/roleplays/:id/attempts (admin)", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/roleplays/:id/grading/:attemptId", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/grading/${attemptId}`)
      .set(authHeader(admin.token))
      .expect(200);
    expectNotServerError(res.status);
  });

  it("POST /api/roleplays/:id/criterion-scores/:scoreId/override", async () => {
    const start = await api()
      .post(`/api/roleplays/${roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const overrideAttemptId = start.body.attempt.id as number;

    await api()
      .post(`/api/roleplays/${roleplayId}/attempts/${overrideAttemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);

    const gradingRes = await api()
      .get(`/api/roleplays/${roleplayId}/grading/${overrideAttemptId}`)
      .set(authHeader(admin.token))
      .expect(200);

    expect(gradingRes.body.criterionScores.length).toBeGreaterThan(0);
    const scoreIdToOverride = gradingRes.body.criterionScores[0].id as number;

    const res = await api()
      .post(`/api/roleplays/${roleplayId}/criterion-scores/${scoreIdToOverride}/override`)
      .set(authHeader(admin.token))
      .send({ score: 90, feedback: "Override for smoke test" })
      .expect(200);
    expect(res.body).toHaveProperty("overallScore");
  });

  it("POST /api/roleplays/:id/publish", async () => {
    const draftId = await createMinimalRoleplay(admin.token);
    const res = await api()
      .post(`/api/roleplays/${draftId}/publish`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body.status).toBe("published");
  });

  it("POST /api/roleplays/:id/unpublish", async () => {
    const res = await api()
      .post(`/api/roleplays/${roleplayId}/unpublish`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body.status).not.toBe("published");
  });

  it("POST /api/roleplays/:id/duplicate", async () => {
    await api()
      .post(`/api/roleplays/${roleplayId}/publish`)
      .set(authHeader(admin.token))
      .expect(200);

    const res = await api()
      .post(`/api/roleplays/${roleplayId}/duplicate`)
      .set(authHeader(admin.token))
      .expect(201);
    expect(res.body).toHaveProperty("id");
  });

  it("GET /api/roleplays/export", async () => {
    const res = await api()
      .get(`/api/roleplays/export?ids=${roleplayId}`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.headers["content-type"]).toMatch(/zip/);
  });

  it("POST /api/roleplays/import (JSON)", async () => {
    const res = await api()
      .post("/api/roleplays/import")
      .set(authHeader(admin.token))
      .send({
        scenarios: [
          {
            roleplay: {
              ...MINIMAL_ROLEPLAY_PAYLOAD.roleplay,
              title: "Imported Smoke Scenario",
            },
            settings: MINIMAL_ROLEPLAY_PAYLOAD.settings,
            persona: MINIMAL_ROLEPLAY_PAYLOAD.persona,
            criteria: MINIMAL_ROLEPLAY_PAYLOAD.criteria,
          },
        ],
      })
      .expect(201);
    expect(res.body).toHaveProperty("created");
    expect(Array.isArray(res.body.created)).toBe(true);
  });

  it("POST /api/roleplays/import/preview requires file", async () => {
    const res = await api()
      .post("/api/roleplays/import/preview")
      .set(authHeader(admin.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it("DELETE /api/roleplays/:id", async () => {
    const tempId = await createMinimalRoleplay(admin.token);
    const res = await api()
      .delete(`/api/roleplays/${tempId}`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("message");
  });

  it("GET /api/roleplays/continue returns continue items", async () => {
    const res = await api()
      .get("/api/roleplays/continue")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.items.length > 0) {
      expect(res.body.items[0]).toHaveProperty("id");
      expect(res.body.items[0]).toHaveProperty("title");
    }
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/featured returns featured hero items", async () => {
    const res = await api()
      .get("/api/roleplays/featured")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/popular returns browse items", async () => {
    const res = await api()
      .get("/api/roleplays/popular")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/recommended returns browse items", async () => {
    const res = await api()
      .get("/api/roleplays/recommended")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/room-for-improvement returns browse items", async () => {
    const res = await api()
      .get("/api/roleplays/room-for-improvement")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expectNotServerError(res.status);
  });

  it("GET /api/roleplays/featured/manage requires manage permission", async () => {
    await api()
      .get("/api/roleplays/featured/manage")
      .set(authHeader(learner.token))
      .expect(403);
  });

  it("PUT /api/roleplays/featured/manage updates featured lineup", async () => {
    const listRes = await api()
      .get("/api/roleplays")
      .set(authHeader(admin.token))
      .expect(200);
    const publishedId = listRes.body.items.find(
      (item: { status: string }) => item.status === "published",
    )?.id;
    expect(publishedId).toBeTruthy();

    const putRes = await api()
      .put("/api/roleplays/featured/manage")
      .set(authHeader(admin.token))
      .send({ roleplayIds: [publishedId] })
      .expect(200);
    expect(Array.isArray(putRes.body.items)).toBe(true);
    expect(putRes.body.items[0].roleplayId).toBe(publishedId);

    const featuredRes = await api()
      .get("/api/roleplays/featured")
      .set(authHeader(learner.token))
      .expect(200);
    expect(featuredRes.body.items.some((item: { id: number }) => item.id === publishedId)).toBe(
      true,
    );
  });

  it("GET /api/roleplays/:id/my-progress returns criterion bests and last improvement", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/my-progress`)
      .set(authHeader(learner.token))
      .expect(200);

    expect(res.body).toHaveProperty("criterionBests");
    expect(Array.isArray(res.body.criterionBests)).toBe(true);
    expect(res.body).toHaveProperty("lastTopImprovement");
    if (res.body.criterionBests.length > 0) {
      expect(res.body.criterionBests[0]).toMatchObject({
        criterionId: expect.any(Number),
        name: expect.any(String),
        bestScore: expect.any(Number),
      });
    }
  });

  it("GET /api/roleplays/:id hides hiddenObjective for learners", async () => {
    await api()
      .put(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .send({
        ...MINIMAL_ROLEPLAY_PAYLOAD,
        persona: {
          ...MINIMAL_ROLEPLAY_PAYLOAD.persona,
          hiddenObjective: "Secret learner-only objective text",
        },
      })
      .expect(200);

    const learnerRes = await api()
      .get(`/api/roleplays/${roleplayId}`)
      .set(authHeader(learner.token))
      .expect(200);

    expect(learnerRes.body.persona).not.toHaveProperty("hiddenObjective");
    expect(learnerRes.body.persona.hasHiddenObjective).toBe(true);
    expect(learnerRes.body.persona.personalityTraits).toBe("friendly");

    const adminRes = await api()
      .get(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .expect(200);

    expect(adminRes.body.persona.hiddenObjective).toBe("Secret learner-only objective text");
  });

  it("GET /api/roleplays/:id/leaderboard ranks by best score", async () => {
    const res = await api()
      .get(`/api/roleplays/${roleplayId}/leaderboard?limit=3`)
      .set(authHeader(learner.token))
      .expect(200);

    expect(res.body).toHaveProperty("entries");
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body).toHaveProperty("currentUser");

    if (res.body.entries.length > 0) {
      expect(res.body.entries[0]).toMatchObject({
        userId: expect.any(Number),
        name: expect.any(String),
        bestScore: expect.any(Number),
        rank: 1,
      });
      expect(res.body.currentUser).toMatchObject({
        userId: learner.id,
        rank: expect.any(Number),
        bestScore: expect.any(Number),
      });
    }
  });
});
