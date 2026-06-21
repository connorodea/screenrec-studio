/**
 * Retries a transient-failing async operation with exponential backoff. Intended
 * to wrap the network-boundary clients (Stream / Deepgram / Claude) so a blip
 * (5xx, 429, dropped connection) doesn't fail an entire recording. `sleep` is
 * injected so tests are deterministic and fast; `isRetryable` lets callers retry
 * only transient errors and fail fast on permanent ones (e.g. 4xx auth).
 * See ../../docs/share-loop-spec.md.
 */

export interface RetryOptions {
  /** Additional attempts after the first (default 2 → 3 attempts total). */
  retries?: number;
  /** Base backoff in ms; attempt N waits `baseDelayMs * 2**N` (default 200). */
  baseDelayMs?: number;
  /** Return false to stop retrying a given error immediately (default: retry all). */
  isRetryable?: (error: unknown) => boolean;
  /** Injected for tests; defaults to real `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Observability hook fired before each retry sleep. */
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const isRetryable = options.isRetryable ?? (() => true);
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) break;
      options.onRetry?.(attempt + 1, error);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
