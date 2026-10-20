import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { BRAND_NAME } from "@/lib/brand";

const searchSchema = z.object({
  reason: z.enum(["not_found", "disabled", "loop", "error"]).catch("not_found"),
});

export const Route = createFileRoute("/unavailable")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Link unavailable — ${BRAND_NAME} Links` },
      { name: "description", content: "This short link is not available. It may have been removed or disabled." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Link unavailable — ${BRAND_NAME} Links` },
      { property: "og:description", content: "This short link is not available." },
    ],
  }),
  component: UnavailablePage,
});

const COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "404 — Link not found",
    body: "This short link doesn't exist. Please check the address and try again.",
  },
  disabled: {
    title: "Link unavailable",
    body: "This link is currently unavailable.",
  },
  loop: {
    title: "Link unavailable",
    body: "This link points back to itself and was blocked for your safety.",
  },
  error: {
    title: "Something went wrong",
    body: "We couldn't resolve this link right now. Please try again in a moment.",
  },
};

function UnavailablePage() {
  const { reason } = Route.useSearch();
  const copy = COPY[reason] ?? COPY["not_found"]!;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="surface-card w-full max-w-md p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{BRAND_NAME}</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
        <Link
          to="/"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to homepage
        </Link>
      </div>
    </main>
  );
}
