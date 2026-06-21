import { describe, it, expect } from "vitest";
import { jsonResponse, readJsonBody } from "./http";

describe("jsonResponse", () => {
  it("builds a JSON Response with the result's status and body", async () => {
    const res = jsonResponse({ status: 201, body: { videoId: "v1" } });
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ videoId: "v1" });
  });

  it("carries error bodies and their status through unchanged", async () => {
    const res = jsonResponse({ status: 400, body: { error: "bad" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad" });
  });
});

describe("readJsonBody", () => {
  it("returns the parsed value on valid JSON", async () => {
    const out = await readJsonBody({ json: async () => ({ filename: "a.mp4" }) });
    expect(out).toEqual({ ok: true, value: { filename: "a.mp4" } });
  });

  it("returns {ok:false} when the body is not valid JSON (so the route 400s, not 500s)", async () => {
    const out = await readJsonBody({
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    expect(out).toEqual({ ok: false });
  });
});
