import { describe, it, expect } from "vitest";
import { canTransition, isTerminal, transition, type VideoStatus } from "./videoStatus";

describe("canTransition", () => {
  it("allows the happy path", () => {
    expect(canTransition("awaiting_upload", "processing")).toBe(true);
    expect(canTransition("processing", "ready")).toBe(true);
  });

  it("allows failure from non-terminal states", () => {
    expect(canTransition("awaiting_upload", "failed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
  });

  it("forbids skipping processing", () => {
    expect(canTransition("awaiting_upload", "ready")).toBe(false);
  });

  it("forbids going backwards", () => {
    expect(canTransition("processing", "awaiting_upload")).toBe(false);
    expect(canTransition("ready", "processing")).toBe(false);
  });

  it("forbids self-transitions", () => {
    expect(canTransition("processing", "processing")).toBe(false);
  });

  it("locks terminal states", () => {
    const terminals: VideoStatus[] = ["ready", "failed"];
    const all: VideoStatus[] = ["awaiting_upload", "processing", "ready", "failed"];
    for (const from of terminals) {
      for (const to of all) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe("isTerminal", () => {
  it("marks ready and failed terminal", () => {
    expect(isTerminal("ready")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
  });

  it("marks in-flight states non-terminal", () => {
    expect(isTerminal("awaiting_upload")).toBe(false);
    expect(isTerminal("processing")).toBe(false);
  });
});

describe("transition", () => {
  it("returns the next state on a legal move", () => {
    expect(transition("processing", "ready")).toBe("ready");
  });

  it("throws on an illegal move", () => {
    expect(() => transition("awaiting_upload", "ready")).toThrow();
  });
});
