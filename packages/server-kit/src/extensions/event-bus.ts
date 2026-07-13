import { EventEmitter } from "node:events";

/**
 * Platform-wide event catalog. Extension points (AuditSink, future
 * NotificationTransport wiring, enterprise packages) subscribe to these
 * instead of each call site needing its own ad-hoc hook.
 */
export interface PlatformEvents {
  "auth.login.succeeded": { userId: number };
  "auth.login.failed": { email?: string; reason: string };
  "user.password.changed": { userId: number };
  "user.role.changed": {
    actorId: number;
    targetUserId: number;
    previousRole: string;
    newRole: string;
  };
  "llm.provider.key.changed": {
    actorId: number;
    provider: string;
    action: "upserted" | "removed";
  };
  "llm.allowlist.changed": { actorId: number };
  "content.published": { contentType: string; contentId: number; actorId?: number };
  "content.unpublished": { contentType: string; contentId: number; actorId?: number };
  "content.deleted": { contentType: string; contentId: number; actorId?: number };
  "activity.recorded": { userId: number; contentType: string; contentId: number };
  "points.awarded": {
    userId: number;
    contentType: string;
    contentId: number;
    points: number;
    tierName: string;
  };
}

type PlatformEventName = keyof PlatformEvents;

/** Thin, typed wrapper over `node:events` — no external dependency required. */
class TypedEventEmitter<TEvents extends object> {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Extension points (AuditSink, etc.) may add several listeners per event.
    this.emitter.setMaxListeners(50);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.emitter.emit(event as string, payload);
  }

  on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void {
    this.emitter.on(event as string, listener);
  }

  off<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void {
    this.emitter.off(event as string, listener);
  }

  once<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void {
    this.emitter.once(event as string, listener);
  }
}

export const eventBus = new TypedEventEmitter<PlatformEvents>();

export type { PlatformEventName };
