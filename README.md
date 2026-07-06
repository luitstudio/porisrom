# Porishrom

Monorepo for the Porishrom freelance marketplace, managed with pnpm workspaces + Turborepo.

## Layout

```
apps/
  frontend/   Next.js — public marketing site + client/freelancer web app
  admin/      Next.js — internal admin panel (not yet scaffolded)
  backend/    NestJS — the API, owns auth and all database access (not yet scaffolded)

packages/
  database/       Prisma schema + client (Postgres). Imported only by apps/backend.
  shared-types/   Zod schemas / DTOs shared across apps for API contracts.
  config/         Shared tsconfig/eslint base config.
```

## Architecture

- `apps/backend` is the only app with database access, via `@porishrom/database`. `apps/frontend` and `apps/admin` are API-only consumers.
- Auth is owned by the backend (JWT + bcrypt). `apps/frontend`/`apps/admin` use NextAuth purely for session cookie handling, calling the backend for actual verification.
- Database: local Postgres via Docker Compose for development; the same Postgres container runs on the VPS in production (swap `DATABASE_URL`, no managed DB service).
- File storage: MinIO (S3-compatible) via Docker, same local-dev-now / VPS-later pattern. Public bucket for portfolio/avatars, private + signed URLs for sensitive documents (Aadhaar/certificates).

## Status

`apps/frontend` is the original Porishrom Next.js app, migrated in as-is (still runs its own local SQLite Prisma + NextAuth credentials setup temporarily, pending backend rewiring). `apps/admin`, `apps/backend`, and the `packages/*` contents are scaffolding placeholders, to be filled in as each phase of the roadmap is built.
