import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cloudflare Stream webhook verification. Stream signs each webhook with a
 * `Webhook-Signature: time=<unix>,sig1=<hex>` header, where the HMAC-SHA256 is
 * taken over `<time>.<rawBody>` with the webhook secret. We must verify this
 * before trusting a "video ready" event — otherwise anyone could forge one.
 */

export interface WebhookVerifyResult {
  valid: boolean;
  reason?: string;
}

export function parseSignatureHeader(header: string): { time: string; sig1: string } | null {
  const map: Record<string, string> = {};
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  const time = map["time"];
  const sig1 = map["sig1"];
  if (!time || !sig1) return null;
  return { time, sig1 };
}

export function computeSignature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhook(opts: {
  header: string;
  body: string;
  secret: string;
  now?: number; // ms epoch, for the replay window
  toleranceSeconds?: number;
}): WebhookVerifyResult {
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return { valid: false, reason: "malformed signature header" };

  const expected = computeSignature(opts.secret, parsed.time, opts.body);
  if (!constantTimeEqualHex(expected, parsed.sig1)) {
    return { valid: false, reason: "signature mismatch" };
  }

  if (opts.toleranceSeconds !== undefined) {
    const now = opts.now ?? Date.now();
    const ageSeconds = Math.abs(now / 1000 - Number(parsed.time));
    if (!Number.isFinite(ageSeconds) || ageSeconds > opts.toleranceSeconds) {
      return { valid: false, reason: "timestamp outside tolerance" };
    }
  }
  return { valid: true };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
