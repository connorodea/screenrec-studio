import { buildStreamDirectUploadRequest } from "./streamUpload";

/**
 * The live Cloudflare Stream client — the real `createStreamUpload` dependency
 * that `createUpload` injects. It composes the pure `buildStreamDirectUploadRequest`
 * builder, calls the (injected) `fetch`, and reads the tus URL + video UID back
 * from the response headers Cloudflare sets (`Location` / `stream-media-id`).
 * `fetch` is injected so this is unit-testable against fake responses with no
 * account credentials; the route file passes the global `fetch` and the CO
 * account id + token. See ../../docs/share-loop-spec.md.
 */

export interface StreamFetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type StreamFetch = (
  url: string,
  init: { method: string; headers: Record<string, string> }
) => Promise<StreamFetchResponse>;

export interface StreamClientConfig {
  fetch: StreamFetch;
  accountId: string;
  apiToken: string;
}

export interface DirectUploadParams {
  uploadLength: number;
  name?: string;
  maxDurationSeconds?: number;
  requireSignedURLs?: boolean;
}

export async function createDirectUpload(
  config: StreamClientConfig,
  params: DirectUploadParams
): Promise<{ uid: string; uploadURL: string }> {
  const req = buildStreamDirectUploadRequest({
    accountId: config.accountId,
    apiToken: config.apiToken,
    uploadLength: params.uploadLength,
    name: params.name,
    maxDurationSeconds: params.maxDurationSeconds,
    requireSignedURLs: params.requireSignedURLs,
  });

  const res = await config.fetch(req.url, { method: req.method, headers: req.headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Cloudflare Stream direct-upload failed (${res.status})${body ? `: ${body}` : ""}`
    );
  }

  const uploadURL = res.headers.get("Location");
  const uid = res.headers.get("stream-media-id");
  if (!uploadURL || !uid) {
    throw new Error("Cloudflare Stream response missing Location / stream-media-id");
  }

  return { uid, uploadURL };
}
