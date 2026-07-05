import { api, authHeader } from "./request.ts";
import type { TestUser } from "./auth.ts";

export const MINIMAL_ROLEPLAY_PAYLOAD = {
  roleplay: {
    title: "Smoke Test Scenario",
    status: "published",
    learnerRole: "Learner",
    situationContext: "A test situation for API smoke tests.",
    learnerObjective: "Complete the smoke test conversation.",
    introduction: "Welcome to the smoke test scenario.",
  },
  settings: {
    personaProvider: "openai",
    personaModel: "gpt-4o",
    graderProvider: "openai",
    graderModel: "gpt-4o",
    maxAttempts: 5,
  },
  persona: {
    name: "Test Persona",
    roleTitle: "Customer",
    personalityTraits: "friendly",
    mood: "neutral",
    difficulty: "easy",
    openingStyle: "professional",
  },
  criteria: [
    {
      name: "Communication",
      description: "Communicates clearly",
      weight: "1.0",
      maxScore: 100,
    },
  ],
};

export async function configureRoleplayAi(adminToken: string): Promise<void> {
  await api()
    .put("/api/roleplay-config")
    .set(authHeader(adminToken))
    .send({
      keys: { openai: "sk-test-fake-key-for-smoke-tests" },
      models: [{ provider: "openai", model: "gpt-4o" }],
    })
    .expect(200);
}

export async function createMinimalRoleplay(adminToken: string): Promise<number> {
  const res = await api()
    .post("/api/roleplays")
    .set(authHeader(adminToken))
    .send(MINIMAL_ROLEPLAY_PAYLOAD)
    .expect(201);

  return res.body.id as number;
}

export async function createAttempt(
  token: string,
  roleplayId: number,
): Promise<{ attemptId: number; runId?: number }> {
  const res = await api()
    .post(`/api/roleplays/${roleplayId}/attempts`)
    .set(authHeader(token))
    .expect(200);

  return { attemptId: res.body.attempt.id };
}

export async function uploadTestImage(adminToken: string): Promise<number> {
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  const res = await api()
    .post("/api/media")
    .set(authHeader(adminToken))
    .attach("file", pngBuffer, "test.png")
    .expect(201);

  return res.body.id as number;
}

export interface TestFixtures {
  admin: TestUser;
  learner: TestUser;
  roleplayId: number;
  mediaId: number;
  classificationOptionId?: number;
}

export async function seedFixtures(admin: TestUser, learner: TestUser): Promise<TestFixtures> {
  await configureRoleplayAi(admin.token);
  const roleplayId = await createMinimalRoleplay(admin.token);
  const mediaId = await uploadTestImage(admin.token);

  const classifications = await api()
    .get("/api/roleplay-classifications")
    .set(authHeader(admin.token))
    .expect(200);

  const firstOption = classifications.body.dimensions?.[0]?.options?.[0];
  const classificationOptionId = firstOption?.id as number | undefined;

  return { admin, learner, roleplayId, mediaId, classificationOptionId };
}
