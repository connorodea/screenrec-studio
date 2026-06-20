import type Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./watchViewModel";

/**
 * Builds the Anthropic Messages request that turns a recording transcript into
 * `{ title, summary, chapters }` JSON. The output is validated by `parseAiSummary`.
 * Pure construction — the actual `client.messages.create(...)` call (with an API
 * key) is the integration step. Per the claude-api skill: default `claude-opus-4-7`,
 * and cache the stable system prefix (volatile transcript goes after it).
 */

export const DEFAULT_SUMMARY_MODEL = "claude-opus-4-7";

export const SUMMARY_SYSTEM_PROMPT = [
  "You summarize a screen-recording transcript for a shareable video page.",
  "",
  'Output ONLY a JSON object of the form:',
  '{"title": string, "summary": string, "chapters": [{"start": number, "title": string}]}',
  "",
  "- title: a concise, specific title (about 10 words or fewer).",
  "- summary: 2 to 4 sentences describing what the recording covers.",
  "- chapters: time-stamped sections using the [seconds] markers in the transcript;",
  "  use an empty array if the recording is too short to chapter.",
  "",
  "No prose, no markdown, no code fences — just the JSON object.",
].join("\n");

/** One transcript line per segment, each prefixed with a `[seconds]` marker so the
 *  model can cite times when choosing chapter starts. */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${s.start.toFixed(1)}] ${s.text}`).join("\n");
}

export function buildSummaryRequest(
  segments: TranscriptSegment[],
  opts: { model?: string; maxTokens?: number } = {}
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: opts.model ?? DEFAULT_SUMMARY_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: [
      { type: "text", text: SUMMARY_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: `Transcript:\n${formatTranscript(segments)}` }],
  };
}
