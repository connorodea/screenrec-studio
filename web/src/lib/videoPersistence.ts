import { normalizeSegments, type ChapterMarker, type TranscriptSegment } from "./watchViewModel";

/**
 * The read-side of the persistence boundary: coerces the `transcript` / `chapters`
 * JSON columns — which come back as `unknown` / `JsonValue` from any driver (pg
 * JSONB, Prisma `Json`) — into validated, normalized domain types before they
 * reach the handlers. Defensive: malformed entries are dropped (not thrown on) so
 * a corrupt stored row degrades to an empty transcript rather than crashing the
 * watch page. DB-agnostic and pure, so the data layer can use it regardless of
 * which driver/ORM is chosen at provisioning time. See ../../docs/share-loop-spec.md.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function coerceStoredSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];

  const raw: TranscriptSegment[] = [];
  for (const item of value) {
    if (isRecord(item) && typeof item.start === "number" && typeof item.text === "string") {
      raw.push({ start: item.start, text: item.text });
    }
  }
  // Reuse the watch-page normalization (trim / clamp negative starts / sort / drop empties).
  return normalizeSegments(raw);
}

export function coerceStoredChapters(value: unknown): ChapterMarker[] {
  if (!Array.isArray(value)) return [];

  const out: ChapterMarker[] = [];
  for (const item of value) {
    if (isRecord(item) && typeof item.start === "number" && typeof item.title === "string") {
      const title = item.title.trim();
      if (title) out.push({ start: Math.max(0, item.start), title });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
