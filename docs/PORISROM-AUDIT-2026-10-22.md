# Porisrom — project audit, completion report, and go-live assessment

Audit date: 22 October 2026, Asia/Calcutta. Scope: the current working tree on `main`, including existing uncommitted and untracked work. This is an initial audit, not a remediation pass. No application fixes, commits, pushes, migrations, seeds, database writes, dependency installation, or deployments were performed.

Evidence terminology: **verified** means inspected or executed during this audit; **historical** means asserted by earlier documentation; **inference** identifies a consequence of inspected code without a live database reproduction; **unknown** means evidence was unavailable. Passing isolated tests does not establish end-to-end completion.

## A. Executive summary

Porisrom connects freelancers and companies through discovery, accepted connections, messaging, negotiated work assignments, delivery review, external-payment reference matching, and reputation. A separate admin application supports profile/document review, moderation, oversight, notifications, and analytics.

The core marketplace is substantially implemented. This is considerably beyond scaffolding: 171 backend tests, 2 admin tests, and 4 frontend tests passed; all three apps passed lint and type checks; the backend and admin production builds passed. The frontend production build failed because Google Fonts could not be fetched in this environment. No current database-backed end-to-end workflow or deployed environment was validated.

The largest verified blocker is a private-document access bypass. With synthetic files and the actual Express middleware arrangement, ordinary private paths returned 404, but percent-encoded directory names returned 200 anonymously. Local KYC/company documents reside beneath the public static root by default. This invalidates the broad F001 completion claim for the current implementation. Cloudinary authenticated assets are a different storage path and were not shown to be publicly exposed by this reproduction.

Other material gaps include non-atomic refresh rotation, UI logout without backend revocation, incomplete account-status enforcement across public surfaces and existing conversations, absent admin dispute resolution, and unreliable audit-log persistence. Infrastructure, migration application, Cloudinary delivery, backup restoration, and the full visible-browser marketplace loop remain unverified.

**Launch outlook:** finish the security boundaries first, then validate an isolated, configured environment. A launch date is not supported by the available evidence.

## B. Architecture and project structure

| Layer | Actual repository implementation |
| --- | --- |
| Marketplace | `apps/frontend`: Next.js 16.2.9, React 19.2.4, TypeScript, Tailwind 4, Base UI/shadcn-style components, Auth.js `next-auth` v5 beta, Socket.IO client. App Router pages, server actions, and server-side backend fetches. |
| Admin | `apps/admin`: Next.js 16.2.9, React 19.2.4, Tailwind 4; separate HTTP-only token cookies and server-side API calls; no Auth.js. Port 3001. |
| API | `apps/backend`: NestJS 11; installed `@nestjs/core` 11.1.27; Express 5.1.0, Passport JWT, bcryptjs, class-validator/class-transformer, Cloudinary, Socket.IO. Default port 4000. |
| Database | `packages/database`: PostgreSQL; Prisma/client 7.8.0, `@prisma/adapter-pg`, generated CJS client compiled through TypeScript. Canonical schema and 12 SQL migrations. |
| Tooling | `pnpm-workspace.yaml`, root `packageManager: pnpm@9.0.0`, Turborepo tasks and lockfile; installed Turbo 2.10.2. The available global pnpm package is 11.9.0 and its attempted switch to pinned pnpm failed. |
| Shared packages | `packages/shared-types/src/index.ts` only exports `{}`; `packages/config` has a manifest and README. These are placeholders, not working shared contracts/configuration. |
| Storage | Cloudinary authenticated PDFs plus optional local private-document fallback; public profile/logo uploads have their own service. Local private files default beneath backend `uploads/`, which is also publicly served. |
| Deployment | Docker Compose provisions only PostgreSQL 16 on host port 5433, with a persistent named volume. Frontend Vercel instructions and general deployment/staging runbooks exist. No application Dockerfiles, reverse-proxy configuration, or checked-in CI workflows were found in the inspected tree. |

Authentication: frontend credentials login calls Nest; Auth.js keeps backend tokens in its JWT and exposes the access token through its session callback for browser usage. Admin stores `admin_access_token` and `admin_refresh_token` in HTTP-only cookies. Nest accepts Bearer access tokens or its own cookies. Roles are read from the current database user by `JwtStrategy`, rather than trusted solely from the token. Refresh tokens are hashed in `AuthSession`. See `apps/frontend/src/auth.ts`, `auth.config.ts`, `apps/admin/src/lib/session.ts`, and `apps/backend/src/auth/`.

The schema includes users, sessions, freelancer/company profiles, categories/skills and joins, portfolios, private document metadata, connections, conversations/messages, assignments/events, deliverables, payment verification, reviews, notifications/read states, and admin logs. `UserBlock` does not exist.

Documentation inventory and conflicts:

- Present and inspected: root `README.md`, `SETUP.md`, `handover.md`, `staging.md`; `docs/PRD.md`, `roadmap.md`, `PORISROM-REMEDIATION-HANDOFF.md`, `api-design.md`, `data-model.md`; application/package READMEs, frontend `VERCEL.md`, environment examples, manifests, schema, migrations, and relevant tests. Requested documents under `docs/` are not missing merely because their root-level equivalents do not exist. No additional versions of those named documents were found by repository file inventory.
- `apps/backend/README.md` says the backend is not scaffolded and describes MinIO. It is implemented and uses Cloudinary/local storage. `packages/database/README.md` still describes frontend SQLite access; current frontend code calls the API instead.
- `docs/api-design.md` claims `/api/v1`; `main.ts` sets no global prefix. Actual routes are `/auth/*`, `/search/*`, etc. It also lists unimplemented `/blocks` routes and paginated messages; `listMessages()` returns the full message list.
- The roadmap still calls realtime messaging future work; REST-persisted Socket.IO delivery and polling recovery exist. It also retains the old company-category mismatch and old broadcast-read limitation, both changed in current code.
- The handover's Cloudinary-only/fail-closed description omits current local fallback. Missing credentials fail closed only when fallback is disabled. The example explicitly enables fallback, even though its comment says local development only; the code allows an explicit true value in production too.
- Historical `profileCompleteness = 0` is outdated: profile upserts now force 100. This is still not a calculated completeness score, and a sparse freelancer PATCH can mark onboarding complete.
- The roadmap contains an unrelated pasted dashboard-shell instruction inside Phase 7. Treat this as documentation corruption, not a new instruction for this audit.
- The remediation handoff contains earlier pending browser statements followed by later claims of successful verification on 2 October. Those later claims are historical, not results from this audit.

## C. Confirmed implemented work

The following code paths are present and supported by passing focused tests; their deployed/end-to-end behavior remains subject to Section F:

- Authentication, role guards, account-status checks for authenticated HTTP requests, persistent refresh-session records, sequential rotation/replay rejection, and backend logout revocation. `auth-session.spec.ts`: 4 passing; `auth-rate-limit.spec.ts`: 9 passing.
- Owner/public profile projections, taxonomy joins, rejected-profile resubmission, photo/logo persistence, portfolio links, and private-document metadata. Tests include profile moderation, malformed relations, profile-photo storage, identity documents, and company documents.
- Approved/active/correct-role search restrictions, bounded pagination, multiple server-side filters, normalized keyword matching, and deterministic search ordering. Freelancer search: 10 passing tests; company search: 5.
- Cross-role connection restrictions, 14-day same-requester cooldown, advisory locking for connection pairs, row locking for responses, and transactional conversation creation. Connection creation/response suites: 13 passing tests.
- Participant-only conversation/assignment access, assignment state transitions, delivery review, role-specific payment reference projection, payment row locking, matching/mismatch handling, and completed-assignment reviews. Security, transaction, terms, financial-history, workflow notification, and reputation-related suites passed.
- Caller-specific broadcast read states and direct-notification ownership checks. `notification-read-state.spec.ts`: 5 passing; frontend notification/realtime helpers: 3 passing tests.
- Admin profile review, badge changes, account block/delete, review removal, oversight, analytics, document proxies, broadcasts, and targeted notifications. Admin proxy tests: 2 passing. Admin production build completed.

### Feature-by-feature status matrix

Every row below combines the PRD requirement with current implementation, verification, and remaining gaps. **E2E not verified** means no current complete browser/API/database journey was established. Broad feature statuses intentionally do not equate passing unit tests with completion.

| Feature / expected behavior | Implementation evidence | Actual behavior and successful checks | Gaps / end-to-end evidence | Status |
| --- | --- | --- | --- | --- |
| 1. Authentication, authorization, sessions, fixed account roles | `apps/backend/src/auth/`; frontend `auth.ts`, `auth.config.ts`, `app/auth/actions.ts`; admin `lib/session.ts` | Signup restricts public roles; bcrypt; current-user/status guards; hashed refresh sessions; sequential rotation/replay/logout tests pass. | Concurrent use of one refresh token succeeded twice in an isolated probe. UI logout does not revoke Nest sessions. JWT access validation ignores session revocation. Admin refresh during page rendering needs a runtime check. E2E not verified. | Partially Complete |
| 2. Freelancer profile, onboarding, skills/categories, portfolio | `profiles/freelancer-profile.*`, profile DTO, `schema.prisma`, frontend onboarding/settings/portfolio routes | Owner/public field separation; relation validation; category/skill joins; rejected-to-pending edit; public photo upload and URL-based portfolio CRUD. Relevant profile/transaction/storage tests pass. | Completion is forced to 100, not calculated; API does not enforce the wizard's full minimum profile. Portfolio is URL-based rather than a general managed-media upload pipeline. Upload-after-profile-save failure can leave partial onboarding. E2E not verified. | Partially Complete |
| 3. Company profile and onboarding | `profiles/company-profile.*`; frontend `app/onboarding/page.tsx`, wizard, customer step, company form | Backend categories loaded and submitted as IDs; transactional joins; logo upload; resubmission; profile moderation tests pass. | Existing empty category joins need data inspection; multi-step profile/photo/document completion is not atomic. E2E not verified. | Partially Complete |
| 4. KYC/company documents, private storage/admin review | `kyc/identity-document.service.ts`, `profiles/company-document.service.ts`, protected controllers, admin `app/api/users/[id]/...`, document migrations | PDF signature/MIME/size checks; authenticated Cloudinary options; owner/admin file access; identity review state; company document metadata/replacement. Identity: 13 tests; company: 5; static: 2. | Encoded-path local-file exposure reproduced despite canonical denial. Cloudinary credentials are nonempty locally but were not authenticated or exercised. Company documents have upload state only; no per-document review decision model, and earlier decisions do not require one. E2E not verified. | Broken |
| 5. Discovery/search/public profiles | `search/search.service.ts`, DTOs; frontend `/freelancers`, `/companies`, `[id]`, loading/error/transition components | Approved-only, active and role-filtered search; categories/skills/location/rating/badge filters; normalized multi-term search; counts, 12-result UI pages, bounded API page size, clear/empty/loading/error states. Search tests: 15 pass. | Public profile and leaderboard queries omit active-account/role restrictions. URL/filter interactions are source-reviewed only. Freelancer UI is Assam-scoped. Legacy category data and real query performance unverified. | Partially Complete |
| 6. Connections and messaging | `connections/`, `conversations/`, `realtime/`; frontend messages routes and chat components | Cross-role/receiver/participant checks; transactional connection/conversation/message/notification work; Socket.IO user rooms with polling recovery. Focused connection/realtime tests pass. | Existing counterpart's blocked/deleted status is not checked when sending messages; sockets authenticate once and are not explicitly revoked on moderation/logout. Messages have no pagination; `readAt` exists without a complete read-receipt workflow. E2E not verified. | Partially Complete |
| 7. Assignment creation, negotiation, acceptance, cancellation | `work-assignments.service.ts`, controller/DTOs, `work-assignment-panel.tsx`, assignment/event schema | Client proposals; freelancer respond; revise loop; mutual cancellation; event timeline; minimum budget and tomorrow-or-later validation. Terms: 10 tests; security/transaction tests pass. | No abandonment timer/admin arbitration path; no counterpart moderation freeze. State checks for ordinary transitions occur before transactions; concurrent transitions need DB tests. Assignment attachment storage is absent. E2E not verified. | Partially Complete |
| 8. Deliverables, revisions, completion | Same assignment service/panel; deliverable DTO/model | Freelancer URL deliverables; client accept/revision; accepted delivery opens payment; matching references completes assignment. Tests cover selected transactional/security branches. | Delivery is a typed URL, not native file hosting. No full submit/revise/resubmit/accept journey run this audit. Concurrent transition safety remains unverified. | Partially Complete |
| 9. Payment verification/UTR | `processPaymentClaim`, `paymentResponse`, financial history; admin payments page | Both-party comparison; own-reference-only participant responses; fresh mismatch rounds; row lock; threshold 3 produces disputed; financial histories implemented. Security/transaction/history tests pass. | Admin has read-only oversight, no resolve/override workflow. Mismatch/dispute code writes events and financial updates but does not create the PRD-promised mismatch notifications. This verifies matching claims, not bank settlement. E2E not verified. | Partially Complete |
| 10. Reviews, ratings, leaderboards/reputation | `reviews/`, `leaderboard/`, admin review removal; public review pages | Completed-assignment-only, one-per-direction unique constraint, transactional aggregation, review moderation, thresholded top-50 leaderboards. Owner review/admin review/security tests pass. | Leaderboards/public review access only gate profile approval, not account status. Simultaneous rating aggregation consistency unverified. E2E not verified. | Partially Complete |
| 11. Notifications and read state | `notifications.service.ts`, `NotificationReadState`, frontend notification helpers | Broadcast per-user upsert/projection; direct ownership; selected workflow notifications and targeted realtime delivery. Read-state 5 tests and frontend helper tests pass. | Broadcasts are retrieved by polling rather than `emitNotificationCreated`, which ignores null user IDs. Some lifecycle notifications are missing; full lists are unbounded. E2E not verified. | Partially Complete |
| 12. Admin dashboard, moderation, approvals, analytics, audit | `admin.controller.ts`, `admin.service.ts`, log interceptor; admin protected pages | Admin guards; safe list selection; profile/docs review; approve/reject/badge/block/soft delete; review removal; SQL-backed analytics and oversight. Focused tests/admin build pass. | Dispute resolution absent; audit logging is asynchronous and failure does not fail the mutation. Soft deletion anonymizes User name/email but retains profile/document fields. Authenticated mobile UI not reverified. | Partially Complete |
| 13. Validation, errors, accessibility, responsive UI | Global `ValidationPipe`; DTOs; recovery components; labeled controls; admin CSS/nav | Whitelist/transform; malformed search/admin/leaderboard/profile relations covered; all app lint/type checks pass. Admin login visible in Chrome with named inputs. | No full accessibility audit; protected responsive workflows blocked. Admin login had autocomplete issue and one 404 resource. Search rejects malformed pages as API errors but UI generally shows unavailable state. 4 MB action limit is below possible combined company document allowance. | Partially Complete |
| 14. API security, rate limiting, rotation, ownership | JWT/roles guards, auth limiter, production secret checks; ownership services | Account-scoped login limit; protected resources/role checks; HTTPS origin/secret-length checks; security tests pass. | Private static bypass and refresh race reproduced. In-memory limits reset on restart and are per instance; no overall spray/IP limit. Identical access/refresh secrets are accepted. Existing sockets are not continuously reauthorized. | Partially Complete |
| 15. Environments, storage, migrations, logging, deployment | Env examples, `prisma.config.ts`, schema/migrations, health controller, Compose, README/staging/VERCEL docs | Env presence inspected without values; schema valid; database TypeScript check passes; readiness executes `SELECT 1`; migration SQL reviewed. | No DB listening, no migration ledger/drift/upgrade run, frontend build network-blocked, pnpm acquisition blocked, no confirmed live infra/backups/monitoring/restore. Local document durability/privacy needs correction. | Not Verified |
| Additional PRD moderation requirement: user block/report | PRD §8; API design `/blocks`; actual schema/module inventory | No `UserBlock`, block/report service, controller, or UI found. Admin account blocking is separate. | Required user-level safety function absent; explicitly decide scope before release if deferring it. | Not Implemented |

## D. Partially completed and missing work

### Confirmed defects and code-supported risks

1. **P0 — private local document disclosure.** `main.ts:14–16` denies two literal prefixes, then statically serves their parent directory. Express's static server decodes percent-encoded names that bypass those literal mount checks. Synthetic HTTP reproduction returned 200 for encoded private directory names. An attacker still needs a stored path; the path is not an authorization boundary. Both local document services use this root by default. Do not infer that actual production documents were exposed: production storage, existing files, external access, and access logs were not inspected.
2. **P0 — refresh rotation is not atomic.** `AuthService.refresh()` reads the old hash and later updates by session ID without a lock or conditional old-hash predicate. Two simultaneous calls with the same synthetic old token both succeeded against the actual compiled service with a mock repository. This is a deterministic service-level reproduction, not a PostgreSQL concurrency test. Existing four session tests cover sequential use only.
3. **P0 — logout/revocation is incomplete across clients.** Frontend `app/dashboard/actions.ts` invokes Auth.js `signOut` only; admin `logoutAdmin()` deletes its cookies only. Neither calls Nest `/auth/logout`. Even explicit Nest revocation does not revoke existing access tokens: `JwtStrategy.validate()` queries the User but never `AuthSession`; the isolated strategy probe accepted a synthetic revoked-session ID. Account blocking still prevents new authenticated HTTP requests because it checks current User status. There is no explicit socket disconnect/expiry timer.
4. **P0 — moderation/public visibility boundaries are inconsistent.** Search filters `user: { status: "active", role: ... }`; public profile, public review gate, and leaderboard queries only check profile approval. Admin block/delete changes User status without resetting profile approval, so these public queries can still select the retained profiles. Existing active counterpart can also send messages or change assignments with a blocked/deleted counterpart because resource access only checks participant IDs. These are code-supported consequences, not newly run live account workflows.
5. **P0 — payment dispute resolution is absent.** Three mismatches place assignments in `disputed`, and further claims are rejected. Admin controller/page inventory has no resolution/override mutation. PRD §6 promises manual handling. Such records cannot finish through the documented product flow. An operational note alone does not supply a safe audited state transition.
6. **P1 — audit trail can miss successful actions.** The admin interceptor starts an unawaited create inside `tap()` and catches/logs failures. A completed moderation mutation can lack its promised audit row; the DB does not make the mutation/log atomic. No trigger or database privilege boundary was found enforcing append-only semantics.
7. **P1 — multi-step uploads can partially complete onboarding.** Profile save marks onboarding complete before photo/doc uploads. Failure later leaves a saved profile and potentially previously uploaded assets. The wizard exposes an error, but resume/retry after reload is not established. Company API permits 1 certificate + 4 Aadhaar PDFs, each 1 MB, while Next's server action body limit is 4 MB including multipart overhead (`next.config.ts`). Maximum accepted selections can exceed the frontend transport ceiling. No full-browser boundary test was run.
8. **P1 — release/configuration reliability.** Missing production backend URLs throw, but explicitly configured localhost/HTTP URLs are accepted by both server-side helpers. Production JWT validation enforces length/example checks but accepts equal access/refresh secrets; this was reproduced with synthetic values. Explicit local KYC fallback is allowed even under production. These differ from the runbooks' requirements and need enforced guards or a verified deployment configuration gate.
9. **P1 — soft deletion is limited anonymization.** Only User name/email are changed; company name, profile text, address and document metadata/assets remain. This preserves relationships but does not implement a complete erasure/retention process. No conclusion about legal compliance is made here; product retention/access behavior must be documented and implemented.

### Missing or unverified requirements

User-level block/report, abandonment escalation, admin cancellation arbitration, and payment mismatch notifications are absent in the inspected paths. General assignment file attachments/native deliverable uploads are absent; link-based delivery exists. Self-service password recovery is not implemented: the forgot-password page describes support recovery and its test verifies that wording. A usable support identity-verification process remains operationally unverified. Admin `tryRefresh()` attempts cookie writes from callers that include server-rendered pages; test expiry/refresh in the actual Next runtime before claiming persistent admin sessions work.

Potential races in non-payment assignment transitions and simultaneous reputation aggregation require targeted PostgreSQL integration tests; they are not claimed here as reproduced bugs. Unbounded messages, notifications, admin lists, and financial history are scaling risks, rather than proof of a present outage.

## E. Security and remediation status — independent F001–F009 review

Earlier October 2 API/DB/browser successes are historical only. Current regression results below came from this audit's full 171-test run. No new F010+ identifiers are assigned.

| Finding | Current implementation / tests | Audit conclusion | Remaining proof/work |
| --- | --- | --- | --- |
| F001 private KYC, public intended assets | Literal deny mounts, owner/admin routes, Cloudinary authenticated delivery, public photo service. Static 2, identity 13, photo 5 tests pass. Real Express synthetic requests: canonical 404, encoded 200. | **Incomplete; privacy boundary broken for local storage.** Existing tests are too shallow to catch middleware bypass. | Separate private filesystem root from every static root; HTTP regression with encoded/case/path variants; confirm public photos still work and owner/admin private access works. |
| F002 login rate limit | Login 10 attempts/15 minutes per normalized account key; signup 5/15m; refresh 30/5m by token hash. Guard suite 9 passes. | **Fix present and isolated-tested.** Broader abuse protection incomplete. | Live 11th-attempt 429; multi-instance/shared limit or edge guard; spray/IP behavior; correct proxy/client addressing. UI login calls Nest twice, so successful logins consume two attempts and create an unused session. |
| F003 rotation, revocation, replay | AuthSession schema/migration; hash rotation/replay rejection; logout update; 4 sequential tests pass. Concurrent probe: 2 refresh successes. UI logout omits backend call; access strategy omits session lookup. | **Partially fixed; concurrency/revocation gaps reproduced or source-confirmed.** | Atomic rotation; both UI logout integrations; revoked-session access/socket policy; DB-backed concurrent/replay and multi-tab refresh tests. |
| F004 company certificate/Aadhaar persistence | CompanyDocument migration/service/controller; wizard multipart upload; admin private proxies. 5 tests pass. | **Persistence fix present and tested; private storage inherits F001 failure.** | Real DB persistence and Cloudinary test; owner/admin/other-user checks; retry/replacement cleanup; maximum combined files through server action. Do not invent a mandatory-document approval policy. |
| F005 work terms | Shared helper, DTO/service checks, panel minimum/date constraints; 10 tests pass. | **Fix present and isolated-tested; no observed regression in covered cases.** | Current live/browser create + revise at date boundary; verify selected application timezone. Existing invalid historical terms are deliberately retained for unrelated edits. |
| F006 broadcast reads | Compound NotificationReadState key; caller-scoped list/upsert; 5 tests pass. | **Fix present and isolated-tested.** | Current DB migration state and two-user visible flow; no historical pass promoted to a current result. |
| F007 malformed inputs | Validated admin/leaderboard/search DTOs; category/skill existence checks before writes; malformed suite 9 passes. | **Fix present for documented cases and isolated-tested.** | Current HTTP 400/error-envelope checks, duplicate/race constraints, and additional unbounded payload limits where needed. Not a blanket claim about every input. |
| F008 admin mobile navigation | Final mobile CSS rule after desktop hide, nav drawer code present; admin lint/type/build pass. | **Fix present; protected mobile behavior not reverified.** | Login to admin and inspect/open/close drawer at actual 320/375/390/430 widths. Current visible check only reached unauthenticated login. |
| F009 select accessibility | Named discovery/admin/work panel selects and custom triggers present; frontend/admin lint/type pass. | **Fix present by source; full runtime accessibility not reverified.** | Accessibility tree/keyboard inspection including accepted-deliverable and completed-review states. Login textbox labels were observed; these do not verify selects. |

### Private storage/KYC next priority

All three Cloudinary variables are present and nonempty in the local backend environment; values were neither printed nor copied. No Cloudinary account/API/upload/delete/signed-delivery request was performed. Source scanning found no Cloudinary credentials/database secrets in frontend/admin source. Real `.env` files are untracked/ignored according to the inspected Git file list. This does not establish provider credentials are valid or perform a historical secret scan.

Cloudinary calls use `resource_type: image`, `type: authenticated`, server-generated IDs, and five-minute private download URLs. Freelancer service blocks pending/approved replacement, supports rejected replacement, cleans a new upload when DB persistence fails, and attempts metadata restoration if replacing the old asset fails. Company service transactionally replaces document rows, then best-effort deletes old assets; deletion failures are swallowed and can leave orphaned sensitive assets. Local cleanup also suppresses unlink errors. File retention and orphan cleanup require an operational procedure.

Safe staging validation after the storage fix: explicitly disable fallback; set backend-only staging credentials; upload synthetic PDFs; prove no ordinary public URL serves them; verify owner/admin/other-user access and URL expiry; approve/reject/replace freelancer documents; verify both company types survive reload; simulate provider/upload/DB/cleanup failures; verify logs and client responses contain no credentials or document contents. Separate profile approval from document review; the implementation does not make company documents mandatory or individually reviewed.

### Discovery/search next priority

The historical company taxonomy mismatch is **resolved for the current new/edit UI code**: onboarding fetches `/categories`, passes the taxonomy to the customer step, and submits category IDs. Settings likewise use taxonomy IDs. The seed supplies nine profession/service categories and twelve skills. The old business-category list is not used in the inspected active picker. Existing CompanyCategory data is unknown; the code change does not backfill old empty joins.

Search normalizes punctuation/whitespace, splits multiple terms into AND-of-OR branches, uses case-insensitive Prisma contains, excludes unapproved/blocked/wrong-role records in both items/count queries, and sorts rating average/count then ID. Company keyword matching covers name/about/state; category is a separate filter. The freelancer UI always requests Assam and adds district/skill/experience. Both retain filters in pagination and provide recovery/empty/loading states. Company changes apply immediately, keyword debounce is 350 ms, and newer changes cancel pending debounce work; freelancer filters apply explicitly. No meaningful database ranking/performance or browser URL-history/pagination verification was possible. Unknown category IDs in search naturally yield no matches; invalid relation IDs on profile writes are rejected.

## F. Test and build report

Commands ran in PowerShell using existing installed dependencies. For Git, the initial bare commands failed with dubious ownership; subsequent commands used `git -c safe.directory='<USERPROFILE>/Desktop/porisrom' ...`, without modifying global Git configuration. Tool exit codes were captured separately where commands were grouped. Type checks used `--incremental false` to avoid updating build-info files.

| Command / working directory | Outcome | Evidence / limitation |
| --- | --- | --- |
| `git status --short`; `git branch --show-current`; `git log -5 --oneline` / root | Initial environment failure; command-scoped retries passed | `main`; HEAD `9c8d9b0`; large existing dirty tree. |
| Scoped Git `diff --stat`, selected `diff -- <paths>`, `ls-files '*.env' '**/.env'` | Passed | Inspected remediation/schema/onboarding/search changes; no real env files listed as tracked. |
| `node --version` | Passed | v24.11.0; different from documented minimum/runtime examples, not proof of compatibility with every Node 20 release. |
| `pnpm.cmd --version` | Blocked by environment/toolchain | Available pnpm 11.9.0 attempted pinned 9.0.0 acquisition; registry fetch/signature verification failed. This does not prove lockfile tampering. |
| `node '<USERPROFILE>\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.mjs' --version` | Blocked, exit 1 | Same acquisition/fetch verification failure. A process-local `npm_config_manage_package_manager_versions=false` retry also failed. No verification bypass was used. |
| `.\node_modules\.bin\vitest.CMD run` / `apps/backend` | **Passed** | 25 files, 171 tests; 21.77 seconds reported. Predominantly mocked service/unit tests, not a live Postgres suite. Storage tests use temporary synthetic files. |
| `.\node_modules\.bin\vitest.CMD run` / `apps/admin` | **Passed** | 1 file, 2 proxy tests. |
| `node --test test/notification-state.test.mjs test/realtime-chat.test.mjs test/recovery-policy.test.mjs` / `apps/frontend` | **Passed** | 4 tests, 0 failed/skipped. No frontend `test` package script exists. |
| `.\node_modules\.bin\eslint.CMD "{src,test}/**/*.ts"` / backend | **Passed with warnings**, exit 0 | 2 unused `no-console` eslint-disable warnings, in `main.ts` and audit-log interceptor. No `--fix`. |
| `.\node_modules\.bin\eslint.CMD` / frontend; same / admin | **Passed**, each exit 0 | No lint errors. |
| `.\node_modules\.bin\tsc.CMD --noEmit --incremental false` / backend, frontend, admin, database | **Passed**, each exit 0 | Used existing generated Prisma client/database artifacts; not a clean dependency installation. |
| `.\node_modules\.bin\prisma.CMD validate` / database | **Passed**, exit 0 | Canonical schema valid; does not connect to DB or prove migration application. |
| `.\node_modules\.bin\nest.CMD build` / backend | **Passed**, exit 0 | Backend compiled using installed database artifacts. |
| `.\node_modules\.bin\next.CMD build` / admin | **Passed**, exit 0 | Compiled, typechecked, generated 11 static-page tasks; protected/API routes listed. |
| `.\node_modules\.bin\next.CMD build` / frontend | **Failed, environment-blocked**, exit 1 | Onest/Outfit `fonts.googleapis.com` fetches failed; no successful frontend production artifact claimed. No font mock/substitution used. |
| `docker info --format '{{.ServerVersion}}'` | **Blocked**, exit 1 | Docker config access denied and engine named pipe absent. No engine/container/volume changes made. |
| Inline Node `net.connect` probes for 127.0.0.1 ports 3000, 3001, 4000, 5433 | **Environment unavailable** | All ECONNREFUSED before temporary admin server. Local env DB metadata confirms localhost:5433; no remote URL tested. |
| `Get-NetTCPConnection -State Listen ...` | Inconclusive | Produced no matching listener rows; independent Node TCP checks confirmed refusal. |
| Inline compiled-service audit probes via `@' ... '@ \| node` / backend | **Defects reproduced** | Concurrent refresh 2 fulfilled/0 rejected; access strategy accepted synthetic revoked sid; production config accepted equal synthetic secrets. Mock DB/JWT, no real tokens or data. See Section D. |
| Inline Express/temporary-file HTTP probe via `@' ... '@ \| node` / backend | **Privacy bypass reproduced** | Literal KYC/company paths 404; encoded counterparts 200. Actual installed Express and compiled deny handler, same middleware order as `main.ts`, temporary synthetic PDFs. Files/directories removed individually; no app uploads touched. Reproduction below. |
| Chrome DevTools `list_pages`, `navigate_page` to localhost:3000 | Browser tool connected; app unavailable | Navigation failed ERR_CONNECTION_REFUSED; no marketplace pass. |
| `.\node_modules\.bin\next.CMD start -p 3001` / admin; Chrome navigation to `/login`, snapshot, resize, console/evaluate | **Limited visible smoke passed** | Production admin login rendered title, named email/password controls, Sign in. Actual viewport measured 500×844 after requested 390×844; do not count this as a 390px test. Scroll width 500, no horizontal overflow at measured width. Autocomplete issue and one resource 404 observed. Server stopped after check. No credentials entered. |
| Scoped `git diff --check` / root | **Passed**, exit 0 | Checked existing tracked changes as well as audit-generated change cleanup; no existing whitespace fixes made. |

### Reproduce the private-static boundary without touching user documents

Run from `apps/backend` after the backend build. This uses a newly allocated OS temporary directory, an ephemeral loopback port, and synthetic PDFs. It closes its server and removes only files/directories it created. It never points at the app's upload directory.

```powershell
@'
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const http = require('http');
const { denyPrivateDocumentUploads } = require('./dist/static-uploads.js');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'porisrom-audit-static-'));
  const dirs = ['kyc-documents', 'company-documents'];
  let server;
  try {
    for (const dir of dirs) {
      await fs.mkdir(path.join(root, dir));
      await fs.writeFile(path.join(root, dir, 'audit.pdf'), '%PDF-1.7 synthetic audit file');
    }
    const app = express();
    app.use('/uploads/kyc-documents', denyPrivateDocumentUploads);
    app.use('/uploads/company-documents', denyPrivateDocumentUploads);
    app.use('/uploads', express.static(root));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    for (const probe of [
      '/uploads/kyc-documents/audit.pdf',
      '/uploads/%6byc-documents/audit.pdf',
      '/uploads/company-documents/audit.pdf',
      '/uploads/%63ompany-documents/audit.pdf'
    ]) {
      await new Promise((resolve, reject) => {
        http.get({host:'127.0.0.1', port:server.address().port, path:probe}, res => {
          res.resume();
          res.on('end', () => { console.log(JSON.stringify({path:probe,status:res.statusCode})); resolve(); });
        }).on('error', reject);
      });
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const dir of dirs) {
      await fs.unlink(path.join(root, dir, 'audit.pdf'));
      await fs.rmdir(path.join(root, dir));
    }
    await fs.rmdir(root);
  }
})().catch(() => { console.error('static boundary probe failed'); process.exitCode = 1; });
'@ | node
```

Checks **not run / not verified**: frozen-lockfile clean install, dependency vulnerability inventory, root Turbo release gate, fresh Prisma generation/full database build, migration status/drift/upgrade, database-backed integration/concurrency tests, live API smoke, live Cloudinary upload/destroy/signed expiry, authenticated Chrome journeys, protected responsive/a11y checks, load tests, backup restore, deployment rollback, and any staging/production endpoint. Root Turbo wrappers were not reported as passing; direct installed package binaries supplied the app checks above. No missing infrastructure was silently substituted.

## G. Staging readiness

Code/configuration exists for a staged deployment, but **this exact worktree should not be deployed as a release candidate before the private-document defect is corrected**. A developer-only isolated environment with synthetic data can be used to reproduce and remediate defects.

| Area | Exists in code/docs | Confirmed deployed/live | Required validation |
| --- | --- | --- | --- |
| Secrets/origins | Backend JWT/Cloudinary/DB variables; frontend AUTH_SECRET and API URLs; admin API URL; production length/origin guards | No | Distinct real secrets, HTTPS URLs, precise CORS allowlist, no public secrets, local fallback explicitly disabled. |
| Database/migrations | 12 SQL migrations; `migrate:deploy`; taxonomy seed; local Compose volume | No; local port unavailable | Provision isolated DB, inspect migration ledger, back up before upgrade, deploy migrations, validate schema/data, restore drill. No destructive migration was identified in current SQL; this is not an upgrade rehearsal. |
| Apps | Backend/admin builds pass; frontend Vercel instructions | No | Working pinned toolchain, reproducible full frontend build, app supervision/restarts and private admin access. |
| Storage | Authenticated Cloudinary + local/public services | No | Correct F001, validate synthetic uploads/delivery/expiry/cleanup and persistent public assets. |
| Auth/transport | HTTP-only secure production cookies, role/ownership guards, configured CORS | No | Atomic refresh, backend revocation from UI, HTTPS/cookie behavior across deployed origins, expired-session/multi-tab/socket testing. CORS is not itself an authorization check. |
| Health | `/health`; `/health/ready` runs SELECT 1 | No | Real 200/503 behavior and platform probes. DB connects during startup; readiness does not validate migrations or Cloudinary. |
| Observability | Nest/default console errors; admin action log model/interceptor | No | Reliable audit trail, log redaction, request correlation, error/availability alerts, storage/migration failure visibility. |
| Operations | Runbooks, optional demo/admin seeds, app-first rollback outline | No | Named operators, admin provisioning/recovery, dispute/support process, backup/restore evidence, immutable artifact and rollback rehearsal. |

Four migrations and significant remediation code are untracked in the baseline. Deployment from committed HEAD alone will omit them. Prepare a reviewed release artifact containing the intended working-tree implementation only after user review; this audit did not commit it.

## H. Production launch checklist

Mandatory blockers:

- [ ] Eliminate encoded-path anonymous access to local private documents while retaining intended public photos/logos; verify existing local document handling safely.
- [ ] Make refresh rotation atomic; connect both UI logout flows to revocation; enforce the intended revoked-session boundary for HTTP/realtime.
- [ ] Apply consistent active-account/role visibility on public profiles, reviews, and leaderboards; freeze mutations involving moderated counterparts and notify the active party.
- [ ] Implement an audited admin dispute-resolution path and the promised mismatch/escalation notifications.
- [ ] Make required moderation audit records reliable; define safe soft-delete/document retention behavior.
- [ ] Deliver user block/report and cancellation escalation, or explicitly review and document their release scope before launch.
- [ ] Prove onboarding upload limits, retries, persistence, resubmission, and recovery; distinguish profile approval from document review.
- [ ] Obtain a successful clean, pinned-toolchain build/test release gate, including frontend production build, without claiming mocked font fetches as production validation.
- [ ] Configure actual HTTPS hosts/origins, distinct secrets, safe storage policy and private database connectivity. Disable demo seeds; provision real admin credentials without defaults.
- [ ] Rehearse migrations and rollback against isolated staging data, with tested backups/restoration and monitoring.
- [ ] Run visible Chrome end-to-end freelancer/client/admin workflow plus negative authorization, expired sessions, mobile menu, keyboard/select and document access checks.
- [ ] Record staging acceptance, production smoke/rollback ownership, support/recovery and payment-dispute procedures. No current deployment or production signoff is confirmed.

Recommended later improvements, subject to measured needs: cursor/paged history and admin lists, search indexing/load testing, full notification retention controls, shared API types/config extraction, richer profile-completeness calculation, extra accessibility polish, and product backlog such as recommendations/saved profiles/email notifications. Payment gateway/escrow, milestones and multi-seat companies are explicitly outside this MVP; their absence is not a blocker by itself.

## I. Completion estimates

These are rough planning estimates, not measurements or progress percentages. Method: compare the 15 feature domains and explicit PRD omissions against code and tests, then estimate remaining implementation and validation work. Assumptions: one developer familiar with TypeScript/Nest/Prisma, one focused working day of engineering effort, prompt access to a safe database/Cloudinary/hosting, current MVP scope, no major redesign, and no unexpected legacy-data repair. Provider approvals and user decisions add elapsed time outside these ranges.

| Dimension | Evidence-based completion assessment | Rough remaining effort |
| --- | --- | --- |
| Product feature implementation | Most core happy paths exist; safety, disputes, moderation, recovery and attachment scope remain incomplete. | 9–18 developer days to close the listed launch-scope code gaps, depending on agreed block/report/arbitration scope. |
| Test and verification coverage | 177 tests executed successfully, but no line/branch coverage measurement and no current full DB/browser journey. | 4–8 developer days for focused regression/integration/concurrency tests and visible role/device flows after fixes. |
| Staging readiness | Runbooks/config present; security gate fails, full release build unproven, infrastructure unconfirmed. | First synthetic staging-validation candidate: roughly 3–6 developer days for immediate security fixes/build environment/configuration; full staging acceptance additionally depends on closing required code gaps and validation. |
| Production readiness | Not established; successful staging, reliable operations, migration/backup/rollback proof absent. | Roughly 15–30 developer days overall across implementation, validation and deployment operations; overlaps the rows above and must not be added to them. |

These ranges are not a launch commitment. The safer first planning milestone is a fixed storage boundary with a passing real-HTTP regression and a successful reproducible frontend build.

## J. How far Porisrom is from going live

**NOT READY FOR STAGING**

The current candidate fails a reproduced confidentiality boundary and has an incomplete refresh/session boundary. The documented automated release gate also lacks a successful frontend build and clean pinned dependency verification. No configured staging infrastructure, applied migration ledger, or live Cloudinary flow has been confirmed. This verdict does not mean the product must be rebuilt; substantial core functionality and isolated tests already exist.

Code work: private/public storage isolation, atomic refresh/revocation, consistent moderation access, dispute resolution/auditing, and required safety/notification/recovery gaps. Configuration/environment work: working pinned toolchain and font fetch/build, staging DB/Cloudinary/origins/secrets, runtime deployment. Operational work: restore/rollback, monitoring, admin/support/dispute ownership, visible acceptance evidence. Passing a checklist on paper is insufficient to change this verdict.

## K. Prioritized remaining work

Efforts are rough developer-day ranges; assume existing architecture and synthetic test data. Parallelizable ranges overlap; do not sum mechanically.

| Priority | Task | Reason / impact | Dependencies | Effort | Acceptance criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Isolate private document storage and remove static bypass | Prevent unauthenticated identity/company document disclosure | Inspect existing local metadata/files without deletion; retain public asset behavior | 0.5–2 days | No private file lies in any public static tree; existing owner/admin reads work; intended public photos remain public | Real Express HTTP encoded/canonical/case/path tests, owner/admin/other-user checks, synthetic browser PDF flow |
| P0 | Make refresh rotation atomic and integrate revocation | Prevent concurrent token reuse and ineffective UI logout | Existing AuthSession migration; safe DB test target | 1–3 days | Same old refresh token cannot produce two successful rotations; UI logout revokes current session; revoked HTTP/socket policy enforced; multi-tab behavior stable | Parallel Postgres refresh requests, replay/logout/expiry tests, both visible UI logout paths |
| P0 | Enforce account status across public and active workflows | Prevent moderated users remaining visible/actionable and receiving live data | Agree existing PRD freeze/read-only handling | 1–3 days | Blocked/deleted accounts absent from public profile/review/leaderboard routes; active counterpart cannot mutate frozen work/chat; receives notification; sockets cease unauthorized delivery | Block/delete tests across both roles, HTTP and socket checks, preserved read-only history |
| P0 | Add audited payment dispute resolution | Three mismatches currently strand assignments | Define permitted resolution actions/evidence under existing manual-review requirement | 2–4 days | Authorized admin can resolve/return/flag through explicit legal state transitions; participants notified; before/after and actor reliably logged | Mismatch-to-dispute-to-resolution DB/browser journey and non-admin denial |
| P1 | Make admin audit writes dependable | Successful high-impact changes must remain accountable | Transaction/log architecture | 1–2 days | Required mutation and audit record cannot silently diverge; sensitive metadata minimized; action history retained | Inject log/DB failure; prove rollback or durable retry semantics and operator alert |
| P1 | Complete onboarding/document failure recovery and limits | Avoid saved profiles with misleading/failed submissions | Storage fix; existing server action/proxy contracts | 1–3 days | Max allowed selections fit transport or UI/API limits agree; partial saves recover visibly; no duplicate/orphan file accumulation | Boundary-size PDFs, failed provider/DB/upload, retry/reload, both roles |
| P1 | Implement user block/report and cancellation escalation | Explicit PRD safety and unresolved-work requirements | Review exact scope/workflow; no invented deadline policy | 2–5 days | Counterpart safety controls persist/enforce; nonresponse/arbitration has a defined supported route | Schema/API/UI negative tests and visible two-user/admin cases |
| P1 | Tighten deployment guards and supported account recovery | Prevent local URLs/fallback/equal secrets in deployed configuration; avoid locked-out users | Hosting topology and approved support recovery policy | 0.5–2 days | Unsafe production config rejected; admin token refresh works after expiry; verified recovery process is actionable | Production-config tests, expired admin session browser test, recovery rehearsal |
| P1 | Establish reproducible dependency/build release gate | Current installed packages do not prove clean release reproducibility | Registry/font network access or reviewed local-font solution | 0.5–2 days | Pinned pnpm installs frozen lockfile and all apps build/lint/type/test in clean CI; migration assets included | Clean runner logs and immutable artifact inventory |
| P1 | Provision and validate staging database/storage/apps | All end-to-end/deployment assertions currently unverified | P0 fixes; credentials and infrastructure | 1–3 days | HTTPS services healthy; migrations/catalog applied; private uploads, full core loop and negative roles pass | Real ready endpoint, migration ledger, visible Chrome and API smoke |
| P1 | Prove operational launch readiness and retention | Recoverability, privacy lifecycle and dispute/support ownership | Staging, backup destination, named operators | 1–3 days | Restore and app rollback rehearsed; monitoring alerts delivered; admin/recovery/dispute and document retention procedures validated | Restore into isolated DB, rollback exercise, alert simulation, signed acceptance log |
| P2 | Bound growing histories/lists and measure performance | Avoid increasingly slow chat/admin/notification pages | Production-like synthetic volume | 1–3 days | Pagination and relevant indexes/limits verified for expected load | Query plans, load tests, continuity/ordering tests |
| P2 | Clean stale docs/shared placeholders and improve UX/a11y | Reduce future implementation confusion and remaining usability debt | Confirm implemented contracts | 1–3 days | Accurate API prefix/storage/taxonomy/realtime docs; no pasted roadmap instructions; measured accessibility issues addressed | Doc-to-route review, keyboard/a11y tree and actual viewport checks |

## L. Recommended next task

**Fix the private local-document/static-serving boundary first.** It is a reproduced confidentiality issue affecting both KYC and company documents; it also undermines the historical remediation signoff. A stronger boundary is more reliable than adding another literal path-deny expression.

Small, verifiable plan after this report is reviewed:

1. Add an actual HTTP regression using the installed Express server, synthetic temp PDFs, the production middleware wiring, and canonical/encoded variants. Prove the present test fails because private bytes are returned. Include a valid public profile image success case.
2. Make private files physically separate from the static upload root. Inspect current local records first and design backward-compatible owner/admin resolution; do not move/delete existing user files or rewrite metadata without a reviewed migration approach.
3. Make production storage/fallback configuration explicit, and verify owner/admin checks plus no-store delivery continue to work. Keep public profile/logo storage public as already decided.
4. Run document/static/photo/security tests, lint/type/backend build; then verify synthetic files through visible Chrome and API calls in a safe configured environment. Only mark F001 complete after encoded anonymous requests fail and authorized access/public assets pass.

No step in this implementation plan was applied during the audit.

## M. Final handover

Repository: `<USERPROFILE>\Desktop\porisrom`; branch `main`; HEAD `9c8d9b0 feat: PORISHROM V.1.`. Previous commits inspected: `8140f98` frontend preview checkpoint; `3fe0a81` SETUP; `e3fdd1f` admin buildout; `853942d` reviews/reputation. At entry, 104 tracked files were changed (diff stat: 2,086 insertions/340 deletions), with substantial additional untracked remediation files/directories. Asset deletions/replacements, `uploads/`, `tmp/`, all pre-existing edits, and untracked migrations were retained.

Only this report is an intentional new persistent audit deliverable. Builds/tests wrote ignored build/cache artifacts. The admin build changed its previously clean generated `next-env.d.ts` route import; that exact audit-generated line was put back, without resetting any pre-existing work. No existing application code was intentionally changed. A temporary production admin server was started for unauthenticated visible smoke and stopped. Inline synthetic probes created no app data and removed their temporary files. No database/container was started or modified.

Architecture remains Next marketplace + Next admin → Nest API → Prisma/PostgreSQL, with Cloudinary/private local documents, public photos and Socket.IO/polling. Verified current checks: backend 171 + admin 2 + frontend 4 tests; all app lint/type checks; database type/schema checks; backend/admin builds; whitespace check. Frontend build blocked on remote fonts. pnpm's pinned-version acquisition failed with registry fetch/signature verification errors. Docker is unavailable to this session; configured local PostgreSQL/API are not running. Chrome MCP is available; only unauthenticated admin login was verified, at measured 500px width.

Most urgent unresolved evidence: synthetic encoded-path private-file requests returned 200, same refresh token concurrently succeeded twice, UI logout omits backend revocation, and access strategy ignores revoked session state. Further source-supported gaps are recorded in Sections D/E and prioritized in K. Historical October 2 successes must not override these current results.

Resume by rechecking Git state and reviewing this report; then address Section L, restore/provision a safe validation environment, complete the remaining P0 work, and run the documented release/staging gates. Do not reset, clean, stash, commit, push, run destructive migrations, wipe volumes, or expose credentials. This audit stops before remediation, as requested.
