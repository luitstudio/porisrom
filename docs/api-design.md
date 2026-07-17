# Porishrom — API Design

Companion to [PRD.md](./PRD.md) and [data-model.md](./data-model.md). All endpoints live on `apps/backend` (NestJS). `apps/frontend` and `apps/admin` are the only consumers — no other app touches the database directly.

Conventions: JSON over HTTPS, JWT in an httpOnly cookie (access + refresh), role-gated via a Nest guard reading the JWT's `role` claim. Paths below are prefixed with `/api/v1`.

Roles column: **F** = Freelancer, **C** = Company/Client, **A** = Admin, **Public** = no auth required.

---

## Auth

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Public | body includes chosen role (freelancer/client) — fixed at signup, no switching |
| POST | `/auth/login` | Public | issues access + refresh cookies |
| POST | `/auth/refresh` | Public (valid refresh cookie) | rotates access token |
| POST | `/auth/logout` | F/C/A | clears cookies |
| GET | `/auth/me` | F/C/A | current session's user + role + profile summary |

## Profiles

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/freelancers/:id` | Public | public profile view |
| PATCH | `/freelancers/me` | F | update own profile |
| GET | `/companies/:id` | Public | public profile view |
| PATCH | `/companies/me` | C | update own profile |
| POST | `/freelancers/me/portfolio` | F | add portfolio item |
| DELETE | `/freelancers/me/portfolio/:id` | F | remove own portfolio item |

## Categories & skills

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/categories` | Public | |
| GET | `/skills` | Public | optional `?categoryId=` |
| POST | `/categories` | A | |
| POST | `/skills` | A | |

## Search / discovery

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/search/freelancers` | Public | query: `categoryId`, `skillId`, `state`, `minRating`, `verifiedOnly`, `experienceLevel`, `page`, `pageSize`; only returns `verificationStatus: "approved"` profiles |
| GET | `/search/companies` | Public | query: `categoryId`, `state`, `minRating`, `verifiedOnly`, `page`, `pageSize`; only returns `verificationStatus: "approved"` profiles |

## Connections

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/connections` | F/C | body: `receiverId`; rejects if receiver same role, blocked, or cooldown active |
| GET | `/connections` | F/C | list mine (sent + received, any status) |
| PATCH | `/connections/:id/accept` | F/C | only the receiver |
| PATCH | `/connections/:id/decline` | F/C | only the receiver |

## Conversations & messages

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/conversations` | F/C | list mine |
| GET | `/conversations/:id/messages` | F/C | paginated, only a participant |
| POST | `/conversations/:id/messages` | F/C | only a participant of an accepted connection |

## Work assignments

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/conversations/:id/work-assignments` | C | create (status: proposed); body: title, description, budgetAmount, currency?, dueDate? |
| GET | `/conversations/:id/work-assignments` | F/C (participant) | list all assignments ever created on this conversation, each with its event timeline |
| GET | `/work-assignments/:id` | F/C (participant) | includes event timeline |
| PATCH | `/work-assignments/:id/respond` | F | body: `{ action: accept \| reject \| request_modification, note? }`; only valid while status is `proposed` |
| PATCH | `/work-assignments/:id/revise` | C | body: `{ action: revise \| reject, title?, description?, budgetAmount?, dueDate?, note? }`; only valid while status is `modification_requested`; `revise` sends it back to `proposed` |
| PATCH | `/work-assignments/:id/cancel` | F/C | body: `{ note? }`; first call records the requester, status stays put; the other participant's call confirms and sets status to `cancelled`; calling it again as the same person who already requested is rejected |

## Deliverables & delivery review

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/work-assignments/:id/deliverables` | F | submit demo/preview/file/link; sets status → submitted |
| PATCH | `/work-assignments/:id/delivery/accept` | C | status → delivery_accepted, unlocks payment |
| PATCH | `/work-assignments/:id/delivery/request-revision` | C | status → revision_requested, back to freelancer |

## Payment verification

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/work-assignments/:id/payment/claim-paid` | C | body: `utr` |
| POST | `/work-assignments/:id/payment/claim-received` | F | body: `utr`; auto-matches against client's claim → verified or mismatch |
| GET | `/work-assignments/:id/payment` | F/C (participant), A | current verification state |

## Reviews

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/work-assignments/:id/reviews` | F/C (participant) | only after status = completed; one per direction |
| GET | `/freelancers/:id/reviews` | Public | |
| GET | `/companies/:id/reviews` | Public | |

## Leaderboard

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/leaderboard/freelancers` | Public | sorted by ratingAvg, min ratingCount threshold |
| GET | `/leaderboard/companies` | Public | same |

## Notifications

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/notifications` | F/C/A | mine |
| PATCH | `/notifications/:id/read` | F/C/A | |

## Moderation (user-level)

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/blocks` | F/C | body: `blockedUserId` |
| DELETE | `/blocks/:id` | F/C | unblock |

## Admin

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/admin/users` | A | filter by role/status |
| PATCH | `/admin/users/:id/approve` | A | approve profile |
| PATCH | `/admin/users/:id/reject` | A | reject profile |
| PATCH | `/admin/users/:id/badge` | A | issue or revoke verification badge |
| PATCH | `/admin/users/:id/block` | A | |
| DELETE | `/admin/users/:id` | A | soft-delete |
| GET | `/admin/conversations` | A | oversight, read-only |
| GET | `/admin/work-assignments` | A | oversight, read-only |
| GET | `/admin/payments` | A | oversight, includes mismatch/disputed flagged items |
| POST | `/admin/notifications/broadcast` | A | to all users |
| POST | `/admin/messages/direct` | A | direct message to any user |
| GET | `/admin/action-log` | A | audit trail of admin actions |

---

## Permission notes

- Every endpoint under `/work-assignments/:id/*` and `/conversations/:id/*` must verify the caller is a participant of that resource (via the underlying Connection), not just any authenticated Freelancer/Company — this is a per-resource ownership check, not just a role check.
- Same-role messaging (F→F, C→C) is rejected at the `/connections` POST level, not just hidden in the UI.
- All `A`-only admin mutations write to `AdminActionLog` automatically (cross-cutting concern, e.g. a Nest interceptor), not something each handler does manually.
