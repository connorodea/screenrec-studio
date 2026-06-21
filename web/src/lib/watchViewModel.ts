import type { VideoStatus } from "./videoStatus";

export interface TranscriptSegment {
  start: number;
  text: string;
}

export interface ChapterMarker {
  start: number;
  title: string;
}

/** The stored video row, as relevant to rendering the watch page. */
export interface VideoRow {
  slug: string;
  status: VideoStatus;
  title: string | null;
  summary: string | null;
  transcript: TranscriptSegment[] | null;
  chapters: ChapterMarker[] | null;
  streamHls: string | null;
  thumbnail: string | null;
}

/** Render-ready model for `GET /v/:slug`. */
export interface WatchViewModel {
  slug: string;
  title: string;
  summary: string | null;
  isReady: boolean;
  playback: { hls: string; thumbnail: string | null } | null;
  segments: TranscriptSegment[];
  chapters: ChapterMarker[];
}

export const DEFAULT_TITLE = "Untitled recording";

export function buildWatchViewModel(row: VideoRow): WatchViewModel {
  const isReady = row.status === "ready";
  return {
    slug: row.slug,
    title: row.title?.trim() || DEFAULT_TITLE,
    summary: row.summary,
    isReady,
    playback: isReady && row.streamHls ? { hls: row.streamHls, thumbnail: row.thumbnail } : null,
    segments: normalizeSegments(row.transcript ?? []),
    chapters: normalizeChapters(row.chapters ?? []),
  };
}

/** Drops empty text, trims, clamps negative starts to 0, sorts by start (stable). */
export function normalizeSegments(raw: TranscriptSegment[]): TranscriptSegment[] {
  return raw
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ start: Math.max(0, s.start), text: s.text.trim() }))
    .sort((a, b) => a.start - b.start);
}

function normalizeChapters(raw: ChapterMarker[]): ChapterMarker[] {
  return raw
    .filter((c) => c.title.trim().length > 0)
    .map((c) => ({ start: Math.max(0, c.start), title: c.title.trim() }))
    .sort((a, b) => a.start - b.start);
}
