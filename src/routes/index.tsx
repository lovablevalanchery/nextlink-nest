import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Link2, ShieldCheck, Zap } from "lucide-react";
import { BRAND_NAME, SHORT_DOMAIN } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND_NAME} Links — Branded short links on ${SHORT_DOMAIN}` },
      {
        name: "description",
        content: `Internal link shortener for ${BRAND_NAME}. Create branded ${SHORT_DOMAIN} short links, edit destinations anytime and track clicks.`,
      },
      { property: "og:title", content: `${BRAND_NAME} Links` },
      {
        property: "og:description",
        content: `Create branded ${SHORT_DOMAIN} short links, edit destinations anytime and track clicks.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Zap, title: "Instant redirects", body: "Server-side 302 redirects with no interstitial page." },
  { icon: Link2, title: "Editable destinations", body: "Change where a link points without changing the short URL." },
  { icon: BarChart3, title: "Click analytics", body: "Daily click trends for today, 7 days and 30 days." },
  { icon: ShieldCheck, title: "Locked down", body: "Admin-only dashboard, validated URLs, protected data." },
];

function Landing() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Link2 className="h-4 w-4" />
          </span>
          {BRAND_NAME}
        </div>
        <Link
          to="/auth"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Admin sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {SHORT_DOMAIN}
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          <span className="text-gradient-brand">Branded short links</span> for everything {BRAND_NAME} ships.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          Paste a long URL, choose a slug, and share a clean link you control forever. Destinations stay editable,
          clicks stay measured.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open dashboard <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/analytics"
            className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            View analytics
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
