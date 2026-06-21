import { handleStreamWebhook, type StreamWebhookDeps } from "./handleStreamWebhook";
import { jsonResponse } from "./http";

/**
 * Route core for `POST /api/webhooks/stream`. The signature is computed over the
 * EXACT raw bytes, so this reads `request.text()` — never `json()` — and pulls the
 * `Webhook-Signature` header Cloudflare Stream sends. A missing header verifies as
 * an empty signature (→ 401). handleStreamWebhook owns verification + idempotency.
 */

export interface WebhookRequestLike {
  text(): Promise<string>;
  headers: { get(name: string): string | null };
}

export async function streamWebhookRoute(
  request: WebhookRequestLike,
  deps: StreamWebhookDeps
): Promise<Response> {
  const body = await request.text();
  const header = request.headers.get("Webhook-Signature") ?? "";
  const result = await handleStreamWebhook(deps, { header, body });
  return jsonResponse(result);
}
