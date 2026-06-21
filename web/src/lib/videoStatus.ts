/**
 * The processing lifecycle of an uploaded recording. Server-authoritative — the
 * Cloudflare Stream `ready` webhook drives `processing -> ready`. Mirrors the
 * macOS client's `VideoStatus` / `RecordingState` transition discipline so an
 * out-of-order update is a caught error, not a corrupt row.
 */
export type VideoStatus = "awaiting_upload" | "processing" | "ready" | "failed";

const TRANSITIONS: Record<VideoStatus, readonly VideoStatus[]> = {
  awaiting_upload: ["processing", "failed"],
  processing: ["ready", "failed"],
  ready: [],
  failed: [],
};

export function canTransition(from: VideoStatus, to: VideoStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: VideoStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Returns `to` if the move is legal; throws otherwise. */
export function transition(from: VideoStatus, to: VideoStatus): VideoStatus {
  if (!canTransition(from, to)) {
    throw new Error(`illegal video status transition: ${from} -> ${to}`);
  }
  return to;
}
