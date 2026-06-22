import { transition, type VideoStatus } from "./videoStatus";
import { cloudflareStreamUrls } from "./streamUrls";
import type { ChapterMarker, TranscriptSegment, VideoRow } from "./watchViewModel";

/**
 * The data-layer contract for videos — the superset of every DB-backed dep the
 * handlers/pipeline need. The route layer's deps factory wires repo methods into
 * each handler's deps; the production Postgres/Prisma repo and this in-memory one
 * implement the same interface, so they're interchangeable (in-memory = local dev +
 * tests; Postgres = production). The repo owns the lifecycle invariants: status
 * transitions are `transition()`-enforced, `streamHls` is derived from the uid at
 * markReady, and `aiStatus` is a separate axis from the (terminal) video status.
 * See ../../docs/share-loop-spec.md.
 */

export interface StoredVideo extends VideoRow {
  id: string;
  streamUid: string;
  durationSeconds: number | null;
  aiStatus: "pending" | "complete" | "failed";
  aiError: string | null;
}

export interface VideoRepository {
  insertVideo(row: { slug: string; streamUid: string; status: "awaiting_upload" }): Promise<{ id: string }>;
  findVideoById(id: string): Promise<StoredVideo | null>;
  findVideoByStreamUid(uid: string): Promise<StoredVideo | null>;
  findVideoBySlug(slug: string): Promise<StoredVideo | null>;
  markProcessing(id: string): Promise<void>;
  markReady(id: string, info: { durationSeconds?: number; thumbnail?: string }): Promise<void>;
  enqueueAiJob(id: string): Promise<void>;
  persistSummary(
    id: string,
    data: {
      title: string | null;
      summary: string | null;
      chapters: ChapterMarker[];
      transcript: TranscriptSegment[];
    }
  ): Promise<void>;
  markComplete(id: string): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
  /** Drain the pending AI-job ids (the worker processes these → runAiPipeline). */
  dequeueAiJobs(): Promise<string[]>;
}

export interface InMemoryRepoOptions {
  streamCustomerSubdomain: string;
  idPrefix?: string;
}

export function createInMemoryVideoRepository(opts: InMemoryRepoOptions): VideoRepository {
  const byId = new Map<string, StoredVideo>();
  const bySlug = new Map<string, string>();
  const byUid = new Map<string, string>();
  const aiQueue: string[] = [];
  const prefix = opts.idPrefix ?? "vid-";
  let seq = 0;

  const get = (id: string): StoredVideo => {
    const v = byId.get(id);
    if (!v) throw new Error(`no video ${id}`);
    return v;
  };
  const clone = (v: StoredVideo): StoredVideo => ({ ...v });
  const setStatus = (v: StoredVideo, to: VideoStatus) => {
    v.status = transition(v.status, to);
  };

  return {
    async insertVideo(row) {
      const id = `${prefix}${++seq}`;
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
        durationSeconds: null,
        aiStatus: "pending",
        aiError: null,
      });
      bySlug.set(row.slug, id);
      byUid.set(row.streamUid, id);
      return { id };
    },

    async findVideoById(id) {
      const v = byId.get(id);
      return v ? clone(v) : null;
    },
    async findVideoByStreamUid(uid) {
      const id = byUid.get(uid);
      return id ? clone(get(id)) : null;
    },
    async findVideoBySlug(slug) {
      const id = bySlug.get(slug);
      return id ? clone(get(id)) : null;
    },

    async markProcessing(id) {
      setStatus(get(id), "processing");
    },
    async markReady(id, info) {
      const v = get(id);
      setStatus(v, "ready"); // throws if not coming from `processing`
      if (typeof info.durationSeconds === "number") v.durationSeconds = info.durationSeconds;
      if (typeof info.thumbnail === "string") v.thumbnail = info.thumbnail;
      v.streamHls = cloudflareStreamUrls(opts.streamCustomerSubdomain, v.streamUid).hls;
    },

    async enqueueAiJob(id) {
      aiQueue.push(id);
    },
    async dequeueAiJobs() {
      return aiQueue.splice(0, aiQueue.length);
    },

    async persistSummary(id, data) {
      const v = get(id);
      v.title = data.title;
      v.summary = data.summary;
      v.chapters = data.chapters;
      v.transcript = data.transcript;
    },
    async markComplete(id) {
      get(id).aiStatus = "complete"; // NOT a video-status transition
    },
    async markFailed(id, reason) {
      const v = get(id);
      v.aiStatus = "failed";
      v.aiError = reason;
    },
  };
}
