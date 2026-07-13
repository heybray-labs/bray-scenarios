import { createLogger } from "../logger.ts";
import { eventBus, type PlatformEvents } from "./event-bus.ts";

const log = createLogger("audit");

export interface AuditEvent {
  actorId?: number;
  action: string;
  resourceType?: string;
  resourceId?: string | number;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
  at: Date;
}

export interface AuditSink {
  record(event: AuditEvent): void | Promise<void>;
}

/** OSS default: writes every audit event to the structured application log. */
export class LogAuditSink implements AuditSink {
  record(event: AuditEvent): void {
    log.info("audit", { ...event, at: event.at.toISOString() });
  }
}

let currentSink: AuditSink = new LogAuditSink();

export function setAuditSink(sink: AuditSink): void {
  currentSink = sink;
}

function record(event: Omit<AuditEvent, "at">): void {
  void currentSink.record({ ...event, at: new Date() });
}

const AUDITED_EVENTS = [
  "auth.login.succeeded",
  "auth.login.failed",
  "user.password.changed",
  "user.role.changed",
  "llm.provider.key.changed",
  "llm.allowlist.changed",
  "content.published",
  "content.unpublished",
  "content.deleted",
] as const satisfies ReadonlyArray<keyof PlatformEvents>;

let wired = false;

/**
 * Subscribes the current AuditSink to every auditable platform event. Safe to
 * call more than once (idempotent) — only the first call attaches listeners.
 */
export function wireAuditLogging(): void {
  if (wired) return;
  wired = true;

  eventBus.on("auth.login.succeeded", (payload) => {
    record({ actorId: payload.userId, action: "auth.login.succeeded", outcome: "success" });
  });

  eventBus.on("auth.login.failed", (payload) => {
    record({
      action: "auth.login.failed",
      outcome: "failure",
      metadata: { email: payload.email, reason: payload.reason },
    });
  });

  eventBus.on("user.password.changed", (payload) => {
    record({
      actorId: payload.userId,
      action: "user.password.changed",
      resourceType: "user",
      resourceId: payload.userId,
      outcome: "success",
    });
  });

  eventBus.on("user.role.changed", (payload) => {
    record({
      actorId: payload.actorId,
      action: "user.role.changed",
      resourceType: "user",
      resourceId: payload.targetUserId,
      outcome: "success",
      metadata: { previousRole: payload.previousRole, newRole: payload.newRole },
    });
  });

  eventBus.on("llm.provider.key.changed", (payload) => {
    record({
      actorId: payload.actorId,
      action: "llm.provider.key.changed",
      resourceType: "llm_provider_key",
      resourceId: payload.provider,
      outcome: "success",
      metadata: { changeType: payload.action },
    });
  });

  eventBus.on("llm.allowlist.changed", (payload) => {
    record({ actorId: payload.actorId, action: "llm.allowlist.changed", outcome: "success" });
  });

  eventBus.on("content.published", (payload) => {
    record({
      actorId: payload.actorId,
      action: "content.published",
      resourceType: payload.contentType,
      resourceId: payload.contentId,
      outcome: "success",
    });
  });

  eventBus.on("content.unpublished", (payload) => {
    record({
      actorId: payload.actorId,
      action: "content.unpublished",
      resourceType: payload.contentType,
      resourceId: payload.contentId,
      outcome: "success",
    });
  });

  eventBus.on("content.deleted", (payload) => {
    record({
      actorId: payload.actorId,
      action: "content.deleted",
      resourceType: payload.contentType,
      resourceId: payload.contentId,
      outcome: "success",
    });
  });
}
