import type { Response } from "express";

/** SSE event contract for a single roleplay turn run. Kept in sync with client use-roleplay-stream.ts */
export type RoleplaySseEvent =
  | { type: "status"; status: string }
  | { type: "token"; content: string }
  | { type: "coach"; content: string }
  | { type: "ended"; reason: string }
  | { type: "done"; runId: number; aiEnded: boolean }
  | { type: "error"; message: string };

type Subscriber = { res: Response };

const subscribers = new Map<number, Set<Subscriber>>();
const eventBuffers = new Map<number, RoleplaySseEvent[]>();
const MAX_BUFFER_EVENTS = 500;

let runCounter = 1;
/** Generate a unique numeric run id for a roleplay turn stream. */
export function nextRoleplayRunId(): number {
  // Combine time + counter to stay unique across restarts within a process lifetime
  runCounter = (runCounter + 1) % 1_000_000;
  return Date.now() * 1_000_000 + runCounter;
}

function appendToBuffer(runId: number, event: RoleplaySseEvent) {
  if (!eventBuffers.has(runId)) eventBuffers.set(runId, []);
  const buf = eventBuffers.get(runId)!;
  buf.push(event);
  if (buf.length > MAX_BUFFER_EVENTS) buf.splice(0, buf.length - MAX_BUFFER_EVENTS);

  if (event.type === "done" || event.type === "error") {
    setTimeout(() => {
      if (!subscribers.has(runId) || subscribers.get(runId)!.size === 0) {
        eventBuffers.delete(runId);
      }
    }, 5 * 60 * 1000);
  }
}

function writeEvent(res: Response, event: RoleplaySseEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function getBufferedRoleplayEvents(runId: number): RoleplaySseEvent[] {
  return [...(eventBuffers.get(runId) ?? [])];
}

export function subscribeToRoleplayRun(runId: number, res: Response): () => void {
  for (const event of getBufferedRoleplayEvents(runId)) {
    writeEvent(res, event);
  }

  const sub: Subscriber = { res };
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId)!.add(sub);

  return () => {
    subscribers.get(runId)?.delete(sub);
    if (subscribers.get(runId)?.size === 0) subscribers.delete(runId);
  };
}

export function emitRoleplayEvent(runId: number, event: RoleplaySseEvent): void {
  appendToBuffer(runId, event);
  const subs = subscribers.get(runId);
  if (!subs?.size) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const sub of subs) {
    try {
      sub.res.write(payload);
    } catch {
      subs.delete(sub);
    }
  }
}

export function setupRoleplaySse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}
