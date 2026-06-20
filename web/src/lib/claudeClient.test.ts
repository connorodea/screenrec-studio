import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runClaudeRequest } from "./claudeClient";
import { buildSummaryRequest } from "./summaryPrompt";

/** Minimal Message fake — only `content` matters for text extraction. */
function msg(content: unknown[]): Anthropic.Message {
  return { content } as unknown as Anthropic.Message;
}

const req = buildSummaryRequest([{ start: 0, text: "hi" }]);

describe("runClaudeRequest", () => {
  it("returns the concatenated text from the message content", async () => {
    const create = vi.fn(async (_req: Anthropic.MessageCreateParamsNonStreaming) =>
      msg([
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ])
    );

    const out = await runClaudeRequest(create, req);
    expect(out).toBe("Hello world");
    expect(create.mock.calls[0]![0]).toBe(req);
  });

  it("ignores non-text blocks (e.g. thinking)", async () => {
    const create = vi.fn(async (_req: Anthropic.MessageCreateParamsNonStreaming) =>
      msg([
        { type: "thinking", thinking: "deciding the title" },
        { type: "text", text: '{"title":"x"}' },
      ])
    );

    const out = await runClaudeRequest(create, req);
    expect(out).toBe('{"title":"x"}');
  });

  it("throws when the message has no text content (so the pipeline marks it failed)", async () => {
    const create = vi.fn(async (_req: Anthropic.MessageCreateParamsNonStreaming) =>
      msg([{ type: "thinking", thinking: "only thinking, no answer" }])
    );

    await expect(runClaudeRequest(create, req)).rejects.toThrow(/no text/i);
  });
});
