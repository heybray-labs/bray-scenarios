import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";
import { seedFixtures } from "../helpers/fixtures.ts";

describe("Teams API", () => {
  let admin: TestUser;
  let learner: TestUser;
  let manager: TestUser;
  let teamId: number;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);

    const managerRes = await api()
      .post("/api/users")
      .set(authHeader(admin.token))
      .send({
        email: "manager@test.example.com",
        password: "ManagerPass123!",
        firstName: "Team",
        role: "user",
      })
      .expect(201);

    manager = {
      email: "manager@test.example.com",
      password: "ManagerPass123!",
      token: await (async () => {
        const login = await api()
          .post("/api/auth/login")
          .send({ email: "manager@test.example.com", password: "ManagerPass123!" })
          .expect(200);
        await api()
          .post("/api/auth/change-password")
          .set(authHeader(login.body.token))
          .send({
            currentPassword: "ManagerPass123!",
            newPassword: "ManagerPass123!X",
          })
          .expect(200);
        const final = await api()
          .post("/api/auth/login")
          .send({ email: "manager@test.example.com", password: "ManagerPass123!X" })
          .expect(200);
        return final.body.token;
      })(),
      id: managerRes.body.user.id,
    };

    const teamRes = await api()
      .post("/api/teams")
      .set(authHeader(admin.token))
      .send({ name: "Test Team", managerId: manager.id })
      .expect(201);

    teamId = teamRes.body.team.id;

    await api()
      .put(`/api/teams/${teamId}/members`)
      .set(authHeader(admin.token))
      .send({ memberIds: [learner.id] })
      .expect(200);
  });

  it("GET /api/teams rejects unauthenticated requests", async () => {
    await api().get("/api/teams").expect(401);
  });

  it("GET /api/teams rejects non-manager non-admin learner", async () => {
    const res = await api().get("/api/teams").set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/teams returns managed teams for manager", async () => {
    const res = await api().get("/api/teams").set(authHeader(manager.token)).expect(200);
    expectNotServerError(res.status);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].id).toBe(teamId);
    expect(res.body.teams[0].memberCount).toBe(1);
  });

  it("GET /api/teams returns all teams for admin", async () => {
    const res = await api().get("/api/teams").set(authHeader(admin.token)).expect(200);
    expect(res.body.teams.some((t: { id: number }) => t.id === teamId)).toBe(true);
  });

  it("GET /api/teams/:id/star-map rejects learner", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/star-map`)
      .set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/teams/:id/star-map allows manager of team", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/star-map`)
      .set(authHeader(manager.token))
      .expect(200);
    expectNotServerError(res.status);
    expect(res.body.team.id).toBe(teamId);
    expect(res.body).toHaveProperty("categories");
    expect(res.body).toHaveProperty("members");
    expect(res.body).toHaveProperty("teamSummary");
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].userId).toBe(learner.id);
    expect(res.body.members[0]).toHaveProperty("starCounts");
    expect(res.body.members[0]).toHaveProperty("categoryMastery");
    expect(res.body.members[0]).toHaveProperty("passRate");
  });

  it("manager cannot access another team's star map", async () => {
    const otherTeam = await api()
      .post("/api/teams")
      .set(authHeader(admin.token))
      .send({ name: "Other Team" })
      .expect(201);

    const res = await api()
      .get(`/api/teams/${otherTeam.body.team.id}/star-map`)
      .set(authHeader(manager.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/teams/all/star-map is admin-only", async () => {
    const managerRes = await api()
      .get("/api/teams/all/star-map")
      .set(authHeader(manager.token));
    expect(managerRes.status).toBe(403);

    const adminRes = await api()
      .get("/api/teams/all/star-map")
      .set(authHeader(admin.token))
      .expect(200);
    expect(adminRes.body.team.id).toBe("all");
  });

  it("GET /api/teams/:id/members/:userId/progress allows manager", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/members/${learner.id}/progress`)
      .set(authHeader(manager.token))
      .expect(200);
    expect(res.body.userId).toBe(learner.id);
    expect(res.body).toHaveProperty("totalPoints");
    expect(res.body).toHaveProperty("categoryMastery");
    expect(res.body).toHaveProperty("starCounts");
  });

  it("GET /api/teams/:id/members/:userId/scenario-history allows manager", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/members/${learner.id}/scenario-history`)
      .set(authHeader(manager.token))
      .expect(200);
    expectNotServerError(res.status);
    expect(res.body.userId).toBe(learner.id);
    expect(res.body).toHaveProperty("totalPoints");
    expect(res.body).toHaveProperty("passRate");
    expect(Array.isArray(res.body.categories)).toBe(true);
    if (res.body.categories.length > 0) {
      const category = res.body.categories[0];
      expect(category).toHaveProperty("slug");
      expect(category).toHaveProperty("starCounts");
      expect(Array.isArray(category.scenarios)).toBe(true);
      if (category.scenarios.length > 0) {
        expect(category.scenarios[0]).toMatchObject({
          roleplayId: expect.any(Number),
          title: expect.any(String),
          starLevel: expect.any(Number),
          attemptCount: expect.any(Number),
        });
      }
    }
  });

  it("GET /api/teams/:id/members/:userId/scenario-history rejects learner", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/members/${learner.id}/scenario-history`)
      .set(authHeader(learner.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/teams/:id/members/:userId/scenario-history rejects member not on team", async () => {
    const res = await api()
      .get(`/api/teams/${teamId}/members/${manager.id}/scenario-history`)
      .set(authHeader(manager.token));
    expect(res.status).toBe(403);
  });

  it("GET /api/teams/:id/members/:userId/roleplays/:roleplayId/attempts allows manager", async () => {
    const fixtures = await seedFixtures(admin, learner);
    const attemptRes = await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);

    await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts/${attemptRes.body.attempt.id}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);

    const res = await api()
      .get(
        `/api/teams/${teamId}/members/${learner.id}/roleplays/${fixtures.roleplayId}/attempts`,
      )
      .set(authHeader(manager.token))
      .expect(200);
    expect(Array.isArray(res.body.attempts)).toBe(true);
    expect(res.body.attempts.length).toBeGreaterThan(0);
    expect(res.body.attempts[0]).toHaveProperty("attemptNumber");
    expect(res.body.attempts[0]).toHaveProperty("starLevel");
  });

  it("manager can view team member attempt results", async () => {
    const fixtures = await seedFixtures(admin, learner);
    const attemptRes = await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const memberAttemptId = attemptRes.body.attempt.id as number;

    await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts/${memberAttemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);

    const res = await api()
      .get(`/api/roleplays/${fixtures.roleplayId}/attempts/${memberAttemptId}/results`)
      .set(authHeader(manager.token))
      .expect(200);
    expectNotServerError(res.status);
    expect(res.body).toHaveProperty("attempt");
    expect(res.body.attempt.userId).toBe(learner.id);
  });

  it("unrelated learner cannot view another user's attempt results", async () => {
    const fixtures = await seedFixtures(admin, learner);
    const attemptRes = await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts`)
      .set(authHeader(learner.token))
      .expect(200);
    const memberAttemptId = attemptRes.body.attempt.id as number;

    await api()
      .post(`/api/roleplays/${fixtures.roleplayId}/attempts/${memberAttemptId}/submit`)
      .set(authHeader(learner.token))
      .send({ endReason: "manual" })
      .expect(200);

    const otherTeam = await api()
      .post("/api/teams")
      .set(authHeader(admin.token))
      .send({ name: "Isolated Team" })
      .expect(201);

    const otherManagerRes = await api()
      .post("/api/users")
      .set(authHeader(admin.token))
      .send({
        email: "other-manager@test.example.com",
        password: "OtherMgrPass123!",
        firstName: "Other",
        role: "user",
      })
      .expect(201);

    await api()
      .patch(`/api/teams/${otherTeam.body.team.id}`)
      .set(authHeader(admin.token))
      .send({ managerId: otherManagerRes.body.user.id })
      .expect(200);

    const otherLogin = await api()
      .post("/api/auth/login")
      .send({ email: "other-manager@test.example.com", password: "OtherMgrPass123!" })
      .expect(200);

    await api()
      .post("/api/auth/change-password")
      .set(authHeader(otherLogin.body.token))
      .send({
        currentPassword: "OtherMgrPass123!",
        newPassword: "OtherMgrPass123!X",
      })
      .expect(200);

    const otherFinal = await api()
      .post("/api/auth/login")
      .send({ email: "other-manager@test.example.com", password: "OtherMgrPass123!X" })
      .expect(200);

    const res = await api()
      .get(`/api/roleplays/${fixtures.roleplayId}/attempts/${memberAttemptId}/results`)
      .set(authHeader(otherFinal.body.token));
    expect(res.status).toBe(404);
  });

  it("POST /api/teams requires admin", async () => {
    const res = await api()
      .post("/api/teams")
      .set(authHeader(manager.token))
      .send({ name: "Blocked" });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/teams unassigns members", async () => {
    const temp = await api()
      .post("/api/teams")
      .set(authHeader(admin.token))
      .send({ name: "Temp Team" })
      .expect(201);

    const tempId = temp.body.team.id;
    await api()
      .put(`/api/teams/${tempId}/members`)
      .set(authHeader(admin.token))
      .send({ memberIds: [learner.id] })
      .expect(200);

    await api().delete(`/api/teams/${tempId}`).set(authHeader(admin.token)).expect(200);

    const usersRes = await api().get("/api/users").set(authHeader(admin.token)).expect(200);
    const learnerRow = usersRes.body.users.find((u: { id: number }) => u.id === learner.id);
    expect(learnerRow.teamId).toBeNull();
  });
});
