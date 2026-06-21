import { describe, it, expect, vi } from "vitest";
import { uploadCompleteRoute } from "./uploadCompleteRoute";
import type { UploadCompleteDeps } from "./handleUploadComplete";
import type { VideoStatus } from "./videoStatus";

function deps(status: VideoStatus, overrides: Partial<UploadCompleteDeps> = {}): UploadCompleteDeps {
  return {
    findVideoById: vi.fn(async () => ({ id: "vid-1", status })),
    markProcessing: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("uploadCompleteRoute", () => {
  it("returns 200 'processing' for an awaiting_upload video", async () => {
    const res = await uploadCompleteRoute("vid-1", deps("awaiting_upload"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "processing" });
  });

  it("returns 404 for an unknown video", async () => {
    const res = await uploadCompleteRoute(
      "nope",
      deps("awaiting_upload", { findVideoById: vi.fn(async () => null) })
    );
    expect(res.status).toBe(404);
  });
});
