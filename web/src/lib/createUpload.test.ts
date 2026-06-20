import { describe, it, expect, vi } from "vitest";
import { createUpload, type CreateUploadDeps } from "./createUpload";

const validBody = { filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 2048 };

function deps(overrides: Partial<CreateUploadDeps> = {}): CreateUploadDeps {
  return {
    makeSlug: () => "slug123",
    createStreamUpload: vi.fn(async () => ({ uid: "uid-1", uploadURL: "https://up/tus" })),
    insertVideo: vi.fn(async () => ({ id: "vid-1" })),
    watchBaseUrl: "https://share.example.com",
    ...overrides,
  };
}

describe("createUpload", () => {
  it("returns 201 with the upload ticket on a valid request", async () => {
    const d = deps();
    const res = await createUpload(d, validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      videoId: "vid-1",
      slug: "slug123",
      watchUrl: "https://share.example.com/v/slug123",
      uploadURL: "https://up/tus",
      uploadProtocol: "tus",
    });
  });

  it("requests the Stream upload sized from the body", async () => {
    const d = deps();
    await createUpload(d, validBody);
    expect(d.createStreamUpload).toHaveBeenCalledWith({ uploadLength: 2048, name: "rec.mp4" });
  });

  it("inserts an awaiting_upload row with the slug + uid", async () => {
    const d = deps();
    await createUpload(d, validBody);
    expect(d.insertVideo).toHaveBeenCalledWith({
      slug: "slug123",
      streamUid: "uid-1",
      status: "awaiting_upload",
    });
  });

  it("returns 400 and skips side effects on an invalid body", async () => {
    const d = deps();
    const res = await createUpload(d, { filename: "" });
    expect(res.status).toBe(400);
    expect("error" in res.body).toBe(true);
    expect(d.createStreamUpload).not.toHaveBeenCalled();
    expect(d.insertVideo).not.toHaveBeenCalled();
  });

  it("returns 502 and does not insert when the Stream upload fails", async () => {
    const d = deps({
      createStreamUpload: vi.fn(async () => {
        throw new Error("cloudflare down");
      }),
    });
    const res = await createUpload(d, validBody);
    expect(res.status).toBe(502);
    expect(d.insertVideo).not.toHaveBeenCalled();
  });
});
