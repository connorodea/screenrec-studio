import { describe, it, expect, vi } from "vitest";
import { uploadsRoute } from "./uploadsRoute";
import type { CreateUploadDeps } from "./createUpload";

function deps(overrides: Partial<CreateUploadDeps> = {}): CreateUploadDeps {
  return {
    makeSlug: () => "slug123",
    createStreamUpload: vi.fn(async () => ({ uid: "uid-1", uploadURL: "https://up/tus" })),
    insertVideo: vi.fn(async () => ({ id: "vid-1" })),
    watchBaseUrl: "https://share.example.com",
    ...overrides,
  };
}

const validBody = { filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 2048 };

describe("uploadsRoute", () => {
  it("returns 201 with the upload ticket on a valid request", async () => {
    const res = await uploadsRoute({ json: async () => validBody }, deps());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { slug: string; watchUrl: string; uploadProtocol: string };
    expect(body.slug).toBe("slug123");
    expect(body.watchUrl).toBe("https://share.example.com/v/slug123");
    expect(body.uploadProtocol).toBe("tus");
  });

  it("returns 400 and skips side effects on a malformed JSON body", async () => {
    const d = deps();
    const res = await uploadsRoute(
      {
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      },
      d
    );
    expect(res.status).toBe(400);
    expect(d.createStreamUpload).not.toHaveBeenCalled();
    expect(d.insertVideo).not.toHaveBeenCalled();
  });

  it("passes the handler's 400 through for an invalid (but parseable) body", async () => {
    const res = await uploadsRoute({ json: async () => ({ filename: "" }) }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toHaveProperty("error");
  });
});
