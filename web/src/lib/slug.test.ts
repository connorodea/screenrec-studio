import { describe, it, expect } from "vitest";
import { makeSlug, isValidSlug, SLUG_ALPHABET } from "./slug";

describe("SLUG_ALPHABET", () => {
  it("excludes visually ambiguous characters", () => {
    for (const c of ["0", "O", "1", "l", "I"]) {
      expect(SLUG_ALPHABET.includes(c)).toBe(false);
    }
  });

  it("has only unique characters", () => {
    expect(new Set(SLUG_ALPHABET).size).toBe(SLUG_ALPHABET.length);
  });
});

describe("makeSlug", () => {
  it("defaults to length 11", () => {
    expect(makeSlug().length).toBe(11);
  });

  it("honors a custom length", () => {
    expect(makeSlug(20).length).toBe(20);
  });

  it("uses only alphabet characters", () => {
    const s = makeSlug(200);
    expect([...s].every((c) => SLUG_ALPHABET.includes(c))).toBe(true);
  });

  it("is deterministic for a given RNG", () => {
    const rng = () => 0; // always selects the first character
    expect(makeSlug(6, rng)).toBe(SLUG_ALPHABET[0]!.repeat(6));
  });

  it("maps RNG output across the whole alphabet", () => {
    const rng = () => 0.999999; // selects the last character
    expect(makeSlug(3, rng)).toBe(SLUG_ALPHABET[SLUG_ALPHABET.length - 1]!.repeat(3));
  });

  it("throws on a non-positive length", () => {
    expect(() => makeSlug(0)).toThrow();
    expect(() => makeSlug(-5)).toThrow();
  });
});

describe("isValidSlug", () => {
  it("accepts a generated slug", () => {
    expect(isValidSlug(makeSlug())).toBe(true);
  });

  it("rejects empty", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects ambiguous or out-of-alphabet characters", () => {
    expect(isValidSlug("abc0")).toBe(false); // digit 0 excluded
    expect(isValidSlug("ab-cd")).toBe(false); // hyphen
    expect(isValidSlug("abcO")).toBe(false); // capital O excluded
  });
});
