import { verifyWebhook } from "./webhook";
import { isTerminal, type VideoStatus } from "./videoStatus";

/**
 * Orchestration for `POST /api/webhooks/stream`: verify the signature, and on a
 * `ready` event for a non-terminal video, mark it ready and enqueue the AI job.
 * Idempotent — re-deliveries, unknown UIDs, and non-ready states are acked as
 * no-ops. Side effects injected for testing. See ../../docs/share-loop-spec.md.
 */

export interface StreamWebhookDeps {
  secret: string;
  toleranceSeconds?: number;
  now?: number;
  findVideoByStreamUid: (uid: string) => Promise<{ id: string; status: VideoStatus } | null>;
  markReady: (id: string, info: { durationSeconds?: number; thumbnail?: string }) => Promise<void>;
  enqueueAiJob: (id: string) => Promise<void>;
}

export interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleStreamWebhook(
  deps: StreamWebhookDeps,
  req: { header: string; body: string }
): Promise<HttpResult> {
  const verification = verifyWebhook({
    header: req.header,
    body: req.body,
    secret: deps.secret,
    now: deps.now,
    toleranceSeconds: deps.toleranceSeconds,
  });
  if (!verification.valid) {
    return { status: 401, body: { error: verification.reason ?? "invalid signature" } };
  }

  let payload: any;
  try {
    payload = JSON.parse(req.body);
  } catch {
    return { status: 400, body: { error: "invalid JSON" } };
  }

  const uid = payload?.uid;
  if (typeof uid !== "string") {
    return { status: 400, body: { error: "missing uid" } };
  }

  // Only the "ready" event matters; ack everything else.
  if (payload?.status?.state !== "ready") {
    return { status: 200, body: { ignored: true } };
  }

  const video = await deps.findVideoByStreamUid(uid);
  if (!video || isTerminal(video.status)) {
    return { status: 200, body: { ignored: true } };
  }

  await deps.markReady(video.id, {
    durationSeconds: typeof payload.duration === "number" ? payload.duration : undefined,
    thumbnail: typeof payload.thumbnail === "string" ? payload.thumbnail : undefined,
  });
  await deps.enqueueAiJob(video.id);

  return { status: 200, body: { ok: true } };
}
