import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { expectNotServerError } from "../helpers/assertions.ts";
import { setupAdmin, createLearner, type TestUser } from "../helpers/auth.ts";

describe("Roleplay classifications API", () => {
  let admin: TestUser;
  let learner: TestUser;
  let optionId: number;

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);

    const list = await api()
      .get("/api/roleplay-classifications")
      .set(authHeader(admin.token))
      .expect(200);
    optionId = list.body.dimensions[0].options[0].id;
  });

  it("GET /api/roleplay-classifications requires auth", async () => {
    await api().get("/api/roleplay-classifications").expect(401);
  });

  it("GET /api/roleplay-classifications", async () => {
    const res = await api()
      .get("/api/roleplay-classifications")
      .set(authHeader(learner.token))
      .expect(200);
    expect(res.body).toHaveProperty("dimensions");
    expectNotServerError(res.status);
  });

  it("GET /api/roleplay-classifications?includeInactive=true", async () => {
    const res = await api()
      .get("/api/roleplay-classifications?includeInactive=true")
      .set(authHeader(admin.token))
      .expect(200);
    expect(res.body).toHaveProperty("dimensions");
  });

  it("POST /api/roleplay-classifications/options", async () => {
    const uniqueSlug = `smoke-test-category-${Date.now()}`;
    const res = await api()
      .post("/api/roleplay-classifications/options")
      .set(authHeader(admin.token))
      .send({
        dimensionSlug: "category",
        label: "Smoke Test Category",
        slug: uniqueSlug,
      })
      .expect(201);
    expect(res.body).toHaveProperty("option");
    optionId = res.body.option.id;
  });

  it("POST /api/roleplay-classifications/options forbidden for learner", async () => {
    const res = await api()
      .post("/api/roleplay-classifications/options")
      .set(authHeader(learner.token))
      .send({ dimensionSlug: "category", label: "Nope" });
    expect(res.status).toBe(403);
  });

  it("PATCH /api/roleplay-classifications/options/:id", async () => {
    const res = await api()
      .patch(`/api/roleplay-classifications/options/${optionId}`)
      .set(authHeader(admin.token))
      .send({ label: "Updated Smoke Category" })
      .expect(200);
    expect(res.body.option.label).toBe("Updated Smoke Category");
  });

  it("PATCH /api/roleplay-classifications/options/:id/reorder", async () => {
    const res = await api()
      .patch(`/api/roleplay-classifications/options/${optionId}/reorder`)
      .set(authHeader(admin.token))
      .send({ direction: "up" });
    expectNotServerError(res.status);
    expect([200, 400]).toContain(res.status);
  });

  it("PATCH /api/roleplay-classifications/options/reorder", async () => {
    const list = await api()
      .get("/api/roleplay-classifications?includeInactive=true")
      .set(authHeader(admin.token))
      .expect(200);
    const dimension = list.body.dimensions.find((d: { slug: string }) => d.slug === "category");
    const orderedOptionIds = dimension.options.map((o: { id: number }) => o.id);

    const res = await api()
      .patch("/api/roleplay-classifications/options/reorder")
      .set(authHeader(admin.token))
      .send({ dimensionSlug: "category", orderedOptionIds })
      .expect(200);
    expect(res.body).toHaveProperty("ok");
  });

  it("DELETE /api/roleplay-classifications/options/:id", async () => {
    const uniqueSlug = `delete-me-tag-${Date.now()}`;
    const created = await api()
      .post("/api/roleplay-classifications/options")
      .set(authHeader(admin.token))
      .send({
        dimensionSlug: "tags",
        label: "Delete Me Tag",
        slug: uniqueSlug,
      })
      .expect(201);

    await api()
      .delete(`/api/roleplay-classifications/options/${created.body.option.id}`)
      .set(authHeader(admin.token))
      .expect(204);
  });
});
