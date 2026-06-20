import { normalizeSegments, type TranscriptSegment } from "./watchViewModel";

/**
 * Maps a Deepgram pre-recorded STT response to the transcript shape the watch
 * page renders. Defensive against missing fields (Deepgram omits `paragraphs`
 * unless requested), and reuses `normalizeSegments` for trim/clamp/sort.
 * Tested against fixture payloads — no API key needed.
 */

interface DeepgramSentence {
  text?: string;
  start?: number;
}
interface DeepgramParagraph {
  sentences?: DeepgramSentence[];
}
interface DeepgramAlternative {
  transcript?: string;
  paragraphs?: { paragraphs?: DeepgramParagraph[] };
}
interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: DeepgramAlternative[] }>;
  };
}

function firstAlternative(response: DeepgramResponse): DeepgramAlternative | undefined {
  return response.results?.channels?.[0]?.alternatives?.[0];
}

export function deepgramToSegments(response: DeepgramResponse): TranscriptSegment[] {
  const paragraphs = firstAlternative(response)?.paragraphs?.paragraphs ?? [];
  const raw: TranscriptSegment[] = [];
  for (const paragraph of paragraphs) {
    for (const sentence of paragraph.sentences ?? []) {
      raw.push({ start: sentence.start ?? 0, text: sentence.text ?? "" });
    }
  }
  return normalizeSegments(raw);
}

export function deepgramPlainTranscript(response: DeepgramResponse): string {
  return firstAlternative(response)?.transcript ?? "";
}
