import type { VideoStatus } from "./videoStatus";

/**
 * Orchestration for `POST /api/uploads/:id/complete` — the client calls this once
 * its tus upload to Cloudflare finishes, which is what owns the
 * `awaiting_upload -> processing` transition. (The Stream `ready` webhook only
 * drives `processing -> ready`, so without this step `processing` had no setter.)
 * Idempotent: a retry or a video that has already advanced is a 200 no-op, so the
 * client can safely re-send. Side effects injected for testing; the route file
 * wires in the real DB implementations. See ../../docs/share-loop-spec.md.
 */

export interface UploadCompleteDeps {
  findVideoById: (id: string) => Promise<{ id: string; status: VideoStatus } | null>;
  markProcessing: (id: string) => Promise<void>;
}

export interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleUploadComplete(
  deps: UploadCompleteDeps,
  input: { videoId: string }
): Promise<HttpResult> {
  const video = await deps.findVideoById(input.videoId);
  if (!video) return { status: 404, body: { error: "not found" } };

  // Already past awaiting_upload (duplicate signal, or the ready webhook beat us):
  // acknowledge without re-transitioning so the client's retry is harmless.
  if (video.status !== "awaiting_upload") {
    return { status: 200, body: { status: video.status, alreadyAdvanced: true } };
  }

  await deps.markProcessing(input.videoId);
  return { status: 200, body: { status: "processing" } };
}
