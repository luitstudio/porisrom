# Porisrom staging readiness report

Reviewed 2026-10-28. **Conditional staging candidate; not staging accepted or production ready.** Implementation, local PostgreSQL tests and browser checks below were performed. No commit, push, deployment, shared/staging/production database mutation, reset, data wipe or volume removal occurred.

Historical sources: [original audit](PORISROM-AUDIT-2026-10-22.md), [private storage](PORISROM-PRIVATE-STORAGE-FIX-2026-10-22.md), [sessions](PORISROM-SESSION-REVOCATION-FIX-2026-10-22.md), [moderation](PORISROM-MODERATION-FIX-2026-10-22.md), and [admin/database verification](PORISROM-ADMIN-DB-VERIFICATION-2026-10-22.md). Their old test totals are not presented as new results. The latest user-approved product decisions supersede undefined historical policy, not existing security controls.

## Fresh findings and implementation

The existing private document authorization/path controls, conditional refresh rotation/replay revocation, backend/client logout, per-request/socket session validation, account moderation, historical read access, durable administrative mutations, payment-dispute resolution and local-font builds were present. They were preserved and exercised by the full regression runner. Admin blocking was **not** a user-to-user block feature. No user block/report/case model or API existed; cancellation had a mutual-confirmation flag but no rejection/escalation/admin arbitration; authenticated support was absent. No verified credential-recovery provider, retention periods, hosted alerting or production backup configuration was found.

| Confirmed cause | Change and resulting behavior |
| --- | --- |
| No persisted participant safety boundary | `UserBlock` plus common either-direction lookup under the same ordered participant row locks as moderation/work mutations. Blocked discovery filters are applied to both items/counts. Established messages, connections, assignments, delivery, reviews and payment mutations cannot bypass the freeze. Authorized history remains readable. |
| Missing private reporting/support | Persisted `SafetyCase`/events, reason/category/context validation, private admin queue/review, generic notices, owner-only support history and rolling DB-backed quotas. Reports are excluded from all participant case lists, including the reported user. |
| Cancellation could stall indefinitely, and the old mutual-cancellation endpoint could cancel payment-disputed work | Required initial reason, counterpart rejection, participant escalation for pending/declined/frozen work and two explicit admin outcomes with required reasons. Locking, state rechecks, case/history/audit/notices share a transaction. Participant cancellation cannot bypass payment-dispute review. No deadlines, penalties, refunds or settlement introduced. |
| Process-local socket rooms | Official `@socket.io/postgres-adapter` 0.5.0 over existing PostgreSQL; migration-owned attachment table, session-mode backplane, explicit heartbeat initialization, subscription/peer readiness and graceful shutdown. Single-instance memory mode retained. Separate processes proved cross-instance revocation and delivery. |
| Unsafe explicit production URL/equal-secret configuration | Production rejects equal JWT secrets and unsafe CORS/marketplace/admin/browser API origins. HTTPS/cookie/build-time requirements and staging placeholders documented. Private production fallback remains disabled. |
| Onboarding saved fields before later uploads; retries could duplicate links | Resume saved fields/links/review status; successful selections cleared before retry; database-locked portfolio deduplication; company settings provides private upload/retry after reload. File bytes are never put in persistent browser storage. |
| Four-MiB action envelope smaller than five allowed PDFs | Envelope raised to eight MiB while API count/type/size limits remain strict. Actual browser submission exposed a second off-by-one: Multer rejects a file when its configured boundary is reached. Transport allows one byte of headroom and services still enforce <=1 MiB PDFs / <=2 MiB images. Five exact-limit PDFs now pass; excess bytes/count fail. |
| Signed cloud redirects lacked the local-response cache policy | All protected owner/admin document-file redirects now use `private, no-store`; admin signed metadata response also sets it. Existing authorization remains intact. Four redirect regressions use synthetic provider responses, not real cloud credentials. |
| No reproducible application image/CI gate | Root multi-target non-root Dockerfile, separate staging Compose project/volumes, names-only environment template, frozen pnpm 9 clean-copy rehearsal and CI/local verification runner. No secrets are copied into build context. |
| Raw exception logging / absent operational recipes | Sanitized route/status exception signals, fixed backplane events and removal of raw frontend auth error logging; backup/restore, monitoring, incident/rollback and acceptance procedures prepared. Hosted collection/alerts remain external gates. |

## Authorization policy

The owner explicitly chose **freeze shared conversations/work read-only; allow administrative escalation**. Either participant's active block applies in both directions. Blocking does not cancel work, erase records, change payment evidence, revoke unrelated sessions, or turn an approved public profile into confidential content. Signed-in discovery hides blocked counterparts; anonymous public profiles remain public. Only the blocker can remove their own block; removing it cannot reverse another block, account moderation or session revocation.

Only active marketplace users submit cases/blocks; self-block/report is denied. Targets must be eligible marketplace users; report context must belong to both participants. Reports require category/reason and return only receipt/status. Active administrators receive generic queue notifications. Report targets never receive reporter details or report reasons. Support owners see their own support history; shared cancellation participants can read their case history. Admin guards and transactional role/status checks protect decisions.

Active duplicate requests are idempotent. Actor/pair locks enforce ten new cases per rolling 24 hours and fifty new block cycles per actor/day across instances. Case decisions are one-shot with conflicts on races. Audit insertion failure rolls back decision/history/notices. Cancellation confirmation and denial are explicit; stale terminal/payment-disputed assignments cannot be silently overridden. Existing automatic payment-dispute resolution remains separate and preserves claims.

The owner approved authenticated support while leaving credential recovery gated. A support resolution never changes passwords, validates identity or reactivates a blocked/deleted account. No pretend email/reset provider was added.

## Changed files

Existing unrelated dirty work and old migrations were preserved. The initial hash inventory covered 213 preexisting dirty/untracked source/test/document files; the preservation check found **no missing baseline files**. Some were extended for this task. Preexisting deleted/renamed image assets were not restored or removed. No `.env` was overwritten.

| Area | Files introduced or extended for this task |
| --- | --- |
| Schema | `packages/database/prisma/schema.prisma`; new `migrations/20261028000000_product_safety/migration.sql`. Existing thirteen migration files unchanged. |
| Safety APIs | `apps/backend/src/safety/{safety.dto,safety.service,safety.controller,safety.module}.ts`; `app.module.ts`; `marketplace-access.ts`; `auth/guards/optional-jwt-auth.guard.ts`; connections/conversations/search/work-assignments services/controllers. |
| Realtime/health | `realtime/realtime-cluster.service.ts`, gateway/module, health controller, main bootstrap; backend dependency manifest and lockfile. |
| Production/storage/logging | `auth/production-auth-config.ts`; owner/company/admin profile controllers; `profiles/freelancer-profile.service.ts`; new `operations/http-error.filter.ts`; both apps' `lib/deployment-origin.ts` and backend URL helpers; frontend public URL/auth helpers. |
| Marketplace | `app/safety/{page,actions}.tsx/ts`, `components/safety/safety-controls.tsx`, public profile/discovery pages, assignment panel, onboarding page/action/types/wizard/profile step, company document retry component/settings, navigation, Next/lint/type configuration for isolated generated output. |
| Admin | `app/(protected)/safety/{page,review-form,actions}` and action tests; admin navigation/URL/configuration helpers. |
| Backend regressions | `safety-postgres.spec.ts`, `realtime-cluster-postgres.spec.ts`, `operational-logging.spec.ts`, production secret/redirect tests. Explicit no-block lookups added to legacy active test fixtures; old assertions retained. |
| Client regressions | `deployment-urls.test.mjs`, `safety-actions.test.mjs`, `onboarding-retry.test.mjs`, Vitest config; existing component harness gained isolated mocks for new safety/router imports. `staging-browser-acceptance.js` runs synthetic real-browser API journeys. |
| Reproducibility | `Dockerfile`, `.dockerignore`, `deploy/compose.staging.yml`, `deploy/staging.env.example`, `.github/workflows/verify.yml`, `scripts/{verify-release,rehearse-clean-install,rehearse-security-backup}.mjs`; isolated DB wrapper extended; `.gitignore`. |
| Reports | This report and the other five requested staging/product/runbook/checklist documents. Older audit/security reports were not rewritten to disguise historical findings. |

## New verification evidence

Local database: newly provisioned native PostgreSQL **18.2**, loopback only, random database ending `_test`, separate temporary cluster verified using the server data directory. Shared PostgreSQL and the old test cluster were not used. Only synthetic accounts/records were created. Test cleanup targets each suite's own fixture IDs.

| Verification | Actual result |
| --- | --- |
| Backend full suite | **357 passed, zero failed/skipped**, 40 test files. Includes **50 real PostgreSQL tests**: existing 26 + 17 participant-safety/portfolio tests + seven tests launching two separate API processes. |
| Admin | **25 passed**, four test files (22 existing + three safety-action checks). |
| Marketplace Vitest | **50 passed**, six test files (17 existing auth checks + 24 production-origin cases + nine safety/onboarding cases). |
| Marketplace Node tests | **4 passed**, notification state, message deduplication and honest recovery wording. |
| Real Chrome / actual API + isolated DB | **20 browser-driven API scenarios passed**, covering registration through negotiation/delivery/revision/payment mismatch, admin reopen/completion, block/report, cancellation, private support, document denial and logout revocation. These are API journeys executed in Chrome, **not twenty click-through UI journeys**. |
| Rendered actual applications | Marketplace/admin login; private support submission/review/owner response; profile report/block/unblock management; cancellation escalation and admin confirmation; five exact-limit PDF retry through the real Next action/backend/DB; oversized-file rejection with retained selections; both logout flows and subsequent access denial were checked. Local HTTP development servers used separate generated output; this does not verify HTTPS production cookies. |
| Existing component browser suite | **11 checks passed**: active send, moderation/failure freezes, retained history and restored legitimate controls. Synthetic component checks are separate from actual-app and database evidence. |
| Static/build checks | Backend/admin/frontend lint and TypeScript passed; database client generation/TypeScript passed; backend and both Next production builds passed. One preexisting backend unused-eslint-disable warning remains; no lint errors. Next route type generation is part of the clean runner. |
| Frozen install | pnpm **9.0.0** frozen installation passed in a new candidate snapshot without `.env`, uploads, Git data, node_modules or old build output. Existing worktree/dependencies were not replaced by that rehearsal. |
| Migrations | Fourteen applied, completed ledger/checksums verified, status up to date and zero schema difference on isolated PostgreSQL. |
| Backup/restore | Three successful native logical rehearsals into fresh databases: 28 tables each, with 49 / 328 / 380 rows respectively; constraints, migration status and zero drift verified. The source database was preserved throughout. Neither is a staging/production backup claim. |
| Docker | `compose config --quiet` passed with placeholder-only file and an empty Docker CLI configuration directory. Image build/runtime **blocked: Docker daemon pipe absent**. Existing Docker Desktop/containers/volumes were not started or altered. |
| CI | Workflow and equivalent local runner prepared/executed; **remote CI not run** because nothing was pushed. |

Reproducible commands from repository root:

```sh
pnpm install --frozen-lockfile
node scripts/verify-release.mjs --isolated-state
node scripts/with-security-test-db.mjs backend-tests safety-postgres realtime-cluster-postgres private-document-http --reporter=dot
node scripts/with-security-test-db.mjs migrate-status
node scripts/with-security-test-db.mjs schema-diff
node scripts/with-security-test-db.mjs db-evidence
node scripts/rehearse-security-backup.mjs
docker --config tmp/docker-empty-config compose --env-file deploy/staging.env.example -f deploy/compose.staging.yml config --quiet
```

Pinned pnpm was invoked locally through `npm exec --offline --package=pnpm@9.0.0 -- pnpm ...`; new dependency resolution explicitly disabled pnpm offline mode. Clean-copy installation used `node scripts/rehearse-clean-install.mjs <installed-pnpm-9-bin-path>`. No registry result or CI execution is inferred from an existing node_modules directory.

`verify-release.mjs` records exact workspace commands/exit codes in `tmp/release-verification.json`: Prisma generate/compile/deploy/status/diff, Nest build, full Vitest suites, four Node tests, each ESLint/tsc, Next typegen and both production builds. `--resume` is only for continuing recorded checks on the same unchanged candidate/environment; do not reuse it for another release. The final onboarding display adjustment was followed by frontend test/lint/type/build checks again. The final disputed-cancellation guard was then checked with the full 357-test backend suite, fresh backend build/lint/TypeScript and all fourteen migrations on a second newly created isolated database in the same task-owned cluster; previous databases/restores were preserved. Final backend test evidence is `tmp/backend-tests-final.json`.

The first attempted clean copy stopped safely because Node disallows copying a directory into its own child; entry-wise copying fixed it and the frozen install passed. Browser testing exposed the exact-limit upload bug, which was fixed and covered above. A later lint/type pass initially included transient Next development artifacts; dedicated ignores/exclusion and `next typegen` fixed that. These earlier failures are not hidden as passes; the final source checks supersede them.

Evidence files under `tmp/` are local artifacts, not committed deployment secrets: `release-verification*.log`, `release-verification.json`, `backend-tests.json`, `backend-tests-final.json`, `staging-rendered-browser-results.json`, `clean-install-result.json`, `staging-browser-results.json`, `staging-backup-rehearsal.json`, `staging-worktree-preservation.json`, and migration ledger output. The local DB credential/state file and dumps remain outside the checkout; do not upload them. CI artifacts intentionally include only sanitized verification summaries/test results.

## Migration, compatibility and unresolved risk

The additive fourteenth migration introduces persisted safety records and transport storage with unique active keys, lookup/cleanup indexes and restrictive relationship FKs. It does not change old auth/private-document/payment contracts. Deploy schema before enabling the new binary. Runtime safety decisions, notices and audit are atomic; the generated migration SQL itself has no explicit enclosing transaction, so a failed DDL rollout may require reviewed forward repair rather than blind retry. Rehearse failure recovery with the target platform before promotion; never edit applied checksums or reset a shared database.

Initial cancellation now requires a reason of at least ten characters (intentional validation tightening); existing confirmation with no note remains supported. Payment-disputed assignments now reject participant cancellation/denial and stay in the audited dispute workflow; a PostgreSQL regression first reproduced the old silent cancellation and then passed after the guard. New frontend prompts/controls supply reasons. Search remains anonymous unless credentials are supplied; supplied invalid/revoked credentials fail rather than silently dropping safety filtering. Public target visibility still follows active role/profile approval, historical reviews remain intact, and administrative payment completion still does not mean bank settlement.

Old binaries do not know about user blocks. A rollback to pre-safety code can reopen prohibited writes; isolate marketplace writes and forward-fix instead of silently weakening protection. The adapter needs direct/session-mode PostgreSQL LISTEN/NOTIFY, sufficient connections and sticky polling sessions or a verified WebSocket-only topology. Local two-process results do not verify the deployment load balancer, failover or a network partition. Required peer-count readiness can deliberately remove a degraded replica group from service.

No hosted immutable audit sink or database-owner tamper prevention is provided. Existing private old-object cleanup can fail and leave private orphans; no unapproved bulk cleanup/retention process was added. Profile completion remains separate from successful optional file review. Credential recovery, account appeals and full erasure remain gated. Dependency/image vulnerability clearance and managed-platform recovery are not established by passing application tests.

## Prioritized release gates

`Local` / `integration` mean this task's actual execution. No row below claims staging or production verification. Roles are responsible roles to assign, not invented named owners.

| Priority / requirement | Status and evidence | Risk / required action | Dependency / responsible role | Verification | Blocks staging acceptance? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- |
| P0 historical document/session/moderation/dispute boundaries | Implemented + local/integration regression passed; prior fixes preserved | External ingress/storage misconfiguration remains possible; repeat deployment negatives | Staging access / security + infrastructure | Private denial, replay/logout, moderation, audited dispute tests through ingress | Yes until deployed acceptance | Yes |
| P1 participant block/report/cancellation/support | Implemented + local DB/browser checked | Assign private queue/review owners; repeat actual HTTPS UI/negative roles | Product/support/admin owners | Safety cases, concurrent decisions, freezes, notices, audit rollback | Local implementation cleared; HTTPS acceptance remains | Yes until acceptance/ownership |
| P1 container release | Prepared; config validated; runtime blocked by external daemon access | Build, scan, pin digests, start images, health/non-root/restarts/resources | Docker/platform / infrastructure | Image builds and container smoke | Yes | Yes |
| P1 exact staging configuration | Template/guards implemented; not staging verified | Supply HTTPS URLs, proxy forwarding, distinct secrets, CORS/cookies and ingress size settings | Actual hosts/secrets / infrastructure | Real Chrome HTTPS expiry/multi-tab/logout and socket checks | Yes | Yes |
| P1 private cloud integration/CDN | Local authorization/cache regressions passed; external access blocked | Verify authorized synthetic cloud upload/download/expiry/replacement/errors/orphans/cache matrix | Authorized staging cloud account / storage + security | Environment-guide matrix | Yes | Yes |
| P1 shared realtime deployment | Implemented + two-process integration passed | Verify LB upgrades/affinity, direct LISTEN connection, outage recovery and pool budget | Platform topology / backend + infrastructure | Two-instance ingress tests plus failure injection | Yes for multiple replicas | Yes for multiple replicas |
| P1 migration rollout | 14 isolated migrations/checksums/zero drift passed | Upgrade representative isolated staging clone; rehearse partial failure/forward repair; approve target DB | Authorized DB clone / database owner | Status, checksum, FKs/indexes, drift, rollback limitations | Yes | Yes |
| P1 reproducible CI | Frozen clean-copy install + local pipeline passed; remote not run | Run exact release artifact in hosted CI, attach sanitized evidence | Repository CI / release owner | Prepared workflow with disposable PostgreSQL | Yes for release promotion | Yes |
| P1 backup/restore/PITR | Local restore verified; managed operations not configured/verified | Approve RPO/RTO/frequency/retention/encryption/location and prove platform restore | Platform access + approved objectives / DB owner | Measured isolated restore and consistency checks | Yes for operational acceptance | Yes |
| P1 monitoring/incidents/rollback | Signals/runbooks implemented; external alerts and release rollback unverified | Configure collector/alerts, assign responders, simulate failures and compatible rollback | Platform/on-call access / operations + security | Alert delivery and recovery drills | Yes for operational acceptance | Yes |
| P1 credential/identity recovery and appeals | Authenticated support implemented; credential recovery not implemented by approved decision | Approve provider/evidence/privacy policy and usable locked-out support path | Product/security/provider | Identity/recovery/session-invalidation rehearsal | No for synthetic staging scope | Yes before real-user acceptance |
| P1 retention/erasure/orphan policy | Inventory complete; periods and deletion rules require product/legal decision | Approve category policies, holds, backup/provider implications and safe cleanup tests | Product/privacy/database/storage owners | Approved inventory plus erasure/retention drill | No for synthetic-only staging | Yes |
| P2 native deliverable files | Not implemented; existing link delivery tested | Decide whether native storage is required for V1 before expanding upload scope | Product/storage | Supported delivery journey | No | Only if V1 scope requires it |
| P3 automated finance/other enhancements | Not implemented; no authorization to create settlement | Separate product/legal/provider design; no inferred refunds/penalties/deadlines | Future product/financial provider | Separate project acceptance | No | No within current manual-payment scope |

Use the [environment guide](PORISROM-STAGING-ENVIRONMENT-GUIDE.md), [backup runbook](PORISROM-DATABASE-BACKUP-RESTORE-RUNBOOK.md), [incident runbook](PORISROM-INCIDENT-RESPONSE-RUNBOOK.md), [release checklist](PORISROM-RELEASE-CHECKLIST.md) and [remaining requirements/retention inventory](PORISROM-REMAINING-PRODUCT-REQUIREMENTS.md) for the exact next steps. External access blockers are explicit; this candidate is not represented as deployed or accepted.
