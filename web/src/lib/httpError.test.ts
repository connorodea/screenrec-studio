import { describe, it, expect } from "vitest";
import { HttpClientError, isTransientHttpError } from "./httpError";

describe("HttpClientError", () => {
  it("carries service + status + body and builds a readable message", () => {
    const err = new HttpClientError("Deepgram", 503, "upstream down");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpClientError);
    expect(err.status).toBe(503);
    expect(err.service).toBe("Deepgram");
    expect(err.message).toContain("Deepgram");
    expect(err.message).toContain("503");
    expect(err.message).toContain("upstream down");
  });
});

describe("isTransientHttpError", () => {
  it("treats 429 and 5xx as transient (retryable)", () => {
    expect(isTransientHttpError(new HttpClientError("S", 429))).toBe(true);
    expect(isTransientHttpError(new HttpClientError("S", 500))).toBe(true);
    expect(isTransientHttpError(new HttpClientError("S", 503))).toBe(true);
  });

  it("treats 4xx other than 429 as permanent", () => {
    expect(isTransientHttpError(new HttpClientError("S", 400))).toBe(false);
    expect(isTransientHttpError(new HttpClientError("S", 401))).toBe(false);
    expect(isTransientHttpError(new HttpClientError("S", 404))).toBe(false);
  });

  it("treats a fetch network failure (TypeError) as transient", () => {
    expect(isTransientHttpError(new TypeError("fetch failed"))).toBe(true);
  });

  it("does not retry an unknown / generic error", () => {
    expect(isTransientHttpError(new Error("boom"))).toBe(false);
    expect(isTransientHttpError("nope")).toBe(false);
  });
});
