import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createLink } from "@/lib/links.functions";
import { SHORT_DOMAIN, shortUrl } from "@/lib/brand";
import { isSafeDestination, normalizeSlug } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateLinkDialog() {
  const queryClient = useQueryClient();
  const create = useServerFn(createLink);
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [slug, setSlug] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeSlug(slug);
      return create({
        data: { destination_url: destination, ...(normalized ? { slug: normalized } : {}) },
      });
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      setCreated(shortUrl(row.slug));
      setDestination("");
      setSlug("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create link"),
  });

  const preview = normalizeSlug(slug);
  const destinationValid = destination.trim() === "" || isSafeDestination(destination);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("✓ Link Copied");
    setTimeout(() => setCopied(false), 1800);
  }

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setDestination("");
      setSlug("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="h-4 w-4" /> Create New Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <div>
            <DialogHeader>
              <DialogTitle>Short link ready</DialogTitle>
              <DialogDescription>Share this link anywhere. You can change its destination later.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-secondary/60 p-3">
              <code className="flex-1 truncate text-sm font-medium">{created}</code>
              <Button size="sm" variant="outline" onClick={() => copy(created)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Link Copied" : "Copy Link"}
              </Button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreated(null)}>
                Create another
              </Button>
              <Button onClick={() => reset(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create short link</DialogTitle>
              <DialogDescription>Paste a destination URL and optionally pick your own slug.</DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="destination">Destination URL</Label>
                <Input
                  id="destination"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="https://example.com/very-long-url"
                  aria-invalid={!destinationValid}
                />
                {!destinationValid && (
                  <p className="text-xs text-destructive">Only valid http:// or https:// URLs are allowed.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Custom slug (optional)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="webinar"
                />
                <p className="text-xs text-muted-foreground">
                  Preview:{" "}
                  <span className="font-medium text-foreground">
                    {SHORT_DOMAIN}/{preview || "auto-generated"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => reset(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || !destinationValid || !destination.trim()}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Short Link
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
