/**
 * Thin HTTP-boundary adapters shared by the Next.js route handlers (web/src/app).
 * The orchestration handlers return a plain `{status, body}` (HttpResult); these
 * turn a Web `Request` into the handler's input and the handler's result into a
 * Web `Response`. Kept pure + framework-light so the route cores are unit-testable
 * with a fake Request + fake deps, no server. See ../../docs/share-loop-spec.md.
 */

export interface HttpResult {
  status: number;
  body: unknown;
}

/** A `Request`-like with just the bit a JSON route needs (so tests can fake it). */
export interface JsonRequestLike {
  json(): Promise<unknown>;
}

export function jsonResponse(result: HttpResult): Response {
  return Response.json(result.body, { status: result.status });
}

/** Safely read a JSON body — malformed/absent JSON becomes `{ok:false}` so a route
 *  returns 400 rather than throwing a 500. */
export async function readJsonBody(
  request: JsonRequestLike
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
