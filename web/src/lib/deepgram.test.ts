import { describe, it, expect } from "vitest";
import { deepgramToSegments, deepgramPlainTranscript } from "./deepgram";

const response = {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "Hello world. This is a test.",
            paragraphs: {
              paragraphs: [
                { sentences: [{ text: "Hello world.", start: 0.5, end: 1.2 }] },
                {
                  sentences: [
                    { text: "This is a test.", start: 1.5, end: 2.8 },
                    { text: "Bye.", start: 3.0, end: 3.2 },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

describe("deepgramToSegments", () => {
  it("flattens sentences into time-ordered segments", () => {
    expect(deepgramToSegments(response)).toEqual([
      { start: 0.5, text: "Hello world." },
      { start: 1.5, text: "This is a test." },
      { start: 3.0, text: "Bye." },
    ]);
  });

  it("sorts out-of-order sentences", () => {
    const r = {
      results: {
        channels: [
          {
            alternatives: [
              {
                paragraphs: {
                  paragraphs: [
                    { sentences: [{ text: "second", start: 5, end: 6 }, { text: "first", start: 1, end: 2 }] },
                  ],
                },
              },
            ],
          },
        ],
      },
    };
    expect(deepgramToSegments(r)).toEqual([
      { start: 1, text: "first" },
      { start: 5, text: "second" },
    ]);
  });

  it("returns [] for missing or empty structures", () => {
    expect(deepgramToSegments({})).toEqual([]);
    expect(deepgramToSegments({ results: { channels: [] } })).toEqual([]);
    expect(deepgramToSegments({ results: { channels: [{ alternatives: [{}] }] } })).toEqual([]);
  });
});

describe("deepgramPlainTranscript", () => {
  it("reads the top-level transcript", () => {
    expect(deepgramPlainTranscript(response)).toBe("Hello world. This is a test.");
  });

  it("returns empty string when absent", () => {
    expect(deepgramPlainTranscript({})).toBe("");
  });
});
