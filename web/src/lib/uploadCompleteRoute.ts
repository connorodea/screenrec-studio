import { handleUploadComplete, type UploadCompleteDeps } from "./handleUploadComplete";
import { jsonResponse } from "./http";

/**
 * Route core for `POST /api/uploads/:id/complete`. The video id is a path param,
 * so the Next.js route file passes it in:
 *   export const POST = (_req, { params }) => uploadCompleteRoute(params.id, buildDeps());
 * No body to parse — handleUploadComplete owns idempotency + the 404.
 */

export async function uploadCompleteRoute(
  videoId: string,
  deps: UploadCompleteDeps
): Promise<Response> {
  const result = await handleUploadComplete(deps, { videoId });
  return jsonResponse(result);
}
