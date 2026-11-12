# Real staging acceptance plan

Prepared 2026-11-03, Asia/Calcutta. This is the execution plan for the next phase after the local Docker acceptance recorded in [the staging acceptance report](PORISROM-STAGING-ACCEPTANCE-REPORT.md). It does not authorize deployment, infrastructure mutation, secret creation, or production promotion.

## Purpose and release rule

The candidate has local evidence for the application, Docker images, two API instances, isolated PostgreSQL, synthetic HTTPS ingress, backup/restore consistency and browser workflows. That evidence is necessary but is not evidence for a real cloud provider or hosted platform.

Record each staging result in restricted release evidence with its candidate Git SHA, immutable image digest, target hostname, date/time, operator, test account namespace, sanitized command result and pass/fail result. Do not store secrets, document bytes, signed URLs, session cookies, bearer tokens, database URLs or raw provider errors in general tickets, CI artifacts or this repository.

Staging is accepted only when every staging-blocking row below passes or has an explicit, time-bounded release-owner exception. Production is blocked by every production-blocking row; a local substitute is not an exception.

## Required access before execution

| Access or credential | Minimum scope | Needed for |
| --- | --- | --- |
| Staging Cloudinary cloud name, API key and secret | Separate staging-only cloud/namespace; upload, authenticated private delivery and deletion/replacement permissions only | Private document matrix and provider-failure evidence |
| Staging DNS, TLS and ingress/CDN control plane | Read access plus approved change authority; HTTPS hosts for marketplace, admin and API | Domain, certificate, cache, routing, WebSocket and failure tests |
| Staging secret manager | Read access only for runtime identities; audit trail; no secrets in repository | Runtime configuration and rotation verification |
| Staging PostgreSQL and platform database controls | Migration role, read-only diagnostic role, approved backup/PITR/restore role and session-compatible connections | Migration rehearsal, Socket.IO adapter, backup/PITR and restore drill |
| Staging compute/orchestrator and logs | Deploy/scale two backend replicas, controlled drain/restart, restricted logs and metrics | Multi-instance, outage and recovery acceptance |
| Image registry and CI security tooling | Pull by digest, workflow visibility, SBOM/scan/signing or attestation access | Hosted CI, provenance, SBOM and vulnerability review |
| Monitoring, alerting and incident channel | Configure synthetic probes and test alert delivery to named responders | Alert, incident and rollback drill |
| Authorized synthetic test accounts/files | Two marketplace roles, one admin and non-sensitive PDFs/images; documented cleanup authority | All browser/storage/workflow tests |
| Product/security/operations approvers | Named authority for unresolved policy decisions and release exceptions | Recovery, retention, ownership and production gate decisions |

Never use a production Cloudinary cloud, production database, customer records or personal identity documents for staging acceptance.

## Acceptance checklist

### 1. Cloudinary and private storage

| Item | Detail |
| --- | --- |
| Current implementation/evidence | Backend separates private documents from public assets, rejects public/private root overlap and uses authenticated private storage; local fallback is rejected in production. Local authorization/path regressions and Docker workflows passed. See [environment guide](PORISROM-STAGING-ENVIRONMENT-GUIDE.md#private-storage-acceptance). |
| Missing or unverified | Real Cloudinary upload, authenticated delivery, signed expiry, CDN cache denial, replacement/deletion/orphan handling, provider quota/error behavior and ingress upload-size behavior. |
| Required access | Staging Cloudinary credentials/namespace, staging HTTPS hosts, synthetic accounts and restricted provider audit logs. |
| Exact acceptance criteria | Owner and authorized admin can upload/download only their permitted synthetic documents; anonymous, wrong-user, encoded-traversal, legacy static-path and alternate-delivery requests are denied. Responses for private documents are not publicly cacheable. Signed/private access expires as configured. Replacing a document preserves authorization and produces an auditable provider/DB outcome; any orphan is recorded for approved reconciliation. Five one-MiB company PDFs and profile-image limits behave as documented through ingress. |
| Test/command | Run every case in the private-storage matrix through the deployed HTTPS hosts using synthetic files. Capture only status/cache headers/expiry outcome and redacted provider IDs. Run the existing release regression before and after: `node scripts/verify-release.mjs`. |
| Release effect | Blocks staging and production. |

### 2. HTTPS, CDN, ingress and production-like configuration

| Item | Detail |
| --- | --- |
| Current implementation/evidence | `deploy/compose.staging.yml` requires exact HTTPS origins, secure runtime values, loopback-only app bindings and disabled local KYC fallback. Local trusted-CA ingress checked allowed/denied CORS, cookies, login/logout and unknown-host rejection. |
| Missing or unverified | Actual DNS, public certificate chain, host routing, CDN cache rules, upload ceilings, cookie/SameSite behavior on real domains, WAF/rate-limit behavior and platform drain/outage behavior. |
| Required access | DNS/TLS/ingress/CDN configuration, secret manager, staging runtime deployment/read-only diagnostics and approved synthetic hosts. |
| Exact acceptance criteria | Marketplace, admin and API hosts use valid trusted HTTPS certificates; unknown hosts are rejected; only configured exact origins receive CORS approval; secure/HttpOnly/Lax cookies work for browser login/logout; private routes/files never receive public CDN caching; public assets retain expected cache behavior; no backend/admin port is public except through approved ingress. |
| Test/command | Operator validates configuration without printing secrets: `docker compose --env-file <operator-owned-staging-env-file> -f deploy/compose.staging.yml config --quiet`. Then run deployed synthetic browser/API checks through each public host and capture `curl --fail --show-error --silent --head` responses for `/health`, `/health/ready`, marketplace/admin login pages and allowed/denied preflight origins. |
| Release effect | Blocks staging and production. |

### 3. Multi-instance WebSocket behavior

| Item | Detail |
| --- | --- |
| Current implementation/evidence | PostgreSQL Socket.IO adapter, peer-aware readiness and cross-instance session/account disconnect behavior are implemented. Seven separate-process tests and two Docker backend replicas passed locally. |
| Missing or unverified | Real load-balancer upgrade/affinity settings, managed PostgreSQL LISTEN/NOTIFY compatibility, platform connection limits, rolling-drain behavior and recovery after adapter/database interruption. |
| Required access | Two staging backend replicas, ingress/load-balancer controls, database session configuration/metrics, controlled restart/drain authority and synthetic test accounts. |
| Exact acceptance criteria | With `SOCKET_ADAPTER=postgres` and `REALTIME_EXPECTED_INSTANCES=2`, both replicas are ready only after adapter subscription/peer discovery. A client connected to replica A receives exactly one message persisted through replica B. Logout or moderation from B disconnects/rejects the A connection; historical reads retain their documented permissions. Refresh replay has one winner and denied replays. Draining/restarting a replica produces no duplicate persistence and reconnects only under current authorization. Backplane outage degrades readiness and recovers without bypassing authorization. |
| Test/command | Deploy two backend replicas with a unique `SOCKET_CHANNEL_PREFIX`; execute the existing realtime regression against staging-only test configuration: `pnpm --filter @porisrom/backend exec vitest run test/realtime-cluster-postgres.spec.ts --maxWorkers=1`. Repeat the browser cross-instance workflow through ingress while intentionally draining one replica and, only in an approved window, interrupting adapter connectivity. |
| Release effect | Blocks multi-instance staging acceptance and production launch. |

### 4. Provider failures, timeouts, retries and recovery

| Item | Detail |
| --- | --- |
| Current implementation/evidence | Storage errors fail closed; onboarding retains saved fields and completed uploads for retry; UI shows retry states in relevant workflows. Local regression and Docker browser coverage exist. |
| Missing or unverified | Real Cloudinary timeout/rate-limit/5xx semantics, CDN/upload timeouts, provider recovery, orphan reconciliation workflow, database transient failures and user-visible behavior through real ingress. |
| Required access | Staging provider diagnostics or approved fault injection, ingress timeout configuration, staging logs/metrics and controlled database/platform fault-injection window. |
| Exact acceptance criteria | A failed private upload never publishes a document or exposes a public URL. A transient failure is actionable, retryable and does not duplicate portfolio/document records. A timeout/5xx/rate limit produces a truthful failure rather than success. Recovery restores service without weakening private authorization; any partial provider object is either cleaned up under approved authority or recorded for reconciliation. Logout/revocation failures remain visible to the user and alert operations. |
| Test/command | Use provider-approved fault injection or a staging-only deny/throttle rule; do not alter application security checks. Exercise onboarding/settings upload retry, document replacement, login refresh and logout through HTTPS. Re-run `node scripts/verify-release.mjs` after any temporary platform change is removed; preserve sanitized traces/metrics only. |
| Release effect | Blocks staging and production. |

### 5. Hosted CI, image digests, SBOM and vulnerability review

| Item | Detail |
| --- | --- |
| Current implementation/evidence | GitHub Actions uses frozen pnpm installation, PostgreSQL release verification and non-pushed Docker target builds. Local Docker images and release checks passed. |
| Missing or unverified | Hosted run on the candidate revision; registry publication; immutable digest promotion; SBOM, vulnerability results, provenance/signature/attestation policy and remediation/exception process. |
| Required access | GitHub Actions/repository visibility, approved registry, CI security scanner/SBOM tool, artifact retention and release/security approver. |
| Exact acceptance criteria | A hosted CI run on the exact candidate SHA passes. The promoted image is referenced by immutable digest, not a mutable tag. A retained SBOM maps to each deployed digest. Vulnerability findings have severity thresholds, owner, disposition and approved exceptions; critical findings are resolved or explicitly release-blocking. Artifact provenance/signature requirements are recorded and satisfied if required by the organization. |
| Test/command | Trigger or review the hosted `Release verification` workflow for the candidate SHA. Build/publish through the approved registry pipeline, then record `docker image inspect <registry-image@sha256:...>` output with sensitive fields removed. Generate and scan SBOMs only with the organization-approved CI tooling; attach sanitized reports outside this repository. |
| Release effect | Does not block an isolated staging experiment if policy permits, but blocks production release. |

### 6. Backups, PITR, restore drills, alerts and incident recovery

| Item | Detail |
| --- | --- |
| Current implementation/evidence | Local logical backup/restore rehearsals compared all non-ephemeral tables, constraints, migrations and schema drift. Health/readiness signals and incident/backup runbooks exist. |
| Missing or unverified | Managed backup storage/encryption, backup schedules/retention, WAL/PITR configuration, recovery timing, cloud-object dependency restoration, alert recipients/thresholds and real incident/rollback drill. |
| Required access | Database provider backup/PITR controls, encrypted backup storage/key custody, restore sandbox, monitoring/alerting, incident channel and authorized cutover/drain authority. |
| Exact acceptance criteria | A recent encrypted backup is independently discoverable and its integrity is verified. PITR window and selected restore point are documented by the database provider. Restore into an isolated environment completes within approved RTO/RPO objectives, passes migration/status/schema checks, preserves required records and does not reactivate compromised sessions or send outbound traffic. Backup, readiness, synthetic availability, auth-reuse and adapter failures deliver alerts to named responders. A tabletop plus controlled staging rollback/restore drill has recorded decisions, timing and follow-up actions. |
| Test/command | First repeat the local evidence command only against its guarded isolated cluster: `node scripts/rehearse-security-backup.mjs`. For staging, use the platform-approved backup/PITR restore procedure into a new isolated target, then run `pnpm --filter @porisrom/database migrate:status`, schema-drift checks from the runbook and restricted synthetic login/history/private-document-denial checks. Trigger approved synthetic alerts for `/health/ready`, missed backup and adapter failure; verify delivery and acknowledgement. |
| Release effect | Staging backup/alert evidence blocks production; missing safe restore capability also blocks staging handling of real data. |

### 7. Outstanding product and policy decisions

| Item | Detail |
| --- | --- |
| Current implementation/evidence | Authenticated private support, moderation, disputes, cancellation escalation, audit records and bounded retention inventory are implemented. The recovery and retention reports explicitly avoid inventing policy. |
| Missing or unverified | Identity evidence and provider for credential recovery; blocked/deleted-account appeals; retention periods, lawful holds, verified erasure, provider/CDN purge and backup treatment; named support/moderation/dispute owners and review expectations; orphan cleanup authority; RPO/RTO and alert destinations. Applications scope, social sign-in and native attachments remain intentionally unapproved product work. |
| Required access | Product, security, privacy/legal, support, operations and finance/dispute decision makers with authority to approve policies. |
| Exact acceptance criteria | Written, owner-approved decisions define scope, data minimization, access controls, escalation authority, retention/hold/erasure behavior, recovery identity proofing, operating owners and measurable recovery objectives. The deployed behavior and user-facing copy are checked against those decisions. No unsupported promise (email recovery, appeal outcome, refund, settlement, deadline or complete erasure) is made. |
| Test/command | Review and approve [recovery decisions](PORISROM-CREDENTIAL-RECOVERY-POLICY-DECISIONS.md), [retention inventory](PORISROM-REMAINING-PRODUCT-REQUIREMENTS.md#retention-inventory), [operations acceptance](PORISROM-STAGING-OPERATIONS-ACCEPTANCE.md) and the release checklist. Record approval references in restricted release evidence; no code command can replace this gate. |
| Release effect | Blocks production. Some decisions—especially recovery/retention—also block staging if staging uses real personal data; synthetic-only staging may proceed only with explicit owner approval. |

## Prioritized execution plan

1. Assign the release owner and obtain the access listed above. Confirm staging is isolated, synthetic-only and has an approved rollback/backup point before deployment.
2. Lock the candidate SHA, run hosted CI, build/publish approved images, and record immutable digests. Do not promote a mutable tag.
3. Configure the staging secret manager and deployment using `deploy/staging.env.example` as a names-only inventory. Validate Compose with `config --quiet`; do not render its secret-expanded output.
4. Rehearse migrations against an isolated staging clone, then apply committed migrations through the opt-in migration job with an approved backup/PITR point.
5. Establish real DNS/TLS/ingress/CDN, deploy one backend replica, and complete HTTPS/cookie/CORS/private-cache acceptance.
6. Configure staging Cloudinary and execute the full private-storage and provider-failure matrix with synthetic files.
7. Scale to two backend replicas and complete the cross-instance WebSocket, drain and backplane recovery matrix.
8. Complete encrypted backup/PITR restore and alert-delivery drills. Update incident evidence with measured timings and owners.
9. Obtain outstanding policy approvals, resolve security findings, and conduct the staging release review. Production promotion remains a separate approval.

## Safe local preparation completed by this change

- This plan consolidates the existing handover, environment guide, acceptance report, release checklist and operations runbooks into one execution checklist.
- It introduces no runtime configuration, credentials, deployment action, product feature, migration or infrastructure change.
- Before an operator runs an external command, they must substitute only approved operator-owned paths/hosts and follow the applicable runbook.
