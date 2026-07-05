import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import { configureRoleplayAi } from "../helpers/fixtures.ts";

describe("Roleplay config API", () => {
  let admin: TestUser;
  let learner: TestUser;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
    await configureRoleplayAi(admin.token);
  });

  it("GET /api/roleplay-config requires auth", async () => {
    await api().get("/api/roleplay-config").expect(401);
  });

  it("GET /api/roleplay-config requires roleplay:manage", async () => {
    const res = await api().get("/api/roleplay-config").set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/roleplay-config", async () => {
    const res = await api().get("/api/roleplay-config").set(authHeader(admin.token)).expect(200);
    expect(res.body).toHaveProperty("keys");
    expectNotServerError(res.status);
  });

  it("PUT /api/roleplay-config", async () => {
    const res = await api()
      .put("/api/roleplay-config")
      .set(authHeader(admin.token))
      .send({
        keys: { openai: "sk-test-updated-key" },
        models: [{ provider: "openai", model: "gpt-4o" }],
      })
      .expect(200);
    expect(res.body).toHaveProperty("isReady");
  });

  it("PUT /api/roleplay-config/keys", async () => {
    const res = await api()
      .put("/api/roleplay-config/keys")
      .set(authHeader(admin.token))
      .send({ openai: "sk-test-keys-endpoint" })
      .expect(200);
    expect(res.body).toHaveProperty("keys");
  });

  it("PUT /api/roleplay-config/allowlists", async () => {
    const res = await api()
      .put("/api/roleplay-config/allowlists")
      .set(authHeader(admin.token))
      .send({
        persona: [{ provider: "openai", model: "gpt-4o" }],
        grader: [{ provider: "openai", model: "gpt-4o" }],
      })
      .expect(200);
    expect(res.body).toHaveProperty("persona");
  });

  it("GET /api/roleplay-config/model-catalog", async () => {
    const res = await api()
      .get("/api/roleplay-config/model-catalog?provider=openai")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("models");
  });

  it("POST /api/roleplay-config/model-catalog", async () => {
    const res = await api()
      .post("/api/roleplay-config/model-catalog")
      .set(authHeader(admin.token))
      .send({ provider: "openai" })
      .expect(200);
    expect(res.body).toHaveProperty("models");
  });

  it("POST /api/roleplay-config/test-key", async () => {
    const res = await api()
      .post("/api/roleplay-config/test-key")
      .set(authHeader(admin.token))
      .send({ provider: "openai", apiKey: "sk-test-fake" })
      .expect(200);
    expect(res.body).toHaveProperty("success");
    expect(res.body.success).toBe(true);
  });

  it("POST /api/roleplay-config/test", async () => {
    const res = await api()
      .post("/api/roleplay-config/test")
      .set(authHeader(admin.token))
      .send({ provider: "openai", model: "gpt-4o", purpose: "persona" })
      .expect(200);
    expect(res.body).toHaveProperty("success");
    expect(res.body.success).toBe(true);
  });
});
