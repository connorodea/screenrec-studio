import { describe, it, expect } from "vitest";
import {
  deepgramListenURL,
  buildDeepgramRequest,
  DEEPGRAM_LISTEN_URL,
  DEFAULT_DEEPGRAM_MODEL,
} from "./deepgramRequest";

describe("deepgramListenURL", () => {
  it("defaults model + transcription features", () => {
    const url = new URL(deepgramListenURL());
    expect(`${url.origin}${url.pathname}`).toBe(DEEPGRAM_LISTEN_URL);
    expect(url.searchParams.get("model")).toBe(DEFAULT_DEEPGRAM_MODEL);
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("smart_format")).toBe("true");
    expect(url.searchParams.get("paragraphs")).toBe("true");
    expect(url.searchParams.get("punctuate")).toBe("true");
  });

  it("honors overrides", () => {
    const url = new URL(deepgramListenURL({ model: "nova-2", language: "es", smartFormat: false }));
    expect(url.searchParams.get("model")).toBe("nova-2");
    expect(url.searchParams.get("language")).toBe("es");
    expect(url.searchParams.get("smart_format")).toBe("false");
  });
});

describe("buildDeepgramRequest", () => {
  it("posts the audio URL with Token auth and JSON body", () => {
    const req = buildDeepgramRequest("https://cf/audio.mp4", "dg-key");
    expect(req.method).toBe("POST");
    expect(new URL(req.url).pathname).toBe("/v1/listen");
    expect(req.headers["Authorization"]).toBe("Token dg-key");
    expect(req.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(req.body)).toEqual({ url: "https://cf/audio.mp4" });
  });

  it("threads options into the URL", () => {
    const req = buildDeepgramRequest("https://cf/a.mp4", "k", { model: "nova-2" });
    expect(new URL(req.url).searchParams.get("model")).toBe("nova-2");
  });
});
