import { describe, it, expect, vi } from "vitest";
import { buildDeps } from "./buildDeps";
import { createInMemoryVideoRepository } from "./videoRepository";
import { uploadsRoute } from "./uploadsRoute";
import { uploadCompleteRoute } from "./uploadCompleteRoute";
import { streamWebhookRoute } from "./streamWebhookRoute";
import { videoMetadataRoute } from "./videoMetadataRoute";
import { runAiPipeline } from "./aiPipeline";
import { computeSignature } from "./webhook";
import { cloudflareStreamUrls } from "./streamUrls";
import type { AppConfig } from "./config";
import type Anthropic from "@anthropic-ai/sdk";

const SUBDOMAIN = "customer-test.cloudflarestream.com";
const STREAM_UID = "uid-e2e";
const TIME = "1700000000";

const config: AppConfig = {
  cloudflareAccountId: "acct",
  cloudflareApiToken: "cftok",
  streamCustomerSubdomain: SUBDOMAIN,
  streamWebhookSecret: "whsec_e2e",
  deepgramApiKey: "dg",
  anthropicApiKey: "an",
  databaseUrl: "postgres://x",
  watchBaseUrl: "https://share.example.com",
};

function resp(opts: { ok: boolean; status: number; headers?: Record<string, string>; json?: unknown; body?: string }) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) lower[k.toLowerCase()] = v;
  return {
    ok: opts.ok,
    status: opts.status,
    headers: { get: (n: string) => lower[n.toLowerCase()] ?? null },
    json: async () => opts.json,
    text: async () => opts.body ?? "",
  };
}

const dgResponse = {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "hello demo",
            paragraphs: { paragraphs: [{ sentences: [{ start: 0, text: "Hello." }, { start: 2, text: "Demo." }] }] },
          },
        ],
      },
    ],
  },
};
const claudeJson = JSON.stringify({ title: "Product demo", summary: "A demo.", chapters: [{ start: 0, title: "Intro" }] });

type Init = { method: string; headers: Record<string, string>; body?: string };

describe("share loop — end-to-end through the real route cores (in-memory repo, fake network)", () => {
  it("carries a recording from POST /api/uploads to a ready, AI-enriched poll", async () => {
    const fetchMock = vi.fn(async (url: string, _init: Init) => {
      if (url.includes("api.cloudflare.com")) {
        return resp({ ok: true, status: 201, headers: { Location: "https://up/tus", "stream-media-id": STREAM_UID } });
      }
      if (url.includes("api.deepgram.com")) return resp({ ok: true, status: 200, json: dgResponse });
      return resp({ ok: false, status: 404 });
    });
    const anthropicCreate = vi.fn(
      async () => ({ content: [{ type: "text", text: claudeJson }] }) as unknown as Anthropic.Message
    );
    const sleep = vi.fn(async (_ms: number) => {});

    const repo = createInMemoryVideoRepository({ streamCustomerSubdomain: SUBDOMAIN });
    const deps = buildDeps(config, repo, { fetch: fetchMock, anthropicCreate, retry: { sleep } });

    // 1. Upload ticket.
    const up = await uploadsRoute(
      { json: async () => ({ filename: "rec.mp4", durationSeconds: 30, sizeBytes: 4096 }) },
      deps.uploads
    );
    expect(up.status).toBe(201);
    const ticket = (await up.json()) as { videoId: string; slug: string; watchUrl: string };
    expect(ticket.watchUrl).toBe(`https://share.example.com/v/${ticket.slug}`);

    // 2. Poll: still awaiting upload.
    const m1 = await videoMetadataRoute(ticket.videoId, deps.read);
    expect(((await m1.json()) as { status: string }).status).toBe("awaiting_upload");

    // 3. Upload completes → processing.
    const c = await uploadCompleteRoute(ticket.videoId, deps.uploadComplete);
    expect(await c.json()).toEqual({ status: "processing" });

    // 4. Stream ready webhook (signed over the raw body).
    const body = JSON.stringify({ uid: STREAM_UID, status: { state: "ready" }, duration: 30, thumbnail: "https://cf/t.jpg" });
    const header = `time=${TIME},sig1=${computeSignature(config.streamWebhookSecret, TIME, body)}`;
    const w = await streamWebhookRoute(
      { text: async () => body, headers: { get: (n) => (n.toLowerCase() === "webhook-signature" ? header : null) } },
      deps.webhook
    );
    expect(w.status).toBe(200);

    // 5. Drain the AI queue and run the pipeline.
    const jobs = await repo.dequeueAiJobs();
    expect(jobs).toEqual([ticket.videoId]);
    const ai = await runAiPipeline(deps.aiPipeline, {
      videoId: ticket.videoId,
      audioUrl: cloudflareStreamUrls(SUBDOMAIN, STREAM_UID).mp4Download,
    });
    expect(ai.ok).toBe(true);

    // 6. Poll: ready, AI-enriched, transcript ready.
    const m2 = await videoMetadataRoute(ticket.videoId, deps.read);
    const meta = (await m2.json()) as { status: string; title: string; transcriptReady: boolean };
    expect(meta.status).toBe("ready");
    expect(meta.title).toBe("Product demo");
    expect(meta.transcriptReady).toBe(true);

    // Stored row: HLS derived from the uid, AI complete, status terminal.
    const stored = await repo.findVideoById(ticket.videoId);
    expect(stored?.streamHls).toBe(cloudflareStreamUrls(SUBDOMAIN, STREAM_UID).hls);
    expect(stored?.aiStatus).toBe("complete");
  });
});
