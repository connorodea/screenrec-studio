import type { buildDeepgramRequest } from "./deepgramRequest";

/**
 * The live Deepgram client — the real `callDeepgram` dependency that
 * `runAiPipeline` injects. The pipeline builds the request (via
 * `buildDeepgramRequest`, which already embeds the `Token` auth + JSON body), so
 * this is a pure executor: run it through the injected `fetch` and return the
 * parsed JSON for `deepgramToSegments`. `fetch` is injected so it's unit-testable
 * against fake responses with no API key. Throws on non-2xx, which the pipeline
 * catches and turns into `markFailed`. See ../../docs/share-loop-spec.md.
 */

export interface DeepgramFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type DeepgramFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<DeepgramFetchResponse>;

export async function runDeepgramRequest(
  fetch: DeepgramFetch,
  req: ReturnType<typeof buildDeepgramRequest>
): Promise<unknown> {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Deepgram transcription failed (${res.status})${body ? `: ${body}` : ""}`);
  }

  return res.json();
}
