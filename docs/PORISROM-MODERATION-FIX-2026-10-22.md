# Porisrom — Account Moderation and Access-Control Fix

Date: 2026-10-22. Scope: the original audit's P0 moderation boundaries only.

**Status: implementation and available regressions pass; isolated PostgreSQL verification remains blocked. This is not deployment or launch approval.** No migration is required. Payment-dispute resolution was not implemented.

## Baseline and confirmed findings

Read the audit, private-storage report, and session-revocation report before implementation. Inspected branch `main`, `git status --short`, relevant existing diffs, Prisma schema, existing migrations, PRD, and current service/controller/client paths. Reports were treated as historical evidence, not instructions to repeat earlier remediation. The dirty worktree already contained substantial unrelated changes, previous security fixes, deleted/renamed illustrations, and untracked migrations; these were preserved.

| Historical finding | Current implementation before this change |
| --- | --- |
| Public profiles and leaderboards expose moderated accounts with approved profiles | Confirmed: queries checked profile approval without current User status/role. |
| Public review access has the same gap | Confirmed: target-profile lookup checked approval only. |
| Search exposes moderated profiles or counts them inconsistently | Disproved for the inspected implementation: both discovery services already reuse an approved/active/correct-role predicate for items and counts. Retained this behavior. |
| Existing conversations permit messages involving moderated accounts | Confirmed: participation alone authorized message creation. Initial regressions showed both blocked and deleted counterpart messages succeeding. |
| Assignment/delivery/payment/review mutations bypass the moderation freeze | Confirmed: participation, role, and workflow state checks did not check both accounts inside write transactions. |
| Sockets authenticate only once | Disproved as a current finding: the previous session fix already checks persisted account/session authorization on inbound packets and outbound delivery, and expires connections. |
| Admin moderation revokes sessions and immediately disconnects idle sockets | Missing: block/delete only updated User. No session revocation, idle disconnection, or PRD counterpart notice. |

Root causes were divergent public eligibility predicates and a missing shared moderation boundary around marketplace writes. The PRD already defines mid-project moderation: freeze conversations and assignments read-only, notify the counterpart, preserve state, and leave manual resolution to Admin. No new cancellation deadline or automatic state transition was invented.

## Policy implemented

1. **Public eligibility:** the target profile must be approved and belong to an active account with the appropriate role (`freelancer` or `client`). Ineligible direct profile/review requests return the existing 404 shape; leaderboards omit them. Existing search filters/count semantics remain intact.
2. **Historical reviews:** the user explicitly selected retaining historical reviews and ratings on active eligible target profiles, including reviews authored before the author was moderated. Moderated targets' public profiles/review endpoints are hidden. Ratings are not recalculated or erased by account moderation. A new review involving an unavailable participant is forbidden.
3. **Historical participant access:** authenticated active participants may read shared messages, assignments, deliverables/events, and their existing payment projection, even when the counterpart is blocked/deleted. Participation checks remain in place. Other users cannot read those records. Blocked/deleted users themselves fail the existing JWT/session validation.
4. **Writes:** both participants must currently be active, with one client and one freelancer. Otherwise new messages, assignments, proposal responses/revisions, either cancellation step, delivery submissions/reviews, payment claims, and assignment reviews are denied with 403. Existing connection response eligibility errors remain 409, and connection creation keeps its existing role/status errors. No history, cancellation request, payment reference, assignment state, or profile-approval state is erased or silently advanced.
5. **Atomic moderation boundary:** marketplace transactions lock participant User rows in ID order and read current status/roles while holding the locks. Admin moderation locks the same target row and rechecks moderation eligibility. Status change, session revocation, and counterpart-notification persistence commit in one transaction. A write that wins the lock may finish before moderation; a write ordered after moderation must observe the moderated account and fail. Previously committed work remains historical.
6. **Session/realtime:** block/delete revokes all target sessions, including on repeated moderation requests, then disconnects the existing user room after commit. Existing `activeSessionUser` checks remain authoritative for JWT access and every inbound/outbound socket operation. No new client-controlled room subscriptions were added. Delayed message events from a now-moderated sender are suppressed. Historical notification/invalidation events committed before moderation may still reach an authorized active counterpart; no new frozen-work mutation can create one after the moderation boundary. Moderation notices intentionally reach the active counterpart.
7. **Notices:** each currently active counterpart of an accepted connection receives a persisted `account_moderated` notification when the target changes into blocked/deleted status. Duplicate blocking does not duplicate notices. Notifications reveal the read-only/support policy without private account details. Notification failure rolls back the moderation transaction; socket side effects occur only after a successful commit.
8. **Unblocking:** restores account eligibility and shared workflow writability if both accounts are eligible. Revoked sessions stay revoked; the unblocked user must log in again. Deleted accounts cannot be unblocked. Existing protection against moderating admin accounts remains intact.

Public visibility requires profile approval; established work requires active account status and marketplace roles. Losing profile approval alone does not erase or freeze an established working relationship.

## Changed files in this task

These are task-local changes; Git diffs against HEAD also include the user's pre-existing work.

| Files | Purpose |
| --- | --- |
| `apps/backend/src/marketplace-access.ts` (new) | Shared active-pair policy and transaction row locks. |
| `apps/backend/src/profiles/freelancer-profile.service.ts`, `profiles/company-profile.service.ts`, `leaderboard/leaderboard.service.ts` | Add active account/correct role to public queries. |
| `apps/backend/src/reviews/reviews.service.ts` | Gate public targets and transactionally prevent new frozen-work reviews. |
| `apps/backend/src/conversations/conversations.service.ts`, `conversations.controller.ts` | Guard message writes; add participant-protected `GET /conversations/:id/access` returning `{ readOnly }`. Existing list/message payloads retain their contracts. |
| `apps/backend/src/connections/connections.service.ts` | Coordinate existing active-pair checks with moderation locks; re-read account relations after acquiring locks. |
| `apps/backend/src/work-assignments/work-assignments.service.ts` | Guard every write transaction, including payment claims before the existing payment-row lock. Keep financial reference redaction and dispute logic. |
| `apps/backend/src/admin/admin.service.ts` | Atomic status/revocation/notices, protected admin/deleted-account handling, post-commit socket disconnection. |
| `apps/backend/src/realtime/realtime.gateway.ts` | Reuse the user room for disconnection; suppress delayed messages from unavailable senders. Preserve session validation. |
| `apps/frontend/src/app/messages/actions.ts`, `src/lib/use-conversation-access.ts` (new) | Fetch current participant access; poll without trusting stale initial page state; disable writes when access cannot be checked. |
| `apps/frontend/src/components/messages/chat-thread.tsx`, `components/work-assignments/work-assignment-panel.tsx` | Disable frozen chat/work/review controls and explain read-only state. Keep history/timeline and completed-assignment selection available. |
| `apps/backend/test/moderation-{boundaries,workflows,public-http,realtime,postgres}.spec.ts` (new) | Moderation regression suites described below. |
| `apps/backend/test/active-marketplace-fixture.ts` (new); `admin-safety.spec.ts`, `security-regressions.spec.ts`, `connection-creation.spec.ts`, `transaction-regressions.spec.ts`, `workflow-notifications.spec.ts`, `realtime-chat.spec.ts`, `work-assignment-terms.spec.ts` | Explicitly update existing fixtures/assertions for the transaction boundary and additional eligibility filters. No production checks were mocked out globally. |
| `apps/frontend/test/moderation-browser-harness.mjs`, `moderation-browser-regression.mjs` (new) | Reproducible browser fixture bundling actual components with synthetic server actions. |
| This report | Evidence, compatibility, and launch status. |

## Regression and verification results

Commands below were run from the named app directory using installed binaries. No dependency installation, database migration, or deployment was performed.

| Verification | Actual result |
| --- | --- |
| Backend: `.\node_modules\.bin\vitest.CMD run --reporter=json --outputFile=../../tmp/moderation-test-results-2026-10-22.json` | **300 passed, 0 failed, 5 skipped**. The skipped tests are blocked database tests, not passes. Machine-readable evidence: `tmp/moderation-test-results-2026-10-22.json`. |
| New `moderation-boundaries.spec.ts` | **8 passed**: message freeze, leaderboard eligibility, connection response freeze, admin role authorization. Initial three reproductions failed before implementation. |
| New `moderation-workflows.spec.ts` | **31 passed**: blocked/deleted active-counterpart mutations across all assignment branches/payments/reviews; history, payment redaction, stranger denial, active writability. |
| New `moderation-public-http.spec.ts` | **14 passed**: real Nest controllers/services/routes; synthetic ORM evaluates submitted predicates. Both profile types cover blocked/deleted/pending/rejected/wrong role, active profiles/reviews, discovery counts and leaderboards. This is HTTP integration, not a real database test. |
| New `moderation-realtime.spec.ts` | **11 passed**: real Socket.IO connections, idle multi-tab disconnection, all-session revocation, counterpart notices, reconnect/JWT denial, no session resurrection on unblock, delayed sender denial, inbound/outbound status rechecks, room-subscription denial, persistence failure, idempotent notice handling. Persistence is synthetic. |
| New `moderation-postgres.spec.ts` | **3 blocked/skipped**: real PostgreSQL moderation/message lock overlap, frozen payment/history/unblock/delete workflow, and discovery/count/leaderboard behavior. Explicit `PORISROM_MODERATION_TEST_DATABASE_URL` was absent. |
| Existing `auth-postgres.spec.ts` | **2 blocked/skipped**: concurrent rotation and refresh-versus-logout. Explicit `PORISROM_AUTH_TEST_DATABASE_URL` was absent. |
| Frontend: `..\admin\node_modules\.bin\vitest.CMD run --config vitest.config.mjs --configLoader runner` | **12 passed** across session/logout and auth proxy suites. |
| Frontend: `node --test test/notification-state.test.mjs test/realtime-chat.test.mjs test/recovery-policy.test.mjs` | **4 passed**. |
| Admin: `.\node_modules\.bin\vitest.CMD run` | **11 passed** across session/logout and proxy suites. |
| Browser fixture: `node test/moderation-browser-harness.mjs`; invoke `window.runBrowserModerationRegression()` in an isolated browser context at `http://127.0.0.1:4899` | **11 checks passed** against actual chat/assignment components: active compose/send, open-tab freeze, review/work disablement, historical message/assignment access, policy text, direct-submit denial, unblock recovery, failed-access-check disablement. Server actions/accounts were synthetic; this is not full authenticated application E2E. Fixture server stopped afterward. |
| Backend: `.\node_modules\.bin\eslint.CMD "{src,test}/**/*.ts"` | Exit 0; **0 errors, 2 existing unused-disable warnings** in `main.ts` and the admin action-log interceptor. |
| Frontend/admin: `.\node_modules\.bin\eslint.CMD .` | Both exit 0, no warnings/errors. |
| All three apps: `.\node_modules\.bin\tsc.CMD --noEmit --incremental false` | All exit 0. Backend rechecked after the final optional PostgreSQL-test edit. |
| Backend: `.\node_modules\.bin\nest.CMD build` | Exit 0. |
| Admin: `.\node_modules\.bin\next.CMD build` | Exit 0. Reverted only the build-generated `next-env.d.ts` import-line change to its pre-task content. |
| Frontend: `.\node_modules\.bin\next.CMD build` | Exit 1: existing Onest/Outfit Google Fonts requests could not connect to `fonts.googleapis.com`. A successful production frontend build is **not claimed**. |
| Git diff whitespace check | Exit 0; Git emitted existing LF/CRLF notices. |

The browser fixture initially hit sandbox directory-resolution restrictions; its explicitly scoped synthetic harness command was approved by automatic review and then ran successfully. No real tokens, account credentials, document contents, or environment secret values were used or printed.

Local PostgreSQL port 5432 accepted a TCP connection, but no explicitly isolated test-database URL was available. Port 5433 and application ports 3000/3001/4000 were unavailable. The existing database was not inspected, reused, reset, or migrated. Both optional PostgreSQL suites require an explicitly supplied database name ending `_test` and an already prepared schema. They clean up only their own randomized synthetic records. The moderation lock-overlap test needs multiple database connections. None of these tests has been claimed to pass.

## Previous security fixes preserved

Private-document storage implementation, static-upload registration, protected file endpoints, and existing untracked migrations were preserved. The public-profile changes only tighten eligibility; private document projections/routes were not weakened. Passing existing suites: document storage **19**, identity documents **13**, company documents **5**, private document HTTP **16**, private static HTTP **17**, static uploads **2**, profile-photo storage **5**.

Refresh rotation CAS, replay/collision behavior, logout credential handling, shared session validation, cookie/proxy handling, and token-expiry logic were retained. Existing backend session tests **8**, HTTP/Socket.IO revocation tests **9**, frontend auth/proxy tests **12**, and admin tests **11** pass. PostgreSQL auth concurrency remains blocked as above. The moderation gateway change extends the existing revocation mechanism rather than replacing it.

## Compatibility, remaining risks, and launch blockers

- No schema change, data backfill, migration, document relocation, history deletion, deployment, or assignment-state migration is needed. Existing pending migrations were not edited or executed. Existing auth API contracts are unchanged.
- The new access endpoint is additive. Existing clients continue receiving the same message/assignment/payment shapes. Writes that formerly bypassed moderation now receive authorization failures; public moderated profiles/reviews now return 404. Updated clients disable the relevant controls and poll every four seconds. Backend enforcement is immediate at the transaction boundary, regardless of client polling or UI tampering.
- The requested historical-review policy is resolved by the user's explicit selection. There is no remaining ambiguity blocking this implementation. Admin manual resolution of frozen work remains a separate operational/product capability; this task intentionally supplies no cancellation deadline, account restoration shortcut, or payment override.
- PostgreSQL lock/concurrency/state-transition regressions are **release-validation blockers** until run against an isolated prepared database. General pre-existing non-payment transition checks outside transactions and concurrent rating aggregation still need their own database concurrency assessment; this patch addresses moderation ordering, not all workflow races.
- Immediate idle-socket disconnect reaches this gateway instance. Other instances still deny packets/delivery using persisted session/status checks, but instantaneous cross-instance idle disconnection requires the deployment's shared Socket.IO adapter. Already authorized in-flight reads/events cannot be retroactively recalled.
- The browser fixture verifies components, not real Auth.js/admin cookies, multi-worker refresh, deployed HTTPS origins, or complete marketplace/admin E2E. Those release checks remain outstanding.
- The original **P0 payment-dispute resolution** blocker remains untouched. This report does not clear it. Private-storage provider/deployment validation, existing migration drift/ledger verification, production configuration, backup/restore/monitoring, asynchronous admin audit-log durability, and the original report's other unresolved requirements remain outside this task.
- Frontend production-build verification remains blocked by font-fetch connectivity. Successful local backend/admin builds do not establish production readiness.

Updated launch assessment: moderation guards are implemented and all available service, HTTP, Socket.IO, client-component, and prior security regressions pass. **Not ready for launch signoff** while isolated database validation, full environment acceptance, the remaining P0 dispute workflow, and existing release blockers are unresolved.
