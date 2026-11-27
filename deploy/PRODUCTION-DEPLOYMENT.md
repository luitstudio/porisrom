# Production deployment gate

This procedure never starts Prisma migrations automatically and never prints a rendered Compose configuration.

1. Provision `/etc/porisrom/production.env` through the approved secret manager. Start from `deploy/production.env.example`; it must be owned by `root`, have mode `600`, stay outside the checkout, and never be committed. `MIGRATION_DATABASE_URL` must use the controlled PostgreSQL owner (`POSTGRES_USER`/`POSTGRES_PASSWORD`) and is used only by the migration/seed executor. `DATABASE_URL` must use `porisrom_backend_runtime` and a different password; it is the only database URL passed to the backend. Set `BACKUP_COORDINATOR_TRUSTED_PROXY_IPS` to the private mTLS proxy allowlist and `BACKUP_COORDINATOR_MTLS_PROXY_TOKEN` to a unique secret-manager value; Compose forwards both only to the backend and refuses its startup if either is absent. Node 24.11.0 supports the documented `--env-file` invocation. The preflight wrapper passes this exact same path to every Docker Compose command with `--env-file`; it also pins Compose's project directory to the repository root. An incidental `.env` in either the checkout or the caller's working directory must never supply missing production variables.
2. Run the non-mutating local configuration check first. It validates configuration only; it does not prove Docker deployment readiness and invokes neither Docker nor Compose:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs --dry-run
   ```

3. Run the Compose-backed validation gate. This creates only the one-shot validation container and does not start PostgreSQL or application services:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs --validate-only
   ```

4. Before changing the database or application containers, verify a current pre-deployment recovery point. The existing production stack must be healthy, the backup must be `INTEGRITY_VERIFIED`, and the latest approved restore rehearsal must be recorded. Start backup work only through the approved coordinator/systemd workflow in `deploy/backup/`; do not invoke the capture script directly or treat an unverified set as rollback protection. Record the recovery-point identifier with the release ticket.

5. A database owner may separately approve PostgreSQL startup, then verify its healthy status. On a fresh database, bootstrap the restricted runtime role shells before migrations: migration `20261130000000_admission_identity_lookup_lock` grants to `porisrom_admission_runtime`, so post-migration provisioning is too late. This bootstrap creates no login-capable role and grants no schema, table, sequence, or function access. Run migrations only with `MIGRATION_DATABASE_URL`; it is never injected into an application service:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml up -d --wait postgres
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /opt/porisrom/app/deploy/migration-role-shell-bootstrap.sql
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml --profile migration run --rm migrate
   ```

   Do not use the migration command without recorded database-owner approval and successful migration rehearsal.

   After the migration ledger is current, apply the reviewed least-privilege runtime-role provisioner through the controlled PostgreSQL owner path. It grants only the runtime functions and table access required by backend, admission, dispatcher, and finalizer processes; it must complete before those services start. It explicitly enables LOGIN only for those four roles. The database owner, legacy verifier, and SECURITY DEFINER owners remain NOLOGIN:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /opt/porisrom/app/deploy/backup-admission-role-provision.sql
   ```

   Set each runtime password interactively in the controlled PostgreSQL session. Do not put passwords on a shell command line or commit them; update the matching secret-manager values (`DATABASE_URL`, `ADMISSION_DATABASE_URL`, `VERIFIER_DISPATCH_DATABASE_URL`, and `FINALIZER_DATABASE_URL`) before starting services:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml exec -it postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   \password porisrom_backend_runtime
   \password porisrom_admission_runtime
   \password porisrom_dispatcher_runtime
   \password porisrom_finalizer_runtime
   \q
   ```

   Before starting admission or verifier, register the independently authenticated verifier workload and its Ed25519 signing public key through the controlled database-owner session. The two fingerprints are deliberately different: the workload fingerprint is SHA-256 of the verifier's mTLS client certificate DER; the signing fingerprint is SHA-256 of the canonical DER SubjectPublicKeyInfo for the Ed25519 public key. Do not use text PEM hashes, certificate display fingerprints, or the admission server certificate.

   ```text
   openssl x509 -in /secure/verifier-client.crt -outform DER | openssl dgst -sha256 -r | awk '{print $1}'
   openssl pkey -pubin -in /secure/verifier-signing-public.pem -pubout -outform DER | openssl dgst -sha256 -r | awk '{print $1}'
   ```

   In a reviewed owner session, insert one active `BackupVerifierPrincipal`, one active `BackupVerifierCertificate` with `purpose='artifact_verifier'`, its exact PEM in `signingPublicKeyPem`, and one active `BackupVerifierWorkloadIdentity` linking the mTLS fingerprint to that same principal and purpose. Set `VERIFIER_PRINCIPAL_ID` and `VERIFIER_CERTIFICATE_FINGERPRINT` from those inserted records. Set `ADMISSION_ENDPOINT` to the internal HTTPS service endpoint and `ADMISSION_TLS_SERVER_NAME` to a DNS SAN on the admission certificate. Keep the client certificate, private signing key, and database credentials in the secret manager; mount them only to the non-root verifier/admission containers. Admission readiness is HTTPS-only and does not require a client certificate, but every proof-admission POST requires a CA-authorized mTLS client certificate.

6. On a fresh production database, explicitly seed only the required taxonomy after migrations. This command sets `SEED_LAUNCH_DATA=false`, so it cannot create demo freelancer or company data:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml --profile migration run --rm --env SEED_LAUNCH_DATA=false --entrypoint node migrate dist/seed.js
   ```

   Migrations and seeding are separate operations: migrations create or update the schema and Prisma migration ledger, while this seed writes the required category and skill reference data. Do not run demo seed data in production. The explicit false flag prevents demo users and companies.

   Verify the taxonomy with this approved read-only PostgreSQL query. Expected results: `categories=9` and `skills=12`.

   ```sql
   SELECT
     (SELECT COUNT(*) FROM "Category") AS categories,
     (SELECT COUNT(*) FROM "Skill") AS skills;
   ```

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT COUNT(*) FROM \"Category\") AS categories, (SELECT COUNT(*) FROM \"Skill\") AS skills;"'
   ```

7. Start the admission authority before any verifier work. It is private, mTLS-only, and must become healthy before the verifier dispatcher can submit proof-v2 evidence:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml up -d --wait admission
   ```

8. Start backend, frontend, and admin only through the gate, after the migration, provisioner, passwords, and taxonomy seed above have completed. It repeats the Compose-backed validation service before requesting application startup. It never enables the migration profile or passes `MIGRATION_DATABASE_URL` to an application service:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs
   ```

9. Start the restricted verifier and finalizer workers after admission is healthy. The verifier claims canonical-publication work and the finalizer consumes only admitted-evidence work:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml --profile verifier --profile finalizer up -d verifier finalizer
   ```

10. Verify production process health before admitting traffic: `postgres`, `admission`, `backend`, `frontend`, `admin`, `verifier`, and `finalizer` must be running; `postgres`, `admission`, `backend`, `frontend`, and `admin` must also report healthy. Inspect only status and sanitized logs:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml ps
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml logs --tail=100 admission backend verifier finalizer
   ```

## Forward-only migration recovery

Migrations are forward-only. Do not rewrite applied migrations or attempt an in-place schema downgrade.

The verified backup-finalization migrations add terminal `finalized` workflow state and immutable finalization/outbox records. Once a finalization has occurred, an older application image is not an approved image-only rollback target because its generated client may not understand that state.

If deployment recovery is required, stop the new workers and application containers, preserve the migrated database for investigation, and choose one approved path: roll forward with a corrective release, or restore the database and application together from the pre-deployment recovery point under database-owner approval. Never restore only application images after finalized workflow records exist.
