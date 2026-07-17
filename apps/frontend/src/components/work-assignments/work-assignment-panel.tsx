"use client";

import * as React from "react";

import {
  cancelWorkAssignmentAction,
  createWorkAssignmentAction,
  listWorkAssignmentsAction,
  respondWorkAssignmentAction,
  reviseWorkAssignmentAction,
  type WorkAssignment,
} from "@/app/work-assignments/actions";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 6000;
const TERMINAL_STATUSES = new Set(["rejected", "cancelled", "completed"]);

type WorkAssignmentPanelProps = {
  conversationId: string;
  viewerUserId: string;
  viewerRole: "freelancer" | "client" | null;
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
    await refresh();
    return true;
  }

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Work Assignment</h2>

      {!active || TERMINAL_STATUSES.has(active.status) ? (
        <div className="mt-2">
          {active && (
            <p className="text-sm text-muted-foreground">
              Last assignment &quot;{active.title}&quot; is{" "}
              <span className="font-medium">{active.status}</span>.
            </p>
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

          {active.status === "accepted" && (
            <div>
              {active.cancelRequestedById && active.cancelRequestedById !== viewerUserId ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {otherPartyName} requested to cancel this assignment.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => runAction(() => cancelWorkAssignmentAction(active.id))}
                  >
                    Confirm Cancellation
                  </Button>
                </div>
              ) : active.cancelRequestedById === viewerUserId ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for {otherPartyName} to confirm the cancellation.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => runAction(() => cancelWorkAssignmentAction(active.id))}
                >
                  Request Cancellation
                </Button>
              )}
            </div>
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
