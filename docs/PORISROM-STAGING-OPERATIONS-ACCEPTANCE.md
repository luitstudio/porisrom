# Operations acceptance

Work began 2026-10-28; finalized 2026-10-29, Asia/Calcutta. Overall: **BLOCKED — external access or approval missing.** Refer to the [acceptance report](PORISROM-STAGING-ACCEPTANCE-REPORT.md) for exact local results. No staff names, alert addresses, recovery objectives, legal periods or platform credentials are invented.

## Backup and restoration

The [existing runbook](PORISROM-DATABASE-BACKUP-RESTORE-RUNBOOK.md) was reviewed. A fresh native PostgreSQL 18.2 rehearsal executed `node scripts/rehearse-security-backup.mjs` against this task's independently provisioned loopback `_test` database. It created a new restore database without `--clean`, compared 28 application/migration table fingerprints (17 rows at the snapshot), validated foreign keys, and passed migration status and zero schema drift. These rows included actual synthetic authentication/session data from the production-artifact smoke test. The source, restore databases and volumes were retained. Ephemeral socket payload data was excluded; its schema was retained.

Status: **PASS — local simulation only.** This is logical database consistency evidence, not proof of remote backup storage, encryption, cloud-asset restoration, PITR, cutover or agreed recovery time. Dump/state files stay outside the checkout and are not CI artifacts. No extra backup is required merely to repeat a historical count after browser fixtures change.

| Required operational decision | Current evidence / required approval |
| --- | --- |
| Backup/database owner and alternate | Role identified, person/contact unassigned; infrastructure owner must assign. |
| Frequency, retention, RPO and RTO | Undefined; product/infrastructure must approve. No numerical guarantee is made from local runtime duration. |
| Encryption and key custody | Required in transit/at rest, but remote configuration and key separation not supplied or tested. |
| Backup storage and integrity monitoring | No approved bucket/location/identity/alert destination. Supply restricted storage and verify checksum/encrypted upload/restore. |
| PITR | No managed provider/WAL recovery configuration verified. Determine availability and restore window with platform owner. |
| Cloud objects and deletion holds | DB dump preserves references, not file bytes. Coordinate provider versions/exports/holds and retention decisions. |
| Release/restore authority | Production cutover and any shared database change require separate explicit approval. A local rehearsal supplies neither. |

## Monitoring acceptance

No hosted collector or alert destination is established. The following checks define the required evidence, not an assertion that alerts were delivered. Use read-only, least-privilege monitoring and aggregated counts; never put passwords, session tokens, query signatures, report reasons or document bytes in telemetry.

| Signal | Existing implementation / exact acceptance exercise | Responsible role |
| --- | --- | --- |
| API availability | `/health` liveness and `/health/ready` DB/backplane readiness. Production artifact returned success locally. Exercise dependency failure through actual ingress and verify alert delivery. | Infrastructure/backend |
| Frontend/admin availability | Native standalone login pages returned 200 locally. Probe both public HTTPS hosts plus a representative static asset; verify DNS/TLS/proxy error alert. | Infrastructure/frontend |
| Database connectivity/exhaustion | Readiness denies failed DB access; monitor connection utilization/limits with platform metrics. Budget API plus up to four adapter connections per instance; test exhaustion only on an isolated service. | Database owner |
| Auth failures/reuse | Sanitized auth-route 401/409/429 signals; persisted `AuthSession.reuseDetectedAt` supports restricted aggregate monitoring. No dedicated hosted reuse metric/alert was verified. Exercise synthetic replay, confirm revocation and alert correlation without logging the token. | Security/backend |
| Session revocation failures | Monitor logout/admin mutation failures; clients must retain credentials/report failure when revocation fails. Inject DB failure on isolated services and prove alert plus truthful UI response. | Security/operations |
| Sockets | `realtime_backplane_unavailable`, peer/subscription readiness and connection/reconnect metrics. Seven fresh separate-process integration tests passed. Actual ingress affinity/upgrades, partition recovery and container drain remain unverified. | Backend/infrastructure |
| Storage/uploads | Track upload/private-file route failures and approved provider metrics. Exercise provider errors, signed expiry, old-object cleanup and cache bypass using authorized staging objects. | Storage owner/security |
| Payment/dispute/cancellation failures | Route/template error rates, state conflicts and private review queue monitoring. Distinguish expected conflicts from persistence failure; never infer bank settlement. | Finance/dispute owner |
| Audit writes | Administrative transactions roll back if audit insertion fails; regression passed. Exercise isolated audit failure and verify on-call signal. Route 5xx alone does not identify every audit root cause; restricted DB investigation is required. | Security/database owner |
| Unexpected 5xx | Global HTTP error signals omit request bodies/headers/raw URLs and error objects; logging regression passed. Proxy and platform logging must be independently inspected and redacted. | Operations/security |
| Backup health | Alert on job failure, missing/stale approved backup, integrity/restore failure. Thresholds and recipient require approval. | Database/on-call owner |

## Incident and rollback review

The [incident runbook](PORISROM-INCIDENT-RESPONSE-RUNBOOK.md) covers compromise, refresh abuse, private-file exposure, unauthorized admin actions, financial disputes, migration failure, storage/realtime outages and compatible application rollback. For database failure: isolate affected writes, preserve evidence and storage, verify cluster identity/health/capacity, select the approved backup/PITR point, restore into a new isolated environment, validate schema/data/session/moderation state, then seek explicit cutover approval. Never reset a shared database or restore compromised sessions into service.

Account containment must preserve histories and revoke HTTP/socket access. Privacy exposure containment must preserve evidence and never make protected files public as an availability workaround. Administrative payment completion is separate from actual settlement. A pre-safety binary ignores user blocks; rolling back to it while accepting marketplace writes is unsafe. An application rollback must retain compatible schema/security behavior; database restore is a separate authorized operation.

Missing operational acceptance: incident commander and alternates; database/storage/release owners; support/moderation/dispute queue operators; private escalation channel; alert destinations and thresholds; credential-provider contact; backup/key custody; approved recovery objectives; authority to drain/isolate/cut over; and an actual platform incident/rollback drill. No alert delivery, real incident exercise or hosted release rollback was performed.

## Safe container rehearsal handoff

Docker is installed but the explicitly selected local `docker_engine` named pipe has no daemon. Existing Docker Desktop/shared services were not started. Do not change context to an unidentified remote engine or start shared containers as a workaround. Once an authorized isolated local daemon is available:

1. Use a unique project identifier, task-owned volumes/networks and synthetic credentials. Configure trusted local test TLS, exact HTTPS test origins and host resolution without reusing production domains or credentials. The guide's placeholder file is not runnable configuration.
2. Build `backend`, `frontend`, `admin`, `migrate` targets with the pinned lockfile. Inspect non-root user, entrypoint, image history and file inventory; check no `.env`, private keys, source databases or unnecessary build tooling are present. `migrate` intentionally contains Prisma tooling; application images do not inherit the build stage.
3. Start only the new PostgreSQL service; verify its identity, apply migrations via the opt-in migration job and inspect all 14 checksums/FKs/indexes. Start applications after successful schema verification. No reset command or volume deletion is part of the procedure.
4. Verify health, actual TLS cookie persistence, BFF authentication/logout, CORS denial, uploads, static assets, sockets and all acceptance journeys. Native HTTP cookie-attribute checks do not establish browser Secure/SameSite behavior.
5. Use an operator-reviewed ingress override to route two backend instances without conflicting fixed host ports. Set the adapter prefix/expected peer count, supply session-mode PostgreSQL, and verify cross-instance logout/moderation, revoked reconnect denial, historical reads and single persistence. Also exercise backplane outage/recovery.
6. Send graceful stop/restart only to task-owned services. Verify bounded shutdown, readiness recovery and no duplicate operations/data corruption. Stop services at the end while retaining volumes and database contents; do not use volume-removal flags.

Authoritative command templates remain in the environment guide. All populated paths, TLS settings, engine context and actual service ownership must be reviewed before execution. No container simulation or remote staging acceptance is claimed by this handoff.
