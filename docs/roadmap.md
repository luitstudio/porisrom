# Porishrom — Implementation Roadmap

Companion to [PRD.md](./PRD.md), [data-model.md](./data-model.md), [api-design.md](./api-design.md). Phases are ordered by dependency — each one assumes the previous is done. Tasks within a phase are meant to be small and independently testable (build + verify, then move to the next).

Do not start implementation until the docs above are confirmed correct.

---

## Phase 0 — Monorepo scaffolding ✅ done

- [x] pnpm + Turborepo workspace root
- [x] `apps/{frontend,admin,backend}` + `packages/{database,shared-types,config}` skeletons
- [x] `apps/frontend` migrated in, fresh git history
- [x] `pnpm install` across the workspace

---

## Phase 1 — Backend foundation (standalone, no frontend wiring yet) ✅ done

Goal: a running NestJS API with auth, testable via curl/Postman, completely independent of `apps/frontend`.

- [x] Scaffold NestJS app in `apps/backend` (built manually rather than via `nest new`, to align with `@porishrom/backend` package name and workspace conventions already in place)
- [x] `docker-compose.yml` at repo root: `postgres` service for local dev (port 5433, since 5432 was already taken by an unrelated container on this machine)
- [x] Point `packages/database` at local Postgres, run first `prisma migrate dev` (User model only, extended with `status` field + `admin` role per data-model.md)
- [x] Wire `apps/backend` to import `@porishrom/database`'s generated Prisma client (required adding a build step to `packages/database` — Prisma 7's new client generator outputs raw TypeScript with explicit `.ts` import extensions, so the package now compiles itself to CJS via `tsc` with `moduleFormat = "cjs"` + `rewriteRelativeImportExtensions`, and exposes a `createPrismaClient()` factory wrapping `@prisma/adapter-pg`)
- [x] Auth module: signup (role fixed at signup), login, JWT access+refresh via httpOnly cookies, logout, `/auth/me`
- [x] Password hashing with bcrypt (bcryptjs, matching `apps/frontend/src/app/auth/actions.ts`)
- [x] Basic role guard (Freelancer/Client/Admin) usable by future modules
- [x] Health check endpoint
- [x] Manual test plan: signup as freelancer, signup as client, login, hit `/auth/me`, confirm role guard rejects wrong-role access on a dummy protected route — all passed via curl

---

## Phase 2 — Profiles, categories, skills, admin approval ✅ done

Goal: real profile data exists and admin can moderate it — still backend-only, testable via API calls.

- [x] `FreelancerProfile` / `CompanyProfile` models + migration
- [x] `Category` / `Skill` models + seed data (seeded from `apps/frontend`'s existing `PROFESSION_CATEGORIES`/`SKILL_SUGGESTIONS` in `onboarding-data.ts`, so filters line up with what onboarding already offers)
- [x] Join tables: `FreelancerCategory`, `FreelancerSkill`, `CompanyCategory`
- [x] `PortfolioItem` model + CRUD endpoints (Freelancer only, own items)
- [x] Profile CRUD endpoints (`GET/PATCH /freelancers/me`, `/companies/me`, public `GET /:id`) — implemented as upsert, so first submit and later edits use the same endpoint; editing a previously-rejected profile automatically resets it to `pending` for resubmission
- [x] Admin approval endpoints: approve/reject profile, issue/revoke badge
- [x] `AdminActionLog` model + auto-logging interceptor for admin mutations (via a `@LogAdminAction()` decorator + `AdminActionLogInterceptor`)
- [x] Seed one Admin user manually (`apps/backend/src/scripts/seed-admin.ts`, no public admin signup route)
- [x] Manual test plan: create freelancer profile, submit for review, admin approves, badge issued, profile now shows verified — all passed via curl, including role-guard rejection of non-admin access to `/admin/*`

---

## Phase 3 — Rewire `apps/frontend` onto the backend ✅ done

Goal: the existing frontend stops touching Prisma/its own DB directly and becomes a pure API consumer.

- [x] Replace `apps/frontend`'s local Prisma-backed NextAuth Credentials logic with calls to backend `/auth/*` — `authorize()` now calls backend `/auth/login`; backend returns `{ user, accessToken, refreshToken }` in the response body (not just cookies) specifically so this BFF-style server-to-server call can capture them; JWT strategy accepts both Bearer header (frontend) and cookie (direct browser/curl)
- [x] **Product decision made mid-phase**: role is now chosen at signup (a Freelancer/Client toggle added to the signup form) instead of on a separate post-signup onboarding screen — the old `RoleSelectionScreen`/`RoleCard` components and `setRoleAction` are removed as redundant
- [x] Onboarding wizard submits to backend profile endpoints (`PATCH /freelancers/me` or `/companies/me`, plus portfolio links) instead of local server actions; category/skill names are resolved to backend IDs via `GET /categories`/`GET /skills`
- [x] Freelancer dashboard and client dashboard fetch the real user via a shared `getCurrentUser()` helper (`auth()` + backend `GET /auth/me`) — KPI/jobs/earnings mock UI is left as-is since those entities don't exist until later phases
- [x] Removed `apps/frontend`'s `prisma/` folder, `prisma.config.ts`, `src/lib/prisma.ts`, and the `@libsql/client`/`@prisma/*`/`bcryptjs` dependencies
- [x] Manual test plan: full signup → onboarding → dashboard flow verified end-to-end in a real browser (Playwright) for both Freelancer and Client roles, zero console/network errors, zero direct DB access from the frontend process

Bugs found and fixed during verification (all real, not test artifacts):
- NextAuth v5's `UntrustedHost` check rejected the local non-Vercel host — fixed with `AUTH_TRUST_HOST=true`
- The root `SessionProvider` doesn't remount across the soft client-side navigation that a Server Action's `redirect()` performs, so `useSession()` in the onboarding wizard read the stale pre-sign-in session on first render even though the cookie was already valid — fixed by forcing one `update()` resync on mount when `status === "unauthenticated"`
- After finishing onboarding, the NextAuth JWT still had the stale `isOnboarded: false` cached from login, so the middleware bounced the user straight back to `/onboarding` — fixed by calling `update({ isOnboarded: true })` before navigating to the dashboard (this call existed in the original code and was dropped during the rewrite; restored)
- Turbopack couldn't infer the correct project root in the new monorepo layout — fixed via an explicit `turbopack.root` in `next.config.ts`

Known gap, not fixed in this phase: `User.profileCompleteness` is never recomputed by the backend, so dashboards still show "0% complete" regardless of actual profile state — cosmetic, deferred.

---

## Phase 4 — Discovery & search ✅ done

- [x] `/search/freelancers` and `/search/companies` endpoints (categoryId, skill Id, state, minRating, verifiedOnly, experienceLevel filters; pagination). Both only return `verificationStatus: "approved"` profiles — pending/rejected profiles never appear in public search, confirmed via test
- [x] Frontend: `/freelancers` browse page with filters (Company-facing) — category/state/experience/verified-only, GET-form driven (works without JS), paginated
- [x] Frontend: `/companies` browse page with filters (Freelancer-facing) — same pattern
- [x] Public profile pages: `/freelancers/[id]` (bio, location, experience, rating, categories, skills, portfolio links) and `/companies/[id]` (about, location, rating, hiring categories); both 404 via `notFound()` for a nonexistent id
- [x] Added "Find Companies" to the navbar alongside the pre-existing "Find Freelancers" link
- [x] Manual test plan: seeded 3 freelancers across categories/states/experience levels (2 approved, 1 left pending) + approved the company profile from Phase 3; verified every filter combination via curl, then verified the same end-to-end in a real browser (Playwright) — filtering, pagination-safe rendering, click-through to profile pages, and the pending profile's exclusion, all confirmed with zero console/network errors

Known gap carried over from Phase 3: the client onboarding UI's category picker (`BUSINESS_CATEGORIES`, e.g. "Tech Startup") still doesn't match the seeded `Category` taxonomy (freelancer professions), so `CompanyCategory` stays empty for real users — company search's `categoryId` filter and the "Hiring categories" section on company profiles won't have real data until this is reconciled.

---

## Phase 5 — Connections & messaging ✅ done

- [x] `Connection` model + `/connections` endpoints (send/accept/decline), same-role rejection, 14-day re-request cooldown after decline. Cooldown only applies if the *same* person retries — the other party initiating fresh is allowed immediately. A declined connection is reused (updated back to `pending`) rather than creating a duplicate row, since `@@unique([requesterId, receiverId])` only covers one direction of a pair
- [x] `Conversation` + `Message` models, created transactionally on connection acceptance (conversation created first, then the connection update, so the returned `connection.conversation` include isn't null)
- [x] `/conversations` + `/conversations/:id/messages` endpoints (participant-only access check via the underlying connection's requester/receiver ids)
- [x] Frontend: connection request UI (send/accept/decline) on profile pages, via a shared `ConnectionActionPanel` client component — shown on `/freelancers/[id]` only to logged-in Clients, and on `/companies/[id]` only to logged-in Freelancers
- [x] Frontend: chat UI (poll-based refresh every 4s, no websockets) at `/dashboard/freelancer/messages(/[id])` and the newly-added `/dashboard/client/messages(/[id])` (client dashboard had no messaging surface before this phase — added a "Messages" link to its header)
- [x] Manual test plan: verified via curl (same-role rejection, valid request, accept, bidirectional messaging, non-participant 403, decline, cooldown block, duplicate-connection conflict) and then the full user-facing flow in a real two-context browser session (Priya↔Acme: connect → accept → message both ways → confirmed the already-open thread on one side picks up the other's reply via polling with no reload), zero errors

---

## Phase 6 — Work assignments ✅ done

- [x] `WorkAssignment` + `WorkAssignmentEvent` models + the negotiation-phase slice of the status state machine (`proposed` ↔ `modification_requested` → `accepted` | `rejected` | `cancelled`; `in_progress` onward is Phase 7's territory, kept in the enum now so the column isn't reshaped twice). Added `cancelRequestedById` (not in the original data-model.md sketch) to actually implement the documented mutual-confirm cancellation — the other participant's confirming call is what flips status to `cancelled`
- [x] `/conversations/:id/work-assignments` create (Company only) + a symmetric `GET` to list a conversation's assignments (needed by the frontend panel, natural REST addition alongside the existing `POST`)
- [x] `/work-assignments/:id/respond` (Freelancer: accept/reject/request-modification)
- [x] `/work-assignments/:id/revise` (Company revises-and-resends → back to `proposed`, or rejects outright after a modification request)
- [x] `/work-assignments/:id/cancel` (mutual-confirm: first call records `cancelRequestedById`, the other participant's call confirms and cancels; calling twice as the same person is rejected)
- [x] Frontend: a single `WorkAssignmentPanel` client component embedded directly above the chat thread (poll-based, 6s) — Company sees "Propose Work Assignment" / revise form, Freelancer sees accept/reject/request-modification, either side sees the cancel flow once accepted, plus a collapsible activity timeline built from every assignment's `WorkAssignmentEvent`s
- [x] Manual test plan: full negotiation loop verified twice — once via curl (propose → freelancer requests modification → company revises → freelancer accepts, plus a separate mutual-cancel test with the "can't confirm your own request" guard) and once end-to-end in a real two-browser-context session, confirming the UI transitions correctly at every step and the timeline records all of it

Bug found and fixed during verification: a React hydration mismatch (#418) from `toLocaleDateString()`/`toLocaleString()` calls with no explicit locale/timeZone — these use the runtime's defaults, which differ between the Node server (SSR) and the browser (hydration). Replaced with deterministic UTC-based formatting.

---

## Phase 7 — Delivery, payment verification ✅ done

- [x] `Deliverable` model + submit endpoint (Freelancer) — valid from `accepted`/`in_progress`/`revision_requested`, moves status to `submitted`
- [x] Delivery review endpoints: accept (→ `payment_pending`, also creates the `PaymentVerification` row) / request-revision (→ `revision_requested`, Freelancer resubmits to loop back to `submitted`) (Company)
- [x] `PaymentVerification` model + claim-paid (Company) / claim-received (Freelancer) endpoints with UTR matching logic, mismatch counter, auto-flag-to-admin (`disputed`) after 3 mismatches
- [x] Frontend: submit-deliverable UI (Freelancer), review UI (Company), payment claim UI both sides — all built into the same `WorkAssignmentPanel` from Phase 6
- [x] Admin: payment oversight view (read-only list, flagged mismatches/disputes highlighted in red) — built as a stopgap page at `/admin/payments` inside `apps/frontend` (gated to the admin role) since `apps/admin` doesn't exist as a real app until Phase 9; this surfaced a real gap from Phase 3 — the frontend's session/JWT types deliberately excluded `"admin"` (mapped to `null`) since the frontend wasn't meant to handle that role. Fixed by widening the role type end-to-end and letting `admin` flow through properly, since it now needs to reach this page
- [x] Manual test plan: verified via curl (submit → request-revision → resubmit → accept → mismatched UTRs → corrected → verified/completed, plus a separate run to hit the 3-mismatch dispute threshold) and a real two-browser-context session covering the same loop end-to-end, plus the admin oversight page

Bug found and fixed during verification: the mismatch counter incremented **twice per correction round** instead of once. After a mismatch, the other party's stale UTR was left in place, so the very next claim from either side got compared against that stale value before the other party had reacted — reaching the 3-mismatch dispute threshold after only 2 real rounds. Fixed by clearing both UTRs whenever a mismatch is recorded, so every subsequent comparison is against a genuinely fresh pair of claims.

---

## Phase 8 — Reviews & reputation ✅ done

- [x] `Review` model + `/work-assignments/:id/reviews` endpoint (one per direction via `@@unique([workAssignmentId, direction])`, only post-completion). Added a proper `author` relation on `Review` (unlike `WorkAssignmentEvent.actorId`, which stays a bare string resolved client-side against the two known conversation participants) — a profile's reviews come from many different authors, so the name has to be resolved server-side via a real join
- [x] Rating aggregation (`ratingAvg`/`ratingCount` recompute via `prisma.review.aggregate` on every new review, scoped per direction so a freelancer's rating only counts `client_to_freelancer` reviews and vice versa)
- [x] `/leaderboard/freelancers` and `/leaderboard/companies` endpoints (default `minRatingCount=3`, overridable via query param; only `verificationStatus: "approved"` profiles are eligible)
- [x] Frontend: review submission UI built into the same `WorkAssignmentPanel`'s `completed` branch (shows a 1–5 + comment form once, then "You rated X" afterward), public review display added to both profile pages, and new `/leaderboard/freelancers` + `/leaderboard/companies` pages linked from a new navbar "Leaderboard" dropdown
- [x] Manual test plan: verified via curl (both sides review a completed assignment, duplicate-review rejection, review-on-non-completed rejection, non-participant rejection, rating averaging across multiple reviews, leaderboard threshold filtering both default and overridden) and a real two-browser-context session — including submitting a review through the actual UI form, not just curl — confirming the leaderboard, profile rating summary, and public review list all update correctly

---

## Phase 9 — `apps/admin` build-out ✅ done

Goal: admin stops being "just API calls via Postman" and gets a real internal tool.

- [x] `Notification` model (`userId: null` = broadcast to all; known MVP simplification — broadcast read-state is a single shared flag, not per-user, since this is an admin communication aside rather than a core workflow) + `GET /notifications` / `PATCH /notifications/:id/read` for any authenticated user
- [x] Admin backend additions: `PATCH /admin/users/:id/block` (toggle, blocks login via the existing `status !== "active"` check), `DELETE /admin/users/:id` (soft-delete — anonymizes name/email, deactivates login, keeps the row and its historical relations intact; blocked from being re-blocked once deleted), `GET /admin/conversations` and `GET /admin/work-assignments` (read-only oversight lists), `POST /admin/notifications/broadcast`, `POST /admin/messages/direct` (delivered as a targeted `Notification`, not a real Connection-gated message thread), `GET /admin/analytics` (signups/day over 30 days via raw `date_trunc` query, active/total assignment counts, payment verification rate, users-by-role breakdown). `AdminActionLogInterceptor` extended to also capture request-body metadata and fall back to `body.userId` as the target when there's no `:id` route param (needed for the direct-message action)
- [x] Scaffold Next.js app in `apps/admin` (port 3001) — deliberately simpler stack than `apps/frontend`: plain Tailwind (no shadcn/Base UI/Framer Motion), no NextAuth
- [x] Admin auth: server actions call the backend's `/auth/login` and `/auth/refresh` directly and store tokens in httpOnly cookies (`admin_access_token` / `admin_refresh_token`, distinct names from `apps/frontend`'s NextAuth cookies since browsers scope cookies by domain, not port). `getSession()` validates via `/auth/me` and refreshes once on 401; non-admin roles are rejected at login. Single role, no onboarding, so this intentionally skips the BFF/session-hook machinery `apps/frontend` needed
- [x] User management view: filter by role, approve/reject/badge/block/delete actions per row, disabled once a user is soft-deleted
- [x] Conversation/work-assignment/payment oversight views (read-only; disputed work assignments and mismatch/disputed payments visually flagged)
- [x] Broadcast notification composer, direct-message-to-user tool (recipient picker sourced from `/admin/users`), plus a "recently sent" list reusing the action log
- [x] `AdminActionLog` viewer (audit trail, including captured metadata)
- [x] Basic analytics dashboard (signups-over-time bar chart, active/total assignments, payment verification rate, users-by-role)
- [x] Removed the `apps/frontend` `/admin/payments` stopgap page now that `apps/admin` supersedes it; admins landing in `apps/frontend` (both the immediate post-login redirect in `auth/actions.ts` and `proxy.ts`'s dashboard-redirect-for-authenticated-user-visiting-/auth/*) now go to the homepage, since there's no admin workflow left inside that app
- [x] Manual test plan: verified via curl (block/unblock/login-rejection-while-blocked, soft-delete/login-rejection-after-delete/re-block-conflict, broadcast + direct message + notification visibility + mark-read, analytics, action-log metadata capture) and a real Playwright browser session driving `apps/admin` end-to-end — non-admin login rejection, admin login, dashboard analytics, users page reject→approve→badge-grant→block/unblock cycle, conversations/work-assignments/payments oversight pages, notification broadcast + direct message with visible confirmation, action log, and logout redirect gating (19/19 checks passed, zero console/HTTP errors)
- Bug found and fixed (pre-existing, surfaced by this phase's redirect changes): `apps/frontend`'s `auth/actions.ts` had its own separate `dashboardPathFor` left over from Phase 3 (before the admin role type was widened) that mapped `admin → null → "/dashboard/client"` as the *immediate* post-login redirect, independently of `proxy.ts`'s already-correct version — so an admin logging into `apps/frontend` landed on the client dashboard instead of anywhere sensible. Fixed by widening it the same way and pointing it at the homepage

---

## Phase 10 — Backlog / post-MVP

Not scheduled yet, revisit after Phase 9 ships and the core loop is validated with real users:

- Milestone-based projects (split a Work Assignment into paid milestones)
- Escrow / real payment gateway integration
- Real-time messaging (websockets) + online/offline presence
- Notification center polish (email/push in addition to in-app)
- Saved freelancers / saved companies
- Smart recommendations (matching freelancers to companies)
- Multi-seat company accounts (team members)
- Deeper analytics dashboards
- Move local-dev Postgres + MinIO onto the VPS (same Docker setup, just swap connection strings/env — per earlier infra decision) once the VPS is purchased
