# Porishrom

Porishrom is a pnpm workspace marketplace monorepo with a Next.js marketplace,
a Next.js admin panel, and a NestJS API backed by PostgreSQL.

## Toolchain

- Node.js 20 or later
- pnpm 9.0.0 (pinned in the root `packageManager` field)
- PostgreSQL 16 or a compatible PostgreSQL deployment

Use `corepack enable` before installing dependencies if pnpm is not already
available.

## Architecture

- `apps/backend` owns authentication, authorization, business logic, Prisma
  access, REST APIs, and Socket.IO delivery.
- `apps/frontend` is the public marketplace and authenticated client/freelancer
  application. It consumes the backend API; it does not access the database.
- `apps/admin` is the internal moderation panel and consumes the backend API.
- `packages/database` contains the canonical PostgreSQL Prisma schema,
  migrations, taxonomy seed, and optional local launch-demo seed.
- Private KYC identity documents use the backend's existing Cloudinary
  authenticated-storage integration. Cloudinary credentials are backend-only.

## Local development

See [SETUP.md](SETUP.md) for the complete local setup instructions. The usual
workflow is:

```sh
pnpm install
docker compose up -d postgres
pnpm --filter @porishrom/database generate
pnpm --filter @porishrom/database migrate:dev
pnpm --filter @porishrom/database build
pnpm --filter @porishrom/database seed
pnpm dev
```

For a local admin account, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the
backend environment before running `pnpm --filter @porishrom/backend seed:admin`.
The seed fails if either value is missing and never provides a default password.

## Production runbook

### 1. Configure secrets and origins

Create deployment-specific environment variables before deployment. Do not
commit `.env` files or credentials.

Backend production requires:

- `DATABASE_URL` — PostgreSQL connection string; secret.
- `FRONTEND_ORIGIN` — HTTPS marketplace and admin origins, comma-separated
  when both are served from separate origins; not a secret.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — distinct private random
  secrets. In production each must be at least 32 characters and must not be a
  known example/default value.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET` — backend-only secrets required where private KYC is
  enabled. Never expose these to browsers.

Frontend production requires:

- `AUTH_SECRET` — private random secret for Auth.js.
- `AUTH_TRUST_HOST=true` when the deployment requires it.
- `BACKEND_URL` — the real HTTPS backend origin for server-side API requests.
- `NEXT_PUBLIC_BACKEND_URL` — the same real HTTPS backend origin for browser
  API and Socket.IO usage. This is public and must contain no secrets.

Admin production requires:

- `BACKEND_URL` — the real HTTPS backend origin for server-side admin API
  requests.

`localhost` values shown in `.env.example` files are local-development values
only. Production must supply real HTTPS URLs; the frontend and admin reject a
missing production backend URL rather than falling back to localhost.

### 2. Provision PostgreSQL and apply migrations

Run the production migration command from the repository root:

```sh
pnpm --filter @porishrom/database migrate:deploy
```

Never run any of the following against production:

- `prisma migrate reset`
- `prisma migrate dev`
- database or Docker-volume deletion

The required catalog/taxonomy data is created by the database seed. Optional
launch-demo data is separate: keep `SEED_LAUNCH_DATA` unset or `false` in
production unless intentionally preparing a non-production demonstration
environment. `LAUNCH_DEMO_PASSWORD` is local/demo-only and must never become a
production credential.

### 3. Deploy and verify

Use this high-level order:

1. Configure production secrets, API URLs, and HTTPS origins.
2. Provision PostgreSQL.
3. Run `pnpm --filter @porishrom/database migrate:deploy`.
4. Deploy the backend.
5. Verify `GET /health` returns liveness and `GET /health/ready` verifies
   PostgreSQL readiness.
6. Deploy the frontend and admin panel with their production backend URLs.
7. Configure HTTPS and ensure `FRONTEND_ORIGIN` includes the deployed
   marketplace/admin origins.
8. Run a final authenticated marketplace and admin smoke test.

Configure the deployment platform's liveness probe for `/health` and readiness
probe for `/health/ready`.

## Security and KYC notes

Production must run behind HTTPS. Secure production session/cookie behavior
depends on HTTPS. Use real generated secrets; do not reuse `.env.example`
placeholders or local values.

KYC documents are private identity documents. They use the existing
Cloudinary authenticated delivery flow and short-lived signed admin access.
Do not expose Cloudinary credentials to frontend code, use public Cloudinary
URLs for KYC, or use real Aadhaar documents for smoke tests.

## Useful commands

```sh
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm --filter @porishrom/backend test
pnpm --filter @porishrom/database migrate:deploy
```
