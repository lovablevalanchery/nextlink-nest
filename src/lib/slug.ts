const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[-._]+/, "")
    .slice(0, 64);
}

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug);
}

const RESERVED = new Set(["auth", "dashboard", "analytics", "api", "unavailable", "assets", "favicon.ico", "robots.txt"]);

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug);
}

export function generateSlug(length = 5) {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isSafeDestination(url: string) {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}
