import { useCallback, useRef } from "react";

export type RoleplaySseEvent =
  | { type: "status"; status: string }
  | { type: "token"; content: string }
  | { type: "coach"; content: string }
  | { type: "ended"; reason: string }
  | { type: "done"; runId: number; aiEnded: boolean }
  | { type: "error"; message: string };

export function useRoleplayStream() {
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const streamRun = useCallback(
    async (
      roleplayId: number,
      runId: number,
      onEvent: (event: RoleplaySseEvent) => void,
    ): Promise<void> => {
      stop();
      const controller = new AbortController();
      abortRef.current = controller;

      const token = localStorage.getItem("auth_token");
      if (!token) {
        onEvent({ type: "error", message: "Not authenticated" });
        return;
      }

      const url = `/api/roleplays/${roleplayId}/stream/${runId}`;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          onEvent({ type: "error", message: `Stream failed (${response.status})` });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as RoleplaySseEvent;
              onEvent(event);
              if (event.type === "done" || event.type === "error") return;
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onEvent({
          type: "error",
          message: error instanceof Error ? error.message : "Stream error",
        });
      }
    },
    [stop],
  );

  return { streamRun, stop };
}
