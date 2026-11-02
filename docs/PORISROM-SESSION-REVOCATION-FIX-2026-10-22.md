# Refresh concurrency and session revocation — 22 October 2026

Scope: refresh-token atomicity, current-session logout, access validation and realtime authorization. The earlier audit and private-storage report were read before implementation. Existing dirty/untracked work and migrations were retained. No schema migration, database reset, seed, commit, push or deployment was performed.

## Result and evidence

The concurrent-refresh and revocation regressions pass against the application code. The original deterministic concurrency regression first failed because both calls succeeded. It now permits one success and one rejection. A real Nest HTTP regression also produces one HTTP 200 and one HTTP 409, with the winning token still usable.

Real HTTP/Socket.IO tests verify current-session logout, expired-access logout, refresh-token-only logout, idempotent repeated logout, signed expired refresh rejection, expired-refresh revocation, revoked/missing/mismatched/expired session rejection, socket revocation and expiry, outbound session checks, and persistence-failure responses. These tests use synthetic signed tokens and an in-memory repository. They are not PostgreSQL or visible-browser tests.

Final backend suite: **236 passed, 2 skipped**. Admin: **11 passed**. Marketplace auth/proxy tests: **12 passed**, plus **4 existing Node tests passed**. The two skipped tests require an explicitly configured isolated PostgreSQL database. All app lint/type checks passed; backend lint retains the same two pre-existing unused eslint-disable warnings. Backend/admin production builds passed; the marketplace build remains blocked by Google Fonts fetch failures. Exact commands and limitations appear below.

## Root causes

- Refresh read the old hash and updated by session ID alone, allowing overlapping requests to overwrite each other and both receive tokens.
- Marketplace logout called Auth.js cookie clearing only; admin logout deleted its cookies only. Backend sessions remained live.
- Access JWT validation checked User status but not AuthSession ownership, expiry or revocation.
- Sockets authenticated once, joined a user room and could continue receiving events after token expiry/revocation.
- Client refreshes were not coalesced. Admin refreshed from server rendering, where Next.js does not permit cookie writes. Read-only marketplace `auth()` calls could likewise rotate credentials without persisting them.

## Session policy and database behavior

No schema changes were necessary. The existing `AuthSession` model and `20261001000000_auth_sessions` migration provide the required ID, hash, ownership, expiry, revokedAt, reuseDetectedAt and updatedAt fields.

Rotation uses a single Prisma `updateMany` with predicates for **session ID, user ID, old token hash, revokedAt null, and unexpired session**. Only a count of 1 returns credentials. PostgreSQL evaluates this conditional UPDATE atomically; a competing update cannot consume the same old hash twice. This database operation, rather than the client cache, supplies the concurrency guarantee. Logout sets revokedAt; rotation never clears it, so a refresh/logout race cannot resurrect the session.

A concurrent loser receives 409 with no credentials. An old token observed within five seconds of the session's last update also receives 409 and does not revoke the winner. After that collision window, stale-token replay conditionally records reuseDetectedAt/revokedAt and disconnects that session. The conditional replay update also checks the observed hash, avoiding revocation of a session that advanced again after the read. The collision window never reissues credentials to stale tokens. This changes immediate sequential replay from 401/revocation to a short 409 period to accommodate overlapping tabs/workers.

Access tokens remain usable after an ordinary rotation until their signed expiry, provided their session remains active. Every authenticated HTTP request now verifies session ownership, presence, expiry and revocation, plus current User status/role. Tokens without a session ID are rejected; pre-session legacy tokens require a fresh login. No token-hash comparison is applied to access tokens, so normal rotation does not invalidate still-valid access tokens from another tab.

Session expiry is derived from the signed refresh token's exp claim, replacing the separate duration parser. Marketplace access expiry also reads the backend token's exp claim, with the existing duration fallback for legacy responses. Existing success response shapes and auth routes are retained.

## Logout behavior

`POST /auth/logout` accepts the existing Bearer/access-cookie credential and optionally a refresh token in the JSON body or backend cookie. It verifies the signature and binds the token subject to the stored session. Signed expired/rotated credentials can revoke only their own session; accepting them on logout does not authorize `/auth/me`, refresh, or other protected operations. Forged/absent credentials fail. Already-revoked sessions can be logged out idempotently. The route is rate limited.

Both clients call this endpoint and await success before clearing local cookies or redirecting. Network, validation or database failure leaves client cookies intact and reports unconfirmed revocation instead of claiming success. The marketplace server action decodes its existing Auth.js JWT directly, avoiding a refresh just to log out. The direct Auth.js signout HTTP path also revokes before handing cookie clearing to Auth.js, after validating the signed Auth.js CSRF cookie and submitted token. Refresh tokens remain server-side and are not added to browser session JSON.

An expired/unreadable Auth.js session cookie cannot supply verifiable backend credentials and produces an explicit action failure; it is not silently represented as confirmed remote revocation. Other login/device sessions remain active. In-flight responses may still race cookie clearing, but any restored tokens for a revoked backend session cannot authorize HTTP or realtime access.

## Realtime and multi-tab behavior

- Socket handshakes require a valid signed access token and active matching session. Server-derived user and session rooms are used.
- A timer disconnects the socket at the earlier of access-token expiry or stored session expiry.
- Local logout/replay immediately disconnects sockets in that session room, leaving other sessions untouched.
- Every outbound message/notification/work update rechecks persisted session state for each recipient socket. A revocation from another process is therefore enforced before a later dispatch, even without an immediate distributed disconnect signal. Database errors fail closed. Incoming Socket.IO packets also pass a session/expiry check.
- Server-side refresh coordinators coalesce concurrent requests and retain a successful response for five seconds so late requests with the same browser cookie can persist the same winning pair. Failed requests are not cached.
- Marketplace refresh is disabled in read-only Auth.js configuration. Writable proxy/session paths perform rotation; the proxy forwards the replacement cookie to the current render as well as the browser. Losing paths never write their stale cookie. A retryable pending session is retained for browser-session polling; the session provider polls every 30 seconds, and socket components subscribe to the current session token.
- Admin rendering redirects expired credentials to `/api/auth/refresh`; the route rotates and persists cookies, then returns to the original same-origin path. Backend errors retain cookies. Unauthorized refresh clears invalid cookies and sends the user to login. Return targets are constrained to the admin origin.

The process-local coordinator is an optimization, not a distributed lock. Multiple BFF workers can still produce temporary 409/pending responses; they do not receive duplicate backend refresh successes or overwrite cookies through the explicitly handled losing paths. PostgreSQL multi-worker tests and actual multi-tab browser acceptance remain required before deployment signoff. A distributed Socket.IO adapter would improve immediate idle-socket disconnect propagation across API instances; per-dispatch database checks already enforce authorization without it. Already-authorized in-flight requests/events are not retroactively cancelled.

## Files changed

| Area | Files and purpose |
| --- | --- |
| Backend session logic | `apps/backend/src/auth/auth.service.ts`: conditional rotation, replay collision policy, logout credentials, expiry. `session-access.ts`: shared active-session validation. `auth.controller.ts`: logout credentials/optional body. `auth.module.ts`: realtime revocation dependency. `guards/auth-rate-limit.guard.ts`: logout allowance. `strategies/jwt.strategy.ts`: require current session. |
| Realtime | `apps/backend/src/realtime/realtime.gateway.ts`: session-bound handshake/rooms, expiry timer, immediate disconnect, inbound/outbound checks. |
| Marketplace | `src/auth.ts`, `src/auth.config.ts`: writable/read-only configuration, coordinated refresh and signed expiry. `src/lib/refresh-coordinator.ts`, `logout-session.ts`, `use-backend-access-token.ts`: lifecycle helpers. `src/app/dashboard/actions.ts`: revoke before signOut. `src/app/api/auth/[...nextauth]/route.ts`: direct signout and pending-session handling. `src/proxy.ts`: replacement-cookie forwarding, stale-cookie suppression and revoked-session login recovery. `src/types/next-auth.d.ts`: retryable refresh state. |
| Browser sockets | Marketplace session provider, chat thread, notification bell and financial history subscribe to current session tokens; existing business logic/routes remain intact. |
| Admin | `src/lib/session.ts`, `refresh-coordinator.ts`, `session-return-url.ts`; `src/app/api/auth/refresh/route.ts`; `src/proxy.ts`: confirmed logout and writable refresh with safe return navigation. |
| Tests | New backend `auth-revocation-http.spec.ts`, `auth-postgres.spec.ts`, `helpers/session-harness.ts`; expanded session/rate-limit/security/realtime fixtures. New marketplace `test/auth-session.test.mjs`, `test/auth-proxy.test.mjs`, `vitest.config.mjs`; new admin `src/lib/session.spec.ts`. |

Private-storage implementation files were not changed. Its protected HTTP test required only a session-aware fixture and session ID in its synthetic JWTs, because the shared JWT guard now requires a real matching session. All private-storage tests remain green. No moderation or payment-dispute workflow was changed.

## Verification record

Commands use existing installed binaries. Run app commands from the corresponding app directory. No dependency installation or verification bypass was used.

| Command | Actual outcome |
| --- | --- |
| Scoped Git `status --short`, relevant `diff -- <paths>` before editing | Passed; preserved the existing dirty tree, private-storage work and untracked migrations. Ownership workaround is command-scoped `git -c safe.directory='<USERPROFILE>/Desktop/porisrom' ...`. |
| Backend `.\node_modules\.bin\vitest.CMD run test/auth-session.spec.ts` before fix | Failed as expected: concurrent calls both succeeded; 1 failure, 4 passes. |
| Backend `.\node_modules\.bin\vitest.CMD run` final run | 236 passed; 2 PostgreSQL tests skipped; 29 files passed, 1 skipped. No failed executed tests. |
| Admin `.\node_modules\.bin\vitest.CMD run` | 11 passed in 2 files. |
| Marketplace `..\admin\node_modules\.bin\vitest.CMD run --config vitest.config.mjs --configLoader runner` | 12 auth/proxy tests passed in 2 files, reusing the already-installed Vitest runtime. |
| Marketplace `node --test test/notification-state.test.mjs test/realtime-chat.test.mjs test/recovery-policy.test.mjs` | 4 passed. |
| Backend `.\node_modules\.bin\eslint.CMD "{src,test}/**/*.ts"` | Exit 0, two pre-existing unused `no-console` disable warnings in main and admin log interceptor. |
| Marketplace/admin `.\node_modules\.bin\eslint.CMD` | Passed, exit 0. |
| All 3 apps `.\node_modules\.bin\tsc.CMD --noEmit --incremental false` | Passed, exit 0. |
| Backend `.\node_modules\.bin\nest.CMD build` | Passed, exit 0. |
| Admin `.\node_modules\.bin\next.CMD build` | Passed, exit 0; includes the new refresh route. |
| Marketplace `.\node_modules\.bin\next.CMD build` | Failed, exit 1: unable to fetch Onest and Outfit from fonts.googleapis.com in this environment. No mocked-font build is claimed. |
| Root scoped `git diff --check` | Passed, exit 0. |
| Loopback PostgreSQL TCP check and isolated-test-variable presence | Port 5433 ECONNREFUSED; `PORISROM_AUTH_TEST_DATABASE_URL` not supplied. No connection string printed. |

Intermediate checks caught the old JWT mocks lacking decode(), the Auth.js route/middleware TypeScript overload mismatch, and the default Vite config bundler's sandbox ancestor-access error. The mocks/types were corrected; the frontend test command uses Vite's runner config loader. These intermediate failures are not counted as final passes. Builds generated ignored artifacts. The admin build's generated next-env route-import edit was returned to its pre-task value after validation.

## PostgreSQL and browser limitations

The opt-in Postgres suite uses `PORISROM_AUTH_TEST_DATABASE_URL` only, never the ordinary DATABASE_URL. It requires a database name ending in `_test`, with the existing schema already applied. It tests ten simultaneous rotations and a refresh/logout race through actual Prisma/Postgres operations. It creates one uniquely identified synthetic user and removes only that fixture's sessions/user on cleanup. It does not migrate, reset, truncate or wipe a database. Neither test ran here; both are explicitly skipped because the isolated target was unavailable.

Real deployed PostgreSQL concurrency, multi-instance BFF/socket behavior, cookie behavior across deployed HTTPS origins, and visible multi-tab marketplace/admin browser workflows remain **blocked/not verified**. Isolated HTTP/socket tests are not a replacement for those checks. No real credentials, user tokens or private document contents were used or printed.

No schema migration is proposed. Existing session rows remain valid; legacy tokens lacking sid require login. Failure responses now include 409 for rotation collisions, logout accepts revocation-only signed expired credentials, and clients retain cookies on failed revocation. Review these compatibility changes and complete the isolated Postgres/visible-browser checks before release. The other audit blockers remain outside this task.
