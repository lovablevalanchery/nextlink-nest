import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, Loader2, Pencil, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteLink, listLinks, updateLink, type LinkRow } from "@/lib/links.functions";
import { BRAND_NAME, shortUrl } from "@/lib/brand";
import { isSafeDestination } from "@/lib/slug";
import { AppShell } from "@/components/app-shell";
import { CreateLinkDialog } from "@/components/create-link-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Link dashboard — ${BRAND_NAME} Links` },
      { name: "description", content: `Manage every branded short link for ${BRAND_NAME}: create, edit, disable and track clicks.` },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Link dashboard — ${BRAND_NAME} Links` },
      { property: "og:description", content: "Create, edit, disable and track branded short links." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const fetchLinks = useServerFn(listLinks);
  const update = useServerFn(updateLink);
  const remove = useServerFn(deleteLink);

  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LinkRow | null>(null);

  const linksQuery = useQuery({ queryKey: ["links"], queryFn: () => fetchLinks({}) });
  const links = linksQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["links"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (row: LinkRow) => update({ data: { id: row.id, is_active: !row.is_active } }),
    onSuccess: (row) => {
      invalidate();
      toast.success(row.is_active ? "Link enabled" : "Link disabled");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const editMutation = useMutation({
    mutationFn: () => update({ data: { id: editing!.id, destination_url: editValue } }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Destination updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { id: deleteTarget!.id } }),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Link deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) => l.slug.toLowerCase().includes(q) || l.destination_url.toLowerCase().includes(q),
    );
  }, [links, search]);

  const stats = useMemo(
    () => ({
      total: links.length,
      clicks: links.reduce((sum, l) => sum + l.click_count, 0),
      active: links.filter((l) => l.is_active).length,
    }),
    [links],
  );

  async function copy(row: LinkRow) {
    await navigator.clipboard.writeText(shortUrl(row.slug));
    setCopiedId(row.id);
    toast.success("✓ Link Copied");
    setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 1800);
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Short links</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create, edit and monitor every branded link in one place.
          </p>
        </div>
        <CreateLinkDialog />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total links" value={stats.total} />
        <StatCard label="Total clicks" value={stats.clicks} />
        <StatCard label="Active links" value={stats.active} />
      </div>

      <div className="mt-8 surface-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by slug or destination URL"
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {linksQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading links…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {links.length === 0 ? "No links yet. Create your first short link." : "No links match your search."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={shortUrl(row.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-semibold text-primary hover:underline"
                    >
                      {shortUrl(row.slug).replace("https://", "")}
                    </a>
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <a
                    href={row.destination_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{row.destination_url}</span>
                  </a>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold">{row.click_count}</p>
                  <p className="text-xs text-muted-foreground">clicks</p>
                </div>

                <p className="w-28 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString()}
                </p>

                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => copy(row)} aria-label="Copy link">
                    {copiedId === row.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit destination"
                    onClick={() => {
                      setEditing(row);
                      setEditValue(row.destination_url);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={row.is_active ? "Disable link" : "Enable link"}
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate(row)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete link"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit destination</DialogTitle>
            <DialogDescription>
              The short URL {editing ? shortUrl(editing.slug).replace("https://", "") : ""} stays the same.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <Label htmlFor="edit-destination">Destination URL</Label>
            <Input
              id="edit-destination"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="https://example.com/new-destination"
            />
            {editValue.trim() !== "" && !isSafeDestination(editValue) && (
              <p className="text-xs text-destructive">Only valid http:// or https:// URLs are allowed.</p>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={editMutation.isPending || !isSafeDestination(editValue)}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save destination
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this short link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone using {deleteTarget ? shortUrl(deleteTarget.slug).replace("https://", "") : "this link"} will no
              longer be redirected, and its click history will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
            >
              Delete Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}
