# Incident response and rollback

2026-10-28. Procedures are prepared; no real incident, platform rollback, alert delivery or production intervention was exercised. Assign an incident commander, security owner, database/storage owner and support contact before accepting real users. Keep evidence in restricted storage; general logs/tickets must not contain tokens, signed URLs, documents or unnecessary personal data.

## Detection and monitoring

API liveness `/health` is process-only. `/health/ready` checks PostgreSQL and, when enabled, a subscribed PostgreSQL Socket.IO adapter and expected peer count; it returns sanitized 503 on failure. Monitor marketplace `/auth/login` and admin `/login` independently. A healthy API does not prove UI, external storage or mail readiness.

New global HTTP exception signals contain only event, method, route template and status. They omit raw URL/query, bodies, headers, private IDs, provider messages and database error text. Backend startup logs the listening port without a misleading localhost public URL. Frontend authorization no longer logs raw backend exceptions. Adapter errors log `realtime_backplane_unavailable`. Platform/reverse-proxy log redaction is still an operational responsibility.

| Signal | Required monitoring/response |
| --- | --- |
| API/UI availability and unexpected 5xx | Synthetic HTTPS checks, error/latency rates; alert on sustained outage using owner-approved thresholds. Use route templates, not raw paths. |
| Database availability / exhaustion | Readiness failures, `pg_stat_activity` connection utilization, rejected/queued connections, slow queries, storage/WAL pressure. Include four adapter connections per API instance in the budget. |
| Authentication / refresh reuse | Track 401/403/409/429 by auth route and security replay events without token values. Investigate repeated reuse; do not weaken replay handling to suppress alerts. |
| Logout / session revocation | Alert on `/auth/logout` 5xx and failed admin moderation; verify persisted revoked state and socket disconnection. Clients retain credentials and display failure if logout cannot revoke. |
| Socket failures | Backplane error event, readiness/peer count, connection/reconnect failures, disconnect latency. Check database LISTEN support and load balancer affinity/upgrades. |
| Private storage / uploads | Upload route 5xx/failure rates, provider availability, authorized synthetic download probes, cleanup reconciliation. A failed cleanup may leave a private orphan and needs restricted manual review. |
| Claims/disputes/cancellation/support | Endpoint errors, stale/open queue review, conflict rates; separate state conflicts from failed persistence. No automatic monetary outcome. |
| Audit persistence | Failed admin route mutations/5xx and database errors; required mutations roll back with their audit inserts. Alert recipients must be operators with private evidence access. |
| Backup integrity | Missing/failed/stale backups, checksum/decryption/restore failures and untested recovery objectives. |

The repository supplies signals and health checks, not a hosted collector/alert destination. Configure and actually test notifications before production. Alert thresholds and escalation ownership require operator approval; no invented service-level promise is made.

## Response playbooks

| Incident | Containment and investigation | Recovery/verification |
| --- | --- | --- |
| Account compromise | Authorized admin block affected account, revoke sessions through existing persisted controls, preserve audit/history. Identify affected session range without copying tokens. | Verify both HTTP denial and cross-instance socket disconnection; use approved identity verification before any recovery. Unblocking must not revive old sessions. |
| Refresh abuse | Preserve sanitized timing/session evidence, revoke compromised sessions/account as appropriate. Do not disable CAS rotation/replay revocation. | Reauthenticate verified owner after approved recovery; prove revoked refresh/access tokens and reconnects fail. Secret rotation needs a reviewed coordinated plan and may invalidate all sessions. |
| Private document exposure | Restrict affected ingress/CDN routes and provider object delivery immediately; preserve evidence; revoke exposed signed access where provider permits. Never make private files public to restore availability. | Test owner/admin/wrong-user/anonymous/encoded paths, cache bypass and signature expiry through actual ingress. Assess notification/legal obligations with responsible specialists. |
| Unauthorized admin action | Suspend compromised administrator, revoke sessions; preserve append-only case/work/audit history and backups. Review before/after states and affected entities. | Authorized compensating decisions with reasons; never erase logs to conceal activity. Recheck role/status and audit durability. |
| Payment/cancellation dispute | Escalate to authorized private review queue with assignment/payment/claim history. No automated refund, penalty, transfer or bank settlement. | Use explicit reasoned audited outcomes. Administrative completion remains distinct from verified payment; preserve claim evidence and participant notices. |
| Migration failure | Stop promotion, preserve migration logs and backup point, inspect ledger/current schema and failed transaction. Do not run reset/db push/edit checksums or mark failed work successful. | Reviewed forward repair on isolated clone first; `migrate resolve` only under a separately approved recovery plan reflecting actual DB state. Validate schema/checksums and regression suite before resuming. |
| Application regression | Stop promotion/drain affected writes as needed. Select last **security-compatible** immutable artifact and retained schema. | Restore application artifact only after compatibility review. Pre-blocking binaries ignore new safety restrictions; isolate marketplace writes rather than roll back to them. Database rollback/restore is a separate authorized change. Verify revoked sessions and private-file denial after rollback. |
| Storage outage | Surface failed upload/download truthfully; keep prior private metadata/evidence. No production local fallback. | Restore provider connectivity; retry only failed work; reconcile old/orphan assets under an approved retention policy, not bulk deletion. |
| Realtime outage | Fail readiness when backplane/subscription/expected peers fail. REST persistence/polling remains recovery path; retain per-request/session checks. | Reconnect through shared adapter, verify logout/moderation across two instances, historical reads and exactly-once persistence. Never deploy memory rooms across multiple instances. |

## Audit durability and export

Required administrative mutation and `AdminActionLog` creation are in the same Prisma transaction; failures reject and roll back rather than report success. Case decisions also append `SafetyCaseEvent`; cancellation appends `WorkAssignmentEvent`. Logs contain actor ID, timestamp, action/entity references and minimal before/after metadata; required reasons live in durable decision/event history. Existing dispute audits include full explicit before/after state and reason. No public report endpoint exposes reporter details to the target.

Admin history is read only through admin-authorized routes/UI. Operational exports must preserve actor, timestamp, entity, operation, reasons and ordering in restricted encrypted storage; no public export endpoint or externally immutable audit sink is introduced. Application-level immutability is not a database privilege/trigger guarantee: the DB owner can still alter records. Retention periods, legal holds, audit export approval and offsite immutable storage remain policy/infrastructure gates. Back up audit/case/work history together with related records.
