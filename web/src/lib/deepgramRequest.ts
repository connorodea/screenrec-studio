/**
 * Builds the Deepgram pre-recorded `listen` request for a hosted audio URL. Pure
 * construction (URL + headers + body), tested without calling Deepgram. The
 * response is parsed by `deepgramToSegments`. See ../../docs/share-loop-spec.md.
 */

export const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";
export const DEFAULT_DEEPGRAM_MODEL = "nova-3";

export interface DeepgramOptions {
  model?: string;
  language?: string;
  smartFormat?: boolean;
  paragraphs?: boolean;
  punctuate?: boolean;
}

export function deepgramListenURL(opts: DeepgramOptions = {}): string {
  const params = new URLSearchParams({
    model: opts.model ?? DEFAULT_DEEPGRAM_MODEL,
    language: opts.language ?? "en",
    smart_format: String(opts.smartFormat ?? true),
    paragraphs: String(opts.paragraphs ?? true),
    punctuate: String(opts.punctuate ?? true),
  });
  return `${DEEPGRAM_LISTEN_URL}?${params.toString()}`;
}

export function buildDeepgramRequest(
  audioUrl: string,
  apiKey: string,
  opts: DeepgramOptions = {}
): { url: string; method: "POST"; headers: Record<string, string>; body: string } {
  return {
    url: deepgramListenURL(opts),
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  };
}
