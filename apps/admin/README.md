# @porishrom/admin

Internal admin console for Porishrom (Phase 9). Talks to `apps/backend` over HTTP only — no direct database access.

Runs on port 3001 (`pnpm --filter @porishrom/admin dev`). Login requires an account with `role: "admin"` on the backend.

Auth is intentionally simpler than `apps/frontend`: no NextAuth. Server actions call the backend's `/auth/login` and `/auth/refresh` directly and store the resulting tokens in httpOnly cookies (`admin_access_token` / `admin_refresh_token`), since this app has a single role and no onboarding/session-hook requirements. See `src/lib/session.ts`.

Pages: dashboard/analytics, user management (approve/reject/badge/block/soft-delete), conversation oversight, work-assignment oversight, payment oversight, notification composer (broadcast + direct message), admin action log.
