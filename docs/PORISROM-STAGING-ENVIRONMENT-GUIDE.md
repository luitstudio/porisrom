# Staging environment guide

Candidate review: 2026-10-28. No deployment was performed. Read the [readiness report](PORISROM-STAGING-READINESS-REPORT.md) for actual evidence and outstanding gates. Existing developer `.env` and `docker-compose.yml` are preserved.

## Configuration contract

Use `deploy/staging.env.example` as a names-only template. Store the populated copy outside the checkout in the deployment secret manager. Never paste it into logs, issue reports, image build arguments, or CI artifacts. Replace every `<SUPPLY_...>` placeholder. These are not usable credentials or proposed hostnames.

| Component | Required values and checks |
| --- | --- |
| PostgreSQL | Operator-owned staging database, restricted application user, TLS as required by platform, bounded connections. `DATABASE_URL` must identify the reviewed environment. Compose's internal hostname is `postgres`; external platform URLs come from the operator. Do not reuse developer/production volumes. |
| API | `NODE_ENV=production`, distinct independently generated `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` of at least 32 characters; `HOST=0.0.0.0`, `PORT=4000`. Defaults remain access 15 minutes / refresh 7 days unless the owner approves changes. |
| API/browser origins | `BACKEND_URL`, `BACKEND_PUBLIC_URL`, `NEXT_PUBLIC_BACKEND_URL`: exact approved HTTPS origins. Marketplace/admin server helpers reject HTTP, loopback, credentials, paths and query strings in production. `NEXT_PUBLIC_BACKEND_URL` is a public **build-time** input; rebuild when changing it. Server-side `BACKEND_URL` must also be reachable from application containers. |
| CORS | `FRONTEND_ORIGIN` is a comma-separated list of exact marketplace and admin HTTPS origins. No `*`, path, credentials, query, hash or loopback. Include only intended origins. CORS is not an authorization boundary. |
| Marketplace authentication | Separate `AUTH_SECRET`, correct public HTTPS `AUTH_URL`, `AUTH_TRUST_HOST=true` only behind a trusted proxy which overwrites forwarded host/proto headers and rejects unapproved hosts. Never expose the API JWT secrets to the browser build. |
| Cookies | Backend and admin use HTTP-only, Secure cookies in production; SameSite=Lax. NextAuth uses secure cookies on HTTPS. Prefer same-site subdomains; unrelated cross-site cookie requests are not supported by Lax. The BFF uses bearer authentication for API calls; Socket.IO authenticates its access token. Do not switch to SameSite=None without a reviewed CSRF/cross-site design. Verify proxy TLS forwarding and logout/expiry in real Chrome. |
| Storage | Verified **staging-only** Cloudinary cloud/key/secret. Authenticated private delivery must be enabled. `KYC_LOCAL_FALLBACK_ENABLED=false`; production private writes cannot fall back to local storage, including on cloud failure. No cloud credentials were used in this task. Public asset storage volume is distinct from private documents. |
| Realtime | `SOCKET_ADAPTER=postgres`, unique environment-specific `SOCKET_CHANNEL_PREFIX` (1–40 letters/digits/`_.:-`), `REALTIME_EXPECTED_INSTANCES` matching the intended replica count. Session-mode/direct PostgreSQL is required for LISTEN/NOTIFY; transaction-pooling connections are unsuitable. Budget up to four additional adapter connections per API instance. No Redis is required. |
| Email/recovery | No approved email/identity provider exists in the current architecture. Authenticated support is available; self-service password reset and blocked/deleted-account recovery remain gated. Do not add pretend email configuration. |
| Operations | Platform secret manager, TLS termination, controlled ingress, encrypted backups, log collection, alerts and on-call destination must be supplied and tested by the operator. These are not provisioned by Compose. |

The repository validates CORS/auth secrets at startup. Private storage refuses production local fallback. Supply the same vetted public API origin to all URL settings and verify the actual proxy route; `BACKEND_PUBLIC_URL` is an operator-reviewed storage-link input, not a substitute for the browser URL checks.

## Image and Compose procedure

The root `Dockerfile` has `backend`, `frontend`, and `admin` targets. Node 24.11.0 and pnpm 9.0.0 match local verification. Runtime processes use the `node` user, init/restart controls and health checks. `.dockerignore` excludes credentials, uploads, dumps, Git data and local build output. The initial image contains workspace build dependencies to preserve pnpm symlinks; image minimization and vulnerability scanning remain release gates. Review and pin approved image **digests** before production. Image builds were not run because Docker's daemon was unavailable.

`deploy/compose.staging.yml` uses a separate `porisrom-staging-simulation` project and new named volumes. It does not replace or reference existing developer volumes. PostgreSQL 18 uses its version-appropriate `/var/lib/postgresql` volume root. No database port is published; application ingress binds loopback for a locally configured TLS proxy. Platform ingress, certificates and domains must be supplied; this file does not create them.

Before any command that mutates staging, obtain authorization for that specific database/environment. Merely preparing this guide does not authorize deployment. With an operator-owned populated environment file:

```sh
docker compose --env-file /operator/staging.env -f deploy/compose.staging.yml config --quiet
docker compose --env-file /operator/staging.env -f deploy/compose.staging.yml build backend frontend admin
docker compose --env-file /operator/staging.env -f deploy/compose.staging.yml up -d postgres
```

Do not print rendered Compose configuration: it expands secrets. Verify the database identity and an encrypted backup/restore point before the next step. Migration is a separate, opt-in one-shot service; application startup does not migrate:

```sh
docker compose --env-file /operator/staging.env -f deploy/compose.staging.yml --profile migration run --rm migrate
docker compose --env-file /operator/staging.env -f deploy/compose.staging.yml up -d backend frontend admin
```

These commands are instructions for an authorized operator and were **not executed here**. Do not use `down -v`, reset, `db push`, destructive rollback, or volume cleanup. Scaling requires unique ingress routing and sufficient database limits. Socket.IO HTTP long polling requires sticky sessions even with a shared adapter; otherwise configure and verify WebSocket-only transport at both ends. Configure replica readiness expectations carefully during rolling releases: a missing required peer deliberately makes readiness fail. Liveness is `/health`; dependency readiness is `/health/ready` (database plus adapter subscription/peer discovery). Graceful shutdown is enabled.

## Migration rehearsal and compatibility

There are now 14 ordered migrations. `20261028000000_product_safety` adds block/case/history tables, enum types, unique active keys, indexes, restrictive foreign keys and the adapter attachment table. It does not drop data or change old migrations. Existing auth/payment/private-storage schema remains intact. Deploy schema first, then application images. Old application versions do not enforce user blocks: once blocking is enabled, rolling back to a pre-safety binary weakens authorization and requires isolating marketplace writes until forward repair. Do not drop new history tables to roll back an application.

Local rehearsal commands use only the verified task-owned temporary cluster:

```sh
node scripts/with-security-test-db.mjs migrate-deploy
node scripts/with-security-test-db.mjs migrate-status
node scripts/with-security-test-db.mjs schema-diff
node scripts/rehearse-security-backup.mjs
node scripts/verify-release.mjs --isolated-state
```

On a newly authorized disposable staging clone, use the same pinned dependency installation, `pnpm --filter @porisrom/database exec prisma migrate deploy`, `migrate status`, and `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. Verify the current database/server identity independently first. Compare each migration file SHA-256 with `_prisma_migrations.checksum`, check `finished_at` and absence of unfinished/rolled-back rows, and check all FKs/indexes. Never repair migration history by editing checksums to silence a failure. Follow the [incident runbook](PORISROM-INCIDENT-RESPONSE-RUNBOOK.md).

## Private storage acceptance

Use only synthetic accounts and synthetic PDFs/images in an explicitly authorized staging storage namespace. Capture status, cache headers, expiry and database/provider IDs in restricted evidence; never capture document contents or signed URLs in general logs. Run each case through the **actual public HTTPS ingress/CDN**, then repeat owner/admin access directly through the approved origin where allowed.

| Test | Expected result |
| --- | --- |
| Public freelancer photo and company logo | Valid supported image <=2 MiB uploads and displays; malformed/spoofed types and oversized files fail; no private PDF becomes public. |
| Freelancer identity PDF | Valid <=1 MiB PDF accepted under existing review rules. Replacement only when policy permits; old private asset remains protected. |
| Company PDFs | One certificate + up to four Aadhaar PDFs, <=1 MiB each; five allowed files pass the 8 MiB action transport. Excess count/size or invalid PDF fails. |
| Owner/admin download | Authorized access works; file bodies and signed redirects/metadata use `Cache-Control: private, no-store`. API response must not be cached. |
| Unauthorized access | Anonymous 401; wrong role/account denied; guessed IDs, encoded traversal, legacy static document paths and alternate cloud delivery URLs cannot expose data. Existing local HTTP regressions cover these paths. |
| Signed expiry | With a synthetic private object, verify access before and denial after the configured five-minute signature lifetime, including CDN caches. Never assume the provider enforces expiry from URL shape alone. |
| Replacement/cleanup | Replace permitted documents, verify DB references and deletion of old object; force provider deletion failure and track the orphan for authorized manual reconciliation. No general evidence deletion job is authorized. |
| Provider/DB failures | Fail upload, metadata persistence and old-object deletion independently. No public/local production fallback, no misleading success; DB history and prior authorized object remain consistent. |
| Retry/reload | Fail a later upload after saving a profile/photo. Retry only pending selected files; reload restores saved profile fields/links, and missing files can be reselected. Previously uploaded private file bytes are never put in browser storage. |
| Proxy/cache | Bypass caching for authenticated API/document endpoints and redirects; forward auth and WebSocket upgrades; do not log Authorization, Cookie, query signatures or response Location. Recheck with a second unauthorized browser after an authorized download. |

Cloudinary delivery/expiry, actual ingress caching, certificate setup and maximum upload size at the ingress are **blocked pending staging access**. Local tests cannot establish these outcomes.
