import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { setupAdmin, type TestUser } from "../helpers/auth.ts";

describe("Features API", () => {
  let admin: TestUser;
  const originalDisabledFeatures = process.env.DISABLED_FEATURES;

  beforeAll(async () => {
    admin = await setupAdmin();
  });

  afterEach(() => {
    if (originalDisabledFeatures === undefined) {
      delete process.env.DISABLED_FEATURES;
    } else {
      process.env.DISABLED_FEATURES = originalDisabledFeatures;
    }
  });

  it("requires auth", async () => {
    await api().get("/api/features?keys=foo").expect(401);
  });

  it("default provider returns all-true for arbitrary keys", async () => {
    delete process.env.DISABLED_FEATURES;
    const res = await api()
      .get("/api/features?keys=foo,bar")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toEqual({ foo: true, bar: true });
  });

  it("DISABLED_FEATURES disables only the listed keys (case-insensitive)", async () => {
    process.env.DISABLED_FEATURES = "Foo";
    const res = await api()
      .get("/api/features?keys=foo,bar")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toEqual({ foo: false, bar: true });
  });

  describe("requireFeature gate on /api/points/leaderboard", () => {
    it("still 401s (not 403) when unauthenticated, even with the feature disabled", async () => {
      process.env.DISABLED_FEATURES = "leaderboard";
      // Auth must run before the entitlement check — an anonymous caller
      // should not be able to probe feature-flag state via the status code.
      await api().get("/api/points/leaderboard").expect(401);
    });

    it("403s an authenticated caller when the feature is disabled", async () => {
      process.env.DISABLED_FEATURES = "leaderboard";
      const res = await api()
        .get("/api/points/leaderboard")
        .set(authHeader(admin.token))
        .expect(403);
      expect(res.body).toEqual({ message: 'Feature "leaderboard" is disabled' });
    });

    it("200s an authenticated caller when the feature is enabled (default)", async () => {
      delete process.env.DISABLED_FEATURES;
      await api().get("/api/points/leaderboard").set(authHeader(admin.token)).expect(200);
    });
  });
});
