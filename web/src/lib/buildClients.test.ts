import { describe, it, expect, vi } from "vitest";
import { buildClients } from "./buildClients";
import type { AppConfig } from "./config";
import type Anthropic from "@anthropic-ai/sdk";

const config: AppConfig = {
  cloudflareAccountId: "acct",
  cloudflareApiToken: "cftok",
  streamCustomerSubdomain: "customer-x.cloudflarestream.com",
  streamWebhookSecret: "whsec",
  deepgramApiKey: "dg",
  anthropicApiKey: "an",
  databaseUrl: "postgres://x",
  watchBaseUrl: "https://s",
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

type Init = { method: string; headers: Record<string, string>; body?: string };
const noopCreate = vi.fn(async () => ({ content: [] }) as unknown as Anthropic.Message);
const noopFetch = vi.fn(async (_u: string, _i: Init) => resp({ ok: true, status: 200 }));

describe("buildClients", () => {
  it("createStreamUpload wires the CF account/token and returns uid + uploadURL", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: Init) =>
      resp({ ok: true, status: 201, headers: { Location: "https://up/tus", "stream-media-id": "uid-1" } })
    );
    const clients = buildClients(config, { fetch: fetchMock, anthropicCreate: noopCreate });
    const out = await clients.createStreamUpload({ uploadLength: 2048, name: "rec.mp4" });
    expect(out).toEqual({ uid: "uid-1", uploadURL: "https://up/tus" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/accounts/acct/stream");
    expect(init.headers["Authorization"]).toBe("Bearer cftok");
  });

  it("retries a transient 503 then succeeds (retry wired with isTransientHttpError)", async () => {
    let n = 0;
    const fetchMock = vi.fn(async (_u: string, _i: Init) => {
      n++;
      return n === 1
        ? resp({ ok: false, status: 503, body: "busy" })
        : resp({ ok: true, status: 201, headers: { Location: "u", "stream-media-id": "v" } });
    });
    const sleep = vi.fn(async (_ms: number) => {});
    const clients = buildClients(config, { fetch: fetchMock, anthropicCreate: noopCreate, retry: { sleep } });
    const out = await clients.createStreamUpload({ uploadLength: 1, name: "r.mp4" });
    expect(out).toEqual({ uid: "v", uploadURL: "u" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a permanent 401", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: Init) => resp({ ok: false, status: 401, body: "no" }));
    const sleep = vi.fn(async (_ms: number) => {});
    const clients = buildClients(config, { fetch: fetchMock, anthropicCreate: noopCreate, retry: { sleep } });
    await expect(clients.createStreamUpload({ uploadLength: 1, name: "r.mp4" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("callDeepgram runs the built request and returns the parsed JSON", async () => {
    const payload = { results: { channels: [] } };
    const fetchMock = vi.fn(async (_u: string, _i: Init) => resp({ ok: true, status: 200, json: payload }));
    const clients = buildClients(config, { fetch: fetchMock, anthropicCreate: noopCreate });
    const out = await clients.callDeepgram({ url: "https://api.deepgram.com/v1/listen", method: "POST", headers: {}, body: "{}" });
    expect(out).toEqual(payload);
  });

  it("callClaude runs the request through the injected SDK create and returns text", async () => {
    const create = vi.fn(
      async () => ({ content: [{ type: "text", text: "hello" }] }) as unknown as Anthropic.Message
    );
    const clients = buildClients(config, { fetch: noopFetch, anthropicCreate: create });
    const out = await clients.callClaude({ model: "m", max_tokens: 10, messages: [] });
    expect(out).toBe("hello");
  });
});
