import { describe, it, expect } from "vitest";
import { createUpload, type CreateUploadDeps } from "./createUpload";
import { handleStreamWebhook, type StreamWebhookDeps } from "./handleStreamWebhook";
import { runAiPipeline, type AiPipelineDeps } from "./aiPipeline";
import { handleWatch, handleVideoMetadata, type VideoReadDeps } from "./handleVideoRead";
import { handleUploadComplete, type UploadCompleteDeps } from "./handleUploadComplete";
import { cloudflareStreamUrls } from "./streamUrls";
import { computeSignature } from "./webhook";
import { transition } from "./videoStatus";
import type { ChapterMarker, TranscriptSegment, VideoRow } from "./watchViewModel";

/**
 * End-to-end integration of the share loop against ONE shared in-memory store,
 * exercising the real handlers in sequence: upload -> (upload completes) ->
 * Stream ready webhook -> AI pipeline -> watch. The point is to prove the data
 * model is consistent across every handler, and to pin two cross-handler contracts
 * the unit tests can't see:
 *   1. The data layer derives the HLS URL from the Stream uid at `markReady` time
 *      (the handlers only read `row.streamHls`).
 *   2. AI completion (`markComplete`/`markFailed`) is a SEPARATE axis from
 *      `VideoStatus` — `ready` is terminal, so AI state must not transition it.
 * `markReady` enforces the real `transition()` so an out-of-order wiring fails loud.
 */

const WEBHOOK_SECRET = "whsec_integration";
const WEBHOOK_TIME = "1700000000";
const CF_HOST = "customer-test.cloudflarestream.com";

interface StoredVideo extends VideoRow {
  id: string;
  streamUid: string;
  aiStatus: "pending" | "complete" | "failed";
}

function createStore() {
  const byId = new Map<string, StoredVideo>();
  const bySlug = new Map<string, string>();
  const byUid = new Map<string, string>();
  const aiQueue: string[] = [];
  let seq = 0;

  const get = (id: string): StoredVideo => {
    const v = byId.get(id);
    if (!v) throw new Error(`no video ${id}`);
    return v;
  };
  const hls = (uid: string) => cloudflareStreamUrls(CF_HOST, uid).hls;

  return {
    byId,
    aiQueue,
    hls,
    audioUrlFor: (id: string) => cloudflareStreamUrls(CF_HOST, get(id).streamUid).mp4Download,

    // --- createUpload deps ---
    insertVideo: async (row: { slug: string; streamUid: string; status: "awaiting_upload" }) => {
      const id = `vid-${++seq}`;
      byId.set(id, {
        id,
        slug: row.slug,
        streamUid: row.streamUid,
        status: row.status,
        title: null,
        summary: null,
        transcript: null,
        chapters: null,
        streamHls: null,
        thumbnail: null,
        aiStatus: "pending",
      });
      bySlug.set(row.slug, id);
      byUid.set(row.streamUid, id);
      return { id };
    },

    // Data-layer transition now driven by the real handleUploadComplete handler
    // (the owner of awaiting_upload -> processing).
    markProcessingById: async (id: string) => {
      const v = get(id);
      v.status = transition(v.status, "processing");
    },

    // --- handleStreamWebhook deps ---
    findVideoByStreamUid: async (uid: string) => {
      const id = byUid.get(uid);
      return id ? { id, status: get(id).status } : null;
    },
    markReady: async (id: string, info: { durationSeconds?: number; thumbnail?: string }) => {
      const v = get(id);
      v.status = transition(v.status, "ready"); // throws if not coming from `processing`
      v.thumbnail = info.thumbnail ?? null;
      v.streamHls = hls(v.streamUid); // data layer derives HLS from the uid
    },
    enqueueAiJob: async (id: string) => {
      aiQueue.push(id);
    },

    // --- runAiPipeline deps ---
    persistSummary: async (
      id: string,
      data: {
        title: string | null;
        summary: string | null;
        chapters: ChapterMarker[];
        transcript: TranscriptSegment[];
      }
    ) => {
      const v = get(id);
      v.title = data.title;
      v.summary = data.summary;
      v.chapters = data.chapters;
      v.transcript = data.transcript;
    },
    markComplete: async (id: string) => {
      get(id).aiStatus = "complete"; // NOT a VideoStatus transition
    },
    markFailed: async (id: string, _reason: string) => {
      get(id).aiStatus = "failed"; // NOT a VideoStatus transition; video stays `ready`
    },

    // --- handleVideoRead deps ---
    findVideoBySlug: async (slug: string) => {
      const id = bySlug.get(slug);
      return id ? ({ ...get(id) } as VideoRow) : null;
    },
    findVideoById: async (id: string): Promise<StoredVideo | null> =>
      byId.has(id) ? { ...get(id) } : null,
  };
}

const dgResponse = {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "hello this is the demo",
            paragraphs: {
              paragraphs: [
                {
                  sentences: [
                    { start: 0, text: "Hello." },
                    { start: 3.2, text: "This is the demo." },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  },
};
const claudeJson = JSON.stringify({
  title: "Product demo walkthrough",
  summary: "A short walkthrough of the product.",
  chapters: [{ start: 0, title: "Intro" }],
});

function signedWebhook(uid: string) {
  const body = JSON.stringify({
    uid,
    status: { state: "ready" },
    duration: 30,
    thumbnail: "https://cf/thumb.jpg",
  });
  return { header: `time=${WEBHOOK_TIME},sig1=${computeSignature(WEBHOOK_SECRET, WEBHOOK_TIME, body)}`, body };
}

describe("share loop (end-to-end, in-memory)", () => {
  it("carries one recording from upload through webhook + AI to a fully-rendered watch page", async () => {
    const store = createStore();
    const STREAM_UID = "uid-abc123";
    const watchBaseUrl = "https://share.example.com";

    const uploadDeps: CreateUploadDeps = {
      makeSlug: () => "demo42",
      createStreamUpload: async () => ({ uid: STREAM_UID, uploadURL: "https://up/tus" }),
      insertVideo: store.insertVideo,
      watchBaseUrl,
    };
    const webhookDeps: StreamWebhookDeps = {
      secret: WEBHOOK_SECRET,
      findVideoByStreamUid: store.findVideoByStreamUid,
      markReady: store.markReady,
      enqueueAiJob: store.enqueueAiJob,
    };
    const aiDeps: AiPipelineDeps = {
      deepgramApiKey: "dg-key",
      callDeepgram: async () => dgResponse,
      callClaude: async () => claudeJson,
      persistSummary: store.persistSummary,
      markComplete: store.markComplete,
      markFailed: store.markFailed,
    };
    const readDeps: VideoReadDeps = {
      findVideoBySlug: store.findVideoBySlug,
      findVideoById: store.findVideoById,
      watchBaseUrl,
    };

    // 1. Upload: client asks for a ticket.
    const upload = await createUpload(uploadDeps, {
      filename: "rec.mp4",
      durationSeconds: 30,
      sizeBytes: 4096,
    });
    expect(upload.status).toBe(201);
    const ticket = upload.body as { videoId: string; slug: string; watchUrl: string };
    expect(ticket.slug).toBe("demo42");
    expect(ticket.watchUrl).toBe("https://share.example.com/v/demo42");

    // Watch page exists but is bare — not ready, no playback, default title.
    const early = await handleWatch(readDeps, "demo42");
    expect(early.status).toBe(200);
    expect(early.body.title).toBe("Untitled recording");
    expect(early.body.playback).toBeNull();

    const pollAwaiting = await handleVideoMetadata(readDeps, ticket.videoId);
    expect(pollAwaiting.body.status).toBe("awaiting_upload");
    expect(pollAwaiting.body.transcriptReady).toBe(false);

    // 2. Upload completes -> the real handler owns awaiting_upload -> processing.
    const uploadCompleteDeps: UploadCompleteDeps = {
      findVideoById: store.findVideoById,
      markProcessing: store.markProcessingById,
    };
    const completed = await handleUploadComplete(uploadCompleteDeps, { videoId: ticket.videoId });
    expect(completed.status).toBe(200);
    expect(completed.body).toEqual({ status: "processing" });
    const pollProcessing = await handleVideoMetadata(readDeps, ticket.videoId);
    expect(pollProcessing.body.status).toBe("processing");

    // Idempotent: a duplicate upload-complete signal is a harmless no-op.
    const dup = await handleUploadComplete(uploadCompleteDeps, { videoId: ticket.videoId });
    expect(dup.body).toEqual({ status: "processing", alreadyAdvanced: true });

    // 3. Cloudflare fires the signed `ready` webhook.
    const hook = await handleStreamWebhook(webhookDeps, signedWebhook(STREAM_UID));
    expect(hook.status).toBe(200);
    expect(store.byId.get(ticket.videoId)!.status).toBe("ready");
    expect(store.aiQueue).toEqual([ticket.videoId]);

    // Now playable, but AI hasn't run: HLS present, title still the fallback.
    const afterReady = await handleWatch(readDeps, "demo42");
    expect((afterReady.body.playback as { hls: string } | null)?.hls).toBe(store.hls(STREAM_UID));
    expect(afterReady.body.title).toBe("Untitled recording");
    expect(afterReady.body.summary).toBeNull();

    // 4. Drain the AI job queue.
    expect(store.aiQueue).toHaveLength(1);
    const jobId = store.aiQueue.shift()!;
    const ai = await runAiPipeline(aiDeps, { videoId: jobId, audioUrl: store.audioUrlFor(jobId) });
    expect(ai.ok).toBe(true);
    expect(store.byId.get(jobId)!.aiStatus).toBe("complete");
    // AI completion did NOT move the (terminal) video status.
    expect(store.byId.get(jobId)!.status).toBe("ready");

    // 5. Watch page is now fully rendered.
    const final = await handleWatch(readDeps, "demo42");
    expect(final.status).toBe(200);
    expect(final.body.title).toBe("Product demo walkthrough");
    expect(final.body.summary).toBe("A short walkthrough of the product.");
    expect(final.body.chapters).toEqual([{ start: 0, title: "Intro" }]);
    expect(final.body.segments).toEqual([
      { start: 0, text: "Hello." },
      { start: 3.2, text: "This is the demo." },
    ]);
    expect((final.body.playback as { hls: string }).hls).toBe(store.hls(STREAM_UID));

    // And the client poll reflects a complete, transcript-ready video.
    const pollDone = await handleVideoMetadata(readDeps, ticket.videoId);
    expect(pollDone.body.status).toBe("ready");
    expect(pollDone.body.title).toBe("Product demo walkthrough");
    expect(pollDone.body.transcriptReady).toBe(true);
  });

  it("leaves a watchable (ready) video when the AI pipeline fails", async () => {
    const store = createStore();
    const STREAM_UID = "uid-fail";
    const watchBaseUrl = "https://share.example.com";

    const uploadDeps: CreateUploadDeps = {
      makeSlug: () => "oops7",
      createStreamUpload: async () => ({ uid: STREAM_UID, uploadURL: "https://up/tus" }),
      insertVideo: store.insertVideo,
      watchBaseUrl,
    };
    const webhookDeps: StreamWebhookDeps = {
      secret: WEBHOOK_SECRET,
      findVideoByStreamUid: store.findVideoByStreamUid,
      markReady: store.markReady,
      enqueueAiJob: store.enqueueAiJob,
    };
    const aiDeps: AiPipelineDeps = {
      deepgramApiKey: "dg-key",
      callDeepgram: async () => dgResponse,
      callClaude: async () => "not json at all", // model misbehaves
      persistSummary: store.persistSummary,
      markComplete: store.markComplete,
      markFailed: store.markFailed,
    };
    const readDeps: VideoReadDeps = {
      findVideoBySlug: store.findVideoBySlug,
      findVideoById: store.findVideoById,
      watchBaseUrl,
    };

    const upload = await createUpload(uploadDeps, { filename: "r.mp4", durationSeconds: 5, sizeBytes: 1024 });
    const { videoId } = upload.body as { videoId: string };

    await handleUploadComplete(
      { findVideoById: store.findVideoById, markProcessing: store.markProcessingById },
      { videoId }
    );
    await handleStreamWebhook(webhookDeps, signedWebhook(STREAM_UID));

    const ai = await runAiPipeline(aiDeps, { videoId, audioUrl: store.audioUrlFor(videoId) });
    expect(ai.ok).toBe(false);
    expect(store.byId.get(videoId)!.aiStatus).toBe("failed");

    // Graceful degradation: still ready + playable, just no AI title/summary.
    const watch = await handleWatch(readDeps, "oops7");
    expect(store.byId.get(videoId)!.status).toBe("ready");
    expect((watch.body.playback as { hls: string }).hls).toBe(store.hls(STREAM_UID));
    expect(watch.body.title).toBe("Untitled recording");
    expect(watch.body.summary).toBeNull();
  });
});
