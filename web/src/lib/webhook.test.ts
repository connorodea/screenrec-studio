import { describe, it, expect } from "vitest";
import { parseSignatureHeader, computeSignature, verifyWebhook } from "./webhook";

const secret = "whsec_test";
const body = JSON.stringify({ uid: "abc", status: { state: "ready" } });
const time = "1700000000";
const validSig = computeSignature(secret, time, body);
const validHeader = `time=${time},sig1=${validSig}`;

describe("parseSignatureHeader", () => {
  it("parses time and sig1", () => {
    expect(parseSignatureHeader("time=123,sig1=abc")).toEqual({ time: "123", sig1: "abc" });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseSignatureHeader("  time=123 , sig1=abc ")).toEqual({ time: "123", sig1: "abc" });
  });

  it("returns null when a field is missing or malformed", () => {
    expect(parseSignatureHeader("time=123")).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
  });
});

describe("verifyWebhook", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyWebhook({ header: validHeader, body, secret }).valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyWebhook({ header: validHeader, body: body + "x", secret }).valid).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyWebhook({ header: validHeader, body, secret: "wrong" }).valid).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verifyWebhook({ header: "nope", body, secret }).valid).toBe(false);
  });

  it("accepts a fresh timestamp within tolerance", () => {
    const result = verifyWebhook({
      header: validHeader, body, secret, now: 1_700_000_000_000, toleranceSeconds: 300,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a timestamp outside tolerance (replay)", () => {
    const result = verifyWebhook({
      header: validHeader, body, secret, now: 1_700_001_000_000, toleranceSeconds: 300, // +1000s
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/tolerance/);
  });

  it("does not throw on an odd-length signature", () => {
    expect(() => verifyWebhook({ header: "time=1,sig1=abc", body, secret })).not.toThrow();
    expect(verifyWebhook({ header: "time=1,sig1=abc", body, secret }).valid).toBe(false);
  });
});
