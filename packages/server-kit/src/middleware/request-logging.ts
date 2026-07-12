import type { Request, Response, NextFunction } from "express";
import { createLogger, generateRequestId } from "../logger.ts";

const log = createLogger("http");

/**
 * Minimal request shape read by the logger. The identity package augments the
 * request with the full authenticated user; server-kit only needs the id.
 */
interface LoggableRequest extends Request {
  requestId?: string;
  user?: { id?: number | string };
}

const SKIP_PATHS = new Set(["/api/health"]);

export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  (req as LoggableRequest).requestId = requestId;

  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const authReq = req as LoggableRequest;
    const meta: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      requestId,
    };

    if (authReq.user?.id) meta.userId = authReq.user.id;

    const message = `${req.method} ${req.path} ${res.statusCode}`;

    if (res.statusCode >= 500) {
      log.error(message, meta);
    } else if (res.statusCode >= 400) {
      log.warn(message, meta);
    } else {
      log.info(message, meta);
    }
  });

  next();
}
