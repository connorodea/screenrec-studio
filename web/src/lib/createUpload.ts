import { parseUploadRequest } from "./validation";

/**
 * Orchestration for `POST /api/uploads` (see ../../docs/share-loop-spec.md):
 * validate → mint slug → create the Cloudflare Stream upload → insert the row →
 * return the ticket. Side effects are injected so the whole flow is testable with
 * fakes; the route file wires in the real slug/Stream/DB implementations.
 */

export interface CreateUploadDeps {
  makeSlug: () => string;
  createStreamUpload: (params: { uploadLength: number; name: string }) => Promise<{
    uid: string;
    uploadURL: string;
  }>;
  insertVideo: (row: {
    slug: string;
    streamUid: string;
    status: "awaiting_upload";
  }) => Promise<{ id: string }>;
  watchBaseUrl: string;
}

interface UploadTicket {
  videoId: string;
  slug: string;
  watchUrl: string;
  uploadURL: string;
  uploadProtocol: "tus";
}

export interface HttpResult {
  status: number;
  body: UploadTicket | { error: string };
}

export async function createUpload(deps: CreateUploadDeps, input: unknown): Promise<HttpResult> {
  const parsed = parseUploadRequest(input);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.errors.join("; ") } };
  }
  const { filename, sizeBytes } = parsed.value;

  const slug = deps.makeSlug();

  let stream: { uid: string; uploadURL: string };
  try {
    stream = await deps.createStreamUpload({ uploadLength: sizeBytes, name: filename });
  } catch {
    return { status: 502, body: { error: "could not create the upload" } };
  }

  const { id } = await deps.insertVideo({
    slug,
    streamUid: stream.uid,
    status: "awaiting_upload",
  });

  return {
    status: 201,
    body: {
      videoId: id,
      slug,
      watchUrl: `${deps.watchBaseUrl}/v/${slug}`,
      uploadURL: stream.uploadURL,
      uploadProtocol: "tus",
    },
  };
}
