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

## Phase 1 — Backend foundation (standalone, no frontend wiring yet)

Goal: a running NestJS API with auth, testable via curl/Postman, completely independent of `apps/frontend`.

- [ ] Scaffold NestJS app in `apps/backend` (`nest new`, align with `@porishrom/backend` package name already set)
- [ ] `docker-compose.yml` at repo root: `postgres` service for local dev
- [ ] Point `packages/database` at local Postgres, run first `prisma migrate dev` (User model only, extended with `status` field + `admin` role per data-model.md)
- [ ] Wire `apps/backend` to import `@porishrom/database`'s generated Prisma client
- [ ] Auth module: signup (role fixed at signup), login, JWT access+refresh via httpOnly cookies, logout, `/auth/me`
- [ ] Password hashing with bcrypt (reuse logic pattern from `apps/frontend/src/app/auth/actions.ts`)
- [ ] Basic role guard (Freelancer/Client/Admin) usable by future modules
- [ ] Health check endpoint
- [ ] Manual test plan: signup as freelancer, signup as client, login, hit `/auth/me`, confirm role guard rejects wrong-role access on a dummy protected route

---

## Phase 2 — Profiles, categories, skills, admin approval

Goal: real profile data exists and admin can moderate it — still backend-only, testable via API calls.

- [ ] `FreelancerProfile` / `CompanyProfile` models + migration
- [ ] `Category` / `Skill` models + seed data (reuse categories already implied by `apps/frontend`'s onboarding: developer, graphic designer, drone operator, videographer, content writer, motion designer, social media, voice-over artist)
- [ ] Join tables: `FreelancerCategory`, `FreelancerSkill`, `CompanyCategory`
- [ ] `PortfolioItem` model + CRUD endpoints (Freelancer only, own items)
- [ ] Profile CRUD endpoints (`GET/PATCH /freelancers/me`, `/companies/me`, public `GET /:id`)
- [ ] Admin approval endpoints: approve/reject profile, issue/revoke badge
- [ ] `AdminActionLog` model + auto-logging interceptor for admin mutations
- [ ] Seed one Admin user manually (no public admin signup route)
- [ ] Manual test plan: create freelancer profile, submit for review, admin approves, badge issued, profile now shows verified

---

## Phase 3 — Rewire `apps/frontend` onto the backend

Goal: the existing frontend stops touching Prisma/its own DB directly and becomes a pure API consumer.

- [ ] Replace `apps/frontend`'s local Prisma-backed NextAuth Credentials logic with calls to backend `/auth/*`
- [ ] Onboarding wizard (`src/components/onboarding/*`) submits to backend profile endpoints instead of local server actions
- [ ] Freelancer dashboard replaces `src/lib/freelancer-dashboard-data.ts` mock data with real API calls (profile, portfolio at minimum — jobs/earnings/messages come later phases)
- [ ] Client dashboard fetches real profile data from backend
- [ ] Remove `apps/frontend`'s own `prisma/` folder, `src/lib/prisma.ts`, and local SQLite dependency once nothing references them
- [ ] Manual test plan: full signup → onboarding → dashboard flow works end-to-end against the backend, with zero direct DB access from the frontend process

---

## Phase 4 — Discovery & search

- [ ] `/search/freelancers` and `/search/companies` endpoints (category, skill, location, rating, verified-only, experience filters; pagination)
- [ ] Frontend: freelancer browse/search page with filters (Company-facing)
- [ ] Frontend: company browse/search page with filters (Freelancer-facing)
- [ ] Public profile pages (portfolio, ratings, categories/skills) for both roles
- [ ] Manual test plan: seed a handful of profiles across categories, verify filter combinations return correct results

---

## Phase 5 — Connections & messaging

- [ ] `Connection` model + `/connections` endpoints (send/accept/decline), same-role rejection, 14-day re-request cooldown after decline
- [ ] `Conversation` + `Message` models, created on connection acceptance
- [ ] `/conversations` + `/conversations/:id/messages` endpoints (participant-only access check)
- [ ] Frontend: connection request UI (send/accept/decline) on profile pages
- [ ] Frontend: chat UI (poll-based refresh, no websockets yet)
- [ ] Manual test plan: freelancer requests connection with company, company accepts, both can message; freelancer cannot message another freelancer (rejected at API level)

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
