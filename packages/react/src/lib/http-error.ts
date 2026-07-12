export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message || `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
