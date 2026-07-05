import { vi } from "vitest";
import type { GradingContext } from "../../roleplay/grading.ts";

const fakeChatModel = {
  invoke: vi.fn().mockResolvedValue({ content: "Hello from the persona." }),
  stream: vi.fn().mockImplementation(async function* () {
    yield { content: "Hello from the persona." };
  }),
  withStructuredOutput: vi.fn().mockReturnValue({
    invoke: vi.fn().mockImplementation(async () => ({
      overallFeedback: "Good work overall.",
      criteria: [{ criterionId: 1, score: 80, feedback: "Solid", strengths: "", improvements: "" }],
    })),
  }),
};

vi.mock("../../roleplay/model-factory.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../roleplay/model-factory.ts")>();
  return {
    ...actual,
    createRoleplayChatModel: vi.fn().mockResolvedValue(fakeChatModel),
  };
});

vi.mock("../../roleplay/grading.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../roleplay/grading.ts")>();
  return {
    ...actual,
    gradeTranscript: vi.fn().mockImplementation(async (_model: unknown, ctx: GradingContext) => ({
      overallFeedback: "Good work overall.",
      criteria: ctx.criteria.map((c) => ({
        criterionId: c.id,
        score: 80,
        feedback: "Solid",
        strengths: "",
        improvements: "",
      })),
    })),
  };
});

vi.mock("../../services/agent-model-catalog.service.ts", () => ({
  agentModelCatalogService: {
    getModelsForProvider: vi.fn().mockResolvedValue({
      models: [
        {
          id: "gpt-4o",
          displayName: "GPT-4o",
          provider: "openai",
          source: "catalog",
        },
      ],
      cached: true,
    }),
    testProviderApiKey: vi.fn().mockResolvedValue(undefined),
  },
}));

export { fakeChatModel };
