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

## Phase 6 — Work assignments

- [ ] `WorkAssignment` + `WorkAssignmentEvent` models + full status state machine per data-model.md
- [ ] `/conversations/:id/work-assignments` create (Company only)
- [ ] `/work-assignments/:id/respond` (Freelancer: accept/reject/request-modification)
- [ ] `/work-assignments/:id/revise` (Company revises after modification request)
- [ ] `/work-assignments/:id/cancel` (mutual-confirm flow)
- [ ] Frontend: create-assignment UI inside chat (Company), respond UI (Freelancer), activity timeline rendering from `WorkAssignmentEvent`
- [ ] Manual test plan: full negotiation loop — propose, request modification, revise, accept — verify event log records every step

---

## Phase 7 — Delivery, payment verification

- [ ] `Deliverable` model + submit endpoint (Freelancer)
- [ ] Delivery review endpoints: accept / request-revision (Company)
- [ ] `PaymentVerification` model + claim-paid (Company) / claim-received (Freelancer) endpoints with UTR matching logic, mismatch counter, auto-flag-to-admin after N mismatches
- [ ] Frontend: submit-deliverable UI (Freelancer), review UI (Company), payment claim UI both sides
- [ ] Admin: payment oversight view (read-only list, flagged mismatches highlighted)
- [ ] Manual test plan: submit deliverable → company requests revision → resubmit → company accepts → both claim payment with matching UTR → assignment reaches Completed; separately, test mismatched UTRs → stays pending → corrected → verified

---

## Phase 8 — Reviews & reputation

- [ ] `Review` model + `/work-assignments/:id/reviews` endpoint (one per direction, only post-completion)
- [ ] Rating aggregation (`ratingAvg`/`ratingCount` recompute on new review)
- [ ] `/leaderboard/freelancers` and `/leaderboard/companies` endpoints (min ratingCount threshold)
- [ ] Frontend: review submission UI, public review display on profiles, leaderboard pages
- [ ] Manual test plan: complete an assignment, both sides review each other, ratings reflect on both profiles and leaderboard ordering updates

---

## Phase 9 — `apps/admin` build-out

Goal: admin stops being "just API calls via Postman" and gets a real internal tool.

- [ ] Scaffold Next.js app in `apps/admin`
- [ ] Admin auth (reuses backend `/auth/*`, admin role only)
- [ ] User management view (approve/reject/badge/block/delete, filters by role/status)
- [ ] Conversation/work-assignment/payment oversight views (read-only, flagged items surfaced)
- [ ] Broadcast notification composer, direct-message-to-user tool
- [ ] `AdminActionLog` viewer (audit trail)
- [ ] Basic analytics (signups over time, active assignments, payment verification rate)
- [ ] Manual test plan: admin reviews a pending profile end-to-end without touching the database or backend directly

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
