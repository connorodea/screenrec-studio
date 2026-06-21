import { describe, it, expect, vi } from "vitest";
import { videoMetadataRoute } from "./videoMetadataRoute";
import type { VideoReadDeps } from "./handleVideoRead";
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

describe("videoMetadataRoute", () => {
  it("returns 200 with the poll metadata for a known video", async () => {
    const res = await videoMetadataRoute("vid-1", deps(row()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; watchUrl: string; transcriptReady: boolean };
    expect(body.status).toBe("ready");
    expect(body.watchUrl).toBe("https://share.example.com/v/ab12");
    expect(body.transcriptReady).toBe(true);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await videoMetadataRoute("nope", deps(null));
    expect(res.status).toBe(404);
  });
});
