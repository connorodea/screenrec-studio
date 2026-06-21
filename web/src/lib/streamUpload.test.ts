import { describe, it, expect } from "vitest";
import {
  streamDirectUploadURL,
  encodeUploadMetadata,
  buildStreamDirectUploadRequest,
  TUS_VERSION,
} from "./streamUpload";

describe("streamDirectUploadURL", () => {
  it("targets the account's stream endpoint in direct_user mode", () => {
    expect(streamDirectUploadURL("acct123")).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/stream?direct_user=true"
    );
  });
});

describe("encodeUploadMetadata", () => {
  it("encodes a single field as 'key base64(value)'", () => {
    expect(encodeUploadMetadata({ name: "rec" })).toBe("name cmVj"); // base64("rec")
  });

  it("comma-joins multiple fields and stringifies values", () => {
    expect(encodeUploadMetadata({ name: "rec", maxDurationSeconds: 60 })).toBe(
      "name cmVj,maxDurationSeconds NjA=" // base64("60") = "NjA="
    );
  });
});

describe("buildStreamDirectUploadRequest", () => {
  const base = { accountId: "acct123", apiToken: "cf-token", uploadLength: 2048 };

  it("builds the POST with auth, tus, and length headers", () => {
    const req = buildStreamDirectUploadRequest(base);
    expect(req.method).toBe("POST");
    expect(req.url).toBe(streamDirectUploadURL("acct123"));
    expect(req.headers["Authorization"]).toBe("Bearer cf-token");
    expect(req.headers["Tus-Resumable"]).toBe(TUS_VERSION);
    expect(req.headers["Upload-Length"]).toBe("2048");
  });

  it("includes encoded Upload-Metadata for optional fields", () => {
    const req = buildStreamDirectUploadRequest({
      ...base, name: "rec", maxDurationSeconds: 60, requireSignedURLs: true,
    });
    const meta = req.headers["Upload-Metadata"] ?? "";
    expect(meta).toContain("name cmVj");
    expect(meta).toContain("maxDurationSeconds NjA=");
    expect(meta).toContain("requiresignedurls dHJ1ZQ=="); // base64("true")
  });

  it("omits Upload-Metadata when no optional fields are given", () => {
    const req = buildStreamDirectUploadRequest(base);
    expect(req.headers["Upload-Metadata"]).toBeUndefined();
  });
});
