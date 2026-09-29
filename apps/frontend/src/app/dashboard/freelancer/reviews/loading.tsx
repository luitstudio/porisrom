import { LoaderCircle } from "lucide-react";

export default function ReviewsLoading() {
  return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading reviews…</div>;
}
