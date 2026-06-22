import { describe, it, expect } from "vitest";
import { createInMemoryVideoRepository } from "./videoRepository";
import { cloudflareStreamUrls } from "./streamUrls";

const SUBDOMAIN = "customer-test.cloudflarestream.com";

function repo() {
  return createInMemoryVideoRepository({ streamCustomerSubdomain: SUBDOMAIN });
}

async function seed(r = repo(), streamUid = "uid-1") {
  const { id } = await r.insertVideo({ slug: "demo42", streamUid, status: "awaiting_upload" });
  return { r, id, streamUid };
}

describe("createInMemoryVideoRepository", () => {
  it("inserts and finds a video by id, slug, and stream uid", async () => {
    const { r, id } = await seed();
    expect((await r.findVideoById(id))?.slug).toBe("demo42");
    expect((await r.findVideoBySlug("demo42"))?.id).toBe(id);
    expect((await r.findVideoByStreamUid("uid-1"))?.id).toBe(id);
    const row = await r.findVideoById(id);
    expect(row).toMatchObject({ status: "awaiting_upload", aiStatus: "pending", title: null, streamHls: null });
  });

  it("returns null for unknown lookups", async () => {
    const r = repo();
    expect(await r.findVideoById("nope")).toBeNull();
    expect(await r.findVideoBySlug("nope")).toBeNull();
    expect(await r.findVideoByStreamUid("nope")).toBeNull();
  });

  it("drives the lifecycle awaiting_upload -> processing -> ready and derives the HLS URL", async () => {
    const { r, id, streamUid } = await seed();
    await r.markProcessing(id);
    expect((await r.findVideoById(id))?.status).toBe("processing");

    await r.markReady(id, { durationSeconds: 42, thumbnail: "https://cf/t.jpg" });
    const row = await r.findVideoById(id);
    expect(row?.status).toBe("ready");
    expect(row?.thumbnail).toBe("https://cf/t.jpg");
    expect(row?.durationSeconds).toBe(42);
    expect(row?.streamHls).toBe(cloudflareStreamUrls(SUBDOMAIN, streamUid).hls);
  });

  it("rejects an illegal status transition (markReady from awaiting_upload)", async () => {
    const { r, id } = await seed();
    await expect(r.markReady(id, {})).rejects.toThrow(/illegal/i);
  });

  it("enqueues and drains AI jobs", async () => {
    const { r, id } = await seed();
    await r.enqueueAiJob(id);
    expect(await r.dequeueAiJobs()).toEqual([id]);
    expect(await r.dequeueAiJobs()).toEqual([]); // drained
  });

  it("persists AI summary and tracks aiStatus on a separate axis from video status", async () => {
    const { r, id } = await seed();
    await r.markProcessing(id);
    await r.markReady(id, {});

    await r.persistSummary(id, {
      title: "T",
      summary: "S",
      chapters: [{ start: 0, title: "Intro" }],
      transcript: [{ start: 0, text: "hi" }],
    });
    await r.markComplete(id);
    let row = await r.findVideoById(id);
    expect(row).toMatchObject({ status: "ready", aiStatus: "complete", title: "T", summary: "S" });
    expect(row?.chapters).toEqual([{ start: 0, title: "Intro" }]);

    // A subsequent AI failure flips aiStatus but never the (terminal) video status.
    await r.markFailed(id, "boom");
    row = await r.findVideoById(id);
    expect(row).toMatchObject({ status: "ready", aiStatus: "failed", aiError: "boom" });
  });
});
