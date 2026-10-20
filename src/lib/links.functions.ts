import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSlug, isReservedSlug, isSafeDestination, isValidSlug, normalizeSlug } from "@/lib/slug";
import { invalidateCachedLink, setCachedLink } from "@/lib/redirect-cache";

function primeCache(row: { id: string; slug: string; destination_url: string; is_active: boolean }) {
  invalidateCachedLink(row.slug);
  setCachedLink(row.slug.toLowerCase(), {
    linkId: row.id,
    destination: row.destination_url,
    status: row.is_active ? "ok" : "disabled",
  });
}

export type LinkRow = {
  id: string;
  slug: string;
  destination_url: string;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
};

const destinationSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => isSafeDestination(v), "Enter a valid http:// or https:// URL");

export const listLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("links")
      .select("id, slug, destination_url, is_active, click_count, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as LinkRow[];
    if (rows.length === 0) return rows;

    const { data: clicks, error: clicksError } = await context.supabase
      .from("click_events")
      .select("link_id");
    if (clicksError) throw new Error(clicksError.message);

    const counts = new Map<string, number>();
    for (const click of clicks ?? []) {
      counts.set(click.link_id, (counts.get(click.link_id) ?? 0) + 1);
    }

    return rows.map((row) => ({ ...row, click_count: counts.get(row.id) ?? 0 }));
  });

export const createLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { destination_url: string; slug?: string }) =>
    z
      .object({ destination_url: destinationSchema, slug: z.string().max(64).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let slug = data.slug ? normalizeSlug(data.slug) : "";
    if (slug) {
      if (!isValidSlug(slug) || isReservedSlug(slug)) {
        throw new Error("That slug isn't allowed. Use letters, numbers, dots, dashes or underscores.");
      }
    } else {
      slug = generateSlug();
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error } = await context.supabase
        .from("links")
        .insert({
          slug,
          destination_url: data.destination_url.trim(),
          created_by: context.userId,
        })
        .select("id, slug, destination_url, is_active, click_count, created_at, updated_at")
        .single();

      if (!error) {
        primeCache(row as LinkRow);
        return row as LinkRow;
      }

      if (error.code === "23505" || error.code === "23514" || !error.message.includes("duplicate")) {
        throw new Error(error.message);
      }
      if (data.slug) throw new Error("This short link is already in use. Please choose another.");
      slug = generateSlug(attempt > 2 ? 7 : 5);
    }
    throw new Error("Could not generate a unique short link. Please try again.");
  });

export const checkSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const slug = normalizeSlug(data.slug);
    if (!slug) return { slug, available: true as boolean };
    if (!isValidSlug(slug) || isReservedSlug(slug)) return { slug, available: false };
    const { data: row } = await context.supabase.from("links").select("id").eq("slug", slug).maybeSingle();
    return { slug, available: !row };
  });

export const updateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; destination_url?: string; is_active?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        destination_url: destinationSchema.optional(),
        is_active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { destination_url?: string; is_active?: boolean } = {};
    if (data.destination_url !== undefined) patch.destination_url = data.destination_url.trim();
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const { data: row, error } = await context.supabase
      .from("links")
      .update(patch)
      .eq("id", data.id)
      .select("id, slug, destination_url, is_active, click_count, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    primeCache(row as LinkRow);
    return row as LinkRow;
  });

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("links")
      .delete()
      .eq("id", data.id)
      .select("slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    invalidateCachedLink(row?.slug ?? null);
    return { ok: true };
  });

export const getClickAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 29 * 86400000);
    since.setUTCHours(0, 0, 0, 0);

    const { data, error } = await context.supabase
      .from("click_events")
      .select("clicked_at")
      .gte("clicked_at", since.toISOString())
      .order("clicked_at", { ascending: true })
      .limit(20000);
    if (error) throw new Error(error.message);

    const byDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of data ?? []) {
      const key = String(row.clicked_at).slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const series = [...byDay.entries()].map(([date, clicks]) => ({ date, clicks }));
    const last = (days: number) => series.slice(-days).reduce((sum, p) => sum + p.clicks, 0);

    const { count: totalClicks } = await context.supabase
      .from("click_events")
      .select("id", { count: "exact", head: true });

    return {
      series,
      today: byDay.get(todayKey) ?? 0,
      last7: last(7),
      last30: last(30),
      total: totalClicks ?? 0,
    };
  });
