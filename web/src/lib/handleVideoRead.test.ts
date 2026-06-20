import { describe, it, expect, vi } from "vitest";
import { handleWatch, handleVideoMetadata, type VideoReadDeps } from "./handleVideoRead";
import type { VideoRow } from "./watchViewModel";

function row(o: Partial<VideoRow> = {}): VideoRow {
  return {
    slug: "ab12",
    status: "ready",
    title: "Demo",
    summary: "S",
    transcript: [{ start: 0, text: "hi" }],
    chapters: [{ start: 0, title: "Intro" }],
    streamHls: "https://cf/m.m3u8",
    thumbnail: "https://cf/t.jpg",
    ...o,
  };
}

function deps(r: VideoRow | null): VideoReadDeps {
  return {
    findVideoBySlug: vi.fn(async () => r),
    findVideoById: vi.fn(async () => r),
    watchBaseUrl: "https://share.example.com",
  };
}

describe("handleWatch", () => {
  it("renders the view-model for a known slug", async () => {
    const res = await handleWatch(deps(row()), "ab12");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("ab12");
    expect(res.body.title).toBe("Demo");
    expect((res.body.playback as { hls: string } | null)?.hls).toBe("https://cf/m.m3u8");
  });

  it("falls back to a default title", async () => {
    const res = await handleWatch(deps(row({ title: null })), "ab12");
    expect(res.body.title).toBe("Untitled recording");
  });

  it("404s an unknown slug", async () => {
    const res = await handleWatch(deps(null), "nope");
    expect(res.status).toBe(404);
  });
});

describe("handleVideoMetadata", () => {
  it("returns raw status/title/playback for the client poll", async () => {
    const res = await handleVideoMetadata(deps(row()), "vid-1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.title).toBe("Demo");
    expect(res.body.watchUrl).toBe("https://share.example.com/v/ab12");
    expect(res.body.transcriptReady).toBe(true);
    expect((res.body.playback as { hls: string } | null)?.hls).toBe("https://cf/m.m3u8");
  });

  it("reports nulls while still processing", async () => {
    const res = await handleVideoMetadata(
      deps(row({ status: "processing", title: null, summary: null, transcript: null, streamHls: null })),
      "vid-1"
    );
    expect(res.body.status).toBe("processing");
    expect(res.body.title).toBeNull();
    expect(res.body.playback).toBeNull();
    expect(res.body.transcriptReady).toBe(false);
  });

  it("404s an unknown id", async () => {
    const res = await handleVideoMetadata(deps(null), "nope");
    expect(res.status).toBe(404);
  });
});
