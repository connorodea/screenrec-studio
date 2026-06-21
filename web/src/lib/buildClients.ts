import type { AppConfig } from "./config";
import type { CreateUploadDeps } from "./createUpload";
import type { AiPipelineDeps } from "./aiPipeline";
import type { MessagesCreate } from "./claudeClient";
import { createDirectUpload } from "./streamClient";
import { runDeepgramRequest } from "./deepgramClient";
import { runClaudeRequest } from "./claudeClient";
import { withRetry } from "./withRetry";
import { isTransientHttpError } from "./httpError";

/**
 * Assembles the network-boundary deps (the DB-independent half of the route deps)
 * from validated config: each live client wrapped in withRetry + isTransientHttpError
 * so transient 5xx/429/network blips are retried and permanent 4xx fail fast. The
 * route layer calls this once with the global `fetch` + `new Anthropic({apiKey}).messages.create`;
 * the DB-backed deps (insert/find/markReady/persist...) are assembled separately by
 * the data layer. Unit-testable with a fake fetch/create. See ../../docs/share-loop-spec.md.
 */

/** One fetch shape both the Stream (no body) and Deepgram (body) clients accept,
 *  satisfied by the global `fetch` and by test fakes. */
export type ClientFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface ClientIO {
  fetch: ClientFetch;
  anthropicCreate: MessagesCreate;
  /** Override retry behaviour (mainly to inject `sleep` in tests). */
  retry?: { retries?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> };
}

export interface AssembledClients {
  createStreamUpload: CreateUploadDeps["createStreamUpload"];
  callDeepgram: AiPipelineDeps["callDeepgram"];
  callClaude: AiPipelineDeps["callClaude"];
}

export function buildClients(config: AppConfig, io: ClientIO): AssembledClients {
  const retryOpts = { isRetryable: isTransientHttpError, ...io.retry };

  return {
    createStreamUpload: (params) =>
      withRetry(
        () =>
          createDirectUpload(
            { fetch: io.fetch, accountId: config.cloudflareAccountId, apiToken: config.cloudflareApiToken },
            params
          ),
        retryOpts
      ),
    callDeepgram: (req) => withRetry(() => runDeepgramRequest(io.fetch, req), retryOpts),
    callClaude: (req) => withRetry(() => runClaudeRequest(io.anthropicCreate, req), retryOpts),
  };
}
