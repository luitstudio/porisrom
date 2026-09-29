# Porishrom staging runbook

## Scope

Use this runbook for the Cloudinary/KYC and discovery/search handoff. Staging should resemble production in security boundaries while using only test accounts and synthetic documents.

## 1. Pre-deployment configuration

Set these in the deployment platform; do not place real values in this repository.

### Backend

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Private staging PostgreSQL URL |
| `PORT` | Platform-provided/listening port if required |
| `FRONTEND_ORIGIN` | Comma-separated HTTPS marketplace and admin staging origins |
| `JWT_ACCESS_SECRET` | Unique random value, at least 32 characters |
| `JWT_REFRESH_SECRET` | Different unique random value, at least 32 characters |
| `CLOUDINARY_CLOUD_NAME` | Staging Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Backend-only staging credential |
| `CLOUDINARY_API_SECRET` | Backend-only staging secret |

### Marketplace frontend

| Variable | Requirement |
| --- | --- |
| `AUTH_SECRET` | Unique staging secret |
| `AUTH_TRUST_HOST` | `true` where required by the host |
| `BACKEND_URL` | HTTPS staging backend origin |
| `NEXT_PUBLIC_BACKEND_URL` | Same HTTPS staging backend origin; contains no secrets |

### Admin

| Variable | Requirement |
| --- | --- |
| `BACKEND_URL` | Same HTTPS staging backend origin |

Do not use localhost URLs, example secrets, production credentials, public Cloudinary delivery, or real identity documents in staging.

## 2. Deploy order

1. Confirm the target database is the staging database.
2. Run migrations exactly once:

   ```powershell
   pnpm.cmd --filter @porishrom/database migrate:deploy
   ```

3. Seed the required catalog taxonomy if the staging database is new:

   ```powershell
   pnpm.cmd --filter @porishrom/database seed
   ```

4. Deploy backend, then check:

   ```text
   GET /health       -> 200 {"status":"ok"}
   GET /health/ready -> 200 {"status":"ready"}
   ```

5. Deploy marketplace frontend and admin with the configured staging backend URLs.
6. Verify each app loads over HTTPS and CORS permits only the configured origins.

## 3. Release smoke checklist

### Auth and roles

- [ ] Create one freelancer and one client test account.
- [ ] Complete each respective onboarding flow.
- [ ] Confirm a freelancer cannot access client-only profile operations and vice versa.
- [ ] Confirm an admin account can access the admin panel and a normal account cannot.

### Private Cloudinary KYC

- [ ] Upload a synthetic PDF under 1 MB from an onboarded freelancer.
- [ ] Confirm the API returns `pending`; no direct/public asset URL is exposed.
- [ ] Open the document only through the admin signed-url flow.
- [ ] Confirm the signed URL expires and unauthorised access is rejected.
- [ ] Approve or reject the document; confirm replacement is allowed only after rejection.
- [ ] Simulate absent Cloudinary credentials in a non-production test environment and confirm upload fails closed with `503`.

### Discovery: client → freelancer

- [ ] `/freelancers` lists only approved freelancer profiles.
- [ ] Search by name, bio/service term, category, and skill.
- [ ] Combine category, skill, district, experience, rating, and verified filters.
- [ ] Verify pagination retains all selected filters and clear filters returns the expected list.
- [ ] Confirm empty/error/loading states are usable at a mobile viewport.

### Discovery: freelancer → company

- [ ] `/companies` lists only approved company profiles.
- [ ] Search by company name, about text, and state.
- [ ] Combine category, state, rating, and verified filters.
- [ ] Verify keyword debounce, filter changes, pagination, and clear filters all preserve correct URL state.
- [ ] Confirm empty/error/loading states are usable at a mobile viewport.

### Core marketplace regression

- [ ] Client sends a connection request; freelancer accepts it.
- [ ] Both users can message in the created conversation.
- [ ] Client creates a work assignment; freelancer accepts it.
- [ ] Freelancer submits a deliverable; client accepts it.
- [ ] Both parties complete matching payment claims; assignment becomes completed.
- [ ] Both parties can submit their permitted review.
- [ ] Notification and realtime updates arrive once and do not duplicate.

## 4. Automated release gate

Run before each staging deployment:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @porishrom/backend test
pnpm.cmd lint
pnpm.cmd type-check
pnpm.cmd build
```

The release is blocked if migrations fail, `/health/ready` is not `200`, a production backend URL falls back to localhost, Cloudinary KYC becomes public, unapproved records are discoverable, or the automated build/tests fail.

## 5. Rollback and safety

- Roll back the deployed application image/version before considering schema rollback.
- Do not run `prisma migrate dev`, `prisma migrate reset`, or database-volume deletion against staging/production data.
- Do not print or share staging secrets in tickets, logs, screenshots, or these documents.
- Retain Cloudinary KYC assets as private authenticated resources; investigate and revoke/rotate credentials immediately if exposure is suspected.
