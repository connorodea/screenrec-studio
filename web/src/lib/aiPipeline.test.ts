import { describe, it, expect, vi } from "vitest";
import { runAiPipeline, type AiPipelineDeps } from "./aiPipeline";

const dgResponse = {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "hello world this is a demo",
            paragraphs: {
              paragraphs: [
                {
                  sentences: [
                    { start: 0, text: "Hello." },
                    { start: 2.5, text: "This is a demo." },
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

const claudeJson = JSON.stringify({
  title: "Demo recording",
  summary: "A short demo of the product.",
  chapters: [{ start: 0, title: "Intro" }],
});

function deps(overrides: Partial<AiPipelineDeps> = {}): AiPipelineDeps {
  return {
    deepgramApiKey: "dg-key",
    callDeepgram: vi.fn(async () => dgResponse),
    callClaude: vi.fn(async () => claudeJson),
    persistSummary: vi.fn(async () => {}),
    markComplete: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runAiPipeline", () => {
  it("transcribes, summarizes, persists, and marks complete", async () => {
    const d = deps();
    const res = await runAiPipeline(d, { videoId: "vid-1", audioUrl: "https://cf/a.mp4" });

    expect(res.ok).toBe(true);

    const dgReq = (d.callDeepgram as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(dgReq.headers["Authorization"]).toBe("Token dg-key");
    expect(JSON.parse(dgReq.body)).toEqual({ url: "https://cf/a.mp4" });

    expect(d.persistSummary).toHaveBeenCalledWith("vid-1", {
      title: "Demo recording",
      summary: "A short demo of the product.",
      chapters: [{ start: 0, title: "Intro" }],
      transcript: [
        { start: 0, text: "Hello." },
        { start: 2.5, text: "This is a demo." },
      ],
    });
    expect(d.markComplete).toHaveBeenCalledWith("vid-1");
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  it("feeds the [seconds]-marked transcript to Claude", async () => {
    const d = deps();
    await runAiPipeline(d, { videoId: "vid-1", audioUrl: "https://cf/a.mp4" });

    const claudeReq = (d.callClaude as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const userMsg = claudeReq.messages[0].content as string;
    expect(userMsg).toContain("[0.0] Hello.");
    expect(userMsg).toContain("[2.5] This is a demo.");
  });

  it("skips Claude and completes with an empty transcript when there is no speech", async () => {
    const d = deps({ callDeepgram: vi.fn(async () => ({ results: { channels: [] } })) });
    const res = await runAiPipeline(d, { videoId: "vid-2", audioUrl: "https://cf/silent.mp4" });

    expect(res.ok).toBe(true);
    expect(d.callClaude).not.toHaveBeenCalled();
    expect(d.persistSummary).toHaveBeenCalledWith("vid-2", {
      title: null,
      summary: null,
      chapters: [],
      transcript: [],
    });
    expect(d.markComplete).toHaveBeenCalledWith("vid-2");
  });

  it("marks failed without persisting when the model output is unparseable", async () => {
    const d = deps({ callClaude: vi.fn(async () => "Sorry, I can't do that.") });
    const res = await runAiPipeline(d, { videoId: "vid-3", audioUrl: "https://cf/a.mp4" });

    expect(res.ok).toBe(false);
    expect(d.persistSummary).not.toHaveBeenCalled();
    expect(d.markComplete).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("vid-3", expect.any(String));
  });

  it("marks failed (and never calls Claude) when transcription throws", async () => {
    const d = deps({
      callDeepgram: vi.fn(async () => {
        throw new Error("deepgram 500");
      }),
    });
    const res = await runAiPipeline(d, { videoId: "vid-4", audioUrl: "https://cf/a.mp4" });

    expect(res.ok).toBe(false);
    expect(d.callClaude).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("vid-4", expect.any(String));
  });
});
