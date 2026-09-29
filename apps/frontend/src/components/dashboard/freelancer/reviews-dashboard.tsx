"use client";

import * as React from "react";
import { LoaderCircle, RefreshCw, Star } from "lucide-react";

import { getFreelancerReviewDashboardAction, type FreelancerReviewDashboard } from "@/app/reviews/actions";
import { AppPageHeader } from "@/components/dashboard/app-page-header";
import { StatePanel } from "@/components/dashboard/state-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const cardClassName = "border-border bg-card shadow-[var(--shadow-subtle)]";
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function ReviewsDashboard({ initialData }: { initialData: FreelancerReviewDashboard }) {
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFreelancerReviewDashboardAction());
    } catch {
      setError("We couldn't load your reviews. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const counts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: data.reviews.filter((review) => review.rating === rating).length,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <AppPageHeader
          title="Reviews"
          description="Client feedback from completed work."
          action={<Button variant="outline" className="dark:!border-border dark:!bg-card dark:!text-foreground dark:hover:!bg-muted dark:hover:!text-foreground" onClick={() => void refresh()} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Refresh</Button>}
        />

        {data.profileMissing ? (
          <StatePanel icon={Star} title="Profile unavailable" description="Finish setting up your freelancer profile before reviews can appear here." />
        ) : error ? (
          <StatePanel icon={Star} title="Reviews unavailable" description={error} action={<Button onClick={() => void refresh()}>Retry</Button>} />
        ) : data.ratingCount === 0 ? (
          <StatePanel icon={Star} title="No reviews yet" description="Reviews will appear here after completed work is reviewed by a client." />
        ) : (
          <>
            <section className="grid min-w-0 gap-3 md:grid-cols-5">
              <Card className={`${cardClassName} md:col-span-2`}>
                <CardContent className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Star className="size-5 fill-current" /></span>
                  <div>
                    <p className="text-metadata font-medium text-muted-foreground">Overall rating</p>
                    <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">{data.ratingAvg.toFixed(1)}</p>
                    <p className="mt-1 text-metadata text-muted-foreground">{data.ratingCount} client review{data.ratingCount === 1 ? "" : "s"}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`${cardClassName} md:col-span-3`}>
                <CardHeader className="border-b border-border">
                  <CardTitle>Rating breakdown</CardTitle>
                  <CardDescription>Distribution across completed-work reviews.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {counts.map(({ rating, count }) => (
                      <div key={rating} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-metadata">
                        <span className="font-medium text-foreground">{rating} <Star className="inline size-3 fill-current text-primary" /></span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / data.ratingCount) * 100}%` }} /></div>
                        <span className="text-right text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="min-w-0">
              <div className="mb-3">
                <h2 className="font-heading text-card-title font-semibold text-foreground">Recent reviews</h2>
                <p className="mt-1 text-metadata text-muted-foreground">Newest client feedback from completed work.</p>
              </div>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {data.reviews.map((review) => (
                  <Card key={review.id} className={cardClassName}>
                    <CardContent className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 border-border"><AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{initials(review.author.name)}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-body font-semibold text-foreground">{review.author.name}</p>
                            <p className="mt-0.5 text-metadata text-muted-foreground">{new Date(review.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</p>
                          </div>
                        </div>
                        <Badge variant="secondary"><Star className="size-3 fill-current" /> {review.rating}/5</Badge>
                      </div>
                      {review.comment && <p className="border-t border-border pt-3 text-muted-body leading-6 text-muted-foreground">{review.comment}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
