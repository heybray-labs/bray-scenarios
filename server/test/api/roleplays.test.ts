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
});
