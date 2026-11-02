# PORISROM REMEDIATION HANDOFF

This document is a permanent handoff for a future fresh Codex session. It captures the audit/remediation context known from the repository and the completed Codex work so far. If this document conflicts with the live repository state, inspect the repository and diffs first and treat unverified items as unknown.

## 1. Project Context

Porisrom is a marketplace-style web application with client/company, freelancer, admin, onboarding, KYC/document, work assignment, search, reviews, connection, notification, and profile workflows.

Verified monorepo structure:

| Area | Path | Verified notes |
| --- | --- | --- |
| Frontend app | `apps/frontend` | Next.js app for public/client/freelancer workflows, onboarding, discovery, dashboards, and work assignments. |
| Admin app | `apps/admin` | Next.js admin interface for admin login, users, notifications, KYC/client review flows, and navigation. |
| Backend API | `apps/backend` | NestJS backend with auth, admin, profiles, KYC, notifications, search, reviews, work assignments, uploads, and Prisma access. |
| Database package | `packages/database` | Prisma schema, migrations, generated client build, and seed/launch data. |
| Shared/config packages | `packages/shared-types`, `packages/config` | Shared package structure exists; exact surface not fully audited in this handoff. |
| Docs | `docs` | Product/API/data/roadmap docs exist and are currently modified in the dirty worktree. |

Important technologies verified during remediation:

- pnpm workspace commands are used.
- Backend is NestJS.
- Frontend and admin are Next.js/React.
- Prisma is used for database access and migrations.
- PostgreSQL is the database expected by Prisma.
- Docker Compose exists, but Docker Desktop/PostgreSQL availability became a blocker later.
- Vitest is used for backend tests.
- Type-check, lint, and production build commands exist for backend/frontend/admin packages.
- Playwright/system Chrome was used for headless browser automation in prior verification, but it did not satisfy the user's visible browser requirement.

Known run/test commands used during remediation:

```text
pnpm --filter @porisrom/database build
pnpm --filter @porisrom/database migrate:deploy
pnpm --filter @porisrom/backend test
pnpm --filter @porisrom/backend type-check
pnpm --filter @porisrom/backend lint
pnpm --filter @porisrom/backend build
pnpm --filter @porisrom/frontend type-check
pnpm --filter @porisrom/frontend lint
pnpm --filter @porisrom/frontend build
pnpm --filter @porisrom/admin type-check
pnpm --filter @porisrom/admin lint
pnpm --filter @porisrom/admin build
```

Exact dev-server commands and ports should be verified from the current repository before use.

## 2. Original Audit Scope

The application was audited and remediated through a combination of:

- Source-code review
- API testing
- Database testing
- Security testing
- Authorization testing
- Multiple synthetic users
- Client workflows
- Freelancer workflows
- Admin workflows
- Browser testing
- Playwright automation
- Chrome/browser testing attempts
- Responsive testing requirements
- Accessibility review
- Type-checking
- Lint
- Production builds

The objective was to test the actual application behavior, not merely inspect source code. Browser verification has a special caveat: prior headed/headless Playwright testing was performed, but the user later clarified that visible Chrome must be controlled through Chrome DevTools MCP and actually observable by the user. That visible Chrome DevTools MCP verification remains pending/blocked until a fresh Codex session exposes the MCP tools.

## 3. Complete Findings Register

| ID | Finding | Severity | Root Cause | Status | Fix | Verification | Remaining Work |
| -- | ------- | -------- | ---------- | ------ | --- | ------------ | -------------- |
| F001 | Public KYC documents could be exposed through public uploads | High | KYC files were under public upload/static serving behavior or had URL patterns that could be accessed directly. | Implemented; regression-tested; visible Chrome MCP verified | Added private KYC/document serving path and protected owner/admin access while preserving public profile/logo uploads. | Backend tests, API checks, auth/authorization checks, direct upload URL denial, profile-photo regression, visible Chrome DevTools MCP admin document workflow on 2026-10-02. | None known. |
| F002 | Login endpoint lacked adequate rate limiting | High | Authentication attempts were not sufficiently throttled. | Implemented and verified | Added auth rate-limit guard and tests. | Backend tests and live API check where 11th bad login returned 429. | None known, except future browser regression if relevant. |
| F003 | Refresh tokens were not session-scoped with rotation/revocation | High | Refresh tokens did not model device sessions, rotation, replay detection, or per-session revocation. | Implemented and verified | Added `AuthSession` model/migration and refresh-token rotation/revocation/replay behavior. | Backend tests and live API checks for rotation, replay, and logout. | Optional future logout-all-devices UI/API; not required now. |
| F004 | Client onboarding document uploads disappeared | High | UI asked for company certificate/Aadhaar files, but backend/database did not persist them. | Implemented; regression-tested; visible Chrome MCP verified | Added private company document storage/database records, owner/admin protected access, onboarding upload flow, admin visibility. | Backend tests, API/security checks, DB checks, visible Chrome DevTools MCP client onboarding/settings/admin document workflow on 2026-10-02. | Optional future failure-mode browser testing only. |
| F005 | Work assignment terms accepted invalid budget/due dates | Medium/High | Backend/frontend allowed zero/negative budget and invalid due dates for new assignments/revisions. | Implemented; API/regression verified; visible Chrome MCP verified | Added shared backend validation helper/DTO/service checks and frontend validation. | Backend tests, type-check/build/lint, live API checks for INR 0/negative/INR 1/yesterday/today/tomorrow; visible Chrome MCP workflow passed on 2026-10-02. | None known. |
| F006 | Broadcast notification read state was global, not per user | High | Broadcast notification `isRead` state was stored on the notification rather than per recipient. | Implemented; API/database/headless Playwright verified; visible Chrome MCP verified | Added `NotificationReadState` model/migration and per-user broadcast read logic. | Backend tests, migration, database checks, live API checks, headless Playwright/prior system Chrome, visible Chrome MCP two-user workflow passed on 2026-10-02. | None known. |
| F007 | Malformed API inputs could produce 500s or unsafe behavior | Medium/High | Some query/body values were not validated before Prisma/service use, including admin role, malformed numeric filters, leaderboard filters, and profile relation IDs. | Implemented; regression-tested; live HTTP verified | Added admin list-users query DTO, leaderboard query DTO, and relation existence validation for company/freelancer profile category/skill IDs. | Targeted tests, full backend tests, type-check, build, lint, and live DB-backed HTTP checks on 2026-10-02. | None known. |
| F008 | Admin mobile navigation button was hidden | Medium | CSS rule `.admin-menu-button { display: none; }` overrode mobile media display rules. | Implemented; build/type/lint verified; visible Chrome MCP verified | Added final mobile media override to make menu button visible on small screens. | Admin type-check/lint/build; visible Chrome MCP responsive verification passed on 2026-10-02 at 320/375/390/430px. | None known. |
| F009 | Select controls lacked accessible labels | Medium | Several native/custom select controls had no accessible label. | Implemented; build/type/lint verified; visible Chrome MCP verified where reachable | Added `aria-label` to unlabeled native/custom select triggers. | Frontend/admin type-check/lint/build, source scan, and visible Chrome DevTools MCP accessibility-tree checks on 2026-10-02. | Work-assignment deliverable/rating selects are source-verified only because they require specific accepted/completed assignment states to render. |

No findings beyond F009 are known in this handoff. Do not invent F010+ without auditing and evidence.

## 4. Detailed Findings

## F001 - Public KYC Document Exposure

### Original Problem

KYC documents could be exposed by public upload/static file behavior. Sensitive identity documents must never be anonymously accessible.

### Evidence

The audit identified public `/uploads` behavior overlapping with KYC document storage. Required verification included anonymous direct URL denial, unauthorized-user denial, authorized owner/admin access, and filename/path manipulation denial.

### Affected Files

- `apps/backend/src/main.ts`
- `apps/backend/src/static-uploads.ts`
- `apps/backend/src/kyc/identity-document.service.ts`
- `apps/backend/src/admin/admin.controller.ts`
- `apps/backend/src/profiles/freelancer-profile.controller.ts`
- `apps/backend/test/identity-document.spec.ts`
- `apps/backend/test/static-uploads.spec.ts`
- Admin/frontend proxy or UI files under `apps/admin/src/app/api/` and related admin user pages were involved in earlier remediation; inspect current diff for exact files.

### Root Cause

Public static upload serving was not sufficiently separated from sensitive KYC document access.

### User/Product Impact

Users' identity documents could be exposed if someone had or guessed a file path.

### Security Impact

High confidentiality risk for sensitive identity documents.

### Decision Required

A design decision was required on whether to remove public uploads globally or preserve public profile/logo uploads while protecting KYC.

### User Decision

User selected Option A: preserve public `/uploads` for intentionally public assets such as profile photos, public profile images, and logos, but ensure KYC documents are never publicly accessible.

### Remediation Implemented

Private KYC access was implemented with protected routes for authorized owner/admin access. Public profile/logo upload behavior was preserved. Direct `/uploads/kyc-documents/*` access was denied.

### Tests Added

- `apps/backend/test/identity-document.spec.ts`
- `apps/backend/test/static-uploads.spec.ts`

### Verification Performed

- Anonymous direct KYC URL denied.
- Protected owner/admin access paths verified through API/tests.
- Unauthorized access denied.
- Path/filename manipulation checked.
- Profile-photo/public upload regression checked.
- 2026-10-02 live API/DB verification with synthetic users:
  - Admin: `f001f004-admin-1790962274689@example.test`.
  - Freelancer owner: `f001-valid-owner-1790962377139@example.test`.
  - Public `/uploads/kyc-documents/*` probe returned 404.
  - Owner protected route `/freelancers/me/identity-document/file` returned a protected signed/private document response.
  - Admin protected route `/admin/users/:id/identity-document/file` returned a protected signed/private document response.
  - An unrelated freelancer using their own owner route for a different account's document returned 404.
  - A non-admin client calling the admin document route returned 403.
  - Public `/uploads` behavior remains installed for non-KYC assets; a nonexistent profile-photo probe returned a normal public-upload 404 rather than being globally disabled.
- 2026-10-02 visible Chrome DevTools MCP verification:
  - Logged into `http://localhost:3001` as the synthetic admin.
  - Opened the F001 freelancer review page for `F001 Valid Owner 1790962377139`.
  - The page showed `Identity Document Review`, status `Pending`, and `View private document`.
  - Opened `http://localhost:3001/api/users/cmur8ramu000a30u1772qh4jg/identity-document` in the same visible admin context.
  - Chrome PDF viewer loaded the protected document route with page controls visible; network showed GET 200 for the admin proxy route.
  - Console on the admin review page contained only React DevTools/HMR messages; the PDF tab had one browser issue about a form field missing `id`/`name`.
- Targeted regression re-run on 2026-10-02 passed: `identity-document.spec.ts` and `static-uploads.spec.ts` (15 tests).

### Verification Still Pending

- None known.

### Current Status

Implementation: PASS. API/security regression: PASS. Visible Chrome DevTools MCP: PASS.

## F002 - Login Rate Limiting

### Original Problem

The login endpoint allowed repeated failed login attempts without adequate throttling.

### Evidence

Audit required login brute-force/rate-limit remediation. Live API verification later confirmed the 11th bad login attempt returned 429.

### Affected Files

- `apps/backend/src/auth/guards/auth-rate-limit.guard.ts`
- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/test/auth-rate-limit.spec.ts`

### Root Cause

No sufficiently enforced login-specific rate limit guard was present.

### User/Product Impact

Accounts were more exposed to brute-force attempts and credential-stuffing pressure.

### Security Impact

High authentication hardening issue.

### Decision Required

Unknown / not verified as requiring a user product decision.

### User Decision

No special product decision recorded.

### Remediation Implemented

Added authentication rate-limiting guard and applied it to login behavior.

### Tests Added

- `apps/backend/test/auth-rate-limit.spec.ts`

### Verification Performed

- Targeted backend tests.
- Live API check: repeated bad login attempts resulted in HTTP 429 on the 11th attempt.

### Verification Still Pending

None known.

### Current Status

Implementation: PASS. API verification: PASS. Regression tests: PASS.

## F003 - Refresh Sessions and Token Rotation

### Original Problem

Refresh-token/session behavior did not support persistent device sessions with token rotation, per-session revocation, and replay detection.

### Evidence

The user selected Option C after the finding was discussed. Live API tests later verified rotation/replay/logout behavior.

### Affected Files

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261001000000_auth_sessions/`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/src/auth/decorators/current-user.decorator.ts`
- `apps/backend/src/auth/strategies/jwt.strategy.ts`
- `apps/backend/test/auth-session.spec.ts`

### Root Cause

Refresh tokens were not modeled as device/session records with server-side rotation/revocation state.

### User/Product Impact

Users and admins lacked robust session security. Stolen refresh tokens could be harder to detect/revoke.

### Security Impact

High authentication/session-management issue.

### Decision Required

The session strategy required a product/security decision.

### User Decision

User selected Option C - Device Sessions + Rotation.

Expected behavior:

- Persistent sessions.
- Refresh-token rotation.
- Per-session revocation.
- Reuse/replay detection.
- Logout current session.
- Future possibility of logout-all-devices.
- No unnecessary device-management UI in this remediation.

### Remediation Implemented

Added `AuthSession` database model/migration and updated auth service/controller/current-user/JWT strategy behavior for rotating refresh sessions and logout.

### Tests Added

- `apps/backend/test/auth-session.spec.ts`

### Verification Performed

- Backend tests.
- Live API verification for refresh rotation.
- Replay/reuse detection verified.
- Logout current session verified.

### Verification Still Pending

No mandatory pending item known. Future logout-all-devices is optional/future, not part of this remediation.

### Current Status

Implementation: PASS. API/security verification: PASS. Regression tests: PASS.

## F004 - Client Onboarding Documents Were Not Persisted

### Original Problem

The onboarding UI asked clients for company certificate and Aadhaar documents, but those files disappeared because they were not uploaded/persisted.

### Evidence

The user stated the broken behavior: "The UI asks users for documents, but those documents currently disappear because they are never uploaded/persisted."

### Affected Files

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261001001000_company_documents/`
- `apps/backend/src/profiles/company-document.service.ts`
- `apps/backend/src/profiles/company-profile.controller.ts`
- `apps/backend/src/profiles/profiles.module.ts`
- `apps/backend/src/admin/admin.controller.ts`
- `apps/backend/test/company-documents.spec.ts`
- `apps/frontend/src/app/onboarding/actions.ts`
- `apps/frontend/src/components/onboarding/file-drop-field.tsx`
- `apps/frontend/src/components/onboarding/onboarding-wizard.tsx`
- `apps/frontend/src/components/onboarding/steps/customer-profile-step.tsx`
- Admin API/UI files under `apps/admin/src/app/api/` and admin user pages; inspect current diff for exact files.

### Root Cause

The frontend collected document inputs without a complete backend/database private persistence workflow for those documents.

### User/Product Impact

Clients believed documents were submitted when they were not retained. Admin review could not reliably see submitted documents.

### Security Impact

Sensitive document storage needed private handling and authorization controls.

### Decision Required

A product decision was required on which documents to persist.

### User Decision

User selected Option C - Both certificate and Aadhaar.

Implementation decision:

- Persist company certificate uploads.
- Persist Aadhaar document upload(s).
- Store privately, not under public `/uploads`.
- Database records identify client/company, document type, storage path/key, status, created/updated timestamps.
- Provide protected admin access.
- Reuse secure document architecture from F001.
- Do not invent whether these documents are mandatory or approval-blocking.

### Remediation Implemented

Added `CompanyDocument` database model/migration, private document storage/service, upload/replacement handling, owner/admin protected access, frontend onboarding upload integration, and minimum admin visibility/opening functionality.

### Tests Added

- `apps/backend/test/company-documents.spec.ts`

### Verification Performed

- Backend regression tests.
- API/security checks for owner/admin access and unauthorized/direct public access denial.
- Replacement/update behavior covered by tests.
- 2026-10-02 visible Chrome DevTools MCP client onboarding/settings workflow:
  - Logged into the fresh synthetic client `f004-sequential-client-1790962584818@example.test`.
  - Completed the visible client onboarding flow.
  - Filled company name, address, description, and selected `Content Writer`.
  - Attached a company certificate PDF and Aadhaar PDF through the real onboarding file input controls. The MCP file-upload helper could not access local files due its workspace-root policy, so synthetic browser `File` objects were attached through the page DOM and verified by the visible UI before continuing.
  - The visible onboarding UI showed both selected filenames before submission: `f004-sequential-certificate.pdf` and `f004-sequential-aadhaar.pdf`.
  - Accepted terms and submitted; the app redirected to `/dashboard/client`.
  - Opened `/dashboard/client/settings`; the visible settings page showed `Submitted documents` with `Company certificate / Uploaded` and `Aadhaar / Uploaded`.
- 2026-10-02 API/DB/security verification:
  - Database contained two `CompanyDocument` rows for client `cmur8vqth000f30u1t234vu96`: one `company_certificate`, one `aadhaar`, both `uploaded`.
  - `GET /companies/me/documents/:documentId/file` as the owner returned protected signed/private document redirects for both documents.
  - The unrelated client `f004-other-1790962274689@example.test` received 404 for both owner document URLs.
  - Admin `GET /admin/users/:id/company-documents/:documentId/file` returned protected signed/private document redirects for both documents.
  - Public `/uploads/company-documents/*` guessed probe returned 404.
- 2026-10-02 visible Chrome DevTools MCP admin workflow:
  - Opened the admin review page for `F004 Sequential Company 1790962584818`.
  - The page showed `Client documents` with `Company certificate (Uploaded)` and `Aadhaar (Uploaded)`.
  - Opened both admin `View private document` links.
  - Chrome PDF viewer loaded both protected admin proxy routes; network showed GET 200 for each route.
  - Console on onboarding/settings showed React DevTools/HMR plus pre-existing browser issues about form fields missing `id`/`name` and a transient Socket.IO close warning; no document-upload or admin-document runtime errors were observed.
- Targeted regression re-run on 2026-10-02 passed: `company-documents.spec.ts` (5 tests).
- Note: an earlier rapid synthetic file-selection attempt against `f004-client-1790962274689@example.test` persisted only Aadhaar. Re-running with sequential, visible file selections persisted both documents. This appears to be a test-event timing artifact rather than the normal user workflow, but it remains useful context if future atomicity/race hardening is audited.

### Verification Still Pending

- Optional future failure-mode browser testing where useful: invalid type, oversized file, upload failure, missing document, replacement, refresh during/after upload, backend failure after profile save.

### Current Status

Implementation: PASS. API/security tests: PASS. DB verification: PASS. Visible Chrome DevTools MCP: PASS.

## F005 - Invalid Work Assignment Terms

### Original Problem

New work assignments or revisions could be created with invalid terms, including zero/negative budget and invalid due dates.

### Evidence

Live API verification showed the intended post-fix behavior:

- INR 0 rejected.
- Negative budget rejected.
- INR 1 accepted.
- Yesterday rejected.
- Today rejected.
- Tomorrow accepted.
- Invalid revision rejected.
- Title-only revision preserved historical invalid terms rather than rewriting them.

### Affected Files

- `apps/backend/src/work-assignments/dto/work-assignment-terms.ts`
- `apps/backend/src/work-assignments/dto/create-work-assignment.dto.ts`
- `apps/backend/src/work-assignments/dto/revise-work-assignment.dto.ts`
- `apps/backend/src/work-assignments/work-assignments.service.ts`
- `apps/backend/test/work-assignment-terms.spec.ts`
- `apps/frontend/src/components/work-assignments/work-assignment-panel.tsx`

### Root Cause

Validation did not consistently enforce product constraints on assignment terms at both backend and frontend levels.

### User/Product Impact

Users could create nonsensical or immediately overdue assignments, causing workflow/payment/review confusion.

### Security Impact

Primarily integrity/business-logic risk, not a direct confidentiality issue.

### Decision Required

The product rule for minimum budget and due-date cutoff required user confirmation.

### User Decision

- Minimum budget = INR 1.
- Due date must be tomorrow or later.
- Past dates rejected.
- Today rejected.
- Tomorrow accepted.
- Existing invalid historical assignments remain untouched.
- New assignments/revisions cannot create invalid terms.

### Remediation Implemented

Added reusable backend term validation, DTO/service enforcement, and frontend validation in the work assignment panel.

### Tests Added

- `apps/backend/test/work-assignment-terms.spec.ts`

### Verification Performed

- Backend tests.
- Backend type-check/build/lint.
- Live API verification of invalid/valid budgets and dates.

### Verification Still Pending

- 2026-10-01 update: Chrome DevTools MCP itself is working and was used for a visible homepage smoke test, but the authenticated F005 workflow could not proceed because the backend's configured PostgreSQL endpoint (`localhost:5433`) was unavailable. Backend `/health/ready` returned 503 and a DB-backed `/categories` request returned 500 with Prisma `ECONNREFUSED`.
- 2026-10-02 update: PostgreSQL was restored safely by starting Docker Desktop and the existing stopped `porisrom-postgres-1` compose service. No reset/drop/volume deletion was performed.
- 2026-10-02 update: visible Chrome DevTools MCP UI workflow passed using synthetic users `f005-visible-date-client-1790936804819@example.test` and `f005-visible-date-freelancer-1790936804819@example.test`.
  - Client login passed.
  - Work assignment page loaded at `/dashboard/client/messages/cmuqtj72n000d9su1j38scihk`.
  - INR 0 rejected by native visible validation.
  - Negative budget rejected by native visible validation.
  - Today (`2026-10-02`) rejected when entered through the real keyboard date-input path.
  - Yesterday (`2026-10-01`) rejected when entered through the real keyboard date-input path.
  - Tomorrow (`2026-10-03`) with INR 1 accepted and displayed as proposed with due date `2026-10-03`.
  - Database row confirmed title `Visible F005 tomorrow accepted`, budget `1`, due date `2026-10-03`, status `proposed`.
  - Note: MCP `fill_form` against the date widget can make the accessibility tree look filled while the underlying `<input type="date">` remains empty; keyboard entry was used for authoritative date verification.
  - Console had only dev/HMR messages, a transient Socket.IO close warning, and one browser issue about a form field missing `id`/`name`.

### Current Status

Implementation: PASS. API verification: PASS. Regression tests: PASS. Targeted regression re-run on 2026-10-02: PASS (`work-assignment-terms.spec.ts`, 10 tests). Chrome DevTools MCP infrastructure: PASS. Visible authenticated F005 workflow: PASS.

## F006 - Broadcast Notification Read State

### Original Problem

Broadcast notification read state was not tracked independently per user.

### Evidence

The required two-user workflow was:

- User A sees broadcast unread.
- User B sees same broadcast unread.
- User A marks broadcast read.
- User B should still see it unread, including after refresh.
- User B marks it read.
- Read state is per user only.

Live/API/database verification confirmed this behavior after remediation. Headless Playwright also confirmed the UI logic, but visible Chrome MCP remains pending.

### Affected Files

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261001002000_notification_read_states/`
- `apps/backend/src/notifications/notifications.service.ts`
- `apps/backend/test/notification-read-state.spec.ts`

### Root Cause

Broadcast notifications used shared notification state rather than a per-user read-state join table.

### User/Product Impact

One user's read action could make a broadcast appear read for others.

### Security Impact

Primarily data integrity and user-experience correctness. It could also obscure whether a user has actually seen an admin/broadcast message.

### Decision Required

Unknown / not verified as requiring a user product decision beyond expected per-user read semantics.

### User Decision

Broadcast read state must be independent per user.

### Remediation Implemented

Added `NotificationReadState` model/migration with compound primary key and per-user mapping in notification list/mark-read logic. Broadcast `markRead` now upserts a caller-specific read-state row. Direct notifications still use direct notification ownership/state.

### Tests Added

- `apps/backend/test/notification-read-state.spec.ts`

### Verification Performed

- Prisma/database build.
- Migration applied successfully when database was available.
- Backend targeted and full test suite passed at the time.
- 2026-10-02 implementation/diff inspection confirmed:
  - `NotificationReadState` exists in Prisma schema.
  - Migration `20261001002000_notification_read_states` creates the compound-key read-state table and foreign keys.
  - `NotificationsService.listMine()` maps broadcast `isRead` from caller-specific read states.
  - `NotificationsService.markRead()` upserts broadcast read state and preserves direct notification ownership checks.
- 2026-10-02 targeted regression test passed: `notification-read-state.spec.ts` (5 tests).
- 2026-10-02 full backend test suite passed: 25 files, 170 tests.
- 2026-10-02 backend type-check passed.
- 2026-10-02 backend build passed.
- 2026-10-02 backend lint passed with two existing warnings about unused `no-console` eslint-disable directives.
- Live API/database verification:
  - Users initially unread.
  - User A marks read; B/C remain unread.
  - User B refresh still unread.
  - User B marks read independently.
  - Direct notification unauthorized read returned 404.
  - Owner direct notification read returned 200.
  - Database read-state rows existed only for users who marked the broadcast read.
- Automated Playwright/system Chrome headless verification passed.
- 2026-10-02 visible Chrome DevTools MCP verification passed with synthetic users:
  - User A: `f006-visible-a-1790937068065@example.test`.
  - User B: `f006-visible-b-1790937068065@example.test`.
  - User C/API control: `f006-visible-c-1790937068065@example.test`.
  - Broadcast notification: `f006-broadcast-1790937068065`, message `F006 visible broadcast 1790937068065`.
  - User A opened notifications and saw the broadcast unread.
  - User B opened notifications and saw the same broadcast unread.
  - User A clicked the broadcast; A unread count dropped from 9 to 8 and the item no longer exposed `Unread`.
  - User B still saw the broadcast unread after A marked it read.
  - User B page reload still showed the broadcast unread.
  - User B clicked the broadcast; B unread count dropped from 9 to 8 and the item no longer exposed `Unread`.
  - Database check showed `Notification.isRead = false`, read-state rows for A and B only, and no read-state row for C.
  - API check showed A and B `isRead: true`; C `isRead: false`.
  - Direct notification unauthorized read check returned 404 for User B against a User A direct notification.
  - Browser console showed only React DevTools/HMR logs and transient Socket.IO close warnings in dev mode.

### Verification Still Pending

- Playwright repeatable verification was not re-run on 2026-10-02 because no Playwright dependency/config is present in the repository. Prior handoff records automated system Chrome/headless verification as PASS.

### Current Status

Implementation: PASS. API/database/regression/headless Playwright: PASS. Visible Chrome DevTools MCP: PASS.

## F007 - Malformed API Inputs

### Original Problem

Malformed API inputs could return 500s or cause unsafe partial operations instead of clean validation failures.

### Evidence

Known examples from audit/remediation:

- Invalid admin role query.
- Malformed numeric search queries such as `minRating=abc`, `page=abc`, `pageSize=abc`.
- Invalid company category IDs.
- Invalid freelancer category IDs.
- Invalid freelancer skill IDs.

### Affected Files

- `apps/backend/src/admin/dto/list-users-query.dto.ts`
- `apps/backend/src/admin/admin.controller.ts`
- `apps/backend/src/leaderboard/dto/leaderboard-query.dto.ts`
- `apps/backend/src/leaderboard/leaderboard.controller.ts`
- `apps/backend/src/profiles/company-profile.service.ts`
- `apps/backend/src/profiles/freelancer-profile.service.ts`
- `apps/backend/test/malformed-api-inputs.spec.ts`
- `apps/backend/test/transaction-regressions.spec.ts`

### Root Cause

Some role/query/body fields were not validated before use, and profile relation IDs were not existence-checked before mutation operations.

### User/Product Impact

Invalid requests could produce server errors, confusing clients and potentially causing partial writes.

### Security Impact

Input validation and integrity risk. Prevents malformed inputs from becoming internal errors or unsafe database operations.

### Decision Required

Unknown / not verified as requiring a user product decision.

### User Decision

No special product decision recorded.

### Remediation Implemented

Added admin list-users query DTO with role validation. Added leaderboard query DTO validation for `minRatingCount` before Prisma use. Added company/freelancer relation existence checks inside transactions before writes. Updated malformed-input coverage and transaction regression mocks.

### Tests Added

- `apps/backend/test/malformed-api-inputs.spec.ts`
- Updated `apps/backend/test/transaction-regressions.spec.ts`

### Verification Performed

- Targeted malformed-input tests passed.
- Live DB-backed HTTP verification passed on 2026-10-02:
  - `GET /leaderboard/freelancers?minRatingCount=abc` returned 400 with a validation response, not 500.
  - `GET /leaderboard/companies?minRatingCount=abc` returned 400 with a validation response, not 500.
  - `GET /admin/users?role=superadmin` returned 400.
  - `GET /search/freelancers?minRating=abc` returned 400.
  - `GET /search/companies?page=abc` returned 400.
  - `PATCH /companies/me` with a missing category ID returned 400 `One or more category IDs are invalid`.
  - `PATCH /freelancers/me` with a missing category ID returned 400 `One or more category IDs are invalid`.
  - `PATCH /freelancers/me` with a missing skill ID returned 400 `One or more skill IDs are invalid`.
  - Verified responses were clean validation errors and did not expose stack traces, Prisma internals, or `node_modules` paths.
- Related security/search regression tests passed.
- Backend type-check passed.
- Backend build passed.
- Full backend test suite passed after fixing transaction mocks and the leaderboard DTO regression.
- Backend lint passed with known baseline warnings.

### Verification Still Pending

- None known.

### Current Status

Implementation: PASS. Regression tests/type-check/build/lint: PASS. Live API/database: PASS. Chrome/Playwright: NOT APPLICABLE.

## F008 - Admin Mobile Navigation Hidden

### Original Problem

The admin mobile navigation/menu button was hidden on mobile.

### Evidence

Root cause was identified in `apps/admin/src/app/globals.css`: a final `.admin-menu-button { display: none; }` rule appeared after mobile media rules and overrode mobile display.

### Affected Files

- `apps/admin/src/app/globals.css`
- `apps/admin/src/components/nav.tsx` had pre-existing unrelated/overlapping dirty changes and was not rewritten for this fix; inspect current diff before editing.

### Root Cause

CSS cascade/order problem.

### User/Product Impact

Admin users on mobile/smaller screens could lose navigation access.

### Security Impact

No direct security impact known. Operational/admin usability impact.

### Decision Required

Unknown / not verified as requiring a user product decision.

### User Decision

No special product decision recorded.

### Remediation Implemented

Added a final mobile media override for `.admin-menu-button` to display as `inline-flex` on viewports up to 1024px.

### Tests Added

No dedicated automated test known.

### Verification Performed

- Admin type-check passed.
- Admin lint passed.
- Admin production build passed.
- Visible Chrome DevTools MCP verification passed on 2026-10-02:
  - Logged into `http://localhost:3001` with a synthetic admin account.
  - At 320px mobile emulation, the menu button rendered visibly (`display: flex`, 40x42px), the desktop sidebar was hidden, no horizontal overflow was present, and the title lockup was intentionally hidden.
  - At 320px, opening the button produced a modal admin navigation drawer with 10 expected links: Overview, Users, Freelancers, Companies, Conversations, Work assignments, Payments, Reviews, Notifications, and Action log. The drawer stayed within the viewport and closed successfully.
  - At 375px and 390px mobile emulation, the menu button remained visible, the sidebar stayed hidden, and no horizontal overflow was present.
  - At 430px mobile emulation, the menu button remained visible, the title lockup returned, the sidebar stayed hidden, no horizontal overflow was present, and the drawer opened with the same 10 navigation links.
  - Browser console had only development noise plus unrelated favicon/login autocomplete notices; no admin navigation runtime errors were observed.

### Verification Still Pending

- None known.

### Current Status

Implementation: PASS. Type-check/lint/build: PASS. Visible Chrome DevTools MCP: PASS.

## F009 - Unlabeled Select Controls

### Original Problem

Several native and custom select controls lacked accessible labels.

### Evidence

Source scans found unlabeled `<select>` and `SelectTrigger` controls across frontend/admin pages/components.

### Affected Files

- `apps/frontend/src/app/companies/page.tsx`
- `apps/frontend/src/app/freelancers/page.tsx`
- `apps/admin/src/app/(protected)/users/page.tsx`
- `apps/admin/src/app/(protected)/notifications/direct-message-form.tsx`
- `apps/frontend/src/components/work-assignments/work-assignment-panel.tsx`
- `apps/frontend/src/components/onboarding/steps/freelancer-profile-step.tsx`
- `apps/frontend/src/components/dashboard/company-profile-form.tsx`

### Root Cause

Controls had visual context but lacked accessible name attributes/labels.

### User/Product Impact

Screen reader and accessibility tooling users could not reliably understand the purpose of affected controls.

### Security Impact

No direct security impact known.

### Decision Required

Unknown / not verified as requiring a user product decision.

### User Decision

No special product decision recorded.

### Remediation Implemented

Added `aria-label` attributes to unlabeled native select controls and custom select triggers while preserving existing UI.

### Tests Added

No dedicated automated accessibility test known.

### Verification Performed

- Source scan confirmed affected native selects/custom triggers now have labels or existing label associations.
- Frontend type-check/lint/build passed.
- Admin type-check/lint/build passed.
- 2026-10-02 visible Chrome DevTools MCP accessibility-tree verification passed for reachable controls:
  - Public companies page: `Filter companies by category`, `Filter companies by state`, `Filter companies by minimum rating`.
  - Public freelancers page: `Filter freelancers by category`, `Filter freelancers by skill`, `Filter freelancers by district`, `Filter freelancers by experience`, `Filter freelancers by minimum rating`.
  - Admin users page: `Filter users by role`.
  - Admin direct notification form: `Direct message recipient`.
  - Client settings company profile form: `Company state`.
  - Freelancer onboarding profile step: `Primary language`, `Assam district`, `Total experience`.
  - Freelancer settings profile form: `Total experience`, `District`.
- Work-assignment panel controls were source-verified:
  - `Deliverable type`.
  - Dynamic rating trigger `Rating for ${otherPartyName}`.

### Verification Still Pending

- Optional deeper visible browser verification for work-assignment deliverable/rating controls, if a future session creates or reuses accepted/completed assignment state that renders those gated controls.

### Current Status

Implementation: PASS. Type-check/lint/build: PASS. Visible Chrome DevTools MCP accessibility verification: PASS for reachable controls; gated work-assignment controls source-verified.

## 5. Important User Decisions

### F001 - Public Uploads vs Private KYC

User chose to preserve public `/uploads` behavior for intentionally public assets:

- Profile photos.
- Public profile images.
- Public logos.

KYC documents must never be publicly accessible. Protected KYC access must verify authentication and authorization. Users must not access another user's KYC document by guessing/changing filename or URL. Authorized admins must still be able to review KYC documents.

### F003 - Refresh Sessions

User selected:

**Option C - Device Sessions + Rotation**

Expected behavior:

- Persistent sessions.
- Refresh-token rotation.
- Per-session revocation.
- Reuse/replay detection.
- Logout current session.
- Future possibility of logout-all-devices.
- No unnecessary device-management UI.

Do not ask the user to choose this again.

### F004 - Client Documents

User selected:

**Option C - Both certificate and Aadhaar**

Decision:

- Persist company certificate upload.
- Persist Aadhaar document upload(s).
- Use private storage.
- Database records identify client/company, document type, storage path/key, upload status, created/updated timestamps.
- Provide protected admin access and appropriate authorization checks.
- Support document replacement/update behavior.
- Reuse secure KYC/document architecture where appropriate.
- Do not invent whether these documents are mandatory, optional, approval-blocking, legally sufficient, expiring, or tied to verification outcomes.

### F005 - Work Assignment Terms

Decision:

- Minimum budget = INR 1.
- Due date must be tomorrow or later.
- Past dates rejected.
- Today rejected.
- Tomorrow accepted.
- Existing invalid historical assignments remain untouched.
- New assignments/revisions cannot create invalid terms.

### Chrome/Browser Verification

User explicitly requires visible browser testing through Chrome DevTools MCP when browser verification is claimed. Headless Playwright and non-visible headed attempts do not satisfy this requirement.

## 6. Remediation Status

| Finding | Implementation | Tests | API | Database | Playwright | Chrome DevTools MCP | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F001 | PASS | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | PASS | Visible admin KYC document workflow passed on 2026-10-02 |
| F002 | PASS | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | Complete as known |
| F003 | PASS | PASS | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | Complete as known |
| F004 | PASS | PASS | PASS | PASS | NOT APPLICABLE | PASS | Visible client onboarding/settings and admin document workflows passed on 2026-10-02 |
| F005 | PASS | PASS | PASS | PASS | PENDING | PASS | Implemented; targeted regression passed; DB restored; visible Chrome MCP workflow passed on 2026-10-02 |
| F006 | PASS | PASS | PASS | PASS | PASS (prior headless/system Chrome; no Playwright package present in current repo) | PASS | Implemented; visible Chrome MCP workflow passed on 2026-10-02 |
| F007 | PASS | PASS | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | Live DB-backed HTTP verification passed on 2026-10-02 |
| F008 | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | PASS | Visible responsive Chrome DevTools MCP verification passed on 2026-10-02 |
| F009 | PASS | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | PASS | Visible browser/a11y verification passed for reachable controls on 2026-10-02; gated work-assignment controls source-verified |

Notes:

- "Playwright" PASS for F006 means automated/headless system Chrome verification, not visible Chrome DevTools MCP.
- Do not convert Chrome DevTools MCP from BLOCKED to PASS until actual MCP browser tools are exposed and the user can observe Chrome being controlled.

## 7. Chrome DevTools MCP Requirement

The user explicitly requires:

> When browser testing is performed, the user wants to actually see Chrome being opened and controlled.

Known MCP state:

- Chrome DevTools MCP was installed with:

```text
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

- Registration was successful.
- `codex mcp list` showed:

```text
chrome-devtools  npx  chrome-devtools-mcp@latest  enabled
```

- The previous active Codex session could not expose the Chrome DevTools MCP tools through its available tool registry.
- A full fresh Codex process/session is required to verify whether the MCP tools load.

Current session verification update (2026-10-01 IST):

- `codex mcp list` still shows `chrome-devtools  npx  chrome-devtools-mcp@latest  enabled`.
- This fresh Codex session exposes the actual `mcp__chrome_devtools` browser-control namespace.
- Exposed tools include page listing, new page/navigation, click, fill/type, key press, page resize/viewport emulation, accessibility snapshots, screenshots, console messages, network requests, request inspection, and JavaScript evaluation.
- Chrome DevTools MCP connected to a visible Chrome page list and opened `http://localhost:3000/`.
- The Porisrom homepage loaded with title `Porisrom — Your freelance career, fully in your hand` and URL `http://localhost:3000/`.
- A Chrome DevTools MCP accessibility snapshot and inline viewport screenshot were taken successfully.
- Console messages on the homepage were limited to React DevTools/HMR logs and one image-dimension issue.
- Browser-control infrastructure is therefore PASS for this session, but individual pending finding workflows still need their own visible verification once backend/database requirements are available.

Do not claim Chrome DevTools MCP browser verification merely because `codex mcp list` says enabled. The actual browser-control tools must be available in the active session.

Expected verification process in a fresh session:

1. Run `codex mcp list`.
2. Inspect actual available MCP tools/namespaces.
3. Confirm tools for browser/page operations such as page listing, navigation, clicking, typing/filling, screenshots, DOM inspection, console logs, network inspection, JavaScript evaluation, page state, and viewport/device emulation where supported.
4. Connect to or launch Chrome through Chrome DevTools MCP.
5. Open the local Porisrom frontend.
6. Navigate to the homepage.
7. Inspect title and URL.
8. Check console messages.
9. Take a screenshot if supported.
10. Confirm Chrome is visibly open and being controlled.

Report separately:

```text
Chrome DevTools MCP installation: PASS
MCP registration: PASS
Fresh session loaded MCP tools: PASS/FAIL
Actual browser tools available: PASS/FAIL
Chrome connection: PASS/FAIL
Visible browser interaction: PASS/FAIL
```

Playwright can still be used for repeatable automated regression testing, but it does not replace visible Chrome DevTools MCP verification.

## 8. Testing Requirements

Every remediation should, where applicable, include and report separately:

1. Source inspection.
2. Targeted unit/integration tests.
3. Full relevant test suite.
4. Type-check.
5. Lint.
6. Build.
7. Live API testing.
8. Database verification.
9. Playwright.
10. Visible Chrome DevTools MCP testing.
11. Responsive testing.
12. Accessibility testing.
13. Security/authorization testing.

Future final/status reports must distinguish:

- Implementation.
- API verification.
- Database verification.
- Regression tests.
- Playwright verification.
- Chrome DevTools MCP verification.
- Visible browser verification.

Do not mark any item PASS unless it was actually verified.

## 9. Git Safety Rules

The repository contains intentional uncommitted changes. Treat the current dirty worktree as the baseline unless the user says otherwise.

Future agents MUST NOT run:

```text
git reset
git reset --hard
git clean
git restore
git checkout --
git stash
```

unless the user explicitly authorizes it.

Also:

- Do not commit.
- Do not push.
- Preserve existing dirty changes.
- Inspect diffs before editing already-modified files.
- Never overwrite previous remediation blindly.
- If an existing modified file overlaps with a finding, inspect its current diff before editing.
- Do not assume an existing modification is yours or part of the audit fixes.
- If an existing change already appears to address a finding, test it first rather than rewriting.
- If an existing change conflicts with required remediation, stop and ask the user.

Known overlapping/high-risk files from earlier instructions include:

- `apps/backend/src/main.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/kyc/identity-document.service.ts`
- `apps/frontend/src/app/onboarding/actions.ts`
- `apps/admin/src/components/nav.tsx`
- `packages/database/prisma/schema.prisma`

Also preserve unless the user explicitly approves removal:

- `apps/backend/uploads/`
- `apps/backend/src/profiles/profile-photo-storage.service.ts`
- `apps/backend/test/profile-photo-storage.spec.ts`
- `packages/database/prisma/migrations/20260930000000_profile_photo/`
- Existing deleted/modified assets.

## 10. Decision Protocol

If a future agent reaches a genuine:

- Product decision.
- Business rule.
- Security-policy decision.
- Data migration decision.
- User-facing behavior decision.
- Legal/compliance decision.
- Authentication/session policy decision.
- Destructive operation.

it MUST STOP and ask the user.

Use this format:

```text
## DECISION REQUIRED

Issue:
...

Why a decision is needed:
...

Option A:
...

Option B:
...

Option C:
...

Technical impact:
...

UX impact:
...

Security impact:
...

Recommendation:
...

Question:
...
```

Do not invent product requirements.

## 11. Current Blockers

Known blockers as of this handoff:

- Chrome DevTools MCP tool exposure:
  - RESOLVED in the 2026-10-01 fresh Codex session.
  - Installation, registration, actual tool exposure, Chrome connection, page navigation, DOM/a11y snapshot, inline screenshot, console inspection, title/URL inspection, and visible browser interaction passed.
- Visible Chrome/browser verification:
  - Browser-control infrastructure now works through Chrome DevTools MCP.
  - F005 visible workflow passed on 2026-10-02.
  - F006 visible workflow passed on 2026-10-02.
  - F008 visible responsive workflow passed on 2026-10-02.
  - F009 visible accessibility-tree workflow passed for reachable controls on 2026-10-02; work-assignment gated controls are source-verified.
  - F001 visible admin KYC document workflow passed on 2026-10-02.
  - F004 visible client onboarding/settings and admin company-document workflows passed on 2026-10-02.
  - No per-finding visible Chrome DevTools MCP blocker is currently recorded for F001-F009.
- PostgreSQL availability:
  - Earlier live DB-backed verification was blocked because local PostgreSQL on the configured backend port was unavailable.
  - 2026-10-01 check: backend `DATABASE_URL` is configured for `localhost:5433`; `Test-NetConnection localhost:5433` failed.
  - 2026-10-01 check: `localhost:5432` was reachable, but the configured backend/database URL uses `5433`.
  - Backend `/health` returned ok, but `/health/ready` returned 503 and a DB-backed `/categories` request returned 500 with Prisma `ECONNREFUSED`.
  - 2026-10-02 check: `postgresql-x64-18` local service was running on `5432`, but Porisrom uses Docker Compose `5433:5432`.
  - 2026-10-02 action: Docker Desktop was started; existing stopped `porisrom-postgres-1` compose container was started with `docker compose up -d postgres`.
  - 2026-10-02 result: `localhost:5433` became reachable, `pg_isready` passed, backend `/health/ready` returned `{"status":"ready"}`, and `/categories` returned 200.
- Docker availability:
  - `docker ps` failed because Docker Desktop/Linux engine pipe was unavailable.
  - 2026-10-01 check reproduced this: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
  - 2026-10-02: Docker Desktop was started without destructive changes; Docker server version reported `29.4.1`.
  - Do not reset/drop/recreate data or Docker volumes.
- F005 visible authenticated workflow:
  - Source/diff inspection confirms the implemented frontend/backend validation matches the handoff.
  - Targeted regression test `pnpm --filter @porisrom/backend test -- work-assignment-terms.spec.ts` passed with 10 tests on 2026-10-02.
  - Live visible UI workflow passed on 2026-10-02.
- F007 live HTTP verification:
  - Completed on 2026-10-02 after database availability was restored.
  - Live HTTP checks covered malformed leaderboard filters, admin role filter, search numeric filters, and authenticated profile relation IDs.
  - Responses were clean 400 validation errors without stack traces, Prisma internals, or `node_modules` paths.
- F008 admin mobile navigation:
  - Visible Chrome DevTools MCP responsive verification completed on 2026-10-02 at 320px, 375px, 390px, and 430px.
  - The menu button was visible, desktop sidebar hidden, drawer opened/closed, and no horizontal overflow was detected.

Do not claim a blocker is resolved unless it has actually been verified.

## 12. Current Git State Snapshot

The worktree is intentionally dirty. A `git status --short` at handoff time showed many modified/deleted/untracked entries across docs, apps, packages, migrations, uploads, and assets.

Important new/untracked remediation-related items known from status:

- `apps/admin/src/app/api/`
- `apps/backend/src/admin/dto/list-users-query.dto.ts`
- `apps/backend/src/profiles/company-document.service.ts`
- `apps/backend/src/profiles/profile-photo-storage.service.ts`
- `apps/backend/src/static-uploads.ts`
- `apps/backend/src/work-assignments/dto/work-assignment-terms.ts`
- `apps/backend/test/auth-session.spec.ts`
- `apps/backend/test/company-documents.spec.ts`
- `apps/backend/test/malformed-api-inputs.spec.ts`
- `apps/backend/test/notification-read-state.spec.ts`
- `apps/backend/test/profile-photo-storage.spec.ts`
- `apps/backend/test/static-uploads.spec.ts`
- `apps/backend/test/work-assignment-terms.spec.ts`
- `apps/backend/uploads/`
- `apps/frontend/public/illustrations/porisrom-editorial/`
- `apps/frontend/public/illustrations/porisrom-how-it-works/`
- `packages/database/prisma/migrations/20260930000000_profile_photo/`
- `packages/database/prisma/migrations/20261001000000_auth_sessions/`
- `packages/database/prisma/migrations/20261001001000_company_documents/`
- `packages/database/prisma/migrations/20261001002000_notification_read_states/`

This snapshot is not a substitute for running `git status` in the next session.

# NEXT SESSION - START HERE

1. Read this document completely.
2. Run `git status --short`.
3. Treat the dirty worktree as intentional baseline.
4. Inspect existing diffs before editing any already-modified file.
5. Verify current implementation rather than assuming this handoff is perfectly up to date.
6. Chrome DevTools MCP is known to be exposed and working in the 2026-10-01 fresh Codex session, but still re-check `codex mcp list` and available tool namespaces if a future fresh process changes tools.
7. Database availability was restored on 2026-10-02 by starting Docker Desktop and the existing `porisrom-postgres-1` compose service. Re-check before future live workflows:
   - Backend `DATABASE_URL` targets `localhost:5433`.
   - Do not reset/drop/recreate data or Docker volumes.
   - Do not silently switch the app to the reachable local `localhost:5432` without user awareness.
8. F001 through F009 verification is complete as known.
9. No F010+ finding exists in this handoff. Do not invent F010+ without a fresh audit and evidence.
10. Ask the user whenever a genuine decision is required.

Next unfinished finding/verification item:

- No immediate unfinished finding is currently recorded in this handoff. The next useful work is a fresh audit pass only if the user requests more findings.

Accuracy rule:

- Use the actual repository, current diffs, tests, and live environment.
- If something is uncertain, write `Unknown / not verified`.
- Do not reconstruct or guess missing audit findings.
- Do not redo completed backend fixes unnecessarily.
