import type { AppConfig } from "./config";
import type { VideoRepository } from "./videoRepository";
import type { CreateUploadDeps } from "./createUpload";
import type { UploadCompleteDeps } from "./handleUploadComplete";
import type { StreamWebhookDeps } from "./handleStreamWebhook";
import type { VideoReadDeps } from "./handleVideoRead";
import type { AiPipelineDeps } from "./aiPipeline";
import { buildClients, type ClientIO } from "./buildClients";
import { makeSlug } from "./slug";

/**
 * The full route-deps factory: combines validated config + a VideoRepository (the
 * DB-backed deps) + buildClients (the network-boundary deps) into the exact dep
 * object each route core / the AI pipeline needs. The Next.js route files call this
 * once and hand each group to its route core. Repo is the interface, so the same
 * wiring works with the in-memory repo (dev/tests) or the Postgres repo (prod).
 * See ../../docs/share-loop-spec.md.
 */

export interface RouteDeps {
  uploads: CreateUploadDeps;
  uploadComplete: UploadCompleteDeps;
  webhook: StreamWebhookDeps;
  read: VideoReadDeps;
  aiPipeline: AiPipelineDeps;
}

export function buildDeps(config: AppConfig, repo: VideoRepository, io: ClientIO): RouteDeps {
  const clients = buildClients(config, io);

  return {
    uploads: {
      makeSlug: () => makeSlug(),
      createStreamUpload: clients.createStreamUpload,
      insertVideo: repo.insertVideo.bind(repo),
      watchBaseUrl: config.watchBaseUrl,
    },
    uploadComplete: {
      findVideoById: repo.findVideoById.bind(repo),
      markProcessing: repo.markProcessing.bind(repo),
    },
    webhook: {
      secret: config.streamWebhookSecret,
      findVideoByStreamUid: repo.findVideoByStreamUid.bind(repo),
      markReady: repo.markReady.bind(repo),
      enqueueAiJob: repo.enqueueAiJob.bind(repo),
    },
    read: {
      findVideoBySlug: repo.findVideoBySlug.bind(repo),
      findVideoById: repo.findVideoById.bind(repo),
      watchBaseUrl: config.watchBaseUrl,
    },
    aiPipeline: {
      deepgramApiKey: config.deepgramApiKey,
      callDeepgram: clients.callDeepgram,
      callClaude: clients.callClaude,
      persistSummary: repo.persistSummary.bind(repo),
      markComplete: repo.markComplete.bind(repo),
      markFailed: repo.markFailed.bind(repo),
    },
  };
}
