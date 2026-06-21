import { describe, it, expect, vi } from "vitest";
import { handleStreamWebhook, type StreamWebhookDeps } from "./handleStreamWebhook";
import { computeSignature } from "./webhook";
import type { VideoStatus } from "./videoStatus";

const secret = "whsec_test";
const time = "1700000000";

function readyBody(uid = "uid-1") {
  return JSON.stringify({ uid, status: { state: "ready" }, duration: 42, thumbnail: "https://cf/t.jpg" });
}
function sign(body: string) {
  return `time=${time},sig1=${computeSignature(secret, time, body)}`;
}

function deps(status: VideoStatus = "processing", overrides: Partial<StreamWebhookDeps> = {}): StreamWebhookDeps {
  return {
    secret,
    findVideoByStreamUid: vi.fn(async () => ({ id: "vid-1", status })),
    markReady: vi.fn(async () => {}),
    enqueueAiJob: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("handleStreamWebhook", () => {
  it("rejects a bad signature without touching the DB", async () => {
    const d = deps();
    const res = await handleStreamWebhook(d, { header: "time=1,sig1=bad", body: readyBody() });
    expect(res.status).toBe(401);
    expect(d.findVideoByStreamUid).not.toHaveBeenCalled();
  });

  it("marks ready and enqueues the AI job for a processing video", async () => {
    const d = deps("processing");
    const body = readyBody();
    const res = await handleStreamWebhook(d, { header: sign(body), body });
    expect(res.status).toBe(200);
    expect(d.markReady).toHaveBeenCalledWith("vid-1", { durationSeconds: 42, thumbnail: "https://cf/t.jpg" });
    expect(d.enqueueAiJob).toHaveBeenCalledWith("vid-1");
  });

  it("ignores non-ready states before any lookup", async () => {
    const d = deps();
    const body = JSON.stringify({ uid: "uid-1", status: { state: "inprogress" } });
    const res = await handleStreamWebhook(d, { header: sign(body), body });
    expect(res.status).toBe(200);
    expect(d.findVideoByStreamUid).not.toHaveBeenCalled();
  });

  it("acks an unknown uid without side effects", async () => {
    const d = deps("processing", { findVideoByStreamUid: vi.fn(async () => null) });
    const body = readyBody("unknown");
    const res = await handleStreamWebhook(d, { header: sign(body), body });
    expect(res.status).toBe(200);
    expect(d.markReady).not.toHaveBeenCalled();
  });

  it("is idempotent for an already-ready video", async () => {
    const d = deps("ready");
    const body = readyBody();
    const res = await handleStreamWebhook(d, { header: sign(body), body });
    expect(res.status).toBe(200);
    expect(d.markReady).not.toHaveBeenCalled();
    expect(d.enqueueAiJob).not.toHaveBeenCalled();
  });

  it("400s on a malformed (but signed) body", async () => {
    const d = deps();
    const body = "{not json";
    const res = await handleStreamWebhook(d, { header: sign(body), body });
    expect(res.status).toBe(400);
  });
});
