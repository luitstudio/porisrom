"use client";

import * as React from "react";

import {
  acceptDeliveryAction,
  cancelWorkAssignmentAction,
  claimPaidAction,
  claimReceivedAction,
  createReviewAction,
  createWorkAssignmentAction,
  listWorkAssignmentsAction,
  requestDeliveryRevisionAction,
  respondWorkAssignmentAction,
  reviseWorkAssignmentAction,
  submitDeliverableAction,
  type DeliverableType,
  type WorkAssignment,
} from "@/app/work-assignments/actions";
import { Button } from "@/components/ui/button";

const DELIVERABLE_TYPES: { value: DeliverableType; label: string }[] = [
  { value: "drive_link", label: "Drive link" },
  { value: "github_link", label: "GitHub link" },
  { value: "demo", label: "Demo link" },
  { value: "preview", label: "Preview link" },
  { value: "watermarked_file", label: "Watermarked file link" },
  { value: "file", label: "File link" },
];

const POLL_INTERVAL_MS = 6000;
const TERMINAL_STATUSES = new Set(["rejected", "cancelled", "completed"]);

type WorkAssignmentPanelProps = {
  conversationId: string;
  viewerUserId: string;
  viewerRole: "freelancer" | "client" | "admin" | null;
  otherPartyName: string;
  initialAssignments: WorkAssignment[];
};

function formatMoney(amount: string, currency: string) {
  const n = Number(amount);
  return `${currency} ${Number.isFinite(n) ? n.toLocaleString("en-IN") : amount}`;
}

// Deterministic, UTC-based formatting — toLocaleDateString()/toLocaleString() with no
// explicit locale/timeZone use the runtime's defaults, which differ between the Node
// server (SSR) and the browser (hydration), causing a React hydration mismatch (#418).
function formatDate(iso: string) {
  return iso.slice(0, 10);
}

function formatDateTime(iso: string) {
  return iso.slice(0, 16).replace("T", " ") + " UTC";
}

function actionLabel(action: string) {
  switch (action) {
    case "proposed":
      return "proposed this assignment";
    case "accept":
      return "accepted";
    case "reject":
    case "rejected":
      return "rejected";
    case "request_modification":
      return "requested a modification";
    case "revised":
      return "revised the terms";
    case "cancel_requested":
      return "requested to cancel";
    case "cancelled":
      return "confirmed the cancellation";
    case "submitted":
      return "submitted a deliverable";
    case "revision_requested":
      return "requested a delivery revision";
    case "delivery_accepted":
      return "accepted the delivery";
    case "payment_claimed_paid":
      return "marked the payment as sent";
    case "payment_claimed_received":
      return "marked the payment as received";
    case "payment_mismatch":
      return "submitted a transaction ID that didn't match";
    case "payment_verified":
      return "confirmed matching payment — assignment completed";
    case "payment_disputed":
      return "hit repeated payment mismatches — flagged for admin review";
    default:
      return action;
  }
}

export function WorkAssignmentPanel({
  conversationId,
  viewerUserId,
  viewerRole,
  otherPartyName,
  initialAssignments,
}: WorkAssignmentPanelProps) {
  const [assignments, setAssignments] = React.useState<WorkAssignment[]>(initialAssignments);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [showModificationForm, setShowModificationForm] = React.useState(false);
  const [showReviseForm, setShowReviseForm] = React.useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = React.useState(false);
  const [showRevisionRequestForm, setShowRevisionRequestForm] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const fresh = await listWorkAssignmentsAction(conversationId);
      setAssignments(fresh);
    } catch {
      // transient poll failure — try again next tick
    }
  }, [conversationId]);

  React.useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const active = assignments.find((a) => !TERMINAL_STATUSES.has(a.status)) ?? assignments[0] ?? null;
  const isCompany = viewerRole === "client";
  const isFreelancer = viewerRole === "freelancer";

  async function runAction(fn: () => Promise<{ error?: string }>) {
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setShowCreateForm(false);
    setShowModificationForm(false);
    setShowReviseForm(false);
    setShowDeliverableForm(false);
    setShowRevisionRequestForm(false);
    await refresh();
    return true;
  }

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Work Assignment</h2>

      {!active || TERMINAL_STATUSES.has(active.status) ? (
        <div className="mt-2">
          {active && active.status === "completed" ? (
            <div>
              <p className="text-sm text-foreground">
                &quot;{active.title}&quot; is complete — payment verified
                {active.paymentVerification?.verifiedAt &&
                  ` on ${formatDate(active.paymentVerification.verifiedAt)}`}
                .
              </p>
              <ReviewSection
                assignment={active}
                viewerUserId={viewerUserId}
                otherPartyName={otherPartyName}
                pending={pending}
                onSubmit={(rating, comment) =>
                  runAction(() => createReviewAction(active.id, rating, comment))
                }
              />
            </div>
          ) : (
            active && (
              <p className="text-sm text-muted-foreground">
                Last assignment &quot;{active.title}&quot; is{" "}
                <span className="font-medium">{active.status}</span>.
              </p>
            )
          )}
          {isCompany && !showCreateForm && (
            <Button size="sm" className="mt-2" onClick={() => setShowCreateForm(true)}>
              Propose Work Assignment
            </Button>
          )}
          {isCompany && showCreateForm && (
            <CreateAssignmentForm
              pending={pending}
              onCancel={() => setShowCreateForm(false)}
              onSubmit={(data) =>
                runAction(() => createWorkAssignmentAction(conversationId, data))
              }
            />
          )}
          {!isCompany && !active && (
            <p className="mt-2 text-sm text-muted-foreground">
              No work assignment yet. {otherPartyName} can send one from here once you&apos;re
              ready to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <div>
            <p className="font-medium text-foreground">{active.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Budget: {formatMoney(active.budgetAmount, active.currency)}
              {active.dueDate && ` · Due ${formatDate(active.dueDate)}`}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-primary">
              {active.status.replace(/_/g, " ")}
            </p>
          </div>

          {active.status === "proposed" && isFreelancer && !showModificationForm && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => runAction(() => respondWorkAssignmentAction(active.id, "accept"))}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setShowModificationForm(true)}
              >
                Request Modification
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => runAction(() => respondWorkAssignmentAction(active.id, "reject"))}
              >
                Reject
              </Button>
            </div>
          )}

          {active.status === "proposed" && isFreelancer && showModificationForm && (
            <NoteForm
              placeholder="What would you like to change (budget, timeline, scope)?"
              pending={pending}
              onCancel={() => setShowModificationForm(false)}
              onSubmit={(note) =>
                runAction(() =>
                  respondWorkAssignmentAction(active.id, "request_modification", note)
                )
              }
            />
          )}

          {active.status === "proposed" && isCompany && (
            <p className="text-sm text-muted-foreground">
              Waiting for {otherPartyName} to respond.
            </p>
          )}

          {active.status === "modification_requested" && isCompany && !showReviseForm && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending} onClick={() => setShowReviseForm(true)}>
                Revise Terms
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  runAction(() => reviseWorkAssignmentAction(active.id, { action: "reject" }))
                }
              >
                Reject
              </Button>
            </div>
          )}

          {active.status === "modification_requested" && isCompany && showReviseForm && (
            <ReviseAssignmentForm
              current={active}
              pending={pending}
              onCancel={() => setShowReviseForm(false)}
              onSubmit={(data) =>
                runAction(() =>
                  reviseWorkAssignmentAction(active.id, { action: "revise", ...data })
                )
              }
            />
          )}

          {active.status === "modification_requested" && isFreelancer && (
            <p className="text-sm text-muted-foreground">
              Waiting for {otherPartyName} to revise the terms.
            </p>
          )}

          {(active.status === "accepted" || active.status === "in_progress") && (
            <div className="flex flex-col gap-3">
              <CancelSection
                active={active}
                viewerUserId={viewerUserId}
                otherPartyName={otherPartyName}
                pending={pending}
                onCancel={() => runAction(() => cancelWorkAssignmentAction(active.id))}
              />
              {isFreelancer && !showDeliverableForm && (
                <Button size="sm" className="self-start" onClick={() => setShowDeliverableForm(true)}>
                  Submit Deliverable
                </Button>
              )}
              {isFreelancer && showDeliverableForm && (
                <SubmitDeliverableForm
                  pending={pending}
                  onCancel={() => setShowDeliverableForm(false)}
                  onSubmit={(data) => runAction(() => submitDeliverableAction(active.id, data))}
                />
              )}
              {isCompany && (
                <p className="text-sm text-muted-foreground">
                  Waiting for {otherPartyName} to submit the work.
                </p>
              )}
            </div>
          )}

          {active.status === "submitted" && (
            <div className="flex flex-col gap-3">
              <DeliverablesList deliverables={active.deliverables} />
              {isCompany && !showRevisionRequestForm && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => runAction(() => acceptDeliveryAction(active.id))}
                  >
                    Accept Delivery
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setShowRevisionRequestForm(true)}
                  >
                    Request Revision
                  </Button>
                </div>
              )}
              {isCompany && showRevisionRequestForm && (
                <NoteForm
                  placeholder="What needs to change before you can accept this?"
                  pending={pending}
                  onCancel={() => setShowRevisionRequestForm(false)}
                  onSubmit={(note) =>
                    runAction(() => requestDeliveryRevisionAction(active.id, note))
                  }
                />
              )}
              {isFreelancer && (
                <p className="text-sm text-muted-foreground">
                  Waiting for {otherPartyName} to review your submission.
                </p>
              )}
            </div>
          )}

          {active.status === "revision_requested" && (
            <div className="flex flex-col gap-3">
              <DeliverablesList deliverables={active.deliverables} />
              {isFreelancer && !showDeliverableForm && (
                <Button size="sm" className="self-start" onClick={() => setShowDeliverableForm(true)}>
                  Resubmit Deliverable
                </Button>
              )}
              {isFreelancer && showDeliverableForm && (
                <SubmitDeliverableForm
                  pending={pending}
                  onCancel={() => setShowDeliverableForm(false)}
                  onSubmit={(data) => runAction(() => submitDeliverableAction(active.id, data))}
                />
              )}
              {isCompany && (
                <p className="text-sm text-muted-foreground">
                  Waiting for {otherPartyName} to resubmit the work.
                </p>
              )}
            </div>
          )}

          {active.status === "payment_pending" && (
            <PaymentSection
              assignment={active}
              isCompany={isCompany}
              pending={pending}
              onClaimPaid={(utr) => runAction(() => claimPaidAction(active.id, utr))}
              onClaimReceived={(utr) => runAction(() => claimReceivedAction(active.id, utr))}
            />
          )}

          {active.status === "disputed" && (
            <p className="text-sm text-destructive">
              This payment has repeatedly failed to verify and is now flagged for admin review.
              Please contact support for resolution.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {assignments.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Activity timeline
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {assignments
              .flatMap((a) => a.events)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((event) => (
                <li key={event.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {event.actorId === viewerUserId ? "You" : otherPartyName}
                  </span>{" "}
                  {actionLabel(event.action)}
                  {event.note && <span className="italic"> — &quot;{event.note}&quot;</span>}
                  <span className="ml-1 text-muted-foreground/70">
                    ({formatDateTime(event.createdAt)})
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CreateAssignmentForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: { title: string; description: string; budgetAmount: number; dueDate?: string }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [budgetAmount, setBudgetAmount] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          description,
          budgetAmount: Number(budgetAmount),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        });
      }}
    >
      <input
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      />
      <textarea
        required
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <div className="flex gap-2">
        <input
          required
          type="number"
          min={0}
          placeholder="Budget (INR)"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Send
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CancelSection({
  active,
  viewerUserId,
  otherPartyName,
  pending,
  onCancel,
}: {
  active: WorkAssignment;
  viewerUserId: string;
  otherPartyName: string;
  pending: boolean;
  onCancel: () => void;
}) {
  if (active.cancelRequestedById && active.cancelRequestedById !== viewerUserId) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {otherPartyName} requested to cancel this assignment.
        </p>
        <Button size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Confirm Cancellation
        </Button>
      </div>
    );
  }
  if (active.cancelRequestedById === viewerUserId) {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting for {otherPartyName} to confirm the cancellation.
      </p>
    );
  }
  return (
    <Button size="sm" variant="outline" className="self-start" disabled={pending} onClick={onCancel}>
      Request Cancellation
    </Button>
  );
}

function DeliverablesList({ deliverables }: { deliverables: WorkAssignment["deliverables"] }) {
  if (deliverables.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground">Submitted files</h3>
      <ul className="mt-1 flex flex-col gap-1">
        {deliverables
          .slice()
          .reverse()
          .map((d) => (
            <li key={d.id} className="text-sm">
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {DELIVERABLE_TYPES.find((t) => t.value === d.type)?.label ?? d.type}
              </a>
              {d.note && <span className="text-muted-foreground"> — {d.note}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}

function SubmitDeliverableForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: { type: DeliverableType; url: string; note?: string }) => void;
}) {
  const [type, setType] = React.useState<DeliverableType>("drive_link");
  const [url, setUrl] = React.useState("");
  const [note, setNote] = React.useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, url, note: note || undefined });
      }}
    >
      <select
        value={type}
        onChange={(e) => setType(e.target.value as DeliverableType)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      >
        {DELIVERABLE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        required
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      />
      <textarea
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Submit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PaymentSection({
  assignment,
  isCompany,
  pending,
  onClaimPaid,
  onClaimReceived,
}: {
  assignment: WorkAssignment;
  isCompany: boolean;
  pending: boolean;
  onClaimPaid: (utr: string) => void;
  onClaimReceived: (utr: string) => void;
}) {
  const [utr, setUtr] = React.useState("");
  const payment = assignment.paymentVerification;
  const myUtr = isCompany ? payment?.clientUtr : payment?.freelancerUtr;
  const alreadyClaimed = Boolean(myUtr) && payment?.status !== "mismatch";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Payment status:{" "}
        <span className="font-medium text-foreground">
          {(payment?.status ?? "awaiting_client").replace(/_/g, " ")}
        </span>
      </p>
      {payment?.status === "mismatch" && (
        <p className="text-sm text-destructive">
          The transaction IDs didn&apos;t match ({payment.mismatchCount} attempt
          {payment.mismatchCount === 1 ? "" : "s"} so far). Please double-check and re-enter it.
        </p>
      )}
      {alreadyClaimed ? (
        <p className="text-sm text-muted-foreground">
          You submitted transaction ID &quot;{myUtr}&quot;. Waiting for the other party.
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isCompany) onClaimPaid(utr);
            else onClaimReceived(utr);
          }}
        >
          <input
            required
            placeholder="Transaction ID / UTR"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {isCompany ? "Mark as Paid" : "Mark as Received"}
          </Button>
        </form>
      )}
    </div>
  );
}

function ReviewSection({
  assignment,
  viewerUserId,
  otherPartyName,
  pending,
  onSubmit,
}: {
  assignment: WorkAssignment;
  viewerUserId: string;
  otherPartyName: string;
  pending: boolean;
  onSubmit: (rating: number, comment?: string) => void;
}) {
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");

  const myReview = assignment.reviews.find((r) => r.authorId === viewerUserId);
  if (myReview) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        You rated {otherPartyName} {myReview.rating}/5.
        {myReview.comment && <span> &quot;{myReview.comment}&quot;</span>}
      </p>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(rating, comment || undefined);
      }}
    >
      <p className="text-sm font-medium text-foreground">Rate {otherPartyName}</p>
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="h-10 w-32 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
      <textarea
        placeholder="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <Button type="submit" size="sm" className="self-start" disabled={pending}>
        Submit Review
      </Button>
    </form>
  );
}

function ReviseAssignmentForm({
  current,
  pending,
  onCancel,
  onSubmit,
}: {
  current: WorkAssignment;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: { title?: string; description?: string; budgetAmount?: number; dueDate?: string; note?: string }) => void;
}) {
  const [title, setTitle] = React.useState(current.title);
  const [description, setDescription] = React.useState(current.description);
  const [budgetAmount, setBudgetAmount] = React.useState(current.budgetAmount);
  const [note, setNote] = React.useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, budgetAmount: Number(budgetAmount), note: note || undefined });
      }}
    >
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      />
      <textarea
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <input
        required
        type="number"
        min={0}
        value={budgetAmount}
        onChange={(e) => setBudgetAmount(e.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
      />
      <textarea
        placeholder="Note to the freelancer (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Send Revision
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NoteForm({
  placeholder,
  pending,
  onCancel,
  onSubmit,
}: {
  placeholder: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = React.useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
    >
      <textarea
        required
        placeholder={placeholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Send
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
