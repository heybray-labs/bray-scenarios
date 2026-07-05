import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";

describe("Users API", () => {
  let admin: TestUser;
  let learner: TestUser;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);
  });

  it("GET /api/users requires admin", async () => {
    await api().get("/api/users").expect(401);
    const res = await api().get("/api/users").set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/users", async () => {
    const res = await api().get("/api/users").set(authHeader(admin.token)).expect(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expectNotServerError(res.status);
  });

  it("POST /api/users", async () => {
    const res = await api()
      .post("/api/users")
      .set(authHeader(admin.token))
      .send({
        email: "another@test.example.com",
        password: "AnotherPass123!",
        firstName: "Another",
        role: "user",
      })
      .expect(201);
    expect(res.body.user).toBeDefined();
  });

  it("PATCH /api/users/:id/role", async () => {
    const res = await api()
      .patch(`/api/users/${learner.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "user" })
      .expect(200);
    expect(res.body.user.role.name).toBe("user");
  });
});
