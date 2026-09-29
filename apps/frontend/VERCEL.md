# Frontend preview deployment

Import the existing GitHub repository into Vercel with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/frontend` |
| Framework Preset | Next.js |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm --filter @porishrom/frontend build` |
| Output Directory | Leave the Next.js default (`.next`) |
| Node.js Version | `20.x` or newer supported runtime |
| Include source files outside the Root Directory | Enabled |

The repository pins `pnpm@9.0.0` in its root `packageManager` field. The
frontend has no workspace package dependencies; its filtered build runs only
`next build`, without building backend, admin, or database packages. The install
uses the workspace lockfile. Do not use the unfiltered root build command.
Next.js fetches the Outfit and Onest Google fonts during the build.

## Environment variables

Configure these for the Vercel environments you deploy (Preview and/or Production):

- `AUTH_SECRET`: a newly generated, private random secret of at least 32 bytes.
  Required now because Auth.js is used by the public pages and proxy.
- `AUTH_TRUST_HOST`: `true`.
- `BACKEND_URL`: required for production server-side API requests; set it to the real HTTPS API origin.
- `NEXT_PUBLIC_BACKEND_URL`: required for browser API and Socket.IO usage; set it to the same real HTTPS API origin. This value is public and must not contain secrets.

Do not copy the example secret into Vercel. Do not prefix `AUTH_SECRET` or
`BACKEND_URL` with `NEXT_PUBLIC_`; only `NEXT_PUBLIC_BACKEND_URL` is public.
Real `.env` files remain ignored. No database variables are needed by the
frontend. `localhost` is for local development only and is not a valid
production backend URL.

## Preview limitations

Public marketing, auth forms, and service-category pages render without a backend.
Freelancer/company discovery displays an unavailable message when the API cannot
be reached. Other failed page loads have a recovery link to the homepage.
Live listings, profiles, leaderboards, login/signup, onboarding, connections,
messages, work assignments, reviews, and payment verification need the existing
backend. Existing design/demo content is unchanged; no mock API is added.

Reference: https://vercel.com/docs/monorepos and
https://vercel.com/docs/functions/runtimes/node-js/node-js-versions.
