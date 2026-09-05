# Frontend preview deployment

Import the existing GitHub repository into Vercel with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/frontend` |
| Framework Preset | Next.js |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm --filter @porishrom/frontend build` |
| Output Directory | Leave the Next.js default (`.next`) |
| Node.js Version | `22.x` |
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
- `BACKEND_URL`: leave unset for this frontend preview. Once a backend is hosted,
  set its real HTTPS origin. The existing server-only helper currently defaults
  to localhost when unset; no backend is expected there on Vercel.

Do not copy the example secret into Vercel. Do not prefix these variables with
`NEXT_PUBLIC_`. Real `.env` files remain ignored. No database variables are
needed by the frontend.

## Preview limitations

Public marketing, auth forms, and service-category pages render without a backend.
Freelancer/company discovery displays an unavailable message when the API cannot
be reached. Other failed page loads have a recovery link to the homepage.
Live listings, profiles, leaderboards, login/signup, onboarding, connections,
messages, work assignments, reviews, and payment verification need the existing
backend. Existing design/demo content is unchanged; no mock API is added.

Known existing frontend issues: onboarding lint reports
`react-hooks/set-state-in-effect` in `onboarding-wizard.tsx`; some navigation
destinations (including `/jobs` and `/why-porisrom`) do not exist yet. These are
outside the deployment checkpoint fixes.

Reference: https://vercel.com/docs/monorepos and
https://vercel.com/docs/functions/runtimes/node-js/node-js-versions.
