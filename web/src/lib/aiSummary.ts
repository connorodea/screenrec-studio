import { z } from "zod";
import type { ValidationResult } from "./validation";

/**
 * Validates the LLM's `{ title, summary, chapters }` output before it reaches the
 * DB / watch page. Models sometimes wrap JSON in prose or ```json fences, so
 * `extractJson` pulls the object out first. Tested with fixture strings — no API key.
 */

export const aiSummarySchema = z
  .object({
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(2000),
    chapters: z
      .array(
        z.object({
          start: z.number().nonnegative().finite(),
          title: z.string().min(1).max(200),
        }).strip()
      )
      .max(50),
  })
  .strip();

export type AiSummary = z.infer<typeof aiSummarySchema>;

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Pulls a JSON value from a model response (bare, fenced, or prose-wrapped). */
export function extractJson(text: string): unknown | null {
  const trimmed = text.trim();

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1]!.trim() : trimmed;

  const direct = tryParse(candidate);
  if (direct !== undefined) return direct;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = tryParse(candidate.slice(start, end + 1));
    if (sliced !== undefined) return sliced;
  }
  return null;
}

export function parseAiSummary(modelText: string): ValidationResult<AiSummary> {
  const json = extractJson(modelText);
  if (json === null) {
    return { ok: false, errors: ["no JSON object found in model output"] };
  }
  const result = aiSummarySchema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) =>
      `${issue.path.join(".") || "(root)"}: ${issue.message}`
    ),
  };
}
