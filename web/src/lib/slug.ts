/**
 * Short, URL-safe identifiers for share links (`/v/<slug>`).
 *
 * Base-56 alphabet with visually ambiguous characters removed (`0 O 1 l I`) so a
 * slug read aloud or typed by hand is unambiguous. See ../../docs/share-loop-spec.md.
 */
export const SLUG_ALPHABET =
  "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a slug of `length` characters. `random` is injectable (defaults to
 * `Math.random`) so generation is deterministic under test. The backend retries
 * on the rare DB unique-collision rather than guaranteeing uniqueness here.
 */
export function makeSlug(length = 11, random: () => number = Math.random): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`slug length must be a positive integer, got ${length}`);
  }
  let slug = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(random() * SLUG_ALPHABET.length);
    slug += SLUG_ALPHABET[index]!;
  }
  return slug;
}

/** Whether `slug` is non-empty and uses only the slug alphabet. */
export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && [...slug].every((c) => SLUG_ALPHABET.includes(c));
}
