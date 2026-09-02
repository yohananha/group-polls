/** URL-safe slug from a name, e.g. "Friday Night Crew" -> "friday-night-crew". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "group";
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/l/i — easy to read aloud

/** Short, unambiguous invite code (e.g. "kx7m2q9p"). Collisions are handled
 * by retrying the insert on unique-constraint violation, not by checking
 * existence first — cheaper and race-free. */
export function randomCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
