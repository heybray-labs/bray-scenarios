import { z } from "zod";

export const ROLEPLAY_TRANSFER_FORMAT = "bray-scenarios";
export const ROLEPLAY_TRANSFER_VERSION = 2;
export const ROLEPLAY_TRANSFER_VERSIONS = [1, 2] as const;

const portableRoleplaySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    introduction: z.string().nullable().optional(),
    customThankYouMessage: z.string().nullable().optional(),
    /** Portable media path inside a zip export, e.g. "media/uuid.jpg" */
    coverImage: z.string().nullable().optional(),
    /** Legacy v1 field (ignored on import) */
    coverImageUrl: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    audienceLevel: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    learnerRole: z.string().nullable().optional(),
    situationContext: z.string().nullable().optional(),
    learnerObjective: z.string().nullable().optional(),
    playbook: z.string().nullable().optional(),
    startDate: z.union([z.string(), z.date()]).nullable().optional(),
    endDate: z.union([z.string(), z.date()]).nullable().optional(),
  })
  .passthrough();

const portableSettingsSchema = z
  .object({
    maxAttempts: z.number().nullable().optional(),
    passThreshold: z.number().optional(),
    allowManualEnd: z.boolean().optional(),
    maxTurns: z.number().nullable().optional(),
    autoEndOnMaxTurns: z.boolean().optional(),
    allowAiEnd: z.boolean().optional(),
    liveCoaching: z.boolean().optional(),
    timeLimitMinutes: z.number().nullable().optional(),
    showTimer: z.boolean().optional(),
    postSessionDisplayMode: z.string().optional(),
    showTranscript: z.boolean().optional(),
    showRubricBreakdown: z.boolean().optional(),
    allowViewPreviousAttempts: z.boolean().optional(),
    personaProvider: z.string().nullable().optional(),
    personaModel: z.string().nullable().optional(),
    graderProvider: z.string().nullable().optional(),
    graderModel: z.string().nullable().optional(),
  })
  .passthrough();

const portablePersonaSchema = z
  .object({
    name: z.string().optional(),
    roleTitle: z.string().nullable().optional(),
    personalityTraits: z.string().nullable().optional(),
    mood: z.string().nullable().optional(),
    difficulty: z.string().optional(),
    backgroundFacts: z.string().nullable().optional(),
    hiddenObjective: z.string().nullable().optional(),
    openingStyle: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  })
  .passthrough();

const portableCriterionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    weight: z.union([z.string(), z.number()]).optional(),
    maxScore: z.number().optional(),
    orderIndex: z.number().optional(),
  })
  .passthrough();

const portableRewardTierSchema = z
  .object({
    tierName: z.string().min(1),
    minScorePercent: z.number().int().min(0).max(100),
    rewardPoints: z.number().int().min(0),
    orderIndex: z.number().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  })
  .passthrough();

export const transferScenarioSchema = z.object({
  roleplay: portableRoleplaySchema,
  settings: portableSettingsSchema.optional(),
  persona: portablePersonaSchema.optional(),
  criteria: z.array(portableCriterionSchema).optional(),
  rewardTiers: z.array(portableRewardTierSchema).optional(),
});

export const transferEnvelopeSchema = z.object({
  format: z.literal(ROLEPLAY_TRANSFER_FORMAT),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().optional(),
  scenarios: z.array(transferScenarioSchema).min(1),
});

/** Accept either a full envelope or a bare single-scenario object. */
export const transferImportBodySchema = z.object({
  scenarios: z.array(transferScenarioSchema).min(1),
});

export type TransferScenario = z.infer<typeof transferScenarioSchema>;
export type TransferEnvelope = z.infer<typeof transferEnvelopeSchema>;

const ROLEPLAY_STRIP_KEYS = new Set([
  "id",
  "createdBy",
  "createdAt",
  "updatedAt",
  "status",
  "published",
  "settings",
  "persona",
  "criteria",
  "myBestAttempt",
  "classifications",
  "coverImageMediaId",
  "coverImageUrl",
  "rewardTiers",
]);

const SETTINGS_STRIP_KEYS = new Set(["id", "roleplayId"]);
const PERSONA_STRIP_KEYS = new Set(["id", "roleplayId"]);
const CRITERION_STRIP_KEYS = new Set(["id", "roleplayId", "createdAt"]);
const REWARD_TIER_STRIP_KEYS = new Set(["id", "roleplayId"]);

function omitKeys(
  obj: Record<string, unknown> | null | undefined,
  keys: Set<string>,
): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (keys.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function serializeDate(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

/** Build a portable scenario from a full roleplay record (with settings/persona/criteria). */
export function stripForExport(
  full: Record<string, unknown>,
  options?: {
    coverImage?: string | null;
    classifications?: {
      category?: string | null;
      tags?: string[];
      audienceLevel?: string | null;
      duration?: string | null;
    };
  },
): TransferScenario {
  const roleplayRaw = omitKeys(full, ROLEPLAY_STRIP_KEYS) ?? {};
  const roleplay = {
    ...roleplayRaw,
    title: String(roleplayRaw.title ?? "Untitled"),
    startDate: serializeDate(roleplayRaw.startDate),
    endDate: serializeDate(roleplayRaw.endDate),
    coverImage: options?.coverImage ?? null,
    category: options?.classifications?.category ?? roleplayRaw.category ?? null,
    tags: options?.classifications?.tags ?? roleplayRaw.tags ?? null,
    audienceLevel: options?.classifications?.audienceLevel ?? roleplayRaw.audienceLevel ?? null,
    duration: options?.classifications?.duration ?? roleplayRaw.duration ?? null,
  };

  const settingsRaw = omitKeys(
    full.settings as Record<string, unknown> | undefined,
    SETTINGS_STRIP_KEYS,
  );
  const personaRaw = omitKeys(
    full.persona as Record<string, unknown> | undefined,
    PERSONA_STRIP_KEYS,
  );

  const criteriaList = Array.isArray(full.criteria) ? full.criteria : [];
  const criteria = criteriaList.map((c) => {
    const stripped = omitKeys(c as Record<string, unknown>, CRITERION_STRIP_KEYS) ?? {};
    return {
      ...stripped,
      name: String(stripped.name ?? ""),
      weight:
        stripped.weight != null ? String(stripped.weight) : undefined,
    };
  });

  const rewardTierList = Array.isArray(full.rewardTiers) ? full.rewardTiers : [];
  const rewardTiers = rewardTierList.map((t, index) => {
    const stripped = omitKeys(t as Record<string, unknown>, REWARD_TIER_STRIP_KEYS) ?? {};
    return {
      tierName: String(stripped.tierName ?? ""),
      minScorePercent: Number(stripped.minScorePercent ?? 0),
      rewardPoints: Number(stripped.rewardPoints ?? 0),
      orderIndex:
        stripped.orderIndex != null ? Number(stripped.orderIndex) : index,
      color: stripped.color != null ? String(stripped.color) : undefined,
      icon: stripped.icon != null ? String(stripped.icon) : undefined,
    };
  });

  return transferScenarioSchema.parse({
    roleplay,
    settings: settingsRaw,
    persona: personaRaw,
    criteria: criteria.length ? criteria : undefined,
    rewardTiers: rewardTiers.length ? rewardTiers : undefined,
  });
}

export function buildTransferEnvelope(scenarios: TransferScenario[]): TransferEnvelope {
  return {
    format: ROLEPLAY_TRANSFER_FORMAT,
    version: ROLEPLAY_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    scenarios,
  };
}

/**
 * Normalize arbitrary JSON into a list of transfer scenarios.
 * Accepts a full envelope or a bare single-scenario object.
 */
export function normalizeImportPayload(raw: unknown): {
  scenarios: TransferScenario[];
  error?: string;
} {
  if (raw == null || typeof raw !== "object") {
    return { scenarios: [], error: "Invalid JSON: expected an object" };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.format === ROLEPLAY_TRANSFER_FORMAT) {
    const parsed = transferEnvelopeSchema.safeParse(obj);
    if (!parsed.success) {
      return {
        scenarios: [],
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }
    return { scenarios: parsed.data.scenarios };
  }

  // Bare single scenario: { roleplay: {...}, ... }
  if (obj.roleplay && typeof obj.roleplay === "object") {
    const parsed = transferScenarioSchema.safeParse(obj);
    if (!parsed.success) {
      return {
        scenarios: [],
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }
    return { scenarios: [parsed.data] };
  }

  // Envelope-like without format field: { scenarios: [...] }
  if (Array.isArray(obj.scenarios)) {
    const parsed = transferImportBodySchema.safeParse(obj);
    if (!parsed.success) {
      return {
        scenarios: [],
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }
    return { scenarios: parsed.data.scenarios };
  }

  return {
    scenarios: [],
    error: `Unrecognized format. Expected "${ROLEPLAY_TRANSFER_FORMAT}" envelope or a scenario object.`,
  };
}

/** Prepare a scenario for insert: force draft, strip any residual ids. */
export function prepareScenarioForImport(scenario: TransferScenario): TransferScenario {
  const roleplay = omitKeys(scenario.roleplay as Record<string, unknown>, ROLEPLAY_STRIP_KEYS) ?? {};
  // Preserve portable coverImage path for import media resolution
  if (typeof scenario.roleplay.coverImage === "string") {
    roleplay.coverImage = scenario.roleplay.coverImage;
  }
  const settings = omitKeys(
    scenario.settings as Record<string, unknown> | undefined,
    SETTINGS_STRIP_KEYS,
  );
  const persona = omitKeys(
    scenario.persona as Record<string, unknown> | undefined,
    PERSONA_STRIP_KEYS,
  );
  const criteria = (scenario.criteria ?? []).map((c) => {
    const stripped = omitKeys(c as Record<string, unknown>, CRITERION_STRIP_KEYS) ?? {};
    return {
      ...stripped,
      name: String(stripped.name ?? ""),
    };
  });

  const rewardTiers = (scenario.rewardTiers ?? []).map((t, index) => {
    const stripped = omitKeys(t as Record<string, unknown>, REWARD_TIER_STRIP_KEYS) ?? {};
    return {
      tierName: String(stripped.tierName ?? ""),
      minScorePercent: Number(stripped.minScorePercent ?? 0),
      rewardPoints: Number(stripped.rewardPoints ?? 0),
      orderIndex:
        stripped.orderIndex != null ? Number(stripped.orderIndex) : index,
      color: stripped.color != null ? String(stripped.color) : undefined,
      icon: stripped.icon != null ? String(stripped.icon) : undefined,
    };
  });

  return {
    roleplay: {
      ...roleplay,
      title: String(roleplay.title ?? "Untitled"),
    },
    settings,
    persona,
    criteria: criteria.length ? criteria : undefined,
    rewardTiers: rewardTiers.length ? rewardTiers : undefined,
  };
}

export function portableMediaPath(storageKey: string): string {
  return `media/${storageKey}`;
}
