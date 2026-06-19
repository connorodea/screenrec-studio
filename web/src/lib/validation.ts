import { z } from "zod";

/** Body of `POST /api/uploads` (see ../../docs/share-loop-spec.md). Unknown keys
 * are stripped so a client can't smuggle extra fields into the row. */
export const uploadRequestSchema = z
  .object({
    filename: z.string().min(1).max(255),
    durationSeconds: z.number().positive().finite(),
    sizeBytes: z.number().int().positive(),
  })
  .strip();

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function parseUploadRequest(input: unknown): ValidationResult<UploadRequest> {
  const result = uploadRequestSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) =>
      `${issue.path.join(".") || "(root)"}: ${issue.message}`
    ),
  };
}
