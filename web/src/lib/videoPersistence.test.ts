import { describe, it, expect } from "vitest";
import { coerceStoredSegments, coerceStoredChapters } from "./videoPersistence";

describe("coerceStoredSegments", () => {
  it("coerces a well-formed stored value into normalized segments", () => {
    const value = [
      { start: 2.5, text: "second" },
      { start: 0, text: "first" },
    ];
    expect(coerceStoredSegments(value)).toEqual([
      { start: 0, text: "first" },
      { start: 2.5, text: "second" },
    ]);
  });

  it("drops malformed entries and trims/clamps the rest", () => {
    const value = [
      { start: -3, text: "  clamp me  " },
      { start: 1, text: "" }, // empty text dropped
      { start: "nope", text: "bad start" }, // wrong type dropped
      { text: "no start" }, // missing start dropped
      "garbage",
    ];
    expect(coerceStoredSegments(value)).toEqual([{ start: 0, text: "clamp me" }]);
  });

  it("returns [] for a non-array (null, object, garbage)", () => {
    expect(coerceStoredSegments(null)).toEqual([]);
    expect(coerceStoredSegments({ not: "an array" })).toEqual([]);
    expect(coerceStoredSegments("[]")).toEqual([]);
  });
});

describe("coerceStoredChapters", () => {
  it("coerces, trims titles, drops empties, and sorts by start", () => {
    const value = [
      { start: 10, title: "Later" },
      { start: -1, title: "  Intro  " },
      { start: 5, title: "   " }, // blank title dropped
      { start: 3 }, // missing title dropped
    ];
    expect(coerceStoredChapters(value)).toEqual([
      { start: 0, title: "Intro" },
      { start: 10, title: "Later" },
    ]);
  });

  it("returns [] for a non-array", () => {
    expect(coerceStoredChapters(null)).toEqual([]);
    expect(coerceStoredChapters(42)).toEqual([]);
  });
});
