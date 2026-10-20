// Tiny in-memory cache for the redirect hot path.
// Lives per server instance, so entries are short-lived by design.

export type CachedLink = {
  linkId: string | null;
  destination: string | null;
  status: "ok" | "disabled" | "not_found";
};

const TTL_MS = 300_000;
const MAX_ENTRIES = 5000;
const WARM_TTL_MS = 300_000;

const cache = new Map<string, { value: CachedLink; expiresAt: number }>();

export function getCachedLink(slug: string): CachedLink | undefined {
  const hit = cache.get(slug);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(slug);
    return undefined;
  }
  // Refresh recency (Map keeps insertion order → cheap LRU).
  cache.delete(slug);
  cache.set(slug, hit);
  return hit.value;
}

export function setCachedLink(slug: string, value: CachedLink) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(slug, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateCachedLink(slug?: string | null) {
  if (!slug) return;
  cache.delete(slug.toLowerCase());
  warmedAt = 0;
  warming = null;
}

/** Preload every link into memory so the very first click on any slug is warm. */
let warmedAt = 0;
let warming: Promise<void> | null = null;

export function warmAllLinks(
  load: () => Promise<Array<{ id: string; slug: string; destination_url: string; is_active: boolean }>>,
): Promise<void> {
  if (Date.now() - warmedAt < WARM_TTL_MS) return Promise.resolve();
  if (warming) return warming;

  warming = load()
    .then((rows) => {
      for (const row of rows) {
        setCachedLink(row.slug.toLowerCase(), {
          linkId: row.id,
          destination: row.destination_url,
          status: row.is_active ? "ok" : "disabled",
        });
      }
      warmedAt = Date.now();
    })
    .catch((err) => {
      console.error("warm cache failed", err);
    })
    .finally(() => {
      warming = null;
    });

  return warming;
}

/** Run background work without blocking the response, when the runtime allows it. */
export function runInBackground(promise: Promise<unknown>) {
  const settled = promise.catch((err) => {
    console.error("background task failed", err);
  });
  try {
    const ctx = (globalThis as Record<string, unknown>)[
      Symbol.for("__cloudflare-context__") as unknown as string
    ] as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined;
    ctx?.ctx?.waitUntil?.(settled);
  } catch {
    // No platform context available; the promise still runs best-effort.
  }
  return settled;
}
