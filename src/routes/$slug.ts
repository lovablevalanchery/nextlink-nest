import { createFileRoute } from "@tanstack/react-router";
import { normalizeSlug } from "@/lib/slug";
import {
  getCachedLink,
  invalidateCachedLink,
  runInBackground,
  setCachedLink,
  warmAllLinks,
  type CachedLink,
} from "@/lib/redirect-cache";

const CACHE_HEADER = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

// Server-only redirect route: /:slug -> destination URL (302).
// Hot path: memory cache -> read-only DB lookup. Click logging happens after the response.
export const Route = createFileRoute("/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = normalizeSlug(params.slug ?? "");
        if (!slug) return Response.redirect(new URL("/unavailable?reason=not_found", request.url), 302);

        const referrer = request.headers.get("referer");

        try {
          let entry = getCachedLink(slug);

          if (!entry) {
            // One bulk load warms every slug at once, so the first click on any
            // newly created link is served from memory like the popular ones.
            await warmAllLinks(async () => {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data, error } = await supabaseAdmin
                .from("links")
                .select("id, slug, destination_url, is_active")
                .limit(5000);
              if (error) throw error;
              return data ?? [];
            });
            entry = getCachedLink(slug);
          }

          if (!entry) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data, error } = await supabaseAdmin.rpc("lookup_link", { _slug: slug });
            if (error) throw error;
            const row = (Array.isArray(data) ? data[0] : data) as
              | { link_id: string | null; destination_url: string | null; status: string }
              | undefined;

            entry = {
              linkId: row?.link_id ?? null,
              destination: row?.destination_url ?? null,
              status: (row?.status as CachedLink["status"]) ?? "not_found",
            };
            setCachedLink(slug, entry);
          }

          if (entry.status === "ok" && entry.destination) {
            const destination = new URL(entry.destination);
            const current = new URL(request.url);
            // Redirect-loop protection: never bounce back to this same short URL.
            if (destination.host === current.host) {
              invalidateCachedLink(slug);
              return Response.redirect(new URL("/unavailable?reason=loop", request.url), 302);
            }

            if (entry.linkId) {
              const linkId = entry.linkId;
              runInBackground(
                import("@/integrations/supabase/client.server").then(({ supabaseAdmin }) =>
                  supabaseAdmin.rpc("log_click", {
                    _link_id: linkId,
                    ...(referrer ? { _referrer: referrer } : {}),
                  }),
                ),
              );
            }

            return new Response(null, {
              status: 302,
              headers: {
                location: destination.toString(),
                // Cache at the edge so repeat visits redirect instantly.
                "cache-control": CACHE_HEADER,
              },
            });
          }

          const reason = entry.status === "disabled" ? "disabled" : "not_found";
          return Response.redirect(new URL(`/unavailable?reason=${reason}`, request.url), 302);
        } catch (err) {
          console.error("redirect lookup failed", err);
          invalidateCachedLink(slug);
          return Response.redirect(new URL("/unavailable?reason=error", request.url), 302);
        }
      },
    },
  },
});

