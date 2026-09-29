# Porishrom developer handover

## Purpose

The next implementation pass is intentionally limited to two areas:

1. Complete and validate Cloudinary configuration for the private identity-document flow.
2. Improve marketplace discovery for both sides of the marketplace: clients finding freelancers and freelancers finding companies.

Do not put Cloudinary credentials in frontend code, change authentication/role boundaries, or bypass the backend API.

## Repository map

| Area | Location | Ownership |
| --- | --- | --- |
| Marketplace UI | `apps/frontend` | Next.js; calls the backend API only |
| Operations UI | `apps/admin` | Next.js; calls the backend API only |
| API and business logic | `apps/backend` | NestJS, auth, search, KYC, realtime |
| Database/schema/migrations | `packages/database` | Prisma and PostgreSQL |

Useful commands:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @porishrom/database generate
pnpm.cmd --filter @porishrom/database migrate:dev       # local only
pnpm.cmd --filter @porishrom/database migrate:deploy    # staging/production only
pnpm.cmd --filter @porishrom/backend test
pnpm.cmd lint
pnpm.cmd type-check
pnpm.cmd build
```

## 1. Cloudinary: current implementation and required work

### Current contract

- The backend-only credentials are `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `apps/backend/.env`.
- Configuration and private KYC storage live in `apps/backend/src/kyc/identity-document.service.ts`.
- Freelancers upload through `POST /freelancers/me/identity-document`; the route is JWT-protected and freelancer-only in `apps/backend/src/profiles/freelancer-profile.controller.ts`.
- The upload accepts a PDF up to 1 MB, uses a server-generated `kyc/<user-id>/<uuid>` public ID, and stores it as Cloudinary `authenticated` content.
- The database stores only the Cloudinary public/asset IDs in `IdentityDocument`; it does not store the original filename or a public URL.
- Admin review and short-lived signed viewing URLs are exposed through the existing admin API. Signed URLs expire after five minutes.

### What to rewire

1. Obtain a staging Cloudinary product/environment and configure the three backend secrets in the deployment platform. Never add them to `apps/frontend`, `apps/admin`, `NEXT_PUBLIC_*`, source files, or checked-in env files.
2. Confirm the Cloudinary account supports authenticated delivery for PDF assets and that the deployed backend can upload, destroy, and create private download URLs.
3. Use a synthetic, non-sensitive PDF to exercise this sequence in staging:
   - an onboarded freelancer uploads a PDF;
   - the record becomes `pending`;
   - an admin obtains a signed URL and reviews the document;
   - a rejected document can be replaced;
   - pending/approved documents cannot be overwritten;
   - another user and unauthenticated callers cannot access it.
4. Keep upload failures fail-closed: absent credentials must return the existing `503` response; do not fall back to public storage or browser-direct unsigned uploads.
5. If adding other asset types later (logos, portfolio media), design a separate public/controlled delivery contract. Do not repurpose the private KYC path.

### Test coverage to preserve

`apps/backend/test/identity-document.spec.ts` verifies PDF validation, private authenticated upload options, server-generated paths, cleanup on failure, and short-lived signed access. Extend this file whenever the KYC contract changes.

## 2. Discovery/search: current implementation and required work

### API contracts

| Audience | UI route | API endpoint | Backend implementation |
| --- | --- | --- | --- |
| Client finding freelancers | `/freelancers` | `GET /search/freelancers` | `apps/backend/src/search/search.service.ts` |
| Freelancer finding companies | `/companies` | `GET /search/companies` | `apps/backend/src/search/search.service.ts` |

Both endpoints return `{ items, page, pageSize, total }` and only return profiles with `verificationStatus: "approved"`. Preserve that rule in every query and count.

Current filters:

- Freelancers: `keyword`, `categoryId`, `skillId`, `state`, `district`, `experienceLevel`, `minRating`, `verifiedOnly`, `page`, `pageSize`.
- Companies: `keyword`, `categoryId`, `state`, `minRating`, `verifiedOnly`, `page`, `pageSize`.

Current keyword fields:

- Freelancer: user name, bio, category name/slug, and skill name.
- Company: company name, about text, and state.

### Recommended improvement order

1. Establish expected search behaviour before changing the query:
   - punctuation/case/whitespace handling;
   - relevant term matching for each audience;
   - filter combinations and pagination reset;
   - deterministic ranking and empty states.
2. Improve the backend query and DTO validation first. Keep all filtering server-side, parameterized through Prisma, approved-only, and bounded by the existing `pageSize <= 50` limit.
3. Update both UI routes together so query parameters, selected filter labels, clear-filter links, pagination, loading state, and error state stay in sync.
4. Preserve role-aware navigation: clients should land on `/freelancers`; freelancers should land on `/companies` (`apps/frontend/src/lib/discovery-navigation.ts`).
5. Add focused tests before merging. Existing service tests are:
   - `apps/backend/test/freelancer-search.spec.ts`
   - `apps/backend/test/company-search.spec.ts`

### Important current UI details

- `/freelancers` is Assam-scoped in the UI (`state=Assam`) and has district, skill, category, experience, rating, and verified filters.
- `/companies` is the reciprocal discovery page with category, state, rating, and verified filters.
- `FreelancerDiscoveryTransition` submits filters explicitly; `CompanyDiscoveryTransition` applies selects immediately and debounces keyword input (350 ms). If the interaction is unified, update both deliberately and verify mobile behaviour.
- Direct `/categories` links were removed from active mobile navigation. Do not reintroduce a `/categories` index link; category detail routes remain `/categories/[category]`.

### Search acceptance criteria

- A client can find approved freelancers by realistic name, service/category, and skill terms, then combine filters and paginate without losing them.
- A freelancer can find approved companies by company name/about/state, then combine filters and paginate without losing them.
- Unapproved, blocked, and wrong-role records never become discoverable.
- Empty, loading, and API-error states remain actionable on desktop and mobile.
- Tests cover every added query branch and the production build remains green.

## Non-negotiable checks before handoff completion

```powershell
pnpm.cmd --filter @porishrom/backend test
pnpm.cmd lint
pnpm.cmd type-check
pnpm.cmd build
```

Run the staging checklist in `staging.md` after deployment. Do not commit `.env` files, credentials, generated Prisma files, `.next`, or other build artifacts.
