import { buildWatchViewModel, type VideoRow } from "./watchViewModel";

/**
 * Read handlers for `GET /v/:slug` (watch page) and `GET /api/videos/:id` (the
 * client's post-upload poll). The watch view returns the render model (with title
 * fallback); the metadata view returns the raw row fields so the client sees
 * `null` title/playback until processing + AI complete. See ../../docs/share-loop-spec.md.
 */

export interface VideoReadDeps {
  findVideoBySlug: (slug: string) => Promise<VideoRow | null>;
  findVideoById: (id: string) => Promise<VideoRow | null>;
  watchBaseUrl: string;
}

export interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleWatch(deps: VideoReadDeps, slug: string): Promise<HttpResult> {
  const row = await deps.findVideoBySlug(slug);
  if (!row) return { status: 404, body: { error: "not found" } };
  return { status: 200, body: buildWatchViewModel(row) as unknown as Record<string, unknown> };
}

export async function handleVideoMetadata(deps: VideoReadDeps, id: string): Promise<HttpResult> {
  const row = await deps.findVideoById(id);
  if (!row) return { status: 404, body: { error: "not found" } };

  const vm = buildWatchViewModel(row);
  return {
    status: 200,
    body: {
      status: row.status,
      slug: row.slug,
      watchUrl: `${deps.watchBaseUrl}/v/${row.slug}`,
      title: row.title, // raw (nullable) — the watch page applies the fallback, the poll shouldn't
      summary: row.summary,
      chapters: vm.chapters,
      transcriptReady: vm.segments.length > 0,
      playback: vm.playback,
    },
  };
}
