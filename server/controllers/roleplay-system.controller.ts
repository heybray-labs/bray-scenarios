import { db } from "../db.ts";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
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
  type Roleplay,
} from "../../shared/schemas/roleplay-core.ts";
import { users } from "../../shared/schemas/users.ts";
import { createLogger } from "../utils/logger.ts";
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
import { generateLiveHint } from "../roleplay/coaching.ts";
import { emitRoleplayEvent } from "../roleplay/roleplay-events.ts";

const log = createLogger("roleplay");

export interface BulkRoleplayPayload {
  roleplay: Partial<Roleplay> & Record<string, unknown>;
  settings?: Record<string, unknown>;
  persona?: Record<string, unknown>;
  criteria?: Array<Record<string, unknown>>;
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

  async getRoleplays(tenantId: number): Promise<Roleplay[]> {
    return db
      .select()
      .from(roleplays)
      .where(eq(roleplays.tenantId, tenantId))
      .orderBy(desc(roleplays.createdAt));
  }

  async getRoleplayById(roleplayId: number, tenantId: number) {
    const [roleplay] = await db
      .select()
      .from(roleplays)
      .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
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
    return { ...roleplay, settings, persona, criteria };
  }

  async bulkSaveRoleplay(
    roleplayId: number | null,
    tenantId: number,
    userId: number,
    payload: BulkRoleplayPayload,
  ): Promise<Roleplay> {
    if (payload.settings) {
      await roleplayConfigService.validateRoleplayModelSettings(
        tenantId,
        payload.settings,
      );
    }

    return db.transaction(async (tx) => {
      // Strip server-owned fields from client payload
      const {
        id: _id,
        tenantId: _tenantId,
        createdBy: _createdBy,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...safeRoleplay
      } = (payload.roleplay ?? {}) as Record<string, unknown>;

      // Keep the published boolean in sync with status so the intro page gate is consistent
      if (typeof (safeRoleplay as any).status === "string") {
        (safeRoleplay as any).published = (safeRoleplay as any).status === "published";
      }

      let saved: Roleplay;
      if (roleplayId) {
        const [updated] = await tx
          .update(roleplays)
          .set({ ...(safeRoleplay as any), updatedAt: new Date() })
          .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
          .returning();
        saved = updated;
      } else {
        const [created] = await tx
          .insert(roleplays)
          .values({
            ...(safeRoleplay as any),
            tenantId,
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
            tenantId,
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

      return saved;
    });
  }

  async deleteRoleplay(roleplayId: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(roleplays)
      .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  async publishRoleplay(roleplayId: number, tenantId: number) {
    const [updated] = await db
      .update(roleplays)
      .set({ status: "published", published: true, updatedAt: new Date() })
      .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  async unpublishRoleplay(roleplayId: number, tenantId: number) {
    const [updated] = await db
      .update(roleplays)
      .set({ status: "draft", published: false, updatedAt: new Date() })
      .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  async getRoleplayStats(roleplayId: number, tenantId: number) {
    const attempts = await db
      .select()
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.tenantId, tenantId),
        ),
      );
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

  private async loadConversationContext(roleplayId: number, tenantId: number) {
    const [roleplay] = await db
      .select()
      .from(roleplays)
      .where(and(eq(roleplays.id, roleplayId), eq(roleplays.tenantId, tenantId)))
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

  async getUserBestAttemptsByRoleplay(tenantId: number, userId: number) {
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
          eq(roleplayAttempts.tenantId, tenantId),
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

  /** Resolve persona/grader models from attempt snapshot or live roleplay config. */
  private async resolveAttemptModels(
    attempt: typeof roleplayAttempts.$inferSelect,
    tenantId: number,
    roleplayId: number,
  ): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef }> {
    const snapshot = await roleplayConfigService.resolveModelsFromAttemptSnapshot(
      attempt,
    );
    if (snapshot) return snapshot;
    return roleplayConfigService.resolveModelsForRoleplay(roleplayId, tenantId);
  }

  /** Start a new attempt: enforces maxAttempts, generates the persona's opening message. */
  async startAttempt(roleplayId: number, userId: number, tenantId: number) {
    const { roleplay, settings, persona } = await this.loadConversationContext(
      roleplayId,
      tenantId,
    );

    const models = await roleplayConfigService.resolveModelsForRoleplay(
      roleplayId,
      tenantId,
    );

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
        tenantId,
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
      const model = await createRoleplayChatModel(tenantId, {
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
        tenantId,
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
        { roleplayId, userId, tenantId },
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
    tenantId: number;
    userId: number;
    learnerText: string;
    runId: number;
  }): Promise<void> {
    const { attemptId, roleplayId, tenantId, learnerText, runId } = opts;
    const turnStart = Date.now();
    try {
      const { roleplay, settings, persona } = await this.loadConversationContext(
        roleplayId,
        tenantId,
      );

      // Persist learner message
      const [attempt] = await db
        .select()
        .from(roleplayAttempts)
        .where(eq(roleplayAttempts.id, attemptId))
        .limit(1);
      if (!attempt) throw new Error("Attempt not found");

      const models = await this.resolveAttemptModels(attempt, tenantId, roleplayId);
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

      // Build context from full history
      const history = await this.getAttemptMessages(attemptId);
      const model = await createRoleplayChatModel(tenantId, {
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

    const tenantId = attempt.tenantId;
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
        const models = await this.resolveAttemptModels(attempt, tenantId, roleplayId);
        const model = await createRoleplayChatModel(tenantId, {
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
        const result = await gradeTranscript(model, {
          roleplayTitle: roleplay?.title ?? "Roleplay",
          learnerRole: roleplay?.learnerRole,
          learnerObjective: roleplay?.learnerObjective,
          situationContext: roleplay?.situationContext,
          playbook: roleplay?.playbook,
          personaName: persona?.name,
          criteria: criterionInputs,
          transcript,
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
      tenantId,
      overallScore,
      isPassed,
      gradingStatus,
      endReason,
      durationMs: Date.now() - gradeStart,
    });

    return this.getResults(attemptId, userId);
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

    return { attempt, criterionScores, messages };
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

    await db
      .update(roleplayAttempts)
      .set({
        score: String(overall),
        isPassed: overall >= passThreshold,
        gradingStatus: "graded",
        gradedAt: new Date(),
      })
      .where(eq(roleplayAttempts.id, updated.attemptId!));

    return { criterionScore: updated, overallScore: overall };
  }
}

export const roleplaySystemController = new RoleplaySystemController();
