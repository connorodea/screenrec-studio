import { describe, it, expect } from "vitest";
import {
  buildWatchViewModel,
  normalizeSegments,
  DEFAULT_TITLE,
  type VideoRow,
} from "./watchViewModel";

function row(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    slug: "ab12",
    status: "ready",
    title: "My demo",
    summary: "A short demo.",
    transcript: [{ start: 0, text: "hello" }],
    chapters: [{ start: 0, title: "Intro" }],
    streamHls: "https://cf/uid/manifest/video.m3u8",
    thumbnail: "https://cf/uid/thumb.jpg",
    ...overrides,
  };
}

describe("buildWatchViewModel", () => {
  it("exposes playback only when ready and an HLS URL exists", () => {
    expect(buildWatchViewModel(row()).playback?.hls).toBe("https://cf/uid/manifest/video.m3u8");
    expect(buildWatchViewModel(row({ status: "processing" })).playback).toBeNull();
    expect(buildWatchViewModel(row({ streamHls: null })).playback).toBeNull();
  });

  it("reports readiness from status", () => {
    expect(buildWatchViewModel(row()).isReady).toBe(true);
    expect(buildWatchViewModel(row({ status: "processing" })).isReady).toBe(false);
  });

  it("falls back to a default title", () => {
    expect(buildWatchViewModel(row({ title: null })).title).toBe(DEFAULT_TITLE);
    expect(buildWatchViewModel(row({ title: "   " })).title).toBe(DEFAULT_TITLE);
    expect(buildWatchViewModel(row({ title: "Real" })).title).toBe("Real");
  });

  it("passes summary through", () => {
    expect(buildWatchViewModel(row({ summary: null })).summary).toBeNull();
    expect(buildWatchViewModel(row({ summary: "x" })).summary).toBe("x");
  });

  it("handles null transcript/chapters", () => {
    const vm = buildWatchViewModel(row({ transcript: null, chapters: null }));
    expect(vm.segments).toEqual([]);
    expect(vm.chapters).toEqual([]);
  });

  it("orders and filters chapters", () => {
    const vm = buildWatchViewModel(row({
      chapters: [{ start: 10, title: "B" }, { start: 2, title: "  " }, { start: 0, title: "A" }],
    }));
    expect(vm.chapters).toEqual([{ start: 0, title: "A" }, { start: 10, title: "B" }]);
  });
});

describe("normalizeSegments", () => {
  it("filters empty text, trims, clamps negative starts, and sorts", () => {
    const out = normalizeSegments([
      { start: 5, text: "world" },
      { start: 0, text: " hello " },
      { start: 2, text: "  " },
      { start: -3, text: "x" },
    ]);
    expect(out).toEqual([
      { start: 0, text: "hello" },
      { start: 0, text: "x" },
      { start: 5, text: "world" },
    ]);
  });
});
