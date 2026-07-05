import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import { seedFixtures } from "../helpers/fixtures.ts";

describe("Media API", () => {
  let admin: TestUser;
  let learner: TestUser;
  let mediaId: number;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
    const fixtures = await seedFixtures(admin, learner);
    mediaId = fixtures.mediaId;
  });

  it("GET /api/media requires auth", async () => {
    await api().get("/api/media").expect(401);
  });

  it("GET /api/media requires roleplay:manage", async () => {
    const res = await api().get("/api/media").set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/media", async () => {
    const res = await api().get("/api/media").set(authHeader(admin.token)).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expectNotServerError(res.status);
  });

  it("POST /api/media", async () => {
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const res = await api()
      .post("/api/media")
      .set(authHeader(admin.token))
      .attach("file", pngBuffer, "upload.png")
      .expect(201);
    expect(res.body).toHaveProperty("id");
  });

  it("GET /api/media/:id", async () => {
    const res = await api().get(`/api/media/${mediaId}`).set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image/);
  });

  it("DELETE /api/media/:id", async () => {
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const uploaded = await api()
      .post("/api/media")
      .set(authHeader(admin.token))
      .attach("file", pngBuffer, "delete-me.png")
      .expect(201);

    const res = await api()
      .delete(`/api/media/${uploaded.body.id}`)
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("message");
  });
});
