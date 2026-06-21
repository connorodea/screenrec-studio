import { describe, it, expect } from "vitest";
import {
  buildSummaryRequest,
  formatTranscript,
  SUMMARY_SYSTEM_PROMPT,
  DEFAULT_SUMMARY_MODEL,
} from "./summaryPrompt";

const segments = [
  { start: 0.5, text: "Hello world." },
  { start: 1.5, text: "This is a test." },
];

describe("formatTranscript", () => {
  it("prefixes each line with a [seconds] marker", () => {
    expect(formatTranscript(segments)).toBe("[0.5] Hello world.\n[1.5] This is a test.");
  });

  it("handles an empty transcript", () => {
    expect(formatTranscript([])).toBe("");
  });
});

describe("SUMMARY_SYSTEM_PROMPT", () => {
  it("asks for JSON title/summary/chapters", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/JSON/);
    for (const field of ["title", "summary", "chapters"]) {
      expect(SUMMARY_SYSTEM_PROMPT).toContain(field);
    }
  });
});

describe("buildSummaryRequest", () => {
  it("defaults to the configured model", () => {
    expect(buildSummaryRequest(segments).model).toBe(DEFAULT_SUMMARY_MODEL);
    expect(DEFAULT_SUMMARY_MODEL).toBe("claude-opus-4-7");
  });

  it("honors a model + maxTokens override", () => {
    const req = buildSummaryRequest(segments, { model: "claude-haiku-4-5", maxTokens: 512 });
    expect(req.model).toBe("claude-haiku-4-5");
    expect(req.max_tokens).toBe(512);
  });

  it("caches the stable system prefix", () => {
    const sys = buildSummaryRequest(segments).system as Array<{
      type: string;
      text: string;
      cache_control?: { type: string };
    }>;
    expect(Array.isArray(sys)).toBe(true);
    expect(sys[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(sys[0]!.text).toBe(SUMMARY_SYSTEM_PROMPT);
  });

  it("puts the transcript in the user message", () => {
    const req = buildSummaryRequest(segments);
    expect(req.messages[0]!.role).toBe("user");
    const content = req.messages[0]!.content as string;
    expect(content).toContain("[0.5] Hello world.");
    expect(content).toContain("[1.5] This is a test.");
  });

  it("sets a non-zero max_tokens by default", () => {
    expect(buildSummaryRequest(segments).max_tokens).toBeGreaterThan(0);
  });
});
