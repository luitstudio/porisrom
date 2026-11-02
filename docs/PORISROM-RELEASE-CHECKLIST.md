# Release gate checklist

2026-10-28. This checklist is not deployment authorization. No push, deployment or production mutation occurred. Status/evidence is in the [readiness report](PORISROM-STAGING-READINESS-REPORT.md).

## Local candidate gates

- [x] Preserve preexisting dirty/untracked fixes and migrations; inspect branch/diffs before work.
- [x] Approved block/read-only, cancellation and support policies implemented without financial settlement.
- [x] Real PostgreSQL duplicate/race/audit rollback tests and separate-process realtime tests pass.
- [x] Full local test/lint/type/build runner passes; historical private-storage/session/moderation/payment tests retained.
- [x] Frozen pnpm 9.0.0 install succeeds in a separate candidate snapshot without secrets/build output.
- [x] Fourteen migrations applied to isolated PostgreSQL; status and schema diff pass.
- [x] Local backup restored into a new isolated database with table fingerprints and constraint/schema verification.
- [x] Compose configuration parses without printing expanded secrets.
- [ ] Docker images built, scanned and started with non-root runtime/health/start ordering verified. **Blocked: no daemon.**
- [ ] Remote CI result recorded for the release candidate. Workflow prepared; **not pushed/run remotely**.

## Staging acceptance (authorized operator)

- [ ] Supply actual HTTPS hosts, proxy configuration, exact CORS and independently generated secrets via secret manager; verify build-time public API URL and cookie behavior.
- [ ] Approve the target database, verify identity/backup point and rehearse migration against a new isolated clone before applying it to staging.
- [ ] Verify all fourteen migration checksums, completed ledger, constraints/indexes and zero drift on staging.
- [ ] Build/start all images; verify UI/API readiness, restarts, graceful drain and limits with real deployment settings.
- [ ] Execute [private storage matrix](PORISROM-STAGING-ENVIRONMENT-GUIDE.md#private-storage-acceptance) against authorized synthetic staging objects through actual ingress/CDN, including five-file upload, provider errors and expiry.
- [ ] Repeat two-instance logout/moderation, revocation reconnect denial, no duplicate persistence, load-balancer affinity and backplane outage recovery through staging ingress.
- [ ] Run all twenty browser API journeys and actual rendered onboarding/safety/support/admin/cancellation/logout UI tests. Local HTTP development evidence does not verify staging Secure/SameSite/proxy behavior.
- [ ] Rehearse expired admin access/refresh and multiple tabs under the actual HTTPS proxy; confirm failed revocation never claims successful logout.
- [ ] Validate observability and alert delivery to named operators; verify no secrets/private documents in logs/CDN caches.
- [ ] Record acceptance evidence with environment, release artifact digest, timestamp, tester and exact result; keep credentials and signed URLs out of artifacts.

## Production acceptance

- [ ] All staging gates accepted; no unresolved P0 or owner-rejected P1.
- [ ] Product/security owners approve usable credential/identity recovery and blocked/deleted appeals process. Authenticated support alone does not solve account lockout.
- [ ] Approve retention/erasure/holds for every category in the [inventory](PORISROM-REMAINING-PRODUCT-REQUIREMENTS.md#retention-inventory), including backups/provider assets and orphan reconciliation.
- [ ] Infrastructure owner approves RPO/RTO, backup schedule/retention/key custody, PITR availability and a measured restore drill on the chosen platform.
- [ ] Assign support/moderation/dispute queue owners and review/incident escalation expectations; no cancellation deadlines or penalties are defined by this release.
- [ ] Pin/scanned images and dependency risk review accepted; remote CI for exact release artifact passed.
- [ ] Security-compatible rollback and incident procedures rehearsed; pre-safety binaries prohibited from accepting marketplace writes.
- [ ] Separate explicit authorization to deploy and modify production obtained. This task does not supply it.

Launch verdict remains **conditional staging candidate; not staging accepted or production ready** until the external gates have evidence.
