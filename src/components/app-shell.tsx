import { Link, useNavigate } from "@tanstack/react-router";
import { Link2, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_NAME, SHORT_DOMAIN } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Link2 className="h-4 w-4" />
            </span>
            <span>
              {BRAND_NAME}
              <span className="ml-2 hidden font-normal text-muted-foreground sm:inline">{SHORT_DOMAIN}</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-2 bg-secondary text-foreground font-medium" }}
            >
              Links
            </Link>
            <Link
              to="/analytics"
              className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-2 bg-secondary text-foreground font-medium" }}
            >
              Analytics
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-1 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
