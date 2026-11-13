# Porisrom application audit

Audit date: 2026-11-03, Asia/Calcutta. Scope: application code, schema/migrations, current test source and recorded local acceptance evidence. Deployment, server provisioning, cloud credentials and real provider calls are out of scope. No application, schema, authentication, deployment or secret file was modified.

## A. Executive summary

The repository contains a substantial marketplace candidate: credential-based signup/login, server-side session revocation and refresh rotation, role-based client/freelancer/admin workflows, private document authorization, approved-profile discovery, connections/messaging, work-assignment state transitions, manual payment claims/disputes, safety cases and transactional admin audits. The schema has 14 committed migrations and models for those workflows. Current safe test execution passed **139 tests** across frontend, admin and targeted backend suites.

The immediate application-completeness blockers are not broad marketplace rewrites:

1. **Google authentication is not implemented.** The UI is disabled; no OAuth provider, callback/account-link model, backend identity exchange or configuration exists.
2. **Terms acceptance is not enforced or recorded server-side.** The signup page requires a checkbox only in browser state; the action/backend/schema have no consent input or persistence.
3. **Self-service credential recovery is intentionally absent.** The current recovery page sends the user to support; no identity verification or reset provider exists.
4. **Freelancer Applications is intentionally a Coming Soon page.** General native deliverable attachments are also intentionally absent; delivery uses links/notes.

No production/staging, Cloudinary-provider, hosted CI, real ingress, load, accessibility certification or real browser OAuth test was executed. Those are not reported as working.

### Evidence status

| Status | Meaning in this report |
| --- | --- |
| Confirmed | Current source or a passing/failing local test directly demonstrates it. |
| Intentional limitation | Current code/documentation explicitly states the boundary; it is not recorded as a defect. |
| Unverified | Accurate verification needs a provider, isolated PostgreSQL test DB, browser, accessibility tool or policy decision not available in this audit. |

## B. Prioritized bug inventory

| ID | Severity / release impact | Affected component | Evidence and reproduction | Expected vs actual | Recommended fix and regression test | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 | **High** — blocks any release requirement for Google sign-in/signup | `apps/frontend/src/components/auth/social-login-buttons.tsx`, `src/auth.ts`, `src/auth.config.ts`, `src/app/api/auth/[...nextauth]/route.ts`, backend auth/schema | The button list contains Google and Apple, but every button has the literal `disabled` attribute and “Coming soon.” `src/auth.ts` registers only `Credentials`; `createAuthConfig()` has an empty provider array. Repository-wide source search found no Google OAuth configuration, callback implementation, provider-account table or Microsoft provider. | Users should be able to choose Google to begin a supported login/signup flow. Actual Google control is non-interactive and no server flow exists. | Implement the approved Google design using the existing Auth.js/NextAuth library, not a replacement library. Add canonical backend identity linking and backend session issuance (see section C). Regression: OAuth initiation/callback, verified-email new signup, returning login, credential-account linking, collision/denial, revoked account, CSRF/state/PKCE failure, refresh/logout/revocation and role/onboarding routing. | Google Cloud OAuth client, consent-screen/callback-domain approval, identity/linking policy, schema migration and backend API design. |
| AUTH-002 | **High** — blocks safe implementation of AUTH-001 if skipped | `packages/database/prisma/schema.prisma`, `apps/backend/src/auth/auth.service.ts`, `apps/frontend/src/auth.ts` | `User.passwordHash` is required; schema has no OAuth/account identity model. Backend login compares a password and issues its own access/refresh session. Marketplace Auth.js credentials callback depends on that backend token pair. | A Google identity must map safely to one canonical Porisrom user and backend session. Actual architecture has no representation or exchange for an external identity. | Do not enable a Google provider alone. Define a unique provider-subject identity record, account-linking policy, verified-email/collision handling, passwordless-user semantics, and a backend OAuth-identity exchange that creates the existing `AuthSession`/JWT pair. Regression: DB uniqueness, concurrent link, provider-subject mismatch, verified-email collision, deleted/blocked user, session replay and unlink policy. | Product/security decision on automatic versus explicit linking, schema migration, authentication architecture review. |
| SEC-001 | **High** if Terms acceptance is a release/legal requirement; otherwise Medium | `apps/frontend/src/components/auth/signup-form.tsx`, `src/app/auth/actions.ts`, `apps/backend/src/auth/dto/signup.dto.ts`, `packages/database/prisma/schema.prisma` | The form blocks the submit button until `acceptedTerms` is true, but sends no terms field. `signupAction` validates only name/email/password/role; `SignupDto` and `User` contain no consent field/version/timestamp. A direct server-action/API request can use the existing signup contract without browser state. | Required Terms/Privacy acceptance should be server-enforced and auditable. Actual acceptance is browser-only and not persisted. | Decide legal consent requirements, then add a server-validated acceptance/version field and durable record before creating an account; preserve version/timestamp/evidence as approved. Regression: direct API/server-action request without consent is rejected; accepted version persists; old/new terms behavior and Google signup follow the same rule. | Legal/privacy decision on consent text/version/retention; schema migration. |
| UX-001 | **Medium** — does not block credential auth security, but impairs normal sign-in | `apps/frontend/src/components/auth/login-form.tsx` | Current login form uses `autoComplete="off"`; its password input uses `autoComplete="new-password"`, which requests password creation behavior rather than stored-password fill. This is visible statically and needs browser confirmation for exact browser behavior. | Returning users should be able to use browser/password-manager credentials. Actual hints discourage that. | Change login hints to appropriate current-credential semantics after UI approval. Regression: rendered login test/browser check confirms email/password autocomplete attributes and successful credential-manager-compatible login. | Browser compatibility/accessibility check. |
| UI-001 | **Medium** — incomplete public/legal journey | `apps/frontend/src/components/layout/footer.tsx` | `LEGAL_DOCUMENTS` has an href for Terms but no href for “Privacy Policy”; the renderer intentionally produces a disabled span titled “Document not yet available.” | Users should have a privacy policy destination if the signup form asks them to accept one. Actual footer has no privacy-policy page/link. | Obtain approved policy copy, create/link the policy route, and align signup/Terms language and consent versioning. Regression: footer link/route test and keyboard navigation check. | Legal/privacy-approved content and consent decision. |
| PROD-001 | **Medium** — does not block current manual marketplace scope, blocks an Applications feature claim | `apps/frontend/src/app/dashboard/freelancer/applications/page.tsx` | Route renders `ComingSoon`; handover calls Applications scope undecided and Jobs an intentional redirect to company discovery. | An Applications dashboard would track applications. Actual page has no workflow/backing API. | Decide whether “applications” means proposals, connection requests or a future jobs product. Do not add a job board without a PRD decision. Regression: feature-specific route/API/state tests after scope approval. | Product decision. |
| PROD-002 | **Medium** — blocks self-service recovery and real-user recovery assurance | `apps/frontend/src/app/auth/forgot-password/page.tsx`; recovery policy docs | Page truthfully offers only mailto support after identity verification. Test confirms it does not promise a reset link. No email/identity provider, reset token model or recovery workflow exists. | If a self-service recovery requirement exists, users need a verified secure flow. Actual V1 intentionally has manual support only. | Keep current wording until identity evidence, locked-out intake and provider policies are approved; then design recovery separately. Regression: anti-enumeration, evidence verification, token expiry/single use, session revocation, abuse limits and accessibility tests. | Product/security/support/provider decision. |

### Confirmed non-defect: Microsoft sign-in

**AUTH-003 — not an issue.** No Microsoft/Azure provider, UI control, environment variable, callback route or identity model was found in application source/schema. Microsoft sign-in is already absent. The social UI currently displays disabled **Google and Apple** controls. Removing Microsoft therefore requires no code deletion; product direction is still needed for whether Apple remains displayed, is removed, or is planned after Google.

## C. Google and Microsoft authentication audit

### Current state

| Question | Evidence-based answer |
| --- | --- |
| Authentication library | Marketplace uses Auth.js/NextAuth 5 beta with JWT strategy and a Credentials provider. Backend uses NestJS Passport JWT plus its own access/refresh JWTs and persisted `AuthSession` rows. Admin intentionally does not use NextAuth; it stores backend tokens in its own HTTP-only cookies. |
| Credential login/signup | Implemented. Marketplace server actions call backend `/auth/signup` and NextAuth Credentials; login calls Credentials once. Backend bcrypt-verifies passwords, checks active status, creates persisted refresh sessions and validates sessions on HTTP/socket use. |
| Google UI | Present only as a disabled “Coming soon” button. It does not call `signIn`, an API route or backend endpoint. |
| Microsoft UI/provider | Absent. No removal work is required. |
| Google OAuth config / callback / linking | Absent. There is no Google provider import, provider credentials/configuration, callback-specific test, provider-account schema, verified-email collision rule, or backend exchange endpoint. The existing catch-all Auth.js route is generic infrastructure for the Credentials provider only. |
| Google login and Google signup | Neither exists. A Google provider cannot be assumed to satisfy marketplace signup because a new account needs a freelancer/client role, Terms consent and backend-issued session. |
| Existing session protection | Strong local evidence: refresh hashes, atomic rotation/collision/replay behavior, revocation, session/account validation on HTTP and sockets, and logout CSRF verification are covered by source and targeted tests. This is a foundation to preserve, not replace. |

### Required Google design before implementation

1. Retain Auth.js/NextAuth as the marketplace OAuth broker unless a specific incompatibility is demonstrated; no new authentication library is justified by this audit.
2. Add a backend-canonical external identity record with unique provider plus stable provider subject. Do not use a matching email as implicit account linking without a reviewed verified-email and proof-of-control policy.
3. Decide the identity collision journey: existing password account, already-linked Google identity, blocked/deleted user, Google email changes and explicit authenticated linking/unlinking.
4. Decide how a new Google user selects freelancer/client role and accepts current Terms before account creation. This state must be integrity-protected and enforced by the backend—not held only in client state or an untrusted OAuth callback query.
5. Add a backend identity exchange/issue-session operation. The marketplace currently requires backend access/refresh tokens for API calls, sockets and revocation; an Auth.js-only browser session cannot replace this contract without a separately justified redesign.
6. Add Google credentials/callback origins only through approved environment management. Never expose a client secret in `NEXT_PUBLIC_*`, source, tests or logs.
7. Test provider callback failures, state/nonce/PKCE handling, verified email requirements, consent, linking, account lifecycle, session replay/revocation, cross-tab refresh, CSRF sign-out and browser routing. Add an end-to-end test against a dedicated OAuth test client before calling it production quality.

## D. Incomplete product functionality

| ID | Status | Evidence / required decision |
| --- | --- | --- |
| PROD-001 | Intentional incomplete feature | Freelancer Applications is Coming Soon; scope is undecided. |
| PROD-002 | Intentional limitation | Credential recovery is manual support only; no self-service reset/identity provider. |
| PROD-003 | Intentional limitation | General native deliverable attachment hosting is absent; delivery supports external links/notes. |
| PROD-004 | Intentional limitation | No escrow, automated refund, bank transfer verification, penalties or cancellation deadline. Payment references are participant evidence with manual admin dispute resolution. |
| PROD-005 | Intentional limitation | No Google, Apple or Microsoft sign-in flow. Google is the requested next authentication feature; Microsoft is already absent. |
| PROD-006 | Incomplete public/legal content | Privacy Policy is visibly unavailable in the footer, despite signup language linking to privacy terms. |
| PROD-007 | Unverified operational journey | Real Cloudinary retry/expiry/cache/orphan behavior requires approved provider access; mocks/local authorization checks do not close it. |

## E. Security and data-integrity findings

### Strengths verified by source and targeted tests

- Backend persists refresh-token hashes in `AuthSession`; refresh rotation uses an atomic conditional update and replay detection/revocation.
- Every protected HTTP request and Socket.IO packet validates persisted session/account state; session/account revocation disconnects sockets.
- Backend validates production secret/origin safety; private document roots cannot overlap public upload roots and local private fallback is disabled in production.
- Private identity/company document routes are authorization-gated; static serving mounts only dedicated public paths.
- Marketplace mutations use transactions and database locks for participant availability/blocks, connection races, work transitions, safety cases and payment claims. Required admin actions use transactional audit writes.
- Input validation uses Nest `ValidationPipe` with whitelist/transform, plus local form validation; backend remains authoritative.

### Risks/gaps

| ID | Severity / release impact | Evidence | Recommendation / test | Dependency |
| --- | --- | --- | --- | --- |
| SEC-001 | High/Medium as described above | Browser-only, unpersisted Terms acceptance. | Server-enforce and persist approved consent. | Legal/privacy. |
| SEC-002 | Medium — deployment-wide security concern, not a local code defect | Auth attempt limits are process-local by documented design. Multiple API instances can multiply effective limits. | Add approved shared/ingress rate limiting when deployment is in scope; test distributed enforcement. | Hosting/edge decision; excluded from current implementation phase. |
| SEC-003 | Medium — policy/operational blocker rather than code defect | Retention, holds, complete erasure, Cloudinary orphan cleanup and session-expiry cleanup periods are deliberately undecided. | Approve retention/erasure/hold rules before compliance claims or real personal data use. | Privacy/legal/operations. |
| SEC-004 | Medium — unverified provider boundary | Cloudinary code/mocks exist, but no real authenticated delivery/expiry/cache test ran in this audit. | Execute the existing storage acceptance matrix only with approved synthetic provider credentials. | Provider access; excluded from current phase. |

No confirmed authorization bypass, public private-document route, session-replay bypass, role-guard bypass, payment transition race or SQL/data corruption defect was found in the inspected source/test evidence. That is not proof that none exists; full backend PostgreSQL integration and browser tests were not rerun here.

## F. Testing coverage gaps

| Area | Existing evidence | Important gap / required regression |
| --- | --- | --- |
| Frontend auth/session | 50 Vitest tests include credential action, proxy, refresh/cookie, deployment-origin, onboarding and safety behavior; 5 Node tests include recovery/realtime/notification checks. | No Google OAuth/provider callback/account-linking tests; no real browser password-manager/autocomplete test. |
| Backend auth/security | Targeted audit run: 59 tests for sessions, rate limits, production config, private storage, gateway and readiness. Historical report records 357 backend tests including PostgreSQL suites. | Audit did not provision an isolated DB, so PostgreSQL integration/race, admin, assignment, safety and Cloudinary tests were not rerun. Run only against a guarded `_test` database. |
| Admin | 25 unit tests passed for proxy/session/safety/payment server actions. | No end-to-end admin browser session-expiry/recovery test in this audit; no Google-account admin policy exists. |
| Terms/legal | UI checkbox behavior exists. | No server/API/schema consent test, versioning test or privacy-policy route/link test. |
| Marketplace workflows | Controllers/services and historical browser/Docker evidence cover connection, chat, assignment, delivery/revision, manual payment, moderation and safety. | No audit-time full browser regression; incomplete Applications feature has no workflow test by design. |
| Uploads/storage | Local path/static authorization and mocked Cloudinary tests exist. | No real provider, signed expiry, CDN cache, timeout/rate-limit/retry/orphan reconciliation test. |
| Accessibility/performance | Component primitives and responsive navigation exist. | No automated a11y, keyboard/focus-return, screen-reader, reduced-motion or performance/load suite. |
| Test ergonomics | Backend/admin expose test scripts. | Frontend has no `test` package script; its six Vitest files require the explicit config/binary invocation used in this audit. Add a reviewed script when implementation resumes. |

## G. Prioritized development roadmap (application work only)

1. **Decide and implement canonical Google identity architecture** (AUTH-001/AUTH-002). Preserve backend sessions, revocation and role/onboarding rules; remove the disabled Apple control unless it is separately approved. Microsoft requires no removal work.
2. **Make consent server-authoritative** (SEC-001/UI-001): approved Privacy Policy route/content, backend consent model/version, direct-request rejection and migration/test coverage.
3. **Close credential UX and recovery decisions**: correct login autocomplete hints (UX-001); retain truthful manual recovery until identity policy/provider is approved, then build the approved flow.
4. **Resolve product scope gaps**: decide Applications meaning before implementation; retain link delivery unless native file hosting becomes an approved requirement.
5. **Stability hardening**: add frontend test script; expand browser coverage for login/onboarding, mobile/error/offline paths and admin refresh; add a11y checks; run isolated PostgreSQL regression before releases.
6. **Provider/operational acceptance later**: Cloudinary real-provider matrix, distributed rate limiting, retention/erasure and hosting remain separate from this application phase.

## H. Estimated remaining application work (hosting excluded)

This is an effort range, not a delivery commitment. It excludes cloud setup, DNS/TLS, container registry, CI hosting, database provisioning, Cloudinary account work, production deployment and external approvals elapsed time.

| Workstream | Engineering estimate after prerequisites are approved | Notes |
| --- | ---: | --- |
| Google identity/linking/backend-session design, migration, implementation and automated tests | 2–4 developer weeks | Largest uncertainty is the approved linking/role/consent policy, not provider SDK installation. |
| Terms/privacy server enforcement and policy route | 3–6 developer days | Depends on approved legal wording/version/retention. |
| Login autocomplete and frontend test ergonomics | 1–2 developer days | Small, bounded regression-tested work. |
| Self-service recovery | 1–3 developer weeks | Only after identity/provider/security decisions; manual support can remain meanwhile. |
| Applications feature | 1–3 developer weeks | Only after product definition; not a defect fix. |
| Accessibility/mobile/error-state audit and remediation | 1–3 developer weeks | Depends on route scope and findings. |
| Full isolated DB/browser regression and bug triage | 3–7 developer days | Requires a guarded disposable PostgreSQL target, not hosting/provisioning work. |

For the immediate stated goal, the practical application backlog is **roughly 3–6 developer weeks** for Google plus consent/security hardening and regression coverage, excluding self-service recovery and Applications unless separately approved. Existing marketplace workflows should be preserved and regression-tested, not rewritten.

## Inspection and test record

### Files directly read

- `apps/frontend/AGENTS.md`, `apps/frontend/package.json`, `apps/admin/package.json`, `apps/backend/package.json`, `packages/database/package.json`, `apps/frontend/vitest.config.mjs`, `apps/admin/vitest.config.mjs`
- `apps/frontend/src/auth.ts`, `apps/frontend/src/auth.config.ts`, `apps/frontend/src/proxy.ts`, `apps/frontend/src/app/auth/actions.ts`, `apps/frontend/src/app/api/auth/[...nextauth]/route.ts`, `apps/frontend/src/components/auth/social-login-buttons.tsx`, `login-form.tsx`, `signup-form.tsx`, `apps/frontend/src/components/layout/navbar.tsx`, `footer.tsx`
- `apps/frontend/src/app/auth/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `dashboard/freelancer/applications/page.tsx`, `dashboard/freelancer/jobs/page.tsx`
- `apps/backend/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `session-access.ts`, `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts`, `dto/signup.dto.ts`, `dto/login.dto.ts`, `production-auth-config.ts`
- `apps/backend/src/main.ts`, `operations/http-error.filter.ts`, `marketplace-access.ts`, `document-storage.ts`, `static-uploads.ts`, `realtime/realtime.gateway.ts`, `realtime/realtime-cluster.service.ts`
- `packages/database/prisma/schema.prisma` and all 14 migration directory names
- `docs/PORISROM-DEVELOPER-HANDOVER.md`, `PORISROM-REMAINING-PRODUCT-REQUIREMENTS.md`, `PORISROM-STAGING-READINESS-REPORT.md`, `PORISROM-STAGING-ACCEPTANCE-REPORT.md`, `PORISROM-CREDENTIAL-RECOVERY-POLICY-DECISIONS.md`, `PORISROM-PRIVATE-STORAGE-FIX-2026-10-22.md`, `PORISROM-SESSION-REVOCATION-FIX-2026-10-22.md`, `PORISROM-MODERATION-FIX-2026-10-22.md`, `PORISROM-ADMIN-DB-VERIFICATION-2026-10-22.md`, `README.md` and `apps/frontend/VERCEL.md`.

Repository-wide file, route/controller, schema-model, test, migration, TODO/FIXME/Coming Soon, provider/authentication, navigation and transaction/lock searches were also run. This is a broad static audit, not a claim that every line of every source file was manually read.

### Tests executed in this audit

| Command | Result |
| --- | --- |
| `node ../admin/node_modules/vitest/vitest.mjs run --config vitest.config.mjs --configLoader runner` from `apps/frontend` | 6 files, **50 passed** |
| `node --test test/recovery-policy.test.mjs test/notification-state.test.mjs test/realtime-chat.test.mjs test/moderation-browser-regression.mjs` from `apps/frontend` | **5 passed** |
| `node node_modules/vitest/vitest.mjs run --config vitest.config.mjs --configLoader runner` from `apps/admin` | 4 files, **25 passed** |
| `node node_modules/vitest/vitest.mjs run test/auth-session.spec.ts test/auth-rate-limit.spec.ts test/production-auth-config.spec.ts test/document-storage.spec.ts test/realtime-gateway.spec.ts test/health-readiness.spec.ts --maxWorkers=1` from `apps/backend` | 6 files, **59 passed** |

Two initial frontend test invocation methods did not execute tests: PowerShell blocked `pnpm.ps1`, then `pnpm.cmd exec` could not resolve a root Vitest binary. The direct installed Vitest invocation above passed. A direct config-loader attempt from the repository root found no tests because the frontend config uses package-relative paths; rerunning from `apps/frontend` passed.

### Confirmed blockers before implementation

- AUTH-001/AUTH-002: approved Google OAuth/account-linking/backend-session design and Google test-client configuration.
- SEC-001/UI-001: legal/privacy decision on consent persistence and Privacy Policy content/version.
- PROD-002: recovery identity/provider policy if self-service recovery is required.
- PROD-001: product definition if Applications is to move beyond its explicit placeholder.

Stop point: this report completes Phase 1 audit only. Await approval before modifying authentication, schema, application code, tests or configuration.
