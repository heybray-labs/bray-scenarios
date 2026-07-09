import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import { seedFixtures } from "../helpers/fixtures.ts";

describe("Points API", () => {
  let admin: TestUser;
  let learner: TestUser;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
    await seedFixtures(admin, learner);
  });

  it("GET /api/points/me/stats requires auth", async () => {
    await api().get("/api/points/me/stats").expect(401);
  });

  it("GET /api/points/me/stats returns progress shape", async () => {
    const res = await api()
      .get("/api/points/me/stats")
      .set(authHeader(learner.token))
      .expect(200);

    expectNotServerError(res.status);
    expect(res.body).toHaveProperty("totalPoints");
    expect(res.body).toHaveProperty("monthPoints");
    expect(res.body).toHaveProperty("starCounts");
    expect(res.body.starCounts).toHaveProperty("gold");
    expect(res.body.starCounts).toHaveProperty("silver");
    expect(res.body.starCounts).toHaveProperty("bronze");
    expect(res.body).toHaveProperty("passedCount");
    expect(res.body).toHaveProperty("publishedCount");
    expect(res.body).toHaveProperty("streakWeeks");
    expect(res.body).toHaveProperty("currentWeekActive");
    expect(Array.isArray(res.body.categoryMastery)).toBe(true);
    if (res.body.categoryMastery.length > 0) {
      const row = res.body.categoryMastery[0];
      expect(row).toHaveProperty("total");
      expect(row).toHaveProperty("starCounts");
      expect(row.starCounts).toHaveProperty("gold");
      expect(row.starCounts).toHaveProperty("silver");
      expect(row.starCounts).toHaveProperty("bronze");
    }
  });

  it("GET /api/points/recent-stars requires auth", async () => {
    await api().get("/api/points/recent-stars").expect(401);
  });

  it("GET /api/points/recent-stars returns items shape", async () => {
    const res = await api()
      .get("/api/points/recent-stars?limit=15")
      .set(authHeader(learner.token))
      .expect(200);

    expectNotServerError(res.status);
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.items.length > 0) {
      const item = res.body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("userId");
      expect(item).toHaveProperty("userName");
      expect(item).toHaveProperty("roleplayId");
      expect(item).toHaveProperty("scenarioTitle");
      expect(item).toHaveProperty("tierName");
      expect(item).toHaveProperty("starLevel");
      expect(item).toHaveProperty("tierColor");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("isCurrentUser");
      expect(typeof item.starLevel).toBe("number");
      expect(item.starLevel).toBeGreaterThanOrEqual(1);
      expect(item.starLevel).toBeLessThanOrEqual(3);
    }
  });
});
