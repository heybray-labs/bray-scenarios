import { db } from "../db.ts";
import { and, eq, desc, asc, sql, inArray, or, ilike, count, gte } from "drizzle-orm";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
  type Roleplay,
} from "../../shared/schemas/roleplay-core.ts";
import {
  buildTransferEnvelope,
  normalizeImportPayload,
  portableMediaPath,
  prepareScenarioForImport,
  stripForExport,
  type TransferEnvelope,
  type TransferScenario,
} from "../../shared/schemas/roleplay-transfer.ts";
import {
  mediaService,
  MediaValidationError,
  withCoverImageUrl,
} from "@heybray/media";
import { users } from "@heybray/identity/schema";
import { createLogger, eventBus } from "@heybray/server-kit";
import {
  createRoleplayChatModel,
  RoleplayNotConfiguredError,
} from "../roleplay/model-factory.ts";
import {
  roleplayConfigService,
  type RoleplayModelRef,
} from "../services/roleplay-config.service.ts";
import {
  buildPersonaSystemPrompt,
  buildOpeningInstruction,
  AI_END_SENTINEL,
  stripEndSentinel,
  hasEndSentinel,
  type TranscriptTurn,
} from "../roleplay/persona-prompt.ts";
import {
  gradeTranscript,
  computeWeightedPercent,
  type GradingCriterionInput,
} from "../roleplay/grading.ts";
import { findCheatDirectiveInMessages, isCheatModeEnabled, extractCheatDirective } from "../config/cheat-mode.ts";
import { generateLiveHint } from "../roleplay/coaching.ts";
import { emitRoleplayEvent } from "../roleplay/roleplay-events.ts";
import type {
  MissingImportClassificationOption,
  RoleplayClassificationInput,
  RoleplayClassifications,
} from "@heybray/taxonomy/schema";
import {
  IMPORT_PROMPT_DIMENSIONS,
  classificationDimensions,
  classificationOptions,
  contentClassificationLinks,
} from "@heybray/taxonomy/schema";
import {
  rewardTiers as gamRewardTiers,
  userContentTierAwards,
  pointTransactions,
  resolveRewardTierDisplay,
  normalizeRewardTiers,
  tierNameFromStarLevel,
  deriveStarLevel,
  type RewardTierInput,
} from "@heybray/gamification/schema";
import { gamification, SCENARIO_CONTENT_TYPE } from "../gamification.ts";
import { scenarioResultsController } from "./scenario-results.controller.ts";
import * as scenarioClassifications from "../lib/scenario-classifications.ts";

const log = createLogger("roleplay");

function classificationInputFromScenario(scenario: TransferScenario): RoleplayClassificationInput {
  const roleplay = scenario.roleplay as Record<string, unknown>;
  return {
    category: typeof roleplay.category === "string" ? roleplay.category : null,
    audienceLevel:
      typeof roleplay.audienceLevel === "string" ? roleplay.audienceLevel : null,
    duration: typeof roleplay.duration === "string" ? roleplay.duration : null,
    tags: Array.isArray(roleplay.tags)
      ? roleplay.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  };
}

export type ImportPreviewResult = {
  scenarioCount: number;
  missing: MissingImportClassificationOption[];
  autoImportTagCount: number;
};

export interface BulkRoleplayPayload {
  roleplay: Partial<Roleplay> & Record<string, unknown>;
  settings?: Record<string, unknown>;
  persona?: Record<string, unknown>;
  criteria?: Array<Record<string, unknown>>;
  rewardTiers?: RewardTierInput[];
  classifications?: RoleplayClassificationInput;
}

export interface RoleplayListOptions {
  publishedOnly?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  categories?: string[];
  audienceLevels?: string[];
  durations?: string[];
  tags?: string[];
  difficulties?: string[];
  userId?: number;
  myStatus?: string;
  sort?: "createdAt" | "publishedAt";
  publishedSince?: Date;
  roleplayIds?: number[];
}

export interface RoleplayListResult {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
}

function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => typeof p === "object" && p && "text" in p)
      .map((p) => String((p as { text?: string }).text ?? ""))
      .join("");
  }
  return "";
}

export class RoleplaySystemController {
  // ===================== CRUD =====================

  async getRoleplays(options?: RoleplayListOptions): Promise<RoleplayListResult> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = (page - 1) * limit;

    const filters: ReturnType<typeof sql>[] = [];

    if (options?.publishedOnly) {
      filters.push(eq(roleplays.status, "published"));
    }

    if (options?.search?.trim()) {
      const term = `%${options.search.trim()}%`;
      filters.push(
        or(ilike(roleplays.title, term), ilike(roleplays.description, term))!,
      );
    }

    if (options?.difficulties?.length) {
      const difficultyValues = options.difficulties.map((d) => d.trim()).filter(Boolean);
      if (difficultyValues.length) {
        filters.push(
          inArray(roleplayPersonas.difficulty, difficultyValues),
        );
      }
    }

    const addClassificationInFilter = (dimensionSlug: string, slugs: string[]) => {
      if (!slugs.length) return;
      filters.push(sql`EXISTS (
        SELECT 1 FROM roleplay_classification_links rcl
        INNER JOIN classification_options co ON co.id = rcl.option_id
        INNER JOIN classification_dimensions cd ON cd.id = co.dimension_id
        WHERE rcl.roleplay_id = ${roleplays.id}
          AND cd.slug = ${dimensionSlug}
          AND co.slug IN (${sql.join(slugs.map((slug) => sql`${slug}`), sql`, `)})
      )`);
    };

    if (options?.categories?.length) {
      addClassificationInFilter(
        "category",
        options.categories.map((c) => c.trim()).filter(Boolean),
      );
    }
    if (options?.audienceLevels?.length) {
      addClassificationInFilter(
        "audience_level",
        options.audienceLevels.map((a) => a.trim()).filter(Boolean),
      );
    }
    if (options?.durations?.length) {
      addClassificationInFilter(
        "duration",
        options.durations.map((d) => d.trim()).filter(Boolean),
      );
    }

    const tagSlugs = (options?.tags ?? []).map((t) => t.trim()).filter(Boolean);
    if (tagSlugs.length) {
      addClassificationInFilter("tags", tagSlugs);
    }

    const userId = options?.userId;
    const myStatus = options?.myStatus?.trim();
    if (userId && myStatus) {
      switch (myStatus) {
        case "not_started":
          filters.push(sql`NOT EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id} AND ra.user_id = ${userId}
          )`);
          break;
        case "in_progress":
          filters.push(sql`EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id}
              AND ra.user_id = ${userId}
              AND ra.status = 'in_progress'
          )`);
          break;
        case "passed":
          filters.push(sql`EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id}
              AND ra.user_id = ${userId}
              AND ra.status = 'completed'
              AND ra.is_passed = true
              AND CAST(ra.score AS numeric) = (
                SELECT MAX(CAST(ra2.score AS numeric))
                FROM roleplay_attempts ra2
                WHERE ra2.roleplay_id = ${roleplays.id}
                  AND ra2.user_id = ${userId}
                  AND ra2.status = 'completed'
              )
          )`);
          break;
        case "attempted":
          filters.push(sql`EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id}
              AND ra.user_id = ${userId}
              AND ra.status = 'completed'
          ) AND NOT EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id}
              AND ra.user_id = ${userId}
              AND ra.status = 'completed'
              AND ra.is_passed = true
              AND CAST(ra.score AS numeric) = (
                SELECT MAX(CAST(ra2.score AS numeric))
                FROM roleplay_attempts ra2
                WHERE ra2.roleplay_id = ${roleplays.id}
                  AND ra2.user_id = ${userId}
                  AND ra2.status = 'completed'
              )
          )`);
          break;
        case "bronze":
        case "silver":
        case "gold": {
          const starLevel = myStatus === "bronze" ? 1 : myStatus === "silver" ? 2 : 3;
          filters.push(sql`EXISTS (
            SELECT 1 FROM user_content_tier_awards ucta
            INNER JOIN reward_tiers rt ON rt.id = ucta.highest_tier_id
            WHERE ucta.user_id = ${userId}
              AND ucta.content_type = 'scenario'
              AND ucta.content_id = ${roleplays.id}
              AND rt.star_level = ${starLevel}
          )`);
          break;
        }
        case "not_passed":
          filters.push(sql`NOT EXISTS (
            SELECT 1 FROM roleplay_attempts ra
            WHERE ra.roleplay_id = ${roleplays.id}
              AND ra.user_id = ${userId}
              AND ra.status = 'completed'
              AND ra.is_passed = true
              AND CAST(ra.score AS numeric) = (
                SELECT MAX(CAST(ra2.score AS numeric))
                FROM roleplay_attempts ra2
                WHERE ra2.roleplay_id = ${roleplays.id}
                  AND ra2.user_id = ${userId}
                  AND ra2.status = 'completed'
              )
          )`);
          break;
        case "below_gold":
          filters.push(sql`NOT EXISTS (
            SELECT 1 FROM user_content_tier_awards ucta
            INNER JOIN reward_tiers rt ON rt.id = ucta.highest_tier_id
            WHERE ucta.user_id = ${userId}
              AND ucta.content_type = 'scenario'
              AND ucta.content_id = ${roleplays.id}
              AND rt.star_level = 3
          )`);
          break;
      }
    }

    if (options?.roleplayIds?.length) {
      filters.push(inArray(roleplays.id, options.roleplayIds));
    }

    if (options?.publishedSince) {
      filters.push(sql`${roleplays.publishedAt} >= ${options.publishedSince}`);
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const orderColumn =
      options?.sort === "publishedAt" ? roleplays.publishedAt : roleplays.createdAt;

    const [countRow] = await db
      .select({ total: count() })
      .from(roleplays)
      .leftJoin(roleplayPersonas, eq(roleplayPersonas.roleplayId, roleplays.id))
      .where(whereClause);

    const rows = await db
      .select({
        roleplay: roleplays,
        difficulty: roleplayPersonas.difficulty,
      })
      .from(roleplays)
      .leftJoin(roleplayPersonas, eq(roleplayPersonas.roleplayId, roleplays.id))
      .where(whereClause)
      .orderBy(desc(orderColumn))
      .limit(limit)
      .offset(offset);

    const roleplayIds = rows.map(({ roleplay }) => roleplay.id);
    const [classificationMap, rewardTierMap] = await Promise.all([
      scenarioClassifications.getClassificationsForRoleplays(roleplayIds),
      gamification.getRewardTiersForContents(SCENARIO_CONTENT_TYPE, roleplayIds),
    ]);

    const items = rows.map(({ roleplay, difficulty }) =>
      withCoverImageUrl({
        ...roleplay,
        difficulty: difficulty ?? null,
        classifications: classificationMap.get(roleplay.id) ?? {
          category: null,
          audienceLevel: null,
          duration: null,
          tags: [],
        },
        rewardTiers: rewardTierMap.get(roleplay.id) ?? [],
      }),
    );

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page,
      limit,
    };
  }

  async getRoleplayById(roleplayId: number) {
    const [roleplay] = await db
      .select()
      .from(roleplays)
      .where(eq(roleplays.id, roleplayId))
      .limit(1);
    if (!roleplay) return null;

    const [settings] = await db
      .select()
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);
    const [persona] = await db
      .select()
      .from(roleplayPersonas)
      .where(eq(roleplayPersonas.roleplayId, roleplayId))
      .limit(1);
    const criteria = await db
      .select()
      .from(roleplayCriteria)
      .where(eq(roleplayCriteria.roleplayId, roleplayId))
      .orderBy(roleplayCriteria.orderIndex);
    const rewardTiers = await gamification.getRewardTiers(SCENARIO_CONTENT_TYPE, roleplayId);
    const classifications = await scenarioClassifications.getRoleplayClassifications(roleplayId);
    return { ...withCoverImageUrl(roleplay), settings, persona, criteria, rewardTiers, classifications };
  }

  async bulkSaveRoleplay(
    roleplayId: number | null,
    userId: number,
    payload: BulkRoleplayPayload,
  ) {
    if (payload.settings && this.settingsHaveAllModels(payload.settings)) {
      await roleplayConfigService.validateRoleplayModelSettings(payload.settings);
    }

    const result = await db.transaction(async (tx) => {
      // Strip server-owned fields from client payload
      const {
        id: _id,
        createdBy: _createdBy,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        coverImageUrl: _coverImageUrl,
        coverImage: _coverImage,
        ...safeRoleplay
      } = (payload.roleplay ?? {}) as Record<string, unknown>;

      if ("coverImageMediaId" in safeRoleplay) {
        const raw = safeRoleplay.coverImageMediaId;
        if (raw === null || raw === undefined || raw === "") {
          safeRoleplay.coverImageMediaId = null;
        } else {
          const mediaId = Number(raw);
          if (!Number.isInteger(mediaId) || mediaId <= 0) {
            throw new MediaValidationError("Invalid cover image");
          }
          await mediaService.assertExists(mediaId);
          safeRoleplay.coverImageMediaId = mediaId;
        }
      }

      // Keep the published boolean in sync with status so the intro page gate is consistent
      if (typeof (safeRoleplay as any).status === "string") {
        (safeRoleplay as any).published = (safeRoleplay as any).status === "published";
      }

      let saved: Roleplay;
      if (roleplayId) {
        const [updated] = await tx
          .update(roleplays)
          .set({ ...(safeRoleplay as any), updatedAt: new Date() })
          .where(eq(roleplays.id, roleplayId))
          .returning();
        saved = updated;
      } else {
        const [created] = await tx
          .insert(roleplays)
          .values({
            ...(safeRoleplay as any),
            createdBy: userId,
            status: (safeRoleplay as any).status ?? "draft",
          })
          .returning();
        saved = created;
      }

      const rid = saved.id;

      // Settings (1:1 upsert)
      if (payload.settings) {
        const [existing] = await tx
          .select()
          .from(roleplaySettings)
          .where(eq(roleplaySettings.roleplayId, rid))
          .limit(1);
        const settingsData = { ...(payload.settings as any), roleplayId: rid };
        delete (settingsData as any).id;
        if (existing) {
          await tx
            .update(roleplaySettings)
            .set(settingsData)
            .where(eq(roleplaySettings.id, existing.id));
        } else {
          await tx.insert(roleplaySettings).values(settingsData);
        }
      }

      // Persona (1:1 upsert)
      if (payload.persona) {
        const [existing] = await tx
          .select()
          .from(roleplayPersonas)
          .where(eq(roleplayPersonas.roleplayId, rid))
          .limit(1);
        const personaData = { ...(payload.persona as any), roleplayId: rid };
        delete (personaData as any).id;
        if (existing) {
          await tx
            .update(roleplayPersonas)
            .set(personaData)
            .where(eq(roleplayPersonas.id, existing.id));
        } else {
          await tx.insert(roleplayPersonas).values(personaData);
        }
      }

      // Criteria (reconcile: upsert provided, delete missing)
      if (payload.criteria) {
        const existing = await tx
          .select()
          .from(roleplayCriteria)
          .where(eq(roleplayCriteria.roleplayId, rid));
        const keptIds: number[] = [];
        let orderIndex = 0;
        for (const c of payload.criteria) {
          const data: any = {
            roleplayId: rid,
            name: (c as any).name ?? "",
            description: (c as any).description ?? null,
            weight: String((c as any).weight ?? "1.0"),
            maxScore: Number((c as any).maxScore ?? 100),
            orderIndex: orderIndex++,
          };
          if ((c as any).id) {
            await tx
              .update(roleplayCriteria)
              .set(data)
              .where(eq(roleplayCriteria.id, (c as any).id));
            keptIds.push((c as any).id);
          } else {
            const [ins] = await tx.insert(roleplayCriteria).values(data).returning();
            keptIds.push(ins.id);
          }
        }
        const toDelete = existing.filter((e) => !keptIds.includes(e.id)).map((e) => e.id);
        if (toDelete.length) {
          await tx.delete(roleplayCriteria).where(inArray(roleplayCriteria.id, toDelete));
        }
      }

      // Reward tiers (reconcile: upsert provided, delete missing) — written to the
      // platform reward_tiers table keyed by (content_type, content_id).
      if (payload.rewardTiers !== undefined) {
        if (!payload.rewardTiers.length) {
          await tx
            .delete(gamRewardTiers)
            .where(
              and(
                eq(gamRewardTiers.contentType, SCENARIO_CONTENT_TYPE),
                eq(gamRewardTiers.contentId, rid),
              ),
            );
        } else {
          const normalizedTiers = normalizeRewardTiers(payload.rewardTiers);
          const existingTiers = await tx
            .select()
            .from(gamRewardTiers)
            .where(
              and(
                eq(gamRewardTiers.contentType, SCENARIO_CONTENT_TYPE),
                eq(gamRewardTiers.contentId, rid),
              ),
            );
          const keptTierIds: number[] = [];
          let tierOrderIndex = 0;
          for (const tier of normalizedTiers) {
            const starLevel = tier.starLevel ?? tierOrderIndex + 1;
            const display = resolveRewardTierDisplay({ starLevel });
            const data = {
              contentType: SCENARIO_CONTENT_TYPE,
              contentId: rid,
              tierName: tierNameFromStarLevel(starLevel),
              minScorePercent: tier.minScorePercent,
              rewardPoints: tier.rewardPoints,
              orderIndex: tier.orderIndex ?? tierOrderIndex++,
              starLevel,
              color: display.color,
              icon: null,
            };
            const existingMatch = tier.id
              ? existingTiers.find((e) => e.id === tier.id)
              : existingTiers.find((e) => e.starLevel === starLevel);
            if (existingMatch) {
              await tx
                .update(gamRewardTiers)
                .set(data)
                .where(eq(gamRewardTiers.id, existingMatch.id));
              keptTierIds.push(existingMatch.id);
            } else {
              const [ins] = await tx.insert(gamRewardTiers).values(data).returning();
              keptTierIds.push(ins.id);
            }
          }
          const tiersToDelete = existingTiers
            .filter((e) => !keptTierIds.includes(e.id))
            .map((e) => e.id);
          if (tiersToDelete.length) {
            await tx
              .delete(gamRewardTiers)
              .where(inArray(gamRewardTiers.id, tiersToDelete));
          }
        }
      }

      if (payload.classifications) {
        await scenarioClassifications.setRoleplayClassifications(rid, payload.classifications, tx);
      }

      const classifications = await scenarioClassifications.getRoleplayClassifications(rid);
      return { ...withCoverImageUrl(saved), classifications };
    });

    await gamification.syncContent([
      {
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: result.id as number,
        title: result.title as string,
        isActive: (result.status as string) === "published",
      },
    ]);

    return result;
  }

  async deleteRoleplay(roleplayId: number, actorId?: number): Promise<boolean> {
    const result = await db
      .delete(roleplays)
      .where(eq(roleplays.id, roleplayId))
      .returning();
    if (result.length > 0) {
      await gamification.onContentDeleted(SCENARIO_CONTENT_TYPE, roleplayId);
      eventBus.emit("content.deleted", {
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: roleplayId,
        actorId,
      });
    }
    return result.length > 0;
  }

  async duplicateRoleplay(roleplayId: number, userId: number) {
    const full = await this.getRoleplayById(roleplayId);
    if (!full) return null;

    const {
      id: _id,
      createdBy: _createdBy,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      coverImageUrl: _coverImageUrl,
      settings,
      persona,
      criteria,
      rewardTiers,
      classifications,
      ...roleplayFields
    } = full as Record<string, unknown> & {
      settings?: Record<string, unknown> | null;
      persona?: Record<string, unknown> | null;
      criteria?: Array<Record<string, unknown>>;
      rewardTiers?: Array<Record<string, unknown>>;
      classifications?: RoleplayClassifications;
    };

    const sourceTitle =
      typeof roleplayFields.title === "string" && roleplayFields.title.trim()
        ? roleplayFields.title.trim()
        : "Untitled";

    const stripRelationIds = (row: Record<string, unknown> | null | undefined) => {
      if (!row) return undefined;
      const { id: _rowId, roleplayId: _rid, createdAt: _rowCreatedAt, ...rest } = row;
      return rest;
    };

    return this.bulkSaveRoleplay(null, userId, {
      roleplay: {
        ...roleplayFields,
        title: `Copy of ${sourceTitle}`,
        status: "draft",
        published: false,
      },
      settings: stripRelationIds(settings ?? undefined),
      persona: stripRelationIds(persona ?? undefined),
      criteria: (criteria ?? []).map((c) => stripRelationIds(c)!),
      rewardTiers: (rewardTiers ?? []).map((t) => ({
        starLevel: Number(t.starLevel ?? 0) || undefined,
        tierName: String(t.tierName ?? ""),
        minScorePercent: Number(t.minScorePercent ?? 0),
        rewardPoints: Number(t.rewardPoints ?? 0),
        orderIndex: Number(t.orderIndex ?? 0),
      })),
      classifications: classifications
        ? {
            category: classifications.category?.slug ?? null,
            audienceLevel: classifications.audienceLevel?.slug ?? null,
            duration: classifications.duration?.slug ?? null,
            tags: classifications.tags.map((t) => t.slug),
          }
        : undefined,
    });
  }

  // ===================== Export / Import =====================

  private settingsHaveAllModels(settings: Record<string, unknown>): boolean {
    return Boolean(
      settings.personaProvider &&
        settings.personaModel &&
        settings.graderProvider &&
        settings.graderModel,
    );
  }

  async exportRoleplays(ids: number[]): Promise<TransferEnvelope> {
    const { envelope } = await this.buildExportPayload(ids);
    return envelope;
  }

  async exportRoleplaysZip(
    ids: number[],
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { envelope, mediaFiles, filenameBase } = await this.buildExportPayload(ids);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("scenarios.json", JSON.stringify(envelope, null, 2));
    for (const [pathInZip, buffer] of mediaFiles) {
      zip.file(pathInZip, buffer);
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    return { buffer, filename: `${filenameBase}.zip` };
  }

  private async buildExportPayload(ids: number[]): Promise<{
    envelope: TransferEnvelope;
    mediaFiles: Map<string, Buffer>;
    filenameBase: string;
  }> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      throw new Error("At least one roleplay id is required");
    }

    const mediaIdToPath = new Map<number, string>();
    const mediaFiles = new Map<string, Buffer>();
    const scenarios: TransferScenario[] = [];

    for (const id of uniqueIds) {
      const full = await this.getRoleplayById(id);
      if (!full) {
        throw new Error(`Roleplay not found: ${id}`);
      }

      let coverImage: string | null = null;
      const mediaId = full.coverImageMediaId;
      if (mediaId != null) {
        let pathInZip = mediaIdToPath.get(mediaId);
        if (!pathInZip) {
          const asset = await mediaService.getById(mediaId);
          if (asset) {
            pathInZip = portableMediaPath(asset.storageKey);
            mediaIdToPath.set(mediaId, pathInZip);
            try {
              mediaFiles.set(pathInZip, await mediaService.readFile(asset));
            } catch {
              pathInZip = undefined;
            }
          }
        }
        coverImage = pathInZip ?? null;
      }

      scenarios.push(
        stripForExport(full as unknown as Record<string, unknown>, {
          coverImage,
          classifications: {
            category: full.classifications?.category?.slug ?? null,
            tags: full.classifications?.tags?.map((t) => t.slug) ?? [],
            audienceLevel: full.classifications?.audienceLevel?.slug ?? null,
            duration: full.classifications?.duration?.slug ?? null,
          },
        }),
      );
    }

    const envelope = buildTransferEnvelope(scenarios);
    const filenameBase =
      scenarios.length === 1
        ? `scenario-${this.slugifyTitle(scenarios[0].roleplay.title)}`
        : `scenarios-export-${new Date().toISOString().slice(0, 10)}`;

    return { envelope, mediaFiles, filenameBase };
  }

  private slugifyTitle(title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return slug || "scenario";
  }

  private clearModelFields(settings: Record<string, unknown>): Record<string, unknown> {
    return {
      ...settings,
      personaProvider: null,
      personaModel: null,
      graderProvider: null,
      graderModel: null,
    };
  }

  private async isModelAvailable(
    purpose: "persona" | "grader",
    ref: RoleplayModelRef,
  ): Promise<boolean> {
    try {
      await roleplayConfigService.assertModelAllowedForPurpose(purpose, ref);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve model fields for import: keep valid models, fall back to app defaults
   * with warnings, or clear models when unavailable. Never throws — import always proceeds.
   */
  private async resolveModelsForImport(
    title: string,
    settings: Record<string, unknown> | undefined,
  ): Promise<{ settings: Record<string, unknown> | undefined; warnings: string[] }> {
    if (!settings) return { settings: undefined, warnings: [] };

    const warnings: string[] = [];
    const next = { ...settings };
    const defaults = await roleplayConfigService.getDefaults();

    const applyDefaultOrClear = async (
      purpose: "persona" | "grader",
      providerKey: string,
      modelKey: string,
      defaultRef: RoleplayModelRef | null,
      unavailableLabel: string,
    ) => {
      if (
        defaultRef &&
        (await this.isModelAvailable(purpose, defaultRef))
      ) {
        next[providerKey] = defaultRef.provider;
        next[modelKey] = defaultRef.model;
        warnings.push(
          `"${title}": ${unavailableLabel}; using default ${defaultRef.provider}:${defaultRef.model}`,
        );
        return;
      }
      next[providerKey] = null;
      next[modelKey] = null;
      warnings.push(
        `"${title}": ${unavailableLabel}; imported without a ${purpose} model (configure AI in Settings)`,
      );
    };

    const tryModel = async (
      purpose: "persona" | "grader",
      providerKey: string,
      modelKey: string,
      defaultRef: RoleplayModelRef | null,
    ) => {
      const provider = next[providerKey] as string | null | undefined;
      const model = next[modelKey] as string | null | undefined;

      // No model in file — leave unset unless we can apply a valid default silently
      if (!provider || !model) {
        if (defaultRef && (await this.isModelAvailable(purpose, defaultRef))) {
          next[providerKey] = defaultRef.provider;
          next[modelKey] = defaultRef.model;
        } else {
          next[providerKey] = null;
          next[modelKey] = null;
        }
        return;
      }

      const available = await this.isModelAvailable(purpose, {
        provider: provider as RoleplayModelRef["provider"],
        model,
      });
      if (available) return;

      await applyDefaultOrClear(
        purpose,
        providerKey,
        modelKey,
        defaultRef,
        `${purpose} model ${provider}:${model} is not available`,
      );
    };

    await tryModel("persona", "personaProvider", "personaModel", defaults.persona);
    await tryModel("grader", "graderProvider", "graderModel", defaults.grader);

    // Partial model pairs are not valid — clear both and warn if anything was set
    if (!this.settingsHaveAllModels(next)) {
      const hadAny =
        next.personaProvider ||
        next.personaModel ||
        next.graderProvider ||
        next.graderModel;
      Object.assign(next, this.clearModelFields(next));
      if (hadAny) {
        warnings.push(
          `"${title}": incomplete model settings; imported without model preferences`,
        );
      }
    } else {
      // Final guard: never let model validation fail the import
      try {
        await roleplayConfigService.validateRoleplayModelSettings(next);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "validation failed";
        warnings.push(
          `"${title}": model settings could not be applied (${detail}); imported without model preferences`,
        );
        Object.assign(next, this.clearModelFields(next));
      }
    }

    return { settings: next, warnings };
  }

  private coerceOptionalDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim()) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  async importRoleplaysFromZip(
    userId: number,
    zipBuffer: Buffer,
    options?: { createMissingClassifications?: boolean },
  ): Promise<{ created: Roleplay[]; warnings: string[] }> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestEntry =
      zip.file("scenarios.json") ?? zip.file(/\.json$/i)[0] ?? null;
    if (!manifestEntry) {
      throw new Error("Zip must contain scenarios.json");
    }
    const manifestText = await manifestEntry.async("string");
    let raw: unknown;
    try {
      raw = JSON.parse(manifestText);
    } catch {
      throw new Error("scenarios.json is not valid JSON");
    }

    const { scenarios, error } = normalizeImportPayload(raw);
    if (error || !scenarios.length) {
      throw new Error(error ?? "No scenarios found in zip");
    }

    const mediaFiles = new Map<
      string,
      { buffer: Buffer; mimeType: string; originalFilename: string }
    >();
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const normalized = name.replace(/^\.\//, "");
      if (!normalized.startsWith("media/")) continue;
      const buffer = Buffer.from(await entry.async("nodebuffer"));
      const lower = normalized.toLowerCase();
      let mimeType = "application/octet-stream";
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else if (lower.endsWith(".webp")) mimeType = "image/webp";
      mediaFiles.set(normalized, {
        buffer,
        mimeType,
        originalFilename: normalized.split("/").pop() || "image",
      });
    }

    return this.importRoleplays(userId, scenarios, mediaFiles, options);
  }

  async previewImportFromZip(zipBuffer: Buffer): Promise<ImportPreviewResult> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestEntry =
      zip.file("scenarios.json") ?? zip.file(/\.json$/i)[0] ?? null;
    if (!manifestEntry) {
      throw new Error("Zip must contain scenarios.json");
    }
    const manifestText = await manifestEntry.async("string");
    let raw: unknown;
    try {
      raw = JSON.parse(manifestText);
    } catch {
      throw new Error("scenarios.json is not valid JSON");
    }

    const { scenarios, error } = normalizeImportPayload(raw);
    if (error || !scenarios.length) {
      throw new Error(error ?? "No scenarios found in zip");
    }

    return this.previewImport(scenarios);
  }

  async previewImport(scenarios: TransferScenario[]): Promise<ImportPreviewResult> {
    const inputs = scenarios.map(classificationInputFromScenario);
    const missing = await scenarioClassifications.findMissingImportOptions(
      inputs,
      IMPORT_PROMPT_DIMENSIONS,
    );
    const autoImportTags = await scenarioClassifications.findMissingImportOptions(
      inputs,
      ["tags"],
    );
    return {
      scenarioCount: scenarios.length,
      missing,
      autoImportTagCount: autoImportTags.length,
    };
  }

  async importRoleplays(
    userId: number,
    scenarios: TransferScenario[],
    mediaFiles?: Map<
      string,
      { buffer: Buffer; mimeType: string; originalFilename: string }
    >,
    options?: { createMissingClassifications?: boolean },
  ): Promise<{ created: Roleplay[]; warnings: string[] }> {
    const created: Roleplay[] = [];
    const warnings: string[] = [];
    const coverPathToMediaId = new Map<string, number>();
    const inputs = scenarios.map(classificationInputFromScenario);

    const autoTagCount = await scenarioClassifications.ensureAutoImportTags(inputs);
    if (autoTagCount > 0) {
      warnings.push(
        `Added ${autoTagCount} missing tag ${autoTagCount === 1 ? "value" : "values"} from import`,
      );
    }

    if (options?.createMissingClassifications) {
      const createdCount = await scenarioClassifications.ensurePromptImportOptions(inputs);
      if (createdCount > 0) {
        warnings.push(
          `Added ${createdCount} missing classification ${createdCount === 1 ? "value" : "values"} from import`,
        );
      }
    }

    for (const scenario of scenarios) {
      const prepared = prepareScenarioForImport(scenario);
      const title = String(prepared.roleplay.title ?? "Untitled");

      const { settings, warnings: modelWarnings } = await this.resolveModelsForImport(
        title,
        prepared.settings as Record<string, unknown> | undefined,
      );
      warnings.push(...modelWarnings);

      const classificationsInput: RoleplayClassificationInput =
        classificationInputFromScenario(prepared);
      const roleplayFields = { ...(prepared.roleplay as Record<string, unknown>) };
      const coverPath =
        typeof roleplayFields.coverImage === "string" ? roleplayFields.coverImage : null;
      delete roleplayFields.coverImage;
      delete roleplayFields.coverImageUrl;
      delete roleplayFields.coverImageMediaId;
      delete roleplayFields.category;
      delete roleplayFields.tags;
      delete roleplayFields.audienceLevel;
      delete roleplayFields.duration;

      let resolvedClassifications: RoleplayClassificationInput | undefined;
      try {
        resolvedClassifications = await scenarioClassifications.resolveImportClassifications(
          classificationsInput,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : "invalid classifications";
        warnings.push(`"${title}": ${detail}`);
      }

      let coverImageMediaId: number | null = null;
      if (coverPath) {
        const existingId = coverPathToMediaId.get(coverPath);
        if (existingId != null) {
          coverImageMediaId = existingId;
        } else {
          const file = mediaFiles?.get(coverPath);
          if (!file) {
            warnings.push(
              `"${title}": cover image "${coverPath}" was not included; imported without cover`,
            );
          } else {
            try {
              const asset = await mediaService.createFromBuffer(file.buffer, {
                originalFilename: file.originalFilename,
                mimeType: file.mimeType,
                createdBy: userId,
              });
              coverPathToMediaId.set(coverPath, asset.id);
              coverImageMediaId = asset.id;
            } catch (error) {
              const detail = error instanceof Error ? error.message : "upload failed";
              warnings.push(
                `"${title}": cover image could not be imported (${detail})`,
              );
            }
          }
        }
      }

      const payload: BulkRoleplayPayload = {
        roleplay: {
          ...roleplayFields,
          title,
          status: "draft",
          published: false,
          coverImageMediaId,
          startDate: this.coerceOptionalDate(roleplayFields.startDate),
          endDate: this.coerceOptionalDate(roleplayFields.endDate),
        },
        settings,
        persona: prepared.persona as Record<string, unknown> | undefined,
        criteria: prepared.criteria as Array<Record<string, unknown>> | undefined,
        rewardTiers: prepared.rewardTiers,
        classifications: resolvedClassifications,
      };

      const roleplay = await this.bulkSaveRoleplay(null, userId, payload);
      created.push(roleplay);
    }

    return { created, warnings };
  }

  async publishRoleplay(roleplayId: number, actorId?: number) {
    const [existing] = await db
      .select({ publishedAt: roleplays.publishedAt })
      .from(roleplays)
      .where(eq(roleplays.id, roleplayId))
      .limit(1);

    const [updated] = await db
      .update(roleplays)
      .set({
        status: "published",
        published: true,
        updatedAt: new Date(),
        ...(existing?.publishedAt ? {} : { publishedAt: new Date() }),
      })
      .where(eq(roleplays.id, roleplayId))
      .returning();
    if (updated) {
      await gamification.syncContent([
        {
          contentType: SCENARIO_CONTENT_TYPE,
          contentId: updated.id,
          title: updated.title,
          isActive: true,
        },
      ]);
      eventBus.emit("content.published", {
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: updated.id,
        actorId,
      });
    }
    return updated ?? null;
  }

  async unpublishRoleplay(roleplayId: number, actorId?: number) {
    const [updated] = await db
      .update(roleplays)
      .set({ status: "draft", published: false, updatedAt: new Date() })
      .where(eq(roleplays.id, roleplayId))
      .returning();
    if (updated) {
      await gamification.syncContent([
        {
          contentType: SCENARIO_CONTENT_TYPE,
          contentId: updated.id,
          title: updated.title,
          isActive: false,
        },
      ]);
      eventBus.emit("content.unpublished", {
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: updated.id,
        actorId,
      });
    }
    return updated ?? null;
  }

  async getRoleplayStats(roleplayId: number) {
    const attempts = await db
      .select()
      .from(roleplayAttempts)
      .where(eq(roleplayAttempts.roleplayId, roleplayId));
    const completed = attempts.filter((a) => a.status === "completed");
    const scores = completed
      .map((a) => (a.score != null ? parseFloat(String(a.score)) : null))
      .filter((s): s is number => s != null);
    const avgScore = scores.length
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
      : null;
    const uniqueUsers = new Set(attempts.map((a) => a.userId)).size;
    return {
      totalAttempts: attempts.length,
      completedAttempts: completed.length,
      uniqueUsers,
      avgScore,
      passCount: completed.filter((a) => a.isPassed).length,
    };
  }

  // ===================== Conversation =====================

  private async loadConversationContext(roleplayId: number) {
    const [roleplay] = await db
      .select()
      .from(roleplays)
      .where(eq(roleplays.id, roleplayId))
      .limit(1);
    if (!roleplay) throw new Error("Roleplay not found");
    const [settings] = await db
      .select()
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);
    const [persona] = await db
      .select()
      .from(roleplayPersonas)
      .where(eq(roleplayPersonas.roleplayId, roleplayId))
      .limit(1);
    return { roleplay, settings: settings ?? null, persona: persona ?? {} };
  }

  async getAttemptMessages(attemptId: number) {
    return db
      .select()
      .from(roleplayMessages)
      .where(eq(roleplayMessages.attemptId, attemptId))
      .orderBy(roleplayMessages.id);
  }

  async getAttempt(attemptId: number, userId: number) {
    const [attempt] = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(eq(roleplayAttempts.id, attemptId), eq(roleplayAttempts.userId, userId)),
      )
      .limit(1);
    return attempt ?? null;
  }

  async getUserAttempts(roleplayId: number, userId: number) {
    return db
      .select()
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      )
      .orderBy(desc(roleplayAttempts.startedAt));
  }

  async getUserBestAttemptsByRoleplay(userId: number) {
    const attempts = await db
      .select({
        id: roleplayAttempts.id,
        roleplayId: roleplayAttempts.roleplayId,
        attemptNumber: roleplayAttempts.attemptNumber,
        score: roleplayAttempts.score,
        isPassed: roleplayAttempts.isPassed,
        status: roleplayAttempts.status,
        completedAt: roleplayAttempts.completedAt,
      })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "completed"),
        ),
      );

    const bestByRoleplay = new Map<number, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      const existing = bestByRoleplay.get(attempt.roleplayId);
      const score = parseFloat(String(attempt.score ?? "0"));
      const existingScore = existing
        ? parseFloat(String(existing.score ?? "0"))
        : -1;
      if (!existing || score > existingScore) {
        bestByRoleplay.set(attempt.roleplayId, attempt);
      }
    }
    return bestByRoleplay;
  }

  async getUserPointsEarnedByRoleplay(userId: number) {
    const rows = await db
      .select({
        contentId: userContentTierAwards.contentId,
        totalPointsAwarded: userContentTierAwards.totalPointsAwarded,
      })
      .from(userContentTierAwards)
      .where(
        and(
          eq(userContentTierAwards.userId, userId),
          eq(userContentTierAwards.contentType, SCENARIO_CONTENT_TYPE),
        ),
      );

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.contentId, row.totalPointsAwarded);
    }
    return map;
  }

  async getUserInProgressAttemptsByRoleplay(userId: number) {
    const rows = await db
      .select({
        id: roleplayAttempts.id,
        roleplayId: roleplayAttempts.roleplayId,
        turnCount: roleplayAttempts.turnCount,
        maxTurns: roleplaySettings.maxTurns,
      })
      .from(roleplayAttempts)
      .leftJoin(roleplaySettings, eq(roleplaySettings.roleplayId, roleplayAttempts.roleplayId))
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "in_progress"),
        ),
      );

    const map = new Map<
      number,
      { id: number; currentTurn: number; maxTurns: number | null }
    >();
    for (const row of rows) {
      map.set(row.roleplayId, {
        id: row.id,
        currentTurn: row.turnCount,
        maxTurns: row.maxTurns,
      });
    }
    return map;
  }

  async enrichBrowseItemsForUser(
    userId: number,
    roleplayIds: number[],
    publishedOnly = true,
  ): Promise<Array<Record<string, unknown>>> {
    if (!roleplayIds.length) return [];
    const uniqueIds = [...new Set(roleplayIds)];
    const [bestAttempts, pointsEarned, inProgressAttempts, listResult] = await Promise.all([
      this.getUserBestAttemptsByRoleplay(userId),
      this.getUserPointsEarnedByRoleplay(userId),
      this.getUserInProgressAttemptsByRoleplay(userId),
      this.getRoleplays({
        publishedOnly,
        roleplayIds: uniqueIds,
        limit: uniqueIds.length,
        page: 1,
        userId,
      }),
    ]);
    const byId = new Map(
      listResult.items.map((item) => [(item as { id: number }).id, item]),
    );
    return roleplayIds
      .map((id) => byId.get(id))
      .filter((item): item is Record<string, unknown> => !!item)
      .map((roleplay) => {
        const id = (roleplay as { id: number }).id;
        return {
          ...roleplay,
          myBestAttempt: bestAttempts.get(id) ?? null,
          myPointsEarned: pointsEarned.get(id) ?? 0,
          myInProgressAttempt: inProgressAttempts.get(id) ?? null,
        };
      });
  }

  async getFeaturedHeroItems(publishedOnly = true) {
    const rows = await db
      .select({
        roleplay: roleplays,
        difficulty: roleplayPersonas.difficulty,
      })
      .from(homepageFeaturedScenarios)
      .innerJoin(roleplays, eq(roleplays.id, homepageFeaturedScenarios.roleplayId))
      .leftJoin(roleplayPersonas, eq(roleplayPersonas.roleplayId, roleplays.id))
      .where(publishedOnly ? eq(roleplays.status, "published") : undefined)
      .orderBy(asc(homepageFeaturedScenarios.sortOrder));

    const roleplayIds = rows.map(({ roleplay }) => roleplay.id);
    const classificationMap =
      await scenarioClassifications.getClassificationsForRoleplays(roleplayIds);

    return rows.map(({ roleplay, difficulty }) => {
      const classifications = classificationMap.get(roleplay.id);
      return withCoverImageUrl({
        id: roleplay.id,
        title: roleplay.title,
        description: roleplay.description,
        coverImageMediaId: roleplay.coverImageMediaId,
        difficulty: difficulty ?? null,
        classifications: classifications
          ? {
              category: classifications.category,
              audienceLevel: classifications.audienceLevel,
            }
          : { category: null, audienceLevel: null },
      });
    });
  }

  async getFeaturedManageList() {
    const rows = await db
      .select({
        roleplayId: homepageFeaturedScenarios.roleplayId,
        sortOrder: homepageFeaturedScenarios.sortOrder,
        title: roleplays.title,
        status: roleplays.status,
        coverImageMediaId: roleplays.coverImageMediaId,
      })
      .from(homepageFeaturedScenarios)
      .innerJoin(roleplays, eq(roleplays.id, homepageFeaturedScenarios.roleplayId))
      .orderBy(asc(homepageFeaturedScenarios.sortOrder));

    return rows.map((row) =>
      withCoverImageUrl({
        roleplayId: row.roleplayId,
        sortOrder: row.sortOrder,
        title: row.title,
        status: row.status,
        coverImageMediaId: row.coverImageMediaId,
      }),
    );
  }

  async setFeaturedManageList(roleplayIds: number[]) {
    const uniqueIds = [...new Set(roleplayIds)];
    await db.transaction(async (tx) => {
      await tx.delete(homepageFeaturedScenarios);
      if (uniqueIds.length) {
        await tx.insert(homepageFeaturedScenarios).values(
          uniqueIds.map((roleplayId, index) => ({
            roleplayId,
            sortOrder: index,
          })),
        );
      }
    });
  }

  async isRoleplayFeatured(roleplayId: number): Promise<boolean> {
    const [row] = await db
      .select({ roleplayId: homepageFeaturedScenarios.roleplayId })
      .from(homepageFeaturedScenarios)
      .where(eq(homepageFeaturedScenarios.roleplayId, roleplayId))
      .limit(1);
    return !!row;
  }

  async getPopularRoleplayIds(limit = 20): Promise<number[]> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await db
      .select({
        contentId: pointTransactions.contentId,
      })
      .from(pointTransactions)
      .innerJoin(roleplays, eq(roleplays.id, pointTransactions.contentId))
      .where(
        and(
          eq(roleplays.status, "published"),
          eq(pointTransactions.contentType, SCENARIO_CONTENT_TYPE),
          gte(pointTransactions.createdAt, since),
          sql`${pointTransactions.contentId} IS NOT NULL`,
        ),
      )
      .groupBy(pointTransactions.contentId)
      .orderBy(desc(sql`SUM(${pointTransactions.amount})`))
      .limit(limit);

    return rows
      .map((row) => row.contentId)
      .filter((id): id is number => id != null);
  }

  async getRecommendedRoleplayIds(userId: number, limit = 20): Promise<number[]> {
    const mastery = await gamification.getMasteryRankings(userId);
    const topCategory = mastery[0];
    if (!topCategory) return [];

    const result = await this.getRoleplays({
      publishedOnly: true,
      categories: [topCategory.slug],
      myStatus: "not_passed",
      userId,
      limit,
      page: 1,
      sort: "publishedAt",
    });
    return result.items.map((item) => (item as { id: number }).id);
  }

  /**
   * "Room for Improvement" — scenarios from themes where the learner has
   * poor scores and/or the lowest % of scenarios completed, preferring
   * below-gold work (retries first, then unattempted gaps).
   */
  async getRoomForImprovementRoleplayIds(userId: number, limit = 20): Promise<number[]> {
    const mastery = await gamification.getMasteryRankings(userId);
    if (!mastery.length) return [];

    const engagementRows = await db
      .select({
        categorySlug: classificationOptions.slug,
        attemptCount: sql<number>`count(*)::int`,
        completedScenarios: sql<number>`count(DISTINCT ${roleplayAttempts.roleplayId})::int`,
      })
      .from(roleplayAttempts)
      .innerJoin(roleplays, eq(roleplays.id, roleplayAttempts.roleplayId))
      .innerJoin(
        contentClassificationLinks,
        and(
          eq(contentClassificationLinks.contentType, SCENARIO_CONTENT_TYPE),
          eq(contentClassificationLinks.contentId, roleplays.id),
        ),
      )
      .innerJoin(
        classificationOptions,
        eq(classificationOptions.id, contentClassificationLinks.optionId),
      )
      .innerJoin(
        classificationDimensions,
        eq(classificationDimensions.id, classificationOptions.dimensionId),
      )
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "completed"),
          eq(roleplays.status, "published"),
          eq(classificationDimensions.slug, "category"),
        ),
      )
      .groupBy(classificationOptions.slug);

    const attemptCountByCategory = new Map(
      engagementRows.map((row) => [row.categorySlug, Number(row.attemptCount) || 0]),
    );
    const completedByCategory = new Map(
      engagementRows.map((row) => [
        row.categorySlug,
        Number(row.completedScenarios) || 0,
      ]),
    );

    type FocusCategory = {
      slug: string;
      attemptCount: number;
      completionRatio: number;
      masteryRatio: number;
      fromPoorScores: boolean;
      fromLowCompletion: boolean;
    };

    const scored: FocusCategory[] = [];
    for (const category of mastery) {
      if (category.total <= 0) continue;
      const attemptCount = attemptCountByCategory.get(category.slug) ?? 0;
      const completed = completedByCategory.get(category.slug) ?? 0;
      const completionRatio = completed / category.total;
      const starred =
        category.starCounts.gold +
        category.starCounts.silver +
        category.starCounts.bronze;
      const masteryRatio = starred / category.total;
      scored.push({
        slug: category.slug,
        attemptCount,
        completionRatio,
        masteryRatio,
        fromPoorScores: false,
        fromLowCompletion: false,
      });
    }

    if (!scored.length) return [];

    // Poor scores: practiced themes with weak star coverage.
    for (const category of scored) {
      if (category.attemptCount > 0 && category.masteryRatio < 0.5) {
        category.fromPoorScores = true;
      }
    }

    // Lowest completion %: incomplete themes, worst coverage first.
    // Take the bottom half (at least 1) among categories not already fully done.
    const incomplete = scored
      .filter((c) => c.completionRatio < 1)
      .sort(
        (a, b) =>
          a.completionRatio - b.completionRatio ||
          b.attemptCount - a.attemptCount ||
          a.slug.localeCompare(b.slug),
      );
    const lowCompletionTake = Math.max(1, Math.ceil(incomplete.length / 2));
    for (const category of incomplete.slice(0, lowCompletionTake)) {
      category.fromLowCompletion = true;
    }

    const focusCategories = scored.filter(
      (c) => c.fromPoorScores || c.fromLowCompletion,
    );
    if (!focusCategories.length) return [];

    // Prefer low completion, then weak mastery, then heavy engagement.
    focusCategories.sort(
      (a, b) =>
        a.completionRatio - b.completionRatio ||
        a.masteryRatio - b.masteryRatio ||
        b.attemptCount - a.attemptCount ||
        a.slug.localeCompare(b.slug),
    );

    const focusSlugs = focusCategories.map((c) => c.slug);
    const overfetch = Math.min(60, Math.max(limit * 3, limit));
    const result = await this.getRoleplays({
      publishedOnly: true,
      categories: focusSlugs,
      myStatus: "below_gold",
      userId,
      limit: overfetch,
      page: 1,
      sort: "publishedAt",
    });

    const candidates = result.items as Array<{
      id: number;
      publishedAt?: string | Date | null;
      classifications?: { category?: { slug?: string } | null };
      rewardTiers?: Array<{ minScorePercent: number; starLevel?: number | null }>;
    }>;
    if (!candidates.length) return [];

    const bestAttempts = await this.getUserBestAttemptsByRoleplay(userId);
    const focusRank = new Map(focusSlugs.map((slug, index) => [slug, index]));
    const focusBySlug = new Map(focusCategories.map((c) => [c.slug, c]));

    const ranked = candidates
      .map((item) => {
        const best = bestAttempts.get(item.id);
        const bestScore =
          best != null ? parseFloat(String(best.score ?? "0")) : null;
        const starLevel = deriveStarLevel(bestScore, item.rewardTiers ?? []);
        const categorySlug = item.classifications?.category?.slug ?? null;
        const categoryRank =
          categorySlug != null ? (focusRank.get(categorySlug) ?? 999) : 999;
        const focus = categorySlug != null ? focusBySlug.get(categorySlug) : undefined;
        const publishedAt = item.publishedAt
          ? new Date(item.publishedAt).getTime()
          : 0;
        return {
          id: item.id,
          attempted: best != null,
          starLevel,
          bestScore: bestScore ?? Number.POSITIVE_INFINITY,
          categoryRank,
          completionRatio: focus?.completionRatio ?? 1,
          publishedAt,
        };
      })
      // Weak runs = attempted with 0 stars only; keep unattempted gaps too.
      .filter((item) => !item.attempted || item.starLevel === 0);

    ranked.sort((a, b) => {
      // 0-star retries first, then unattempted gaps in low-completion themes.
      if (a.attempted !== b.attempted) return a.attempted ? -1 : 1;
      if (a.bestScore !== b.bestScore) return a.bestScore - b.bestScore;
      if (a.completionRatio !== b.completionRatio) {
        return a.completionRatio - b.completionRatio;
      }
      if (a.categoryRank !== b.categoryRank) return a.categoryRank - b.categoryRank;
      return b.publishedAt - a.publishedAt;
    });

    return ranked.slice(0, limit).map((item) => item.id);
  }

  async getContinueScenarios(userId: number, limit = 10) {
    const inProgressRows = await db
      .select({
        roleplayId: roleplayAttempts.roleplayId,
        title: roleplays.title,
        coverImageMediaId: roleplays.coverImageMediaId,
        attemptId: roleplayAttempts.id,
        turnCount: roleplayAttempts.turnCount,
        maxTurns: roleplaySettings.maxTurns,
        startedAt: roleplayAttempts.startedAt,
      })
      .from(roleplayAttempts)
      .innerJoin(roleplays, eq(roleplays.id, roleplayAttempts.roleplayId))
      .leftJoin(roleplaySettings, eq(roleplaySettings.roleplayId, roleplays.id))
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "in_progress"),
          eq(roleplays.status, "published"),
        ),
      )
      .orderBy(desc(roleplayAttempts.startedAt));

    const bestAttempts = await this.getUserBestAttemptsByRoleplay(userId);
    const inProgressIds = new Set(inProgressRows.map((r) => r.roleplayId));

    const retryCandidates: Array<{
      roleplayId: number;
      title: string;
      coverImageMediaId: number | null;
      bestScore: number;
      lastActivity: Date;
    }> = [];

    for (const [roleplayId, attempt] of bestAttempts) {
      if (inProgressIds.has(roleplayId)) continue;
      const score = parseFloat(String(attempt.score ?? "0"));
      const tiers = await gamification.getRewardTiers(SCENARIO_CONTENT_TYPE, roleplayId);
      if (!tiers.length) continue;
      const starLevel = deriveStarLevel(score, tiers);
      if (starLevel >= 3) continue;
      const [roleplay] = await db
        .select({
          title: roleplays.title,
          coverImageMediaId: roleplays.coverImageMediaId,
          status: roleplays.status,
        })
        .from(roleplays)
        .where(eq(roleplays.id, roleplayId))
        .limit(1);
      if (!roleplay || roleplay.status !== "published") continue;
      retryCandidates.push({
        roleplayId,
        title: roleplay.title,
        coverImageMediaId: roleplay.coverImageMediaId,
        bestScore: score,
        lastActivity: attempt.completedAt ? new Date(attempt.completedAt) : new Date(0),
      });
    }

    retryCandidates.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    type ContinueItem = {
      roleplayId: number;
      title: string;
      coverImageMediaId: number | null;
      status: "in_progress" | "retry";
      bestScore: number | null;
      starLevel: number;
      nextTier: {
        name: string;
        minScorePercent: number;
        rewardPoints: number;
        starLevel: number;
      } | null;
      inProgressAttempt: { id: number; currentTurn: number; maxTurns: number | null } | null;
    };

    const items: ContinueItem[] = [];

    for (const row of inProgressRows) {
      if (items.length >= limit) break;
      const tiers = await gamification.getRewardTiers(SCENARIO_CONTENT_TYPE, row.roleplayId);
      const best = bestAttempts.get(row.roleplayId);
      const bestScore = best ? parseFloat(String(best.score ?? "0")) : null;
      const starLevel = deriveStarLevel(bestScore, tiers);
      const sortedAsc = [...tiers].sort((a, b) => a.starLevel - b.starLevel);
      const nextTierRow =
        bestScore != null
          ? sortedAsc.find((t) => t.minScorePercent > bestScore)
          : sortedAsc[0];
      items.push({
        roleplayId: row.roleplayId,
        title: row.title,
        coverImageMediaId: row.coverImageMediaId,
        status: "in_progress",
        bestScore,
        starLevel,
        nextTier: nextTierRow
          ? {
              name: nextTierRow.tierName,
              minScorePercent: nextTierRow.minScorePercent,
              rewardPoints: nextTierRow.rewardPoints,
              starLevel: nextTierRow.starLevel,
            }
          : null,
        inProgressAttempt: {
          id: row.attemptId,
          currentTurn: row.turnCount,
          maxTurns: row.maxTurns,
        },
      });
    }

    for (const candidate of retryCandidates) {
      if (items.length >= limit) break;
      const tiers = await gamification.getRewardTiers(SCENARIO_CONTENT_TYPE, candidate.roleplayId);
      const starLevel = deriveStarLevel(candidate.bestScore, tiers);
      const sortedAsc = [...tiers].sort((a, b) => a.starLevel - b.starLevel);
      const nextTierRow = sortedAsc.find((t) => t.minScorePercent > candidate.bestScore) ?? null;
      items.push({
        roleplayId: candidate.roleplayId,
        title: candidate.title,
        coverImageMediaId: candidate.coverImageMediaId,
        status: "retry",
        bestScore: candidate.bestScore,
        starLevel,
        nextTier: nextTierRow
          ? {
              name: nextTierRow.tierName,
              minScorePercent: nextTierRow.minScorePercent,
              rewardPoints: nextTierRow.rewardPoints,
              starLevel: nextTierRow.starLevel,
            }
          : null,
        inProgressAttempt: null,
      });
    }

    return items;
  }

  /** Resolve persona/grader models from attempt snapshot or live roleplay config. */
  private async resolveAttemptModels(
    attempt: typeof roleplayAttempts.$inferSelect,
    roleplayId: number,
  ): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef }> {
    const snapshot = await roleplayConfigService.resolveModelsFromAttemptSnapshot(
      attempt,
    );
    if (snapshot) return snapshot;
    return roleplayConfigService.resolveModelsForRoleplay(roleplayId);
  }

  /** Start a new attempt: enforces maxAttempts, generates the persona's opening message. */
  async startAttempt(roleplayId: number, userId: number) {
    const { roleplay, settings, persona } = await this.loadConversationContext(
      roleplayId,
    );

    const models = await roleplayConfigService.resolveModelsForRoleplay(roleplayId);

    const prior = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      );

    // Drop abandoned attempts that never got an opening message (e.g. after a failed AI call).
    for (const existing of prior) {
      if (existing.status !== "in_progress") continue;
      const msgs = await this.getAttemptMessages(existing.id);
      if (msgs.length === 0) {
        await db.delete(roleplayAttempts).where(eq(roleplayAttempts.id, existing.id));
      }
    }

    const attempts = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      );
    if (settings?.maxAttempts && attempts.length >= settings.maxAttempts) {
      throw new Error("Maximum attempts reached");
    }

    const [attempt] = await db
      .insert(roleplayAttempts)
      .values({
        roleplayId,
        userId,
        attemptNumber: attempts.length + 1,
        status: "in_progress",
        turnCount: 0,
        personaProvider: models.persona.provider,
        personaModel: models.persona.model,
        graderProvider: models.grader.provider,
        graderModel: models.grader.model,
      })
      .returning();

    try {
      const model = await createRoleplayChatModel({
        provider: models.persona.provider,
        model: models.persona.model,
        temperature: 0.8,
      });
      const messages: BaseMessage[] = [
        new SystemMessage(buildPersonaSystemPrompt({ roleplay, persona, settings })),
        new HumanMessage(buildOpeningInstruction({ roleplay })),
      ];
      const response = await model.invoke(messages);
      const opening = stripEndSentinel(chunkText(response.content)).trim();

      await db.insert(roleplayMessages).values({
        attemptId: attempt.id,
        role: "persona",
        content: opening || "Hello.",
        turnNumber: 0,
      });

      const allMessages = await this.getAttemptMessages(attempt.id);
      log.info("Roleplay attempt started", {
        roleplayId,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        userId,
        personaProvider: models.persona.provider,
        personaModel: models.persona.model,
        graderProvider: models.grader.provider,
        graderModel: models.grader.model,
      });
      return { attempt, messages: allMessages };
    } catch (error) {
      log.error(
        "Roleplay attempt start failed",
        error instanceof Error ? error : new Error(String(error)),
        { roleplayId, userId },
      );
      await db.delete(roleplayAttempts).where(eq(roleplayAttempts.id, attempt.id));
      throw error;
    }
  }

  private buildModelMessages(
    roleplay: any,
    persona: any,
    settings: any,
    history: { role: string; content: string }[],
  ): BaseMessage[] {
    const messages: BaseMessage[] = [
      new SystemMessage(buildPersonaSystemPrompt({ roleplay, persona, settings })),
    ];
    for (const m of history) {
      if (m.role === "persona") messages.push(new AIMessage(m.content));
      else if (m.role === "learner") messages.push(new HumanMessage(m.content));
    }
    return messages;
  }

  /**
   * Persist the learner's message and stream the persona's reply over SSE.
   * Returns immediately is the caller's responsibility; this runs the streaming.
   */
  async runPersonaTurn(opts: {
    attemptId: number;
    roleplayId: number;
    userId: number;
    learnerText: string;
    runId: number;
  }): Promise<void> {
    const { attemptId, roleplayId, learnerText, runId } = opts;
    const turnStart = Date.now();
    try {
      const { roleplay, settings, persona } = await this.loadConversationContext(
        roleplayId,
      );

      // Persist learner message
      const [attempt] = await db
        .select()
        .from(roleplayAttempts)
        .where(eq(roleplayAttempts.id, attemptId))
        .limit(1);
      if (!attempt) throw new Error("Attempt not found");

      const models = await this.resolveAttemptModels(attempt, roleplayId);
      const newTurnNumber = (attempt?.turnCount ?? 0) + 1;
      await db.insert(roleplayMessages).values({
        attemptId,
        role: "learner",
        content: learnerText,
        turnNumber: newTurnNumber,
      });
      await db
        .update(roleplayAttempts)
        .set({ turnCount: newTurnNumber })
        .where(eq(roleplayAttempts.id, attemptId));

      const cheatDirective = isCheatModeEnabled()
        ? extractCheatDirective(learnerText)
        : null;
      if (cheatDirective) {
        await db.insert(roleplayMessages).values({
          attemptId,
          role: "ended",
          content: "Cheat mode — submitting for grading…",
          turnNumber: newTurnNumber,
        });
        emitRoleplayEvent(runId, { type: "ended", reason: "cheat_mode" });
        emitRoleplayEvent(runId, { type: "done", runId, aiEnded: true });
        log.warn("CHEAT MODE — ending conversation from learner message", {
          attemptId,
          roleplayId,
          directivePreview: cheatDirective.slice(0, 120),
        });
        return;
      }

      // Build context from full history
      const history = await this.getAttemptMessages(attemptId);
      const model = await createRoleplayChatModel({
        provider: models.persona.provider,
        model: models.persona.model,
        temperature: 0.8,
      });
      const modelMessages = this.buildModelMessages(
        roleplay,
        persona,
        settings,
        history.map((h) => ({ role: h.role, content: h.content })),
      );

      emitRoleplayEvent(runId, { type: "status", status: "thinking" });

      // The end sentinel may be split across streaming chunks, so emitting each
      // delta verbatim (or stripping per-delta) can leak a partial sentinel to the
      // learner. We hold back a tail long enough to contain any sentinel variant
      // and only emit text that is guaranteed not to be part of one.
      const SENTINEL_HOLDBACK = AI_END_SENTINEL.length + 8;
      let full = "";
      let emitted = 0;
      const stream = await model.stream(modelMessages);
      for await (const chunk of stream as any) {
        const delta = chunkText(chunk?.content);
        if (!delta) continue;
        full += delta;
        const safeEnd = full.length - SENTINEL_HOLDBACK;
        if (safeEnd > emitted) {
          const content = stripEndSentinel(full.slice(emitted, safeEnd));
          emitted = safeEnd;
          if (content) emitRoleplayEvent(runId, { type: "token", content });
        }
      }
      // Flush whatever remained in the holdback window, sentinel removed.
      if (emitted < full.length) {
        const content = stripEndSentinel(full.slice(emitted));
        if (content) emitRoleplayEvent(runId, { type: "token", content });
      }

      const aiEnded = settings?.allowAiEnd ? hasEndSentinel(full) : false;
      const personaText = stripEndSentinel(full).trim();

      await db.insert(roleplayMessages).values({
        attemptId,
        role: "persona",
        content: personaText || "...",
        turnNumber: newTurnNumber,
      });

      // Live coaching hint (non-streamed)
      if (settings?.liveCoaching) {
        try {
          const transcript: TranscriptTurn[] = [...history, {
            role: "persona",
            content: personaText,
          } as any].map((h: any) => ({
            role: h.role === "persona" ? "persona" : "learner",
            content: h.content,
          }));
          const hint = await generateLiveHint(model, {
            learnerObjective: roleplay.learnerObjective,
            playbook: roleplay.playbook,
            transcript,
            personaName: persona?.name,
            learnerRole: roleplay.learnerRole,
          });
          if (hint) emitRoleplayEvent(runId, { type: "coach", content: hint });
        } catch (err) {
          log.warn("Live coaching hint failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // End conditions
      let endReason: string | null = null;
      if (aiEnded) endReason = "ai_ended";
      else if (
        settings?.autoEndOnMaxTurns &&
        settings?.maxTurns &&
        newTurnNumber >= settings.maxTurns
      ) {
        endReason = "max_turns";
      }
      if (endReason) emitRoleplayEvent(runId, { type: "ended", reason: endReason });

      emitRoleplayEvent(runId, { type: "done", runId, aiEnded: !!endReason });

      log.debug("Roleplay persona turn completed", {
        attemptId,
        runId,
        roleplayId,
        turnNumber: newTurnNumber,
        durationMs: Date.now() - turnStart,
        aiEnded: !!endReason,
        endReason,
      });
    } catch (error) {
      const message =
        error instanceof RoleplayNotConfiguredError
          ? error.message
          : "The persona could not respond. Please try again.";
      log.error(
        "Roleplay persona turn failed",
        error instanceof Error ? error : new Error(String(error)),
        { attemptId, runId, durationMs: Date.now() - turnStart },
      );
      emitRoleplayEvent(runId, { type: "error", message });
    }
  }

  /** Grade the attempt transcript and award rewards. */
  async submitAttempt(attemptId: number, userId: number, endReason = "manual") {
    const gradeStart = Date.now();
    const [attempt] = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(eq(roleplayAttempts.id, attemptId), eq(roleplayAttempts.userId, userId)),
      )
      .limit(1);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.status === "completed") {
      return this.getResults(attemptId, userId);
    }

    const roleplayId = attempt.roleplayId;

    const [roleplay] = await db
      .select()
      .from(roleplays)
      .where(eq(roleplays.id, roleplayId))
      .limit(1);
    const [persona] = await db
      .select()
      .from(roleplayPersonas)
      .where(eq(roleplayPersonas.roleplayId, roleplayId))
      .limit(1);
    const [settings] = await db
      .select()
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);
    const criteria = await db
      .select()
      .from(roleplayCriteria)
      .where(eq(roleplayCriteria.roleplayId, roleplayId))
      .orderBy(roleplayCriteria.orderIndex);
    const messages = await this.getAttemptMessages(attemptId);

    const transcript: TranscriptTurn[] = messages
      .filter((m) => m.role === "persona" || m.role === "learner")
      .map((m) => ({
        role: m.role === "persona" ? "persona" : "learner",
        content: m.content,
      }));

    const completedAt = new Date();
    const timeSpent = Math.max(
      0,
      Math.round((completedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000),
    );

    let overallScore = 0;
    let gradingStatus = "auto_graded";
    let overallFeedback = "";

    if (criteria.length > 0) {
      try {
        const models = await this.resolveAttemptModels(attempt, roleplayId);
        const model = await createRoleplayChatModel({
          provider: models.grader.provider,
          model: models.grader.model,
          temperature: 0.2,
        });
        const criterionInputs: GradingCriterionInput[] = criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          weight: parseFloat(String(c.weight)) || 1,
          maxScore: c.maxScore,
        }));

        const cheatDirective = isCheatModeEnabled()
          ? findCheatDirectiveInMessages(messages)
          : null;
        if (cheatDirective) {
          log.warn("CHEAT MODE grading — using learner message directive", {
            attemptId,
            roleplayId,
            directivePreview: cheatDirective.slice(0, 120),
          });
        }

        const result = await gradeTranscript(model, {
          roleplayTitle: roleplay?.title ?? "Roleplay",
          learnerRole: roleplay?.learnerRole,
          learnerObjective: roleplay?.learnerObjective,
          situationContext: roleplay?.situationContext,
          playbook: roleplay?.playbook,
          personaName: persona?.name,
          criteria: criterionInputs,
          transcript,
          cheatDirective,
        });

        overallFeedback = result.overallFeedback;
        overallScore = computeWeightedPercent(
          criterionInputs,
          result.criteria.map((c) => ({ criterionId: c.criterionId, score: c.score })),
        );

        // Persist per-criterion scores
        for (const cs of result.criteria) {
          const crit = criteria.find((c) => c.id === cs.criterionId);
          if (!crit) continue;
          await db.insert(roleplayCriterionScores).values({
            attemptId,
            criterionId: cs.criterionId,
            score: String(Math.max(0, Math.min(crit.maxScore, cs.score))),
            maxScore: crit.maxScore,
            feedback: cs.feedback,
            strengths: cs.strengths,
            improvements: cs.improvements,
          });
        }
      } catch (error) {
        log.error(
          "Roleplay grading failed",
          error instanceof Error ? error : new Error(String(error)),
          { attemptId },
        );
        gradingStatus = "failed";
        overallFeedback =
          "Automatic grading could not be completed. An administrator can review this attempt.";
      }
    }

    const passThreshold = settings?.passThreshold ?? 70;
    const isPassed = gradingStatus === "auto_graded" ? overallScore >= passThreshold : null;

    await db
      .update(roleplayAttempts)
      .set({
        status: "completed",
        completedAt,
        timeSpent,
        endReason,
        score: gradingStatus === "failed" ? null : String(overallScore),
        isPassed,
        gradingStatus,
        gradedAt: completedAt,
        overallFeedback,
      })
      .where(eq(roleplayAttempts.id, attemptId));

    log.info("Roleplay attempt graded", {
      attemptId,
      roleplayId,
      userId,
      overallScore,
      isPassed,
      gradingStatus,
      endReason,
      durationMs: Date.now() - gradeStart,
    });

    // Always log the completion (streaks / last-active); award points only when auto-graded.
    const pointsAward = await gamification.recordResult({
      userId,
      contentType: SCENARIO_CONTENT_TYPE,
      contentId: roleplayId,
      activityId: attemptId,
      scorePercent: gradingStatus === "auto_graded" ? overallScore : null,
      passed: isPassed,
      occurredAt: completedAt,
      eligibleForAward: gradingStatus === "auto_graded",
    });

    const results = await this.getResults(attemptId, userId);
    if (!results) return null;

    return {
      ...results,
      pointsAwarded: pointsAward?.pointsAwarded ?? 0,
      tierName: pointsAward?.tierName ?? null,
      totalPoints: pointsAward?.totalPoints ?? null,
    };
  }

  async getResults(attemptId: number, userId: number) {
    const [attempt] = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(eq(roleplayAttempts.id, attemptId), eq(roleplayAttempts.userId, userId)),
      )
      .limit(1);
    if (!attempt) return null;

    const criterionScores = await db
      .select({
        id: roleplayCriterionScores.id,
        criterionId: roleplayCriterionScores.criterionId,
        score: roleplayCriterionScores.score,
        maxScore: roleplayCriterionScores.maxScore,
        feedback: roleplayCriterionScores.feedback,
        strengths: roleplayCriterionScores.strengths,
        improvements: roleplayCriterionScores.improvements,
        manualScore: roleplayCriterionScores.manualScore,
        criterionName: roleplayCriteria.name,
        criterionWeight: roleplayCriteria.weight,
      })
      .from(roleplayCriterionScores)
      .leftJoin(
        roleplayCriteria,
        eq(roleplayCriterionScores.criterionId, roleplayCriteria.id),
      )
      .where(eq(roleplayCriterionScores.attemptId, attemptId));

    const messages = await this.getAttemptMessages(attemptId);

    const pointsForAttempt = await gamification.getPointsForActivity(attemptId);
    const resultsContext = await scenarioResultsController.getResultsContext(
      attempt,
      userId,
      criterionScores,
    );

    return {
      attempt,
      criterionScores,
      messages,
      pointsAwarded: pointsForAttempt?.amount ?? 0,
      tierName: pointsForAttempt?.tierName ?? null,
      ...resultsContext,
    };
  }

  // ===================== Admin / grading =====================

  async getAllAttempts(roleplayId: number) {
    return db
      .select({
        id: roleplayAttempts.id,
        userId: roleplayAttempts.userId,
        attemptNumber: roleplayAttempts.attemptNumber,
        score: roleplayAttempts.score,
        status: roleplayAttempts.status,
        isPassed: roleplayAttempts.isPassed,
        gradingStatus: roleplayAttempts.gradingStatus,
        turnCount: roleplayAttempts.turnCount,
        startedAt: roleplayAttempts.startedAt,
        completedAt: roleplayAttempts.completedAt,
        timeSpent: roleplayAttempts.timeSpent,
        userName: users.firstName,
        email: users.email,
      })
      .from(roleplayAttempts)
      .leftJoin(users, eq(roleplayAttempts.userId, users.id))
      .where(eq(roleplayAttempts.roleplayId, roleplayId))
      .orderBy(desc(roleplayAttempts.startedAt));
  }

  /** Admin override of a single criterion score; recomputes the attempt overall. */
  async overrideCriterionScore(
    criterionScoreId: number,
    graderId: number,
    score: number,
    feedback?: string,
  ) {
    const [updated] = await db
      .update(roleplayCriterionScores)
      .set({
        manualScore: String(score),
        score: String(score),
        feedback: feedback ?? undefined,
        gradedBy: graderId,
        gradedAt: new Date(),
      })
      .where(eq(roleplayCriterionScores.id, criterionScoreId))
      .returning();
    if (!updated) throw new Error("Criterion score not found");

    // Recompute overall for the attempt
    const scores = await db
      .select()
      .from(roleplayCriterionScores)
      .where(eq(roleplayCriterionScores.attemptId, updated.attemptId!));
    const criteria = await db
      .select()
      .from(roleplayCriteria);
    const inputs: GradingCriterionInput[] = scores
      .map((s) => {
        const crit = criteria.find((c) => c.id === s.criterionId);
        return crit
          ? {
              id: crit.id,
              name: crit.name,
              weight: parseFloat(String(crit.weight)) || 1,
              maxScore: crit.maxScore,
            }
          : null;
      })
      .filter((x): x is GradingCriterionInput => x != null);
    const overall = computeWeightedPercent(
      inputs,
      scores.map((s) => ({
        criterionId: s.criterionId!,
        score: parseFloat(String(s.manualScore ?? s.score)) || 0,
      })),
    );

    const [attempt] = await db
      .select()
      .from(roleplayAttempts)
      .where(eq(roleplayAttempts.id, updated.attemptId!))
      .limit(1);
    const [settings] = attempt
      ? await db
          .select()
          .from(roleplaySettings)
          .where(eq(roleplaySettings.roleplayId, attempt.roleplayId))
          .limit(1)
      : [undefined];
    const passThreshold = settings?.passThreshold ?? 70;
    const isPassed = overall >= passThreshold;

    await db
      .update(roleplayAttempts)
      .set({
        score: String(overall),
        isPassed,
        gradingStatus: "graded",
        gradedAt: new Date(),
      })
      .where(eq(roleplayAttempts.id, updated.attemptId!));

    // Reflect the manual re-grade in the activity log so stats/star-map read the
    // corrected score. Does NOT award points — manual grades never have.
    if (attempt) {
      await gamification.updateResult({
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: attempt.roleplayId,
        activityId: updated.attemptId!,
        scorePercent: overall,
        passed: isPassed,
      });
    }

    return { criterionScore: updated, overallScore: overall };
  }

  async getScenarioLeaderboard(
    roleplayId: number,
    currentUserId: number,
    limit = 3,
  ): Promise<{
    entries: Array<{ userId: number; name: string; bestScore: number; rank: number }>;
    currentUser: { userId: number; name: string; bestScore: number; rank: number } | null;
  }> {
    const safeLimit = Math.min(50, Math.max(1, limit));

    const rows = await db
      .select({
        userId: roleplayAttempts.userId,
        bestScore: sql<number>`MAX(CAST(${roleplayAttempts.score} AS numeric))`,
        firstName: users.firstName,
        email: users.email,
      })
      .from(roleplayAttempts)
      .innerJoin(users, eq(roleplayAttempts.userId, users.id))
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.status, "completed"),
        ),
      )
      .groupBy(roleplayAttempts.userId, users.firstName, users.email)
      .orderBy(desc(sql`MAX(CAST(${roleplayAttempts.score} AS numeric))`));

    const ranked = rows.map((row, index) => ({
      userId: row.userId,
      name: row.firstName?.trim() || row.email,
      bestScore: Number(row.bestScore),
      rank: index + 1,
    }));

    const entries = ranked.slice(0, safeLimit);

    const currentRow = ranked.find((r) => r.userId === currentUserId) ?? null;

    return {
      entries,
      currentUser: currentRow,
    };
  }
}

export const roleplaySystemController = new RoleplaySystemController();
