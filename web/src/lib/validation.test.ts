import { describe, it, expect } from "vitest";
import { parseUploadRequest } from "./validation";

const valid = { filename: "rec.mp4", durationSeconds: 12.5, sizeBytes: 1024 };

describe("parseUploadRequest", () => {
  it("accepts a valid body", () => {
    const r = parseUploadRequest(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid);
  });

  it("strips unknown fields", () => {
    const r = parseUploadRequest({ ...valid, sneaky: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid);
  });

  it("rejects a missing filename", () => {
    const { sizeBytes, durationSeconds } = valid;
    const r = parseUploadRequest({ sizeBytes, durationSeconds });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/filename/);
  });

  it("rejects an empty filename", () => {
    expect(parseUploadRequest({ ...valid, filename: "" }).ok).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    expect(parseUploadRequest({ ...valid, durationSeconds: 0 }).ok).toBe(false);
    expect(parseUploadRequest({ ...valid, durationSeconds: -1 }).ok).toBe(false);
  });

  it("rejects a non-integer or non-positive sizeBytes", () => {
    expect(parseUploadRequest({ ...valid, sizeBytes: 10.5 }).ok).toBe(false);
    expect(parseUploadRequest({ ...valid, sizeBytes: 0 }).ok).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(parseUploadRequest({ ...valid, filename: 123 }).ok).toBe(false);
    expect(parseUploadRequest({ ...valid, durationSeconds: "12" }).ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(parseUploadRequest(null).ok).toBe(false);
    expect(parseUploadRequest(undefined).ok).toBe(false);
    expect(parseUploadRequest("nope").ok).toBe(false);
  });
});
