export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
};

const MAX_STRING_LENGTH = 200;

function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel | undefined;
  if (envLevel && LOG_LEVEL_VALUES[envLevel] !== undefined) {
    return envLevel;
  }
  return "INFO";
}

function truncate(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Error) {
    return truncate(value.message);
  }
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}:${formatMetaValue(value)}`);
  return parts.length > 0 ? ` | ${parts.join(" ")}` : "";
}

function errorMeta(err: Error): Record<string, unknown> {
  return {
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack?.split("\n").slice(0, 3).join(" | "),
  };
}

class Logger {
  private readonly module?: string;
  private readonly configuredLevel: LogLevel;

  constructor(module?: string) {
    this.module = module;
    this.configuredLevel = getLogLevelFromEnv();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.configuredLevel];
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const moduleTag = this.module ?? (meta?.module as string | undefined);
    const { module: _module, ...restMeta } = meta ?? {};
    const modulePrefix = moduleTag ? `[${moduleTag}] ` : "";
    const line = `${timestamp} ${level} ${modulePrefix}${message}${formatMeta(restMeta)}`;

    switch (level) {
      case "ERROR":
        console.error(line);
        break;
      case "WARN":
        console.warn(line);
        break;
      case "DEBUG":
      case "TRACE":
        console.debug(line);
        break;
      default:
        console.log(line);
    }
  }

  trace(message: string, meta?: Record<string, unknown>): void {
    this.write("TRACE", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write("DEBUG", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("WARN", message, meta);
  }

  error(
    message: string,
    err?: Error | Record<string, unknown>,
    meta?: Record<string, unknown>,
  ): void {
    if (err instanceof Error) {
      this.write("ERROR", message, { ...meta, ...errorMeta(err) });
      return;
    }
    this.write("ERROR", message, { ...err, ...meta });
  }
}

export const logger = new Logger();

export function createLogger(module: string): Logger {
  return new Logger(module);
}

/** @deprecated Use `logger` or `createLogger()` */
export const platformLogger = logger;

export function logExternalCall(opts: {
  service: string;
  operation: string;
  durationMs: number;
  status?: number | string;
  meta?: Record<string, unknown>;
}): void {
  const level: LogLevel =
    typeof opts.status === "number" && opts.status >= 400 ? "WARN" : "DEBUG";
  logger[level === "WARN" ? "warn" : "debug"]("External API call", {
    module: "external",
    service: opts.service,
    operation: opts.operation,
    durationMs: opts.durationMs,
    status: opts.status,
    ...opts.meta,
  });
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
