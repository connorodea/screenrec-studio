import { describe, it, expect } from "vitest";
import { parseAiSummary, extractJson } from "./aiSummary";

const valid = JSON.stringify({
  title: "My demo",
  summary: "A short demo.",
  chapters: [{ start: 0, title: "Intro" }],
});

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps a ```json code fence", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("pulls an object out of surrounding prose", () => {
    expect(extractJson('Sure! {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it("returns null when there is no JSON", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("parseAiSummary", () => {
  it("accepts a valid summary", () => {
    const r = parseAiSummary(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("My demo");
      expect(r.value.chapters).toHaveLength(1);
    }
  });

  it("accepts a fenced response", () => {
    expect(parseAiSummary("```json\n" + valid + "\n```").ok).toBe(true);
  });

  it("accepts a prose-wrapped response", () => {
    expect(parseAiSummary("Here you go: " + valid + " — done").ok).toBe(true);
  });

  it("strips unknown fields", () => {
    const r = parseAiSummary(JSON.stringify({
      title: "T", summary: "S", chapters: [], extra: "x",
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect("extra" in r.value).toBe(false);
  });

  it("rejects a missing or empty title", () => {
    expect(parseAiSummary(JSON.stringify({ summary: "S", chapters: [] })).ok).toBe(false);
    expect(parseAiSummary(JSON.stringify({ title: "", summary: "S", chapters: [] })).ok).toBe(false);
  });

  it("rejects a negative chapter start", () => {
    const r = parseAiSummary(JSON.stringify({
      title: "T", summary: "S", chapters: [{ start: -1, title: "x" }],
    }));
    expect(r.ok).toBe(false);
  });

  it("rejects non-JSON model output", () => {
    const r = parseAiSummary("I could not produce a summary.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/no JSON/i);
  });
});
