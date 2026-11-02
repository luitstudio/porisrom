# Final staging acceptance report

Work began 2026-10-28; initial verification finalized 2026-10-29; Docker follow-up closed 2026-11-02, Asia/Calcutta. **Staging acceptance is blocked; production readiness is not established.** This task closes safe local packaging/verification work and prepares explicit external/policy decisions. It does not deploy, push, commit, change production/shared databases, change branch protection, start Docker Desktop or delete Docker volumes/data.

Sources reviewed: the six October 28 readiness/environment/checklist/backup/incident/product reports and earlier audit/private-storage/session/moderation/admin-database reports. Prior results remain historical. The current branch is `main`; the candidate has substantial existing dirty/untracked work, including migrations and the workflow. An initial 268-file source/report/config hash inventory and 8,097-line tracked diff inspection preceded edits. Existing image deletions/renames and earlier security work were preserved; developer `.env` files were not overwritten.

## Docker acceptance follow-up (2026-10-29 through 2026-11-02)

**PASS - local Docker simulation only. Overall staging acceptance remains blocked by external and operational gates below.** All three production images built and ran. The isolated database, HTTPS ingress, two backend instances, browser flows and graceful restart were actually exercised. The final task services were intentionally stopped on 2026-11-02; containers, network, database volume and synthetic records remain intact. No remote/production deployment, push, commit, production mutation or volume deletion occurred.

### Resource safety and environment

Initial inventory: `tmp/docker-resource-baseline-2026-10-29.json`. It records five pre-existing containers, four images, eight networks and six volumes, including Airbnb's running `postgres-db`, stopped `ghor-test-pg`, Zentraa PostgreSQL/Redis, and the older stopped `porisrom-postgres-1`. No pre-existing database container or volume was reused. Branch `main`, existing diffs/untracked files, repository instructions, deployment files and prior reports were inspected before edits.

The task uses project **`porisrom-acceptance-20261029-cede6a0f`**, network **`porisrom-acceptance-20261029-cede6a0f_default`**, volume **`porisrom-acceptance-20261029-cede6a0f_database`**, and synthetic DB **`porisrom_docker_acceptance_test`**. PostgreSQL has no published port; only the synthetic HTTPS proxy publishes a randomly allocated **127.0.0.1** port. These resources are distinct from both older Porisrom volumes. Two APIs, marketplace, admin, PostgreSQL and the proxy run in this project. Utility containers have unique task names and remain retained after exit.

Docker engine 29.4.1 and Compose 5.1.3 were verified through the normal `desktop-linux` context. Child commands explicitly select that context without modifying global configuration. PostgreSQL uses `postgres:18.2-bookworm`; applications use Node 24.11.0, frozen pnpm 9.0.0 installation, Prisma 7.8.0 and the existing lockfile. Actual production database/platform compatibility still needs target-environment rehearsal.

Generated DB/JWT/Auth.js secrets, private Compose JSON and synthetic TLS key are outside the build context in a task-owned OS temporary directory, referenced through `tmp/docker-acceptance-pointer.json`. Access and refresh secrets are distinct. Developer `.env` files were not changed. Applications retain TLS verification and trust only the mounted synthetic CA; only the disposable Chromium test accepts the self-signed certificate. The `.test` names exist solely as isolated Docker network aliases. Cloudinary settings are empty and production local private-file fallback remains disabled.

The final resource preservation check passed **23/23** comparisons: five original containers, four image identities, five project-network identities, three daemon networks against continuation preflight, and six original volumes. Existing running/exited container states remain as inventoried. Docker's daemon-managed `bridge` ID changed across operator Desktop restarts (`e6a4ffc6eb63` originally, `755b23828a55` on October 31, `ceff08984823` before November 2 actions). The checker retains those differences and compares built-in networks against the current preflight; it does not discard project-network identity changes. Earlier strict checks correctly flagged this drift. No global restart or network mutation was performed by these scripts. Final evidence: `unrelated-resource-preservation-1793617207459.json`.

### Implementation changes

| Files | Change and purpose |
| --- | --- |
| `Dockerfile`, `.dockerignore` | Install frozen dependencies from workspace manifests before source copy; exclude Turbo/generated caches and docs/CI from context; explicitly build both Next apps in production mode; separate migration and acceptance-test tooling from non-root app runtimes. Existing private storage guards remain intact. |
| `scripts/docker-acceptance.mjs` | Private isolated Compose preparation, explicit Docker context, child-only BuildKit enablement, validated resume with retained-volume ownership/certificate checks, unique migration jobs, secret-redacted unique logs and command sidecars, scoped start/stop. |
| `scripts/docker-acceptance-checks.mjs` | Runtime image inspection; trusted-CA HTTPS/CORS probes; migration checksum comparison; guarded containerized regressions; fresh synthetic fixtures; full/UI-only browser modes; six-service lifecycle with container IDs and business-row digests; original-resource preservation evidence. |
| `scripts/verify-release.mjs` | Validated optional `--test-workers=1..16`; the constrained Docker runner selects one backend test-file worker. Concurrent requests inside tests remain concurrent. Default behavior elsewhere is unchanged. |
| `deploy/acceptance-proxy.mjs`, `deploy/acceptance-seed.cjs` | Allowlisted synthetic HTTPS/WebSocket ingress; seed only the exact test DB, refuse identity/role collisions and use fresh synthetic fixture suffixes without resetting earlier records. |
| `deploy/Dockerfile.acceptance-browser`, `deploy/acceptance-browser.mjs` | Separate pinned Playwright test image; real HTTPS API/UI tests; explicit Socket.IO authentication-rejection checks; visible-control/streamed-history waits; existing logout redirect contract; safe visibility diagnostics. |
| `apps/frontend/test/staging-browser-acceptance.js` | Reuse the existing twenty journeys on the allowlisted synthetic HTTPS origin as well as the established loopback origin. |
| This report | New build, execution, failures, retry, preservation and release-gate evidence. Earlier verification remains historical below. |

No application auth, storage, moderation, financial or session policy was weakened. No schema or migration was changed. The full private-storage/session/moderation/audit/dispute suites ran successfully in the isolated container database.

### Images and execution evidence

These are local Docker image IDs/BuildKit exported manifest-list digests, not registry publication or vulnerability-scan evidence. All three app runtime users are `node`; actual non-root execution and sensitive-file checks passed for each.

| Runtime target | Final local ID (`sha256:`) | Size in bytes |
| --- | --- | ---: |
| backend | `567956b2c55f369b91adb443b970efc30c04ca36b9bbdc59e393bc0796ff5aea` | 191828632 |
| frontend | `d60ff6afb4139e65bf09acab83377e673b7e83ef67a32834f8943115de8e83eb` | 130918767 |
| admin | `a88084e3283f6661c085fda1d9f7a5a598a1184f1efbd28382f15cddb7058f3f` | 104353559 |

Migration, acceptance-test and browser utility images also built successfully. The backend was rebuilt after the final Dockerfile cache-layout changes, then only task API/proxy containers were recreated onto that image before acceptance. Final inventory logs are `image-*-179346943*.log` and `image-files-*-179346943*.log`. Runtime checks found no `.env`/`.env.*`, key/certificate files or `/app/.turbo` in app images. This is a targeted content check, not an SBOM or vulnerability scan.

All six services became healthy. The API readiness checks query PostgreSQL and require both PostgreSQL Socket.IO peers to be subscribed; two distinct backend containers were used, not a single process presented as multi-instance evidence. The dedicated migration job applied all 14 migrations to the task DB; later resumes reported no pending migrations. No reset or destructive migration command was used.

### Actual new verification

| Check | Result and evidence |
| --- | --- |
| Full containerized release verification | **22/22 commands passed**, fresh final run, no resume/cached test substitution. `regression-results-porisrom-acceptance-20261029-cede6a0f-regressions-1793469347912.json`; full log `container-regressions-1793469347912-4baa2e.log`. |
| Backend | **357 passed**, 40 files, zero failed/skipped. Includes **50 real PostgreSQL tests**: 21 admin/auth/dispute, 2 refresh concurrency/replay, 3 moderation, 17 safety/portfolio and 7 tests spawning separate backend processes. These 50 are included in 357. `backend-tests-porisrom-acceptance-20261029-cede6a0f-regressions-1793469347912.json`. |
| Admin | **25 passed**, four files. |
| Frontend | **50 Vitest + 4 Node tests passed = 54**, zero failed/skipped. |
| Static checks/builds | All application lint, TypeScript, database generation/compilation, Nest production build, Next typegen and both production builds passed in the 22-command run. One existing backend unused `eslint-disable` warning remains; zero lint errors. Both standalone sanitizers passed. |
| Migration readiness | 14 migrations applied; `migrate status` current and schema diff zero in the release run. **14/14 SHA-256 checksums** match repository SQL, with finished/non-rolled-back ledger entries; repeated successfully after restart on November 2. `migration-checksums.json`. |
| HTTPS ingress | **7/7 probes passed**, including after restart on November 2: readiness on each API, marketplace/admin login pages, unknown Host rejected with 421, exact allowed CORS origin and no allow-origin header for the untrusted origin. Real TLS certificate validation enabled. `https-probes.json`. |
| Full real-browser acceptance | **45 passed, zero failed** on October 31. Breakdown: 20 API journeys, 1 aggregate completeness assertion, 3 backend HTTPS cookie/login/logout checks, 14 cross-container assertions and 7 rendered UI checks. These are not 45 separate user journeys. `browser.json`, `browser-checks-1793470012180-3e34c0.log`. |
| API journeys | Both registrations/logins, onboarding/approval/discovery/connection, messaging, assignment negotiation/acceptance/delivery/revision, payment claims/mismatch/admin reopen/completion, block/report/frozen writes, cancellation escalation/arbitration, private support, unauthorized document denial and logout/revocation. Real API/database, no replacement mocks. |
| Cross-container browser cases | WSS connected to A while B persists/delivers once; persisted message count increases once; B logout disconnects A and explicit auth rejection prevents reconnect; B moderation disconnects A while history remains readable and writes fail; unblocking does not restore revoked sessions; ten refresh requests across A/B yield exactly one success/nine conflicts, replay after grace revokes the rotated session; concurrent admin decisions have one winner/one conflict. |
| HTTPS cookies/UI | Backend, marketplace BFF and admin BFF Secure/HttpOnly/Lax cookies; cookie-auth login/logout; support submit and visible persisted history; private admin queue; retained conversation; both browser logout flows and subsequent private-access denial. Self-signed test ingress does not prove real CDN/cross-site/domain settings. |
| Graceful lifecycle | **All six services stopped and restarted**, same six container IDs retained; all returned healthy. API/Next exit codes 143 (SIGTERM), proxy/Postgres 0; no OOM or forced-kill 137. User, Message, PaymentClaim and AdminActionLog counts **and row digests unchanged**. Duration 41118 ms. `lifecycle.json`. |
| Post-restart UI | **7/7 rendered checks passed again on November 2**, including access to the previously persisted WSS conversation, support, cookies and both logouts. `browser-ui.json`, `browser-ui-checks-1793617101627-387301.log`. These repeat seven checks, not seven extra unique journeys. Final retained task-volume/network existence and unchanged `desktop-linux` context are recorded in `retained-task-resources.json`. |
| Final shutdown | Only this private Compose project stopped on November 2; containers/network/volume/data retained. `stop-task-services-1793617195646-66175c.log`; final stopped-state `container-status-1793617210477-2dcebd.log`. |
| Helper syntax | Seven JavaScript helpers passed `node --check` at closeout; no failed checks. |
| Worktree | All 274 baseline files remain; lockfile hash unchanged. Changed baseline files are Dockerfile, .dockerignore, browser helper, release runner and this report; new task helpers are separate additions. `tmp/docker-acceptance-preservation-check.json`. |

The final test totals are newly executed Docker evidence, not copied from older reports. Historical eleven component checks were not rerun or added to these totals. Application source and the lockfile remained unchanged between successful October 31 verification and November 2 closeout; only test tooling/report changes followed.

### Failures, diagnosis and fixes

1. The inherited `DOCKER_BUILDKIT=0` caused `unknown --progress`. Fixed only for task child processes. Initial context transfer included about 2.6 GB of Turbo cache; the transfer was interrupted and generated caches were excluded without deleting local files.
2. Docker became unavailable between sessions; a continuation probe exited 1 on the missing Desktop Linux pipe. No global Desktop/WSL/service restart was performed. After operator restoration, the retained synthetic certificate was expired; it was renewed in a uniquely named network-isolated task container after verifying application services were stopped and volume ownership matched. The initial browser base extraction had no completion evidence; later browser image builds completed. These earlier failures do not erase the later successes.
3. First release run: 349 backend passes, 1 payment-history timeout, 7 tests skipped by a failed realtime suite setup; other 21 commands passed. With builds finished, the two affected suites passed **28/28** in isolation. A full parallel-file rerun passed 356/357 backend tests, with only that payment-history timeout; all seven process/socket tests passed. This local runner had two CPUs, a half-CPU DB and brief host memory pressure. Test-file contention is supported by repeatable sub-second isolated/serial behavior; no precise CPU-versus-I/O profiling is claimed. Added optional worker control; the final full run with one backend file worker passed all 357 without assertion or timeout changes. In-test PostgreSQL/request races were retained.
4. Browser attempts initially failed on immediate support-history counting, hidden streamed copies of form controls, immediate admin heading lookup, and a test expecting login-page navigation when the existing marketplace logout contract redirects home. PostgreSQL confirmed support persistence. Visibility diagnostics captured one hidden reason field and one visible field. Fixed test waits/selectors and expected redirect, preserving product behavior. UI-only diagnosis passed 7/7, then the complete run passed 45/45. Prior five failure reports are retained as `browser-first-failure.json` through `browser-fifth-failure.json`, with their individual command logs. A runner error and failed assertion can appear as two report entries for one underlying failure; they are not two distinct product defects.
5. Preservation initially flagged the default bridge ID changes across operator engine restarts. Built-in networks now use the recorded current preflight while retaining original drift evidence; project networks still require their original IDs. Final 23 comparisons passed. Completed one-off migration containers produce harmless orphan warnings and were retained; `--remove-orphans` was not used.

### Commands and reproducibility boundaries

Entry points used across this Docker attempt and retries:

```powershell
node scripts/docker-acceptance.mjs prepare
node scripts/docker-acceptance.mjs build backend frontend admin migrate
node scripts/docker-acceptance.mjs build acceptance-tests
node scripts/docker-acceptance.mjs build-browser
node scripts/docker-acceptance.mjs start
node scripts/docker-acceptance.mjs resume
node scripts/docker-acceptance.mjs images
node scripts/docker-acceptance.mjs regressions
node scripts/docker-acceptance.mjs diagnose-regressions
node scripts/docker-acceptance.mjs migration-checksums
node scripts/docker-acceptance.mjs http
node scripts/docker-acceptance.mjs seed
node scripts/docker-acceptance.mjs browser-ui
node scripts/docker-acceptance.mjs browser
node scripts/docker-acceptance.mjs lifecycle
node scripts/docker-acceptance.mjs status
node scripts/docker-acceptance.mjs stop
node scripts/docker-acceptance.mjs preservation
```

Build target grouping varied during retries; the list identifies entry points, not a verbatim single shell session. Helpers invoke `docker --context desktop-linux build --progress=plain --target <target> --tag <project>:<target> .`; Next build arguments contain only the synthetic HTTPS origins. Later operations store exact redacted Docker argument arrays and exit codes beside their logs as `*.log.command.json`. Final full regression invoked `/app/scripts/verify-release.mjs --test-workers=1` in the dedicated test image, sharing only the verified task PostgreSQL container network namespace so existing loopback `_test` guards remain enforced. No production credentials are needed for these tests.

Evidence directory: `tmp/porisrom-acceptance-20261029-cede6a0f/`. Do not publish the entire temporary tree or private state; sanitize selected reports before sharing. The local helper depends on the retained private pointer and baseline inventory, so it is a task rehearsal harness, not a portable production orchestrator. For a clean environment use the existing [environment guide](PORISROM-STAGING-ENVIRONMENT-GUIDE.md) and reviewed `deploy/compose.staging.yml`, create a new unique project/volume and inventory its surroundings first. Do not copy this fixture DB or generated credentials into real staging.

For this retained project, use `resume` rather than `prepare`/`start`: it verifies ownership, rechecks resources and never rotates secrets or deletes the database. The two-day synthetic certificate expires **2026-11-02 17:41:36 UTC**; later runs must renew only the test certificate while task applications/proxy are stopped, then restart with the new trusted CA. Never bypass application TLS validation. Keep synthetic fixtures between checks; `seed` adds fresh ones rather than resetting data. Run heavy builds and regression phases sequentially on this constrained host. Never use `down -v`, `prune`, reset commands or unrelated project stop/recreate operations.

### Remaining acceptance boundaries

- Actual Cloudinary/private-object upload/download/expiry/replacement/orphan cleanup and provider error behavior were not exercised against a real provider. Credentials/namespace authorization are still required. Local regressions are not cloud acceptance.
- The HTTPS proxy is a synthetic local test utility, not the actual deployment ingress/CDN. Real domains, trust chains, routing/affinity, cache denial, cross-site SameSite settings, outage/drain behavior and load/capacity acceptance remain unverified. The PostgreSQL adapter requires a LISTEN-compatible connection; actual platform pooling needs review.
- Image vulnerability/SBOM review, immutable release-digest approval, remote CI at the exact candidate, hosted backup/PITR/encryption, monitoring/alert delivery and operational drills remain pending. No remote CI run or production readiness is claimed.
- Auth attempt limits remain process-local; deployment-wide abuse controls need an approved ingress/shared-rate-limit design. Database-backed participant safety quotas were not disabled. This task did not implement an unrelated limiter service.
- Credential recovery/identity verification, retention/erasure/holds, operating owners and recovery objectives remain product/operational decisions in the linked policy/runbooks. No deadlines, provider, financial settlement or erasure rule was invented.

## Earlier acceptance work (historical; not rerun by this Docker follow-up)

## Changes made in the earlier task

- Root `Dockerfile` now separates application runtime stages from build tooling. Backend uses pnpm 9 production deployment with explicit `dist` package allowlists in backend/database manifests; Next apps use standalone tracing with the monorepo root and minimal Node server entrypoints. Migration tooling has its own opt-in `migrate` target. Compose now selects that target.
- Both Next configs enable standalone output; public/static assets are copied explicitly for the frontend, and admin static assets are copied. Runtime stages use `node`, JSON-form entrypoints, existing health checks and preserved restart/signal configuration. Actual image non-root behavior remains unverified without Docker.
- `.dockerignore` adds private-key/certificate/database/store exclusions to the existing environment/upload/Git/test-data exclusions. No image was built, so a final image inventory and vulnerability scan remain required.
- Local standalone builds revealed Next automatically copies loaded `.env` files into generated output. `scripts/sanitize-standalone.mjs` removes only those generated copies, rejects sensitive key files/links and leaves developer environments untouched. It removed two generated copies without printing their contents. Docker context already excludes `.env`; both image builds and the verification runner now invoke the check. Local standalone output is not distributable until it passes this check.
- `.github/workflows/verify.yml` adds four Docker build targets after application verification, uses synthetic public build origins, does not push images, and checks non-root image configuration. Existing read-only repository permissions, frozen pnpm installation, isolated PostgreSQL, test artifacts and workflow triggers are retained. Branch protection was not changed.
- `scripts/acceptance-artifact-smoke.mjs` exercises task-owned native production artifacts with synthetic credentials/data and writes sanitized results. It does not claim to run containers or a TLS proxy.
- The browser acceptance source now exposes a named global runner and removes unused variables, making it lintable/reusable. Its twenty scenario behaviors are unchanged.
- Four requested reports were created: this report, operations acceptance, credential-recovery decisions and retention decisions. No password-reset flow, identity provider, retention deadline or deletion automation was invented.

## Actual verification in the earlier task

| Check | New result / evidence |
| --- | --- |
| Full backend suite | 357 passed, 40 files, zero failed/skipped. Includes 50 real PostgreSQL tests: 21 admin dispute/auth + 2 refresh concurrency + 3 moderation + 17 participant safety/portfolio + 7 tests spawning two distinct backend processes. `tmp/backend-tests.json`. |
| Admin | 25 tests passed across four files. |
| Frontend | 50 Vitest tests across six files plus four Node tests passed. This is 54, not an increased total from packaging work. |
| Lint/types/builds | Full release runner executed all apps' lint and TypeScript, Prisma generation/compilation, Nest production build, Next typegen and both standalone production builds. One preexisting backend unused-disable warning remains. Three browser-helper lint warnings were then fixed; final frontend lint passed. A post-browser type check initially hit a malformed generated development route file; after stopping development servers and running Next typegen, both app TypeScript checks passed again. This generated-file failure is recorded rather than presented as a successful check. |
| Migration rehearsal | Fresh task-owned loopback PostgreSQL 18.2 cluster, randomly named `_test` DB; all 14 migrations applied and status/schema diff passed. Original cluster/databases and all prior restored snapshots preserved. |
| Production backend package | pnpm 9 `deploy --prod` completed in a new task-owned artifact directory; root lockfile unchanged. Compiled Prisma client loads. Typescript/ESLint/Vitest/Nest CLI are not resolvable as runtime packages. Deployment emitted Windows optional bin-link warnings; final image/store inventory and Linux execution are still required. |
| Native production artifacts | 13 smoke checks passed: packaged Prisma load, absence of four runtime tool entrypoints, API/DB readiness, synthetic authentication, production cookie attributes, exact allowed/denied CORS headers, persisted logout revocation, and both standalone login pages. `tmp/final-acceptance-artifact-smoke.json`. These are native Windows processes, not Linux images. Cookie attributes over HTTP do not prove HTTPS browser behavior. |
| Browser/API | 20 fresh Chrome API journeys passed through the real backend and isolated DB, with a local development marketplace origin. They include both registrations/logins, onboarding/approval/discovery/connection, messages, assignment negotiation/acceptance/delivery/revision, claims/mismatches, admin review/reopen/completion, block/report/frozen writes, cancellation arbitration, private support, document denial and logout/revocation. `tmp/final-acceptance-browser.json`. They are not twenty rendered HTTPS staging UI journeys. |
| Backup/restore | Fresh logical restore into a new DB matched 28 tables/17 rows at that snapshot, validated constraints, passed migration status and zero drift. This includes synthetic artifact authentication data; later browser fixture counts differ. `tmp/staging-backup-rehearsal.json`. No shared/staging backup, encryption, PITR or remote upload is claimed. |
| Compose | Updated file validates with `config --quiet` using placeholder-only input and empty CLI configuration. No expanded secrets were printed. |
| Docker | Explicit local engine version probe failed: `npipe:////./pipe/docker_engine` does not exist. No image build, container start, container HTTPS/auth/socket/restart test or image scan succeeded. |
| Remote CI | No authenticated GitHub connector/CLI or approved token was available. The candidate/workflow is untracked/uncommitted; running a remote committed revision would not verify it. No dispatch, push or remote success claim. Local workflow structure/build-target validation does not equal a hosted run. |

Pinned dependency checks used pnpm 9.0.0 and the existing lockfile. A frozen reinstall completed with resolution skipped; the sandbox initially selected a different package store, so the check was completed using the populated store with approved registry access. No source/lockfile replacement was used to make installation succeed.

Exact commands/evidence:

```sh
node scripts/provision-security-test-db.mjs
node scripts/verify-release.mjs --isolated-state
node <installed-pnpm-9.0.0-bin> --filter @porisrom/backend deploy --prod tmp/acceptance-backend-runtime-verified
node scripts/sanitize-standalone.mjs
node scripts/acceptance-artifact-smoke.mjs
node scripts/rehearse-security-backup.mjs
docker --config tmp/docker-empty-config --host npipe:////./pipe/docker_engine version --format '{{.Server.Version}}'
docker --config tmp/docker-empty-config compose --env-file deploy/staging.env.example -f deploy/compose.staging.yml config --quiet
```

`tmp/release-verification.json` records workspace commands/exit codes; `tmp/final-acceptance-regression.log` contains this task's full run. The sanitizer was added after that full run and executed separately; no cached/resume result is substituted for the new run. The isolated wrapper seeded synthetic browser accounts and ran backend/development frontend for browser tests; raw tokens stayed in process/browser memory and were never output. Do not upload temporary DB state, dumps, private files or complete server logs as general artifacts.

## Gate matrix

Only the requested status vocabulary is used. “Target environment” means actual authorized staging, which was not supplied. Responsible roles require assignment/approval; none are invented individuals.

| Gate | Status | Evidence / exact verification | Remaining risk / required owner or approval | Blocks staging? | Blocks production? |
| --- | --- | --- | --- | --- | --- |
| Existing security/product regressions | PASS — local simulation only | Fresh 357 backend/50 PG, 25 admin, 54 frontend tests; prior private-storage/session/moderation/audit/dispute suites retained | Repeat through actual deployed ingress; security/release owner | Target acceptance still required | Yes until target acceptance |
| Native runtime packaging | PASS - local simulation only | Native artifact smoke plus final Linux non-root/filesystem inspection and successful runtime/browser execution | Immutable-digest approval and vulnerability/SBOM review; release/security owner | No for packaging gate | Target review still required |
| Docker build/execution | PASS - local simulation only | Three app plus utility images built; six healthy services, 45 browser checks, 22 release commands and retained-data six-service restart passed | Actual platform ingress/storage/operations gates remain; infrastructure owner | No for local Docker gate | Target acceptance still required |
| Real cloud/private storage | BLOCKED — external access or approval missing | Local authorization/path/cache/provider-error regressions passed; no real provider calls | Explicit staging cloud account/namespace/credentials authorization; storage/security owner | Yes | Yes |
| Reverse proxy/CDN/HTTPS cookies | BLOCKED — external access or approval missing | Local trusted-CA HTTPS/CORS and browser cookie/logout checks passed; actual CDN/ingress not supplied | Approved real hosts/TLS/ingress and cache rules; provider-expiry and deployment-domain tests | Yes | Yes |
| Shared realtime in deployment | BLOCKED — external access or approval missing | Seven separate-process tests plus distinct-container WSS/revocation/replay/concurrent-review checks passed locally | Real ingress, LISTEN-compatible connection, affinity/upgrades and outage/drain verification; backend/infrastructure owner | Yes for multi-instance acceptance | Yes for multi-instance launch |
| Migration/restore local rehearsal | PASS — local simulation only | Fresh 14 migrations, zero drift; separate restored DB with matching fingerprints/constraints | Actual platform upgrade/partial-failure/restore approval and evidence; database owner | Target rehearsal required | Yes |
| Remote CI | BLOCKED — external access or approval missing | Workflow inspected/improved; local equivalent ran; no hosted run URL | Authorized exact candidate publication/dispatch by owner; pushing prohibited in this task. Configure required check names through separate approval | Yes for promotion | Yes |
| Hosted backup/PITR/encryption | BLOCKED — external access or approval missing | Local logical restore only; requirements reviewed | Approved storage/key custody, managed platform access and measured restore; database/infrastructure owner | Yes for operations acceptance | Yes |
| Monitoring/on-call/recovery objectives | DECISION REQUIRED — product or operational policy is undefined | Signals/runbooks reviewed; no alert destination or approved RPO/RTO | Assign operators/contacts/thresholds and demonstrate alert/incident/rollback drills | Yes for operations acceptance | Yes |
| Credential recovery/appeals | DECISION REQUIRED — product or operational policy is undefined | Private support remains separate; policy decision document prepared | Approve identity evidence/provider/locked-out intake and security design; product/security/support | No for disposable synthetic scope | Yes |
| Self-service recovery implementation | NOT IMPLEMENTED — work does not exist | No password-reset token/provider flow is enabled | Implement and test only after approved recovery decisions | No for synthetic scope | Yes unless an approved alternative meets acceptance |
| Data retention/erasure/holds | DECISION REQUIRED — product or operational policy is undefined | Category/owner/access/options/backup questions documented; no deletion job enabled | Product/privacy approval and separately reviewed cleanup implementation | No for synthetic-only staging | Yes for real personal/financial data |
| Overall actual staging acceptance | BLOCKED - external access or approval missing | Local Docker build/runtime/regression/browser/restart gates passed; external staging and operations remain unverified | Close approved target ingress/cloud, exact-candidate CI and operational gates; no deployment authorized here | Yes | Yes |

## Precise external handoff

Cloud: supply an approved staging-only cloud identity/namespace and HTTPS ingress/CDN configuration. Execute the existing environment guide's fourteen-case matrix with synthetic PDF/image files: public photo/logo; private owner/admin/wrong-account/anonymous; encoded/traversal/alternate delivery; real signed expiry; cache headers and unauthorized second-browser cache access; exact size/type/count boundaries; permitted replacement and unrelated-object preservation; provider/DB/delete failures; retries; no production local fallback. Record statuses and expiry/cache observations without retaining signed URLs or document bodies in general logs. A mock redirect cannot close this gate.

Docker: follow [operations acceptance](PORISROM-STAGING-OPERATIONS-ACCEPTANCE.md#safe-container-rehearsal-handoff) and the existing environment guide with a unique task project and retained volumes. No volume deletion, database reset or automatic migration on every replica. Use the dedicated migration target, verify schema first, then smoke actual images/TLS/sockets/restart/drain. Final image scans and immutable digests need owner approval.

CI: preserve stable `verify` job identity and review new image-matrix status names before making them required. Workflow allows push/PR/manual dispatch, read-only contents permission, lockfile-keyed pnpm store caching (not cached node_modules), isolated PostgreSQL health checks and seven-day sanitized test artifact retention. Docker jobs build locally on hosted runners without registry pushes or production secrets. No repository settings were changed. An owner must publish the reviewed full dirty/untracked candidate outside this task's no-push boundary before an exact-revision hosted run can be accepted.

Policy/operations: approve the [recovery decisions](PORISROM-CREDENTIAL-RECOVERY-POLICY-DECISIONS.md), [retention decisions](PORISROM-DATA-RETENTION-POLICY-DECISIONS.md) and [operations ownership/evidence](PORISROM-STAGING-OPERATIONS-ACCEPTANCE.md). Neither document authorizes account restoration, evidence deletion or production changes. Prior security controls remain mandatory during rollback and future integration.
