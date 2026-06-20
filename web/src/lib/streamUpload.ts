/**
 * Builds the backend → Cloudflare Stream "direct creator upload" (tus) request.
 * The response's `Location` header is the one-time tus URL we hand the client,
 * and `stream-media-id` is the video UID. Pure construction so the URL/headers/
 * metadata encoding are unit-testable without calling Cloudflare.
 * See ../../docs/share-loop-spec.md.
 */

export const TUS_VERSION = "1.0.0";

export interface StreamUploadParams {
  accountId: string;
  apiToken: string;
  uploadLength: number;
  name?: string;
  maxDurationSeconds?: number;
  requireSignedURLs?: boolean;
}

export function streamDirectUploadURL(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`;
}

/** tus `Upload-Metadata`: comma-joined `key base64(value)` pairs. */
export function encodeUploadMetadata(fields: Record<string, string | number | boolean>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString("base64")}`)
    .join(",");
}

export function buildStreamDirectUploadRequest(params: StreamUploadParams): {
  url: string;
  method: "POST";
  headers: Record<string, string>;
} {
  const metadata: Record<string, string | number | boolean> = {};
  if (params.name !== undefined) metadata["name"] = params.name;
  if (params.maxDurationSeconds !== undefined) metadata["maxDurationSeconds"] = params.maxDurationSeconds;
  if (params.requireSignedURLs !== undefined) metadata["requiresignedurls"] = params.requireSignedURLs;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiToken}`,
    "Tus-Resumable": TUS_VERSION,
    "Upload-Length": String(params.uploadLength),
  };
  const meta = encodeUploadMetadata(metadata);
  if (meta.length > 0) headers["Upload-Metadata"] = meta;

  return { url: streamDirectUploadURL(params.accountId), method: "POST", headers };
}
