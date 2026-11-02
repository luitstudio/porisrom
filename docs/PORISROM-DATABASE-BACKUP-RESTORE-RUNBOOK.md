# Database backup and restore runbook

2026-10-28. This task performed three logical backup/restore rehearsals on a new loopback-only disposable PostgreSQL 18.2 cluster. It did not back up or mutate shared/staging/production databases.

## Ownership and policy gates

The infrastructure owner must approve backup frequency, retention, RPO/RTO, storage region/location, encryption/key custody, access roles and an alert recipient before production. No frequency or legal retention period is invented here. Managed physical snapshots/PITR may be preferable; PITR is **not configured or verified** in this repository. Confirm WAL archiving, recovery window and a restore exercise with the chosen platform. A logical dump alone does not establish PITR.

Encrypt backups in transit and at rest. Keep keys separate, restrict download/restore privileges, audit exports and test expiry/access. Database dumps include private report reasons, messages, payment claims, document identifiers and password/session hashes. Treat restored data with the same confidentiality as the source. Cloud assets are a separate backup/deletion dependency: a PostgreSQL restore cannot recreate an object deleted at the provider. Retention/deletion holds must propagate to backups according to an approved policy.

## Authorized operator procedure

1. Identify the exact cluster, database, environment, server version and data directory using a read-only connection. Compare against the approved change ticket. Record application version and migration ledger without credentials. Pause conflicting schema changes; a single `pg_dump` uses a consistent snapshot, but separately captured external assets need a coordinated manifest.
2. Use a compatible `pg_dump --format=custom --no-owner --no-acl` with credentials supplied through the secret manager/secure client mechanism, never command-line URLs or shell history. Exclude only data in `public.socket_io_attachments` (short-lived socket transport); retain its schema. Do not exclude audit, financial, report or session records.
3. Encrypt and checksum the dump immediately, store under the approved access/retention policy, verify upload integrity, and alert on job failure/staleness. Do not log the dump, password or connection URL.
4. Restore into a **new isolated database** with matching extensions/version and restricted networking using `pg_restore --no-owner --no-acl --exit-on-error`. Never use `--clean`, overwrite a live DB, drop shared databases, or restore into production during a drill.
5. Verify table row counts/fingerprints, validated foreign keys, indexes and unique constraints, migration checksums/order/completion, `prisma migrate status` and schema diff. Check representative synthetic login/session, private-document denial, assignment/payment history and admin audit reads. If restoring real data, revoke restored sessions and disable outbound integrations in that isolated environment under an authorized recovery plan; do not accidentally send notifications or cloud deletions.
6. Record recovery duration, integrity evidence and failed checks. Application cutover requires a separately approved incident/release decision and security review. Reconcile DB object references with storage, and confirm no older snapshot re-enables compromised users/sessions or removes moderation decisions.

## Executed local rehearsal

`node scripts/rehearse-security-backup.mjs` verifies the task-owned state file and real server data directory before doing anything. It uses a native custom-format dump, creates a fresh randomly named `_test` restore database, restores without overwrite, compares sorted JSON fingerprints for all 28 non-ephemeral tables, checks constraint validation, migration status and schema drift. Source data, old databases and all volumes are preserved. Dumps remain in the task-owned OS temporary directory and are not CI artifacts.

Actual first rehearsal: **28 tables / 49 rows matched**, constraints validated, migrations passed, no schema drift; ephemeral socket payload data excluded. Evidence: `tmp/staging-backup-rehearsal.json`. The row count describes that snapshot only, not later browser fixtures. Two later rehearsals, including the final post-browser snapshot, matched 28 tables with 328 and 380 rows respectively; both also passed constraints, migration status and schema-drift checks. This does not verify managed backups, encryption, remote upload, PITR, restore time objectives, or operational cutover. All remain staging/production gates.
