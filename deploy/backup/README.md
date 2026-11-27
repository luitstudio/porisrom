# Phase 2A: VPS-local encrypted backups

This is deliberately **VPS-only**. It creates no R2/S3/SFTP/rsync upload, remote replication, or hybrid backup path. Encrypted sets stay under `/opt/porisrom/backups/`; that directory must be on persistent VPS storage with capacity approved from a measured first backup.

## Contents and safety model

`porisrom-backup.sh` creates one immutable-by-convention set containing:

- `database.dump.age`: a PostgreSQL 18-compatible `pg_dump` custom archive. It preserves the `socket_io_attachments` schema but excludes only its ephemeral payload data, as in the existing rehearsal.
- `production_public_assets.tar.age` and `production_private_documents.tar.age`: archives streamed from the production backend's two mounted volumes.
- `manifest.sha256`, `metadata`, and an `INTEGRITY_VERIFIED` marker.

## Coordinator-authorized capture

The backup script no longer accepts a class argument. It accepts only
`--request /run/porisrom/backup-capture.request`, a non-symlink, root-owned
`0600` file in a root-owned `0700` directory. Its exact five-line format is
`job_id`, `lease_id`, `generation`, `class`, and `attempt_id`. Every value is
strictly validated; it is data, never shell input.

Before creating any artifact, the script uses its dedicated mTLS client
identity to claim and immediately validate that exact coordinator job. The
authoritative validation requires the matching quiescent maintenance
generation, job, lease, class, and attempt. `backupSafe=false` is expected
while this matching lease is held. The coordinator endpoint must enforce that
no unresolved storage operations exist; the script never accepts a global
`backupSafe` observation as a substitute for the exact lease binding.

Metadata binds every published set to the job/lease/generation/class/attempt.
The script writes an atomic, root-only result envelope under `results/` before
it reports: `succeeded` means only integrity-verified publication, while an
interruption before that durable write is retained as `uncertain` for
reconciliation. A report failure preserves the already-written envelope for
report-only retry.
It never marks `RESTORE_VERIFIED`, and never releases a capture lease.

Each source stream goes directly through `age`; the job never stages a plaintext dump or asset archive on disk. A set progresses through four distinct states: **created** (staging only), **integrity verified** (ciphertext hashes checked and atomically published), **restore verified** (a disposable restore completed and wrote `RESTORE_VERIFIED`), and **last known-good recovery point** (the newest valid restore-verified set). SHA-256 integrity never means that a database or asset restore succeeded.

Retention runs only after a new integrity-verified publication. Before deleting any candidate it rechecks every candidate manifest; a corrupt, incomplete, or uncertain set aborts pruning. It keeps 7 daily, 4 weekly, and 3 monthly sets, never deletes the last known-good restore-verified set, and performs no pruning at all until one restore-verified set exists. Interrupted staging directories are never published or eligible for recovery/retention.

This is availability protection, not offsite or tamper-resistant storage. The VPS, its local disks, its Docker volumes, and the local backup directory share a failure domain. Hostinger backups/snapshots remain supplemental and must be verified separately.

## Installation prerequisites

Do these only under an approved production change. None were performed by this repository change.

1. Install Ubuntu packages providing `age`, GNU core utilities (`sha256sum`, `tar`, `df`, `flock`), Docker Compose v2, and systemd. Confirm `age --version`, `docker compose version`, and that the Docker service is available.
2. Keep `/opt/porisrom/app` as the checked-out deployment root used by production. Copy the scripts and unit templates from `deploy/backup/`; do not modify `compose.production.yml`.
3. Create `/opt/porisrom/backups` on persistent storage, root-owned and mode `0700`. Measure database size and both asset volumes before choosing `PORISROM_BACKUP_MIN_FREE_KIB`, `PORISROM_BACKUP_SAFETY_RESERVE_KIB`, encryption overhead, and temporary overhead. The job conservatively estimates the three source streams, encrypted output, staging metadata, and reserve before staging; it rechecks before each artifact and publication. It never deletes recovery points to make room.
4. Create an `age` key pair on a controlled recovery workstation, **not on the VPS**. Put only the public recipient in `/etc/porisrom/backup.env`; keep the private identity in separately controlled recovery custody. The VPS must never retain the private identity.
5. Create `/etc/porisrom/backup.env` from `backup.env.example`, owned by root with mode `0600`. It contains no database password. Do not put `DATABASE_URL`, `POSTGRES_PASSWORD`, an age identity, or a Cloudinary secret in it.
   Install the restricted coordinator mTLS client certificate, key, and CA at
   the configured root-only paths. The reverse-proxy boundary documented in
   `docs/BACKUP-COORDINATOR-MTLS-BOUNDARY.md` must be deployed before capture;
   this repository change does not create that route.
6. Install the coordinator template service plus the daily, weekly, and monthly coordinator timer files under `/etc/systemd/system/`. Do not enable the deprecated direct-capture timer. Set script files executable (`0700`). Review all paths before `daemon-reload`.
7. Before enabling timers, run only non-mutating checks on the VPS: `bash -n` for both scripts and `systemd-analyze verify` for each installed service/timer. Confirm the systemd service will receive the intended public age recipient and backup root without printing the environment.
8. Obtain written approval before manually invoking the first `daily` job. Verify the resulting set's checksums, permissions, timestamp, manifest, and free-space threshold. Do not delete the old verified set during first-run investigation.

## Timer schedule

- Daily: 02:15 UTC, retained: latest 7 daily sets.
- Weekly: Sunday 03:15 UTC, retained: latest 4 weekly sets.
- Monthly: day 1 at 04:15 UTC, retained: latest 3 monthly sets.

The weekly/monthly runs create their own backup set. This avoids treating an arbitrary daily backup as a weekly/monthly recovery point.

## Restore rehearsal

Run `porisrom-restore-rehearsal.sh` only from a controlled recovery environment holding the private age identity. It accepts no Compose-file override: it validates its exact sibling `compose.restore-rehearsal.yml`, rejects production names, external volumes/networks, host mounts, published ports, unexpected services, non-18.2 PostgreSQL, and non-disposable databases. A successful restore writes `RESTORE_VERIFIED`, which is required for a set to become the last known-good recovery point.

The script never uses `--clean` and will not restore over the production database. After the database and asset volumes restore, verify schema/migration state, fingerprints, private-file authorization, critical business history, and application behaviour before considering a cutover. Do not attach a restored environment to production outbound integrations or Cloudinary deletion credentials.

## Operational checks and limits

- Alert if a systemd unit fails, a timer has not run, free space falls below the calculated reserve, no new `INTEGRITY_VERIFIED` set appears on schedule, or the last restore verification is stale.
- Verify checksum files on each recovery attempt before decryption. Age decryption additionally detects ciphertext corruption/authentication failure when the recovery key is used.
- PostgreSQL dump consistency does not make the active asset volumes transactionally consistent with the DB. `metadata` identifies the set; reconciliations are required during recovery.
- This phase has no WAL archive or point-in-time recovery. Its best possible database RPO is the successful backup cadence; actual RTO and RPO require a timed rehearsal and owner approval.
- Cloudinary-hosted object bytes are not copied by this tooling. Database identifiers and any local/legacy volume assets are covered, but provider-held objects require a later, separately approved storage recovery design.
