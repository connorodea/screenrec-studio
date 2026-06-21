import { handleVideoMetadata, type VideoReadDeps } from "./handleVideoRead";
import { jsonResponse } from "./http";

/**
 * Route core for `GET /api/videos/:id` — the client's post-upload poll. The id is a
 * path param; delegates to handleVideoMetadata (raw nullable fields + 404 owned
 * there). The watch page itself (`/v/:slug`) is a server-rendered React component
 * over handleWatch's view-model, not a JSON route.
 */

export async function videoMetadataRoute(
  videoId: string,
  deps: VideoReadDeps
): Promise<Response> {
  const result = await handleVideoMetadata(deps, videoId);
  return jsonResponse(result);
}
