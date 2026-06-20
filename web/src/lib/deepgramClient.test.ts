import { describe, it, expect, vi } from "vitest";
import { runDeepgramRequest } from "./deepgramClient";
import { buildDeepgramRequest } from "./deepgramRequest";

function fakeResponse(opts: { ok: boolean; status: number; json?: unknown; body?: string }) {
  return {
    ok: opts.ok,
    status: opts.status,
    json: async () => opts.json,
    text: async () => opts.body ?? "",
  };
}

type Init = { method: string; headers: Record<string, string>; body: string };

describe("runDeepgramRequest", () => {
  it("executes the built request and returns the parsed JSON response", async () => {
    const req = buildDeepgramRequest("https://cf/a.mp4", "dg-key");
    const payload = { results: { channels: [{ alternatives: [{ transcript: "hi" }] }] } };
    const fetchMock = vi.fn(async (_url: string, _init: Init) =>
      fakeResponse({ ok: true, status: 200, json: payload })
    );

    const out = await runDeepgramRequest(fetchMock, req);
    expect(out).toEqual(payload);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(req.url);
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Token dg-key");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ url: "https://cf/a.mp4" });
  });

  it("throws on a non-2xx response (so runAiPipeline marks the video failed)", async () => {
    const req = buildDeepgramRequest("https://cf/a.mp4", "dg-key");
    const fetchMock = vi.fn(async (_url: string, _init: Init) =>
      fakeResponse({ ok: false, status: 401, body: "Unauthorized" })
    );
    await expect(runDeepgramRequest(fetchMock, req)).rejects.toThrow(/401/);
  });
});
