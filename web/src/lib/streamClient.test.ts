import { describe, it, expect, vi } from "vitest";
import { createDirectUpload, type StreamClientConfig } from "./streamClient";

function fakeResponse(opts: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  body?: string;
}) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) lower[k.toLowerCase()] = v;
  return {
    ok: opts.ok,
    status: opts.status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => opts.body ?? "",
  };
}

function config(fetchImpl: StreamClientConfig["fetch"]): StreamClientConfig {
  return { fetch: fetchImpl, accountId: "acct123", apiToken: "cf-token" };
}

describe("createDirectUpload", () => {
  it("issues the tus direct-upload request and returns uid + uploadURL from the headers", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: { method: string; headers: Record<string, string> }) =>
        fakeResponse({
          ok: true,
          status: 201,
          headers: {
            Location: "https://upload.cloudflarestream.com/tus/abc",
            "stream-media-id": "uid-xyz",
          },
        })
    );

    const res = await createDirectUpload(config(fetchMock), { uploadLength: 2048, name: "rec.mp4" });
    expect(res).toEqual({ uid: "uid-xyz", uploadURL: "https://upload.cloudflarestream.com/tus/abc" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct123/stream?direct_user=true");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer cf-token");
    expect(init.headers["Upload-Length"]).toBe("2048");
    expect(init.headers["Tus-Resumable"]).toBe("1.0.0");
  });

  it("passes the name through as tus Upload-Metadata", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: { method: string; headers: Record<string, string> }) =>
        fakeResponse({ ok: true, status: 201, headers: { Location: "u", "stream-media-id": "v" } })
    );
    await createDirectUpload(config(fetchMock), { uploadLength: 10, name: "demo.mp4" });

    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers["Upload-Metadata"]).toContain(
      `name ${Buffer.from("demo.mp4").toString("base64")}`
    );
  });

  it("throws on a non-2xx response (so createUpload maps it to 502)", async () => {
    const fetchMock = vi.fn(async () => fakeResponse({ ok: false, status: 403, body: "Forbidden" }));
    await expect(createDirectUpload(config(fetchMock), { uploadLength: 1 })).rejects.toThrow(/403/);
  });

  it("throws when the response is missing the uid / uploadURL headers", async () => {
    const fetchMock = vi.fn(async () => fakeResponse({ ok: true, status: 201, headers: {} }));
    await expect(createDirectUpload(config(fetchMock), { uploadLength: 1 })).rejects.toThrow(/missing/i);
  });
});
