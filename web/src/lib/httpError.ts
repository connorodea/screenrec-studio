/**
 * A typed error for non-2xx responses from the network-boundary clients, carrying
 * the HTTP `status` so retry logic can classify it. `isTransientHttpError` is the
 * predicate the route layer passes to `withRetry` — retry 429 / 5xx and fetch-level
 * network failures, fail fast on 4xx (auth, bad request) and unknown errors.
 * See ../../docs/share-loop-spec.md.
 */

export class HttpClientError extends Error {
  readonly service: string;
  readonly status: number;
  readonly body?: string;

  constructor(service: string, status: number, body?: string) {
    super(`${service} request failed (${status})${body ? `: ${body}` : ""}`);
    this.name = "HttpClientError";
    this.service = service;
    this.status = status;
    this.body = body;
    // Preserve instanceof across transpile targets.
    Object.setPrototypeOf(this, HttpClientError.prototype);
  }
}

export function isTransientHttpError(error: unknown): boolean {
  if (error instanceof HttpClientError) {
    return error.status === 429 || error.status >= 500;
  }
  // fetch() rejects with a TypeError on a network-level failure (no HTTP response).
  if (error instanceof TypeError) return true;
  return false;
}
