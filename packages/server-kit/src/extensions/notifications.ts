import { createLogger } from "../logger.ts";

const log = createLogger("notifications");

/**
 * Extension seam for outbound notifications. Scenarios sends no email today
 * (no invites, password-reset, or 2FA delivery exist) — this ships the seam
 * only, ready for a Phase 6 SES (or similar) transport. Not a gap Phase 3
 * created; see docs/phase-3-implementation.md.
 */
export interface NotificationTransport {
  send(input: {
    to: string;
    channel: "email";
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

/** OSS default: logs instead of sending, so a misconfigured transport is visible, not silent. */
export class LogNotificationTransport implements NotificationTransport {
  async send(input: {
    to: string;
    channel: "email";
    template: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    log.info("notification (not sent — no transport configured)", input);
  }
}

let currentTransport: NotificationTransport = new LogNotificationTransport();

export function setNotificationTransport(transport: NotificationTransport): void {
  currentTransport = transport;
}

export function getNotificationTransport(): NotificationTransport {
  return currentTransport;
}
