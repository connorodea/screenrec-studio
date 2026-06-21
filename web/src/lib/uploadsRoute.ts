import { createUpload, type CreateUploadDeps } from "./createUpload";
import { jsonResponse, readJsonBody, type JsonRequestLike } from "./http";

/**
 * Route core for `POST /api/uploads`: parse the JSON body (malformed → 400 rather
 * than a 500), run the createUpload orchestration, and map its `{status, body}` to
 * a Response. The Next.js route file is a one-liner:
 *   export const POST = (req) => uploadsRoute(req, buildUploadDeps());
 * Deps stay injected so this is unit-testable with a fake Request + fakes.
 */

export async function uploadsRoute(
  request: JsonRequestLike,
  deps: CreateUploadDeps
): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResponse({ status: 400, body: { error: "invalid JSON body" } });
  }
  const result = await createUpload(deps, parsed.value);
  return jsonResponse(result);
}
