import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getClickAnalytics } from "@/lib/links.functions";
import { BRAND_NAME } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: `Click analytics — ${BRAND_NAME} Links` },
      { name: "description", content: `Daily click trends across all ${BRAND_NAME} short links: today, 7 days and 30 days.` },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Click analytics — ${BRAND_NAME} Links` },
      { property: "og:description", content: "Daily click trends across all short links." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fetchAnalytics = useServerFn(getClickAnalytics);
  const query = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics({}) });
  const data = query.data;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Click analytics</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Aggregated clicks across all of your short links.</p>

      {query.isLoading || !data ? (
        <div className="mt-10 flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total clicks" value={data.total} />
            <Stat label="Clicks today" value={data.today} />
            <Stat label="Last 7 days" value={data.last7} />
            <Stat label="Last 30 days" value={data.last30} />
          </div>

          <div className="mt-8 surface-card p-6">
            <h2 className="text-sm font-semibold">Clicks per day</h2>
            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#clicksFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}
