import type Anthropic from "@anthropic-ai/sdk";

/**
 * The live Claude client — the real `callClaude` dependency that `runAiPipeline`
 * injects. `buildSummaryRequest` already constructs the full Messages request
 * (model `claude-opus-4-7`, cached system prefix, non-streaming, 1024 max_tokens),
 * so this is a pure executor: run it through the injected SDK `messages.create`
 * and return the concatenated text for `parseAiSummary`. The `create` fn is
 * injected so this is unit-testable with a fake — the route file passes the real
 * `new Anthropic({apiKey}).messages.create`. Throws when the model returns no text
 * (the pipeline catches it and marks the video failed). See ../../docs/share-loop-spec.md.
 */

export type MessagesCreate = (
  req: Anthropic.MessageCreateParamsNonStreaming
) => Promise<Anthropic.Message>;

export async function runClaudeRequest(
  create: MessagesCreate,
  req: Anthropic.MessageCreateParamsNonStreaming
): Promise<string> {
  const message = await create(req);

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) {
    throw new Error("Claude returned no text content");
  }

  return text;
}
