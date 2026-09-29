"use client";

import * as React from "react";
import { ExternalLink, Link as LinkIcon, Plus, Trash2 } from "lucide-react";

import {
  createPortfolioItemAction,
  deletePortfolioItemAction,
  type PortfolioItem,
} from "@/app/dashboard/freelancer/portfolio/actions";
import { BentoCard } from "@/components/onboarding/bento-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Feedback = { kind: "success" | "error"; text: string };

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function PortfolioManager({ initialItems }: { initialItems: PortfolioItem[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);

  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  const urlIsValid = !trimmedUrl || isHttpUrl(trimmedUrl);

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || deletingId || !trimmedTitle || !isHttpUrl(trimmedUrl)) return;

    setSaving(true);
    setFeedback(null);
    const result = await createPortfolioItemAction({ title: trimmedTitle, url: trimmedUrl });
    if (result.success) {
      setItems((current) => [result.data, ...current]);
      setTitle("");
      setUrl("");
      setFeedback({ kind: "success", text: "Portfolio item added." });
    } else {
      setFeedback({ kind: "error", text: result.error });
    }
    setSaving(false);
  }

  async function deleteItem(item: PortfolioItem) {
    if (saving || deletingId) return;

    setDeletingId(item.id);
    setFeedback(null);
    const result = await deletePortfolioItemAction(item.id);
    if (result.success) {
      setItems((current) => current.filter(({ id }) => id !== item.id));
      setFeedback({ kind: "success", text: `“${item.title}” deleted.` });
    } else {
      setFeedback({ kind: "error", text: result.error });
    }
    setDeletingId(null);
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Share links to your strongest work and case studies.</p>
        </div>

        <form onSubmit={addItem}>
          <BentoCard title="Add portfolio item" icon={Plus} span="3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title" required />
              <Input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/project"
                aria-invalid={!urlIsValid}
                required
              />
            </div>
            {!urlIsValid && <p className="text-xs text-destructive">Enter a valid HTTP or HTTPS URL.</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || deletingId !== null || !trimmedTitle || !isHttpUrl(trimmedUrl)}>
                <LinkIcon className="size-4" />
                {saving ? "Adding..." : "Add link"}
              </Button>
            </div>
          </BentoCard>
        </form>

        {feedback && (
          <p className={feedback.kind === "success" ? "text-sm text-primary" : "text-sm text-destructive"}>
            {feedback.text}
          </p>
        )}

        {items.length === 0 ? (
          <BentoCard title="Your work" icon={LinkIcon} span="3">
            <p className="py-8 text-center text-sm text-muted-foreground">
              No portfolio items yet. Add your first project link above.
            </p>
          </BentoCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
                <CardHeader>
                  <CardTitle className="pr-10 font-display text-lg">{item.title}</CardTitle>
                  <CardAction>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      aria-label={`Delete ${item.title}`}
                      disabled={saving || deletingId !== null}
                      onClick={() => void deleteItem(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                  {deletingId === item.id && <p className="mt-3 text-xs text-muted-foreground">Deleting...</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
