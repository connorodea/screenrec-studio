/**
 * Derives the Cloudflare Stream playback + download URLs from the account's
 * customer subdomain and a video uid. Pure construction so it's unit-testable
 * without an account. The data layer uses `hls` + `thumbnail` when `markReady`
 * fires (the watch handlers only read `row.streamHls`), and the webhook -> AI
 * handoff uses `mp4Download` as the single-file audio source for Deepgram.
 * `customerSubdomain` is the per-account host from the Cloudflare dashboard
 * (e.g. `customer-<code>.cloudflarestream.com`); provisioning supplies it.
 * See ../../docs/share-loop-spec.md.
 */

export interface StreamUrls {
  hls: string;
  dash: string;
  thumbnail: string;
  mp4Download: string;
}

function normalizeHost(subdomain: string): string {
  const host = subdomain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!host) throw new Error("missing Cloudflare Stream customer subdomain");
  return host;
}

export function cloudflareStreamUrls(customerSubdomain: string, uid: string): StreamUrls {
  const host = normalizeHost(customerSubdomain);
  const id = uid.trim();
  if (!id) throw new Error("missing Cloudflare Stream video uid");

  const base = `https://${host}/${id}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg`,
    mp4Download: `${base}/downloads/default.mp4`,
  };
}
