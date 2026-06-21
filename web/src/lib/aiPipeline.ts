import type Anthropic from "@anthropic-ai/sdk";
import { buildDeepgramRequest } from "./deepgramRequest";
import { deepgramToSegments } from "./deepgram";
import { buildSummaryRequest } from "./summaryPrompt";
import { parseAiSummary } from "./aiSummary";
import type { ChapterMarker, TranscriptSegment } from "./watchViewModel";

/**
 * The AI pipeline that runs after a video reaches `ready` (enqueued by the Stream
 * webhook): transcribe the audio with Deepgram, summarize the transcript with
 * Claude, then persist `{title, summary, chapters, transcript}` and mark the video
 * complete. This is the spine that composes the pure builders/parsers — only the
 * two network boundaries (`callDeepgram` / `callClaude`) and the DB writes are
 * injected, so the whole flow is testable with fakes. See ../../docs/share-loop-spec.md.
 */

export interface AiPipelineDeps {
  deepgramApiKey: string;
  callDeepgram: (req: ReturnType<typeof buildDeepgramRequest>) => Promise<unknown>;
  callClaude: (req: Anthropic.MessageCreateParamsNonStreaming) => Promise<string>;
  persistSummary: (
    videoId: string,
    data: {
      title: string | null;
      summary: string | null;
      chapters: ChapterMarker[];
      transcript: TranscriptSegment[];
    }
  ) => Promise<void>;
  markComplete: (videoId: string) => Promise<void>;
  markFailed: (videoId: string, reason: string) => Promise<void>;
}

export type AiPipelineResult = { ok: true } | { ok: false; error: string };

export async function runAiPipeline(
  deps: AiPipelineDeps,
  input: { videoId: string; audioUrl: string }
): Promise<AiPipelineResult> {
  const { videoId, audioUrl } = input;

  try {
    const dgRaw = await deps.callDeepgram(buildDeepgramRequest(audioUrl, deps.deepgramApiKey));
    const transcript = deepgramToSegments(dgRaw as Parameters<typeof deepgramToSegments>[0]);

    // No speech detected — nothing to summarize. Complete with an empty transcript
    // so the watch page renders (with its default-title fallback) rather than hanging.
    if (transcript.length === 0) {
      await deps.persistSummary(videoId, { title: null, summary: null, chapters: [], transcript: [] });
      await deps.markComplete(videoId);
      return { ok: true };
    }

    const modelText = await deps.callClaude(buildSummaryRequest(transcript));
    const parsed = parseAiSummary(modelText);
    if (!parsed.ok) {
      const error = `AI summary unparseable: ${parsed.errors.join("; ")}`;
      await deps.markFailed(videoId, error);
      return { ok: false, error };
    }

    await deps.persistSummary(videoId, {
      title: parsed.value.title,
      summary: parsed.value.summary,
      chapters: parsed.value.chapters,
      transcript,
    });
    await deps.markComplete(videoId);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "AI pipeline failed";
    await deps.markFailed(videoId, error);
    return { ok: false, error };
  }
}
