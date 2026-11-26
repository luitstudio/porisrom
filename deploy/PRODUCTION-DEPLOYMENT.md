# Production deployment gate

This procedure never starts Prisma migrations automatically and never prints a rendered Compose configuration.

1. Provision `/etc/porisrom/production.env` through the approved secret manager. It must be owned by `root`, have mode `600`, stay outside the checkout, and never be committed. Node 24.11.0 supports the documented `--env-file` invocation. The preflight wrapper passes this exact same path to every Docker Compose command with `--env-file`; it also pins Compose's project directory to the repository root. An incidental `.env` in either the checkout or the caller's working directory must never supply missing production variables.
2. Run the non-mutating local configuration check first. It validates configuration only; it does not prove Docker deployment readiness and invokes neither Docker nor Compose:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs --dry-run
   ```

3. Run the Compose-backed validation gate. This creates only the one-shot validation container and does not start PostgreSQL or application services:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs --validate-only
   ```

4. A database owner may separately approve PostgreSQL startup, then verify its healthy status. Migrations remain an explicit, separately approved action:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml up -d --wait postgres
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml --profile migration run --rm migrate
   ```

   Do not use the migration command without recorded database-owner approval and successful migration rehearsal.

5. On a fresh production database, explicitly seed only the required taxonomy after migrations. This command sets `SEED_LAUNCH_DATA=false`, so it cannot create demo freelancer or company data:

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

6. Start the admission authority before any verifier work. It is private, mTLS-only, and must become healthy before the verifier dispatcher can submit proof-v2 evidence:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml up -d --wait admission
   ```

7. Start backend, frontend, and admin only through the gate. It repeats the Compose-backed validation service before requesting application startup. It never enables the migration profile:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs
   ```

8. Start the restricted verifier and finalizer workers after admission is healthy. The verifier claims canonical-publication work and the finalizer consumes only admitted-evidence work:

   ```text
   docker compose --env-file /etc/porisrom/production.env --project-directory /opt/porisrom/app --file /opt/porisrom/app/deploy/compose.production.yml --profile verifier --profile finalizer up -d verifier finalizer
   ```

## Forward-only migration recovery

Migrations are forward-only. Do not rewrite applied migrations or attempt an in-place schema downgrade.

The verified backup-finalization migrations add terminal `finalized` workflow state and immutable finalization/outbox records. Once a finalization has occurred, an older application image is not an approved image-only rollback target because its generated client may not understand that state.

If deployment recovery is required, stop the new workers and application containers, preserve the migrated database for investigation, and choose one approved path: roll forward with a corrective release, or restore the database and application together from the pre-deployment recovery point under database-owner approval. Never restore only application images after finalized workflow records exist.
