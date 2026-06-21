import { describe, it, expect } from "vitest";
import { cloudflareStreamUrls } from "./streamUrls";

const HOST = "customer-abc123.cloudflarestream.com";

describe("cloudflareStreamUrls", () => {
  it("builds the HLS, DASH, thumbnail, and MP4-download URLs for a video", () => {
    expect(cloudflareStreamUrls(HOST, "uid-xyz")).toEqual({
      hls: "https://customer-abc123.cloudflarestream.com/uid-xyz/manifest/video.m3u8",
      dash: "https://customer-abc123.cloudflarestream.com/uid-xyz/manifest/video.mpd",
      thumbnail: "https://customer-abc123.cloudflarestream.com/uid-xyz/thumbnails/thumbnail.jpg",
      mp4Download: "https://customer-abc123.cloudflarestream.com/uid-xyz/downloads/default.mp4",
    });
  });

  it("normalizes a subdomain given with a protocol and/or trailing slash", () => {
    const urls = cloudflareStreamUrls("https://customer-abc123.cloudflarestream.com/", "uid-1");
    expect(urls.hls).toBe(
      "https://customer-abc123.cloudflarestream.com/uid-1/manifest/video.m3u8"
    );
  });

  it("throws on a blank uid", () => {
    expect(() => cloudflareStreamUrls(HOST, "  ")).toThrow(/uid/i);
  });

  it("throws on a blank customer subdomain", () => {
    expect(() => cloudflareStreamUrls("", "uid-1")).toThrow(/subdomain/i);
  });
});
