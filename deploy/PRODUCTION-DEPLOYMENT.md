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

5. Start the applications only through the gate. It repeats the Compose-backed validation service before requesting PostgreSQL, backend, frontend, and admin startup. It never enables the migration profile:

   ```text
   node --env-file=/etc/porisrom/production.env /opt/porisrom/app/deploy/production-preflight.mjs
   ```
