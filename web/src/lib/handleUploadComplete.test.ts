import { describe, it, expect, vi } from "vitest";
import { handleUploadComplete, type UploadCompleteDeps } from "./handleUploadComplete";
import type { VideoStatus } from "./videoStatus";

function deps(status: VideoStatus, overrides: Partial<UploadCompleteDeps> = {}): UploadCompleteDeps {
  return {
    findVideoById: vi.fn(async () => ({ id: "vid-1", status })),
    markProcessing: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("handleUploadComplete", () => {
  it("moves an awaiting_upload video to processing", async () => {
    const d = deps("awaiting_upload");
    const res = await handleUploadComplete(d, { videoId: "vid-1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "processing" });
    expect(d.markProcessing).toHaveBeenCalledWith("vid-1");
  });

  it("is idempotent once the video has already advanced", async () => {
    const d = deps("processing");
    const res = await handleUploadComplete(d, { videoId: "vid-1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "processing", alreadyAdvanced: true });
    expect(d.markProcessing).not.toHaveBeenCalled();
  });

  it("does not re-process a video that is already ready", async () => {
    const d = deps("ready");
    const res = await handleUploadComplete(d, { videoId: "vid-1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", alreadyAdvanced: true });
    expect(d.markProcessing).not.toHaveBeenCalled();
  });

  it("404s an unknown video without side effects", async () => {
    const d = deps("awaiting_upload", { findVideoById: vi.fn(async () => null) });
    const res = await handleUploadComplete(d, { videoId: "nope" });
    expect(res.status).toBe(404);
    expect(d.markProcessing).not.toHaveBeenCalled();
  });
});
