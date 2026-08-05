# Porishrom — local setup

Step-by-step guide to get the whole monorepo running on a fresh machine. Three apps, one Postgres database.

## 1. Install prerequisites

- **Git**
- **Node.js 20+** (check with `node -v`)
- **pnpm** — enable via corepack (comes with Node): `corepack enable`
- **Docker Desktop** — used for Postgres. Must be running before you start the backend (this is the #1 thing that trips people up — if the backend can't connect to the DB, check Docker Desktop is actually open).

## 2. Clone the repo

```
git clone https://github.com/luitstudio/porisrom.git
cd porisrom
```

## 3. Install dependencies

From the repo root (installs for all three apps + packages at once):

```
pnpm install
```

## 4. Set up environment files

Each app has its own `.env`, none of which are committed (they're gitignored on purpose). Copy each example and fill it in:

```
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin/.env.example apps/admin/.env
```

(On Windows PowerShell, use `Copy-Item` instead of `cp` if `cp` isn't available.)

The defaults in each `.env.example` already match the Docker Postgres setup below, so for local dev you mostly don't need to change values — **except**:

- `apps/backend/.env` → `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: change these to any random string (they just need to be non-empty and secret-ish for local dev — e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` twice and paste the results in).
- `apps/frontend/.env` → `AUTH_SECRET`: same idea, generate a random string the same way.

## 5. Start Postgres

```
docker compose up -d postgres
```

This runs Postgres in a container on port **5433** (not the default 5432, to avoid clashing with any Postgres you might already have running locally). Data persists in a Docker volume across restarts.

Check it's up:

```
docker ps
```

You should see `porisrom-postgres-1` with status `Up`.

## 6. Generate the Prisma client and run migrations

```
cd packages/database
pnpm exec prisma generate
pnpm exec prisma migrate dev
cd ../..
```

This creates all the tables. `prisma migrate dev` is safe to re-run — it just applies any migrations you don't have yet.

## 7. Build the database package

The backend imports `@porishrom/database` as a built package, not straight from source, so build it once:

```
pnpm --filter @porishrom/database build
```

(Re-run this any time `packages/database/prisma/schema.prisma` changes and you've pulled new migrations.)

## 8. Seed data

**Categories/skills** (needed for signup/profile forms to have options):

```
cd packages/database
pnpm seed
cd ../..
```

**An admin account** (needed to log into the admin console):

```
cd apps/backend
pnpm build
pnpm seed:admin
cd ../..
```

This creates `admin@porishrom.local` / `ChangeMe123!` — change the password later via the admin console, or override it by setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars before running the command.

## 9. Run everything

From the repo root:

```
pnpm dev
```

This starts all three apps at once (via Turborepo) with hot-reload:

| App | URL |
|---|---|
| Backend (NestJS API) | http://localhost:4000 |
| Frontend (main marketplace app) | http://localhost:3000 |
| Admin console | http://localhost:3001 |

Leave this running in a terminal. Ctrl+C to stop everything.

## 10. Verify it's working

```
curl http://localhost:4000/health        # {"status":"ok"}
```

Then just open http://localhost:3000 in a browser — sign up a new account (freelancer or client) and go through onboarding, or log into http://localhost:3001 with the admin account from step 8.

## Project structure / where to look

- `docs/PRD.md`, `docs/data-model.md`, `docs/api-design.md`, `docs/roadmap.md` — read these first. They're the source of truth for what's built, what each API endpoint does, and what's still left (see the Phase 10 backlog in `roadmap.md`).
- `apps/backend` — NestJS API, owns the database and auth entirely.
- `apps/frontend` — the public marketplace (freelancers/clients).
- `apps/admin` — internal admin console.
- `packages/database` — Prisma schema + client, imported only by `apps/backend`.

## Common issues

- **Backend can't connect to Postgres** → Docker Desktop isn't running, or the container stopped. Run `docker compose up -d postgres` again.
- **`Cannot find module '@porishrom/database'`** → you skipped step 7 (build the database package).
- **Something feels stale / weird redirect loops / random 404s on routes that should exist** → kill the dev servers and delete the Next.js cache, then restart:
  ```
  rm -rf apps/frontend/.next apps/admin/.next
  pnpm dev
  ```
- **Prisma migration errors** → make sure `packages/database/.env` and `apps/backend/.env` both point at the same `DATABASE_URL` (port 5433).

## Git workflow

Default branch is `main`. Please branch off it for changes (`git checkout -b your-name/feature`) and open a PR rather than pushing straight to `main`.
