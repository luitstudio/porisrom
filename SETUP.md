# Porishrom local setup

This guide starts the local marketplace, admin panel, backend, and PostgreSQL.
For production deployment requirements, see [README.md](README.md).

## 1. Prerequisites

- Git
- Node.js 20 or later (`node -v`)
- pnpm 9.0.0 (`corepack enable`)
- Docker Desktop, running locally for PostgreSQL

## 2. Install dependencies

```sh
git clone https://github.com/luitstudio/porisrom.git
cd porisrom
pnpm install
```

## 3. Create local environment files

Copy each example to its local `.env` file:

```sh
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin/.env.example apps/admin/.env
```

In Windows PowerShell, use `Copy-Item` if preferred.

The example localhost URLs match the Docker database and local applications.
For local authentication, replace the backend JWT placeholders and frontend
`AUTH_SECRET` with private random values. Do not reuse those values in
production.

Cloudinary variables are only needed when exercising the private KYC upload
flow. Keep `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` local and private;
they are never frontend variables.

## 4. Start PostgreSQL

```sh
docker compose up -d postgres
docker ps
```

The local database is exposed on port `5433` and its Docker volume persists
across restarts.

## 5. Generate Prisma and apply local migrations

```sh
pnpm --filter @porishrom/database generate
pnpm --filter @porishrom/database migrate:dev
pnpm --filter @porishrom/database build
```

`migrate:dev` is for local development only. Production uses:

```sh
pnpm --filter @porishrom/database migrate:deploy
```

Never run `prisma migrate reset`, `prisma migrate dev`, or delete a database or
volume against a production database.

## 6. Seed catalog data and optional local demos

Categories and skills are required catalog data for onboarding and discovery:

```sh
pnpm --filter @porishrom/database seed
```

The normal seed does not require demo accounts. Optional launch/demo accounts
are enabled only by setting `SEED_LAUNCH_DATA=true` and a local-only
`LAUNCH_DEMO_PASSWORD` in `packages/database/.env`. Do not enable this flag or
use the demo password as a production credential.

To seed a local admin account, first set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
`apps/backend/.env`, then run:

```sh
pnpm --filter @porishrom/backend build
pnpm --filter @porishrom/backend seed:admin
```

There is no default admin email or password. The seed fails closed if either
credential is missing and does not print the password.

## 7. Run the applications

```sh
pnpm dev
```

| Application | Local URL |
| --- | --- |
| Backend API | http://localhost:4000 |
| Marketplace | http://localhost:3000 |
| Admin panel | http://localhost:3001 |

## 8. Verify local services

```sh
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

`/health` verifies backend process liveness. `/health/ready` performs a minimal
PostgreSQL readiness check.

## Common local issues

- Backend cannot connect to PostgreSQL: ensure Docker Desktop is running and
  `docker compose up -d postgres` completed successfully.
- Prisma migration errors: ensure `packages/database/.env` and
  `apps/backend/.env` reference the same local `DATABASE_URL` (port `5433`).
- Cannot find `@porishrom/database`: rerun
  `pnpm --filter @porishrom/database build`.
- Stale Next.js behavior: stop local dev servers, remove the relevant `.next`
  directory, and restart `pnpm dev`.

## Production reminder

Production must use HTTPS, real production secrets, an HTTPS backend URL for
both frontend backend URL variables, and `migrate:deploy`. Follow the complete
runbook in [README.md](README.md); do not copy local Docker credentials or
example secrets to production.
