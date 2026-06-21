import { describe, it, expect, vi } from "vitest";
import { streamWebhookRoute } from "./streamWebhookRoute";
import { computeSignature } from "./webhook";
import type { StreamWebhookDeps } from "./handleStreamWebhook";
import type { VideoStatus } from "./videoStatus";

const SECRET = "whsec_route";
const TIME = "1700000000";

function deps(status: VideoStatus = "processing", overrides: Partial<StreamWebhookDeps> = {}): StreamWebhookDeps {
  return {
    secret: SECRET,
    findVideoByStreamUid: vi.fn(async () => ({ id: "vid-1", status })),
    markReady: vi.fn(async () => {}),
    enqueueAiJob: vi.fn(async () => {}),
    ...overrides,
  };
}

function req(body: string, signature: string | null) {
  return {
    text: async () => body,
    headers: { get: (name: string) => (name.toLowerCase() === "webhook-signature" ? signature : null) },
  };
}

function signed(body: string) {
  return `time=${TIME},sig1=${computeSignature(SECRET, TIME, body)}`;
}

describe("streamWebhookRoute", () => {
  it("marks ready + enqueues AI and returns 200 on a valid signed ready event", async () => {
    const body = JSON.stringify({ uid: "uid-1", status: { state: "ready" }, duration: 42 });
    const d = deps("processing");
    const res = await streamWebhookRoute(req(body, signed(body)), d);
    expect(res.status).toBe(200);
    expect(d.markReady).toHaveBeenCalledWith("vid-1", expect.objectContaining({ durationSeconds: 42 }));
    expect(d.enqueueAiJob).toHaveBeenCalledWith("vid-1");
  });

  it("returns 401 and never touches the DB on a bad signature", async () => {
    const d = deps();
    const res = await streamWebhookRoute(req("{}", "time=1,sig1=bad"), d);
    expect(res.status).toBe(401);
    expect(d.findVideoByStreamUid).not.toHaveBeenCalled();
  });

  it("treats a missing signature header as a 401", async () => {
    const d = deps();
    const body = JSON.stringify({ uid: "uid-1", status: { state: "ready" } });
    const res = await streamWebhookRoute(req(body, null), d);
    expect(res.status).toBe(401);
    expect(d.findVideoByStreamUid).not.toHaveBeenCalled();
  });
});
