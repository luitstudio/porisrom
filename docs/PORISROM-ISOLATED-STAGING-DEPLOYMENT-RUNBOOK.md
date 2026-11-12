# Isolated staging deployment runbook

Prepared 2026-11-03, Asia/Calcutta. This runbook implements the deployment-preparation portion of the approved [real staging acceptance plan](PORISROM-REAL-STAGING-ACCEPTANCE-PLAN.md). It is an operator procedure, not a deployment authorization. No command below may be run against a cloud account, shared environment or production system until the applicable confirmation gate has been recorded by the designated owner.

Use an isolated, synthetic-data-only staging environment. It must not share a database, Cloudinary cloud/namespace, secret set, DNS hostname, storage bucket, private network, image tag or persistent volume with production.

## 1. Current repository deployment contract

| Component | Existing contract | Staging implication |
| --- | --- | --- |
| Images | The root `Dockerfile` builds `backend`, `frontend`, `admin` and opt-in `migrate` targets. App runtimes are non-root and production builds sanitize generated standalone output. | Build or pull the exact approved candidate; record each immutable image digest. The default Node base image is a tag, so the release owner must approve/pin its resolved digest in the delivery system. |
| Compose | `deploy/compose.staging.yml` is named `porisrom-staging-simulation`, binds application ports to loopback and starts a local PostgreSQL service. Migrations are a one-shot profile and never run as part of app startup. | It is appropriate as a reviewed local/container rehearsal template. It is **not** a turnkey managed-host staging manifest. Do not point it at a shared database and do not expose its loopback ports directly. |
| Configuration | Backend rejects unsafe production auth origins/secrets and local private-document fallback. Frontend/admin require a credential-free HTTPS `BACKEND_URL` in production. | Supply all runtime values through the approved staging secret manager; provide public browser API origin at image build and correct server API origin at runtime. |
| Realtime | PostgreSQL Socket.IO adapter, `SOCKET_CHANNEL_PREFIX` and `REALTIME_EXPECTED_INSTANCES` are supported. | Managed PostgreSQL must permit persistent `LISTEN`/`NOTIFY` sessions; use a staging-unique channel prefix and set expected instances to `2` for the multi-instance test. |
| CI | `.github/workflows/verify.yml` frozen-installs dependencies, runs release checks and builds unpushed local Docker targets. | Hosted CI, registry publication, digest promotion, SBOM, scans and provenance are still an approved-pipeline responsibility. |

## 2. Infrastructure requirements and minimum access

| Resource | Minimum staging requirement | Minimum access |
| --- | --- | --- |
| Compute/orchestrator | Three independently deployable services (backend with two replicas, frontend, admin); health checks; rolling drain/restart; private east-west network. | Deployer can create/update only the isolated staging service set; operator can view events/logs and drain one backend replica. |
| Ingress/CDN/DNS/TLS | Three HTTPS hosts: marketplace, admin and API; Host routing; WebSocket upgrade support; defined HTTP long-poll affinity or verified WebSocket-only policy; cache rules that prohibit private-document caching. | Read access plus a separately approved change/release action. |
| PostgreSQL | Dedicated staging database, TLS/private networking, persistent-session `LISTEN`/`NOTIFY`, capacity for two APIs plus migrations; backups and an isolated restore target. | Separate migration, runtime, read-only diagnostics and backup/PITR restore roles. Runtime role must not own backup/PITR administration. |
| Cloudinary | Separate staging cloud or strictly isolated namespace; authenticated private object delivery, audit visibility and approved synthetic-object cleanup. | Credentials limited to staging upload/delivery/replacement needs; Cloudinary console/audit access is separate. |
| Secret manager | Versioned secret records, deployment identity access, access audit and rotation procedure. | Read/inject permission for deployment identity; humans use audited, least-privilege access only. |
| Registry/CI security | Private registry, immutable digest retrieval, hosted CI logs, SBOM/scan storage and approval workflow. | Read candidate workflow and artifacts; publisher/promotion approval separate from deployer. |
| Observability/operations | Metrics/logs with redaction, synthetic probes, alert routing, incident channel and release/rollback evidence location. | Configure/test staging signals only; named responders acknowledge test alerts. |

## 3. Staging environment-variable checklist

Create an operator-owned, untracked secret-manager configuration from `deploy/staging.env.example`. The repository checklist uses names only; never add values to this file, commit one, or print a rendered environment.

### Backend/runtime

- `NODE_ENV`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `FRONTEND_ORIGIN`
- `BACKEND_PUBLIC_URL`
- `PORT`
- `HOST`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `KYC_LOCAL_FALLBACK_ENABLED`
- `PROFILE_PHOTO_UPLOAD_DIR`
- `PRIVATE_DOCUMENT_UPLOAD_DIR`
- `KYC_DOCUMENT_UPLOAD_DIR`
- `SOCKET_ADAPTER`
- `SOCKET_CHANNEL_PREFIX`
- `REALTIME_EXPECTED_INSTANCES`

### Marketplace frontend

- `NODE_ENV`
- `BACKEND_URL`
- `NEXT_PUBLIC_BACKEND_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST`
- `HOSTNAME`
- `PORT`

### Admin frontend

- `NODE_ENV`
- `BACKEND_URL`
- `HOSTNAME`
- `PORT`

### Compose-local database only

These are required only when the isolated local PostgreSQL service in `deploy/compose.staging.yml` is deliberately used. A managed database deployment uses its provider configuration and must not duplicate credentials in Compose.

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

## 4. Template review: decisions and unsafe assumptions

| Existing setting or omission | Risk or limitation | Required disposition before staging |
| --- | --- | --- |
| `deploy/compose.staging.yml` includes `postgres` and fixed loopback ports. | It can accidentally be mistaken for a managed-platform deployment and cannot map two backend replicas to the same host port. | Choose either an isolated Compose-hosted database or a managed dedicated database. Use platform service discovery/ingress for two backend replicas; do not use `docker compose up --scale backend=2` against the current fixed-port service. |
| Compose `backend` depends on the local `postgres` service. | That dependency is unsuitable if `DATABASE_URL` targets a managed database. | Produce an operator-reviewed platform manifest/override after the database decision. It must remove the local-Postgres dependency and retain explicit migration control. |
| `AUTH_TRUST_HOST=true` is in the staging template. | It is valid only if the ingress correctly controls forwarded host headers. | Security/infra owner must approve trusted proxy/header handling; otherwise provide the approved Auth.js deployment configuration. |
| Image build accepts `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL`. | Browser API origin is compiled into frontend assets; a post-build secret-manager update cannot correct a wrong public origin. | Lock final HTTPS hostnames before image build and deploy only images built for those public origins. They must contain no credentials. |
| `NODE_IMAGE` defaults to a tag. | Tags are mutable and do not by themselves establish supply-chain provenance. | Resolve and record the approved Node base digest in the CI/release system; decide whether the Dockerfile itself will be digest-pinned in a separately reviewed change. |
| CI builds but does not publish, scan or attest images. | No hosted evidence, promoted digest, SBOM or vulnerability disposition exists. | Approve the registry/CI security pipeline before production. An isolated staging test may use manually approved images only if release policy permits. |
| No ingress/CDN platform manifest exists. | The repository intentionally avoids guessing a cloud provider; actual cache/TLS/affinity settings are not represented. | Infrastructure owner supplies provider-native configuration and peer-reviews it against this runbook. |
| No shared ingress rate-limit service is configured. | Authentication rate limits are process-local. | Approve WAF/gateway/shared rate-limit policy before public staging exposure or production. |

## 5. Provisioning and deployment procedure

Every gate requires a written approval reference, owner and timestamp in restricted release evidence. Stop when a gate fails; do not work around it by weakening HTTPS, storage or authorization controls.

### Gate A — isolation and ownership (before any external resource exists)

Confirm all of the following:

- A unique staging environment identifier, hostnames, database and Cloudinary namespace are approved.
- The environment is synthetic-data-only and has a documented cleanup owner.
- The release owner approves the candidate Git SHA and the infrastructure owner approves the target platform.
- No production resource, credential, network, database, namespace or data is in scope.
- A rollback/backup point and an incident channel exist before migration or user-flow testing.

Safe repository-only review commands:

```powershell
git rev-parse HEAD
git status --short
git ls-files deploy Dockerfile .github/workflows/verify.yml
```

### Gate B — hosted candidate verification and artifact selection

Obtain the hosted CI result for the approved SHA. Security/release owner records the image registry paths and immutable digests outside the repository. Do not deploy a mutable tag.

```powershell
# Read-only local checks; they do not contact a registry or cloud account.
git rev-parse HEAD
Get-Content .github/workflows/verify.yml -Raw
```

Before a registry push/promotion or any cloud deployment, require explicit release-owner confirmation that hosted CI passed and that SBOM/vulnerability/provenance policy has been applied.

### Gate C — secret injection and configuration validation

The operator creates the secret-manager records using the name-only checklist above. The values remain outside the checkout. Confirm: distinct JWT secrets, production mode, exact HTTPS origins, Cloudinary staging-only identity, `KYC_LOCAL_FALLBACK_ENABLED=false`, `SOCKET_ADAPTER=postgres`, a unique channel prefix and a deliberate `REALTIME_EXPECTED_INSTANCES` value.

For a deliberate isolated Compose rehearsal only, run this command from an operator-owned secret file that is outside the repository. It checks syntax but must not have its expanded output redirected to logs:

```powershell
docker compose --env-file <operator-owned-staging-env-file> --file deploy/compose.staging.yml config --quiet
```

Require infrastructure/security confirmation before creating secret records, applying a deployment manifest or exposing any hostname.

### Gate D — database and migration rehearsal

Database owner confirms target identity, encrypted backup/PITR point, restore procedure, migration role and no active production connection. First rehearse all committed migrations on an isolated clone/empty staging database. Do not use `db push`, `migrate reset`, destructive rollback or automatic migrations in application replicas.

After the rehearsal passes, the database owner may explicitly authorize one migration job using the image's `migrate` target. Record migration status, migration checksums and schema-drift evidence without database URLs or credentials.

Local guarded evidence command only:

```powershell
node scripts/rehearse-security-backup.mjs
```

### Gate E — deploy one backend replica behind private ingress

Deploy backend, marketplace and admin from approved immutable images. Keep backend/admin service ports private; ingress is the sole public entry point. Verify `/health` and `/health/ready`, valid public TLS, exact CORS, cookie login/logout and private-cache denial before allowing acceptance users.

Before exposing the hosts, require infrastructure approval of DNS/TLS/Host routing/CDN cache policy and security approval of `AUTH_TRUST_HOST`/forwarded-header behavior.

### Gate F — scale to two API instances and verify realtime

Deploy two backend replicas through the platform orchestrator, both with identical runtime configuration except instance identity. Set `SOCKET_ADAPTER=postgres`, a staging-unique `SOCKET_CHANNEL_PREFIX`, and `REALTIME_EXPECTED_INSTANCES=2`. The managed PostgreSQL endpoint must preserve the long-lived connections required for adapter `LISTEN`/`NOTIFY`.

Do not use the existing Compose `--scale backend=2` command: its fixed `127.0.0.1:4400:4000` host mapping makes that unsafe/non-functional. A provider-native service definition or peer-reviewed Compose override without per-replica host-port publishing is required.

Acceptance sequence through real ingress:

1. Confirm both replicas report ready only once database and adapter peer discovery are healthy.
2. Connect a synthetic browser/socket to replica A; route an authenticated message write through replica B; prove one persisted message and one delivered event.
3. Logout and moderation through B; prove A disconnects and rejects revoked reconnect while permitted historical reads continue.
4. Drain/restart one replica; verify no duplicate messages, current authorization on reconnect and recovery of readiness.
5. In an approved fault window, interrupt adapter/database connectivity; verify degraded readiness, redacted telemetry/alert delivery and safe recovery.

Existing regression reference (run only with an explicitly isolated staging test configuration):

```powershell
pnpm --filter @porisrom/backend exec vitest run test/realtime-cluster-postgres.spec.ts --maxWorkers=1
```

### Gate G — acceptance evidence and controlled cleanup

Complete all approved-plan matrices, including private storage, provider failures, ingress behavior, two-instance sockets, backup/PITR and alerts. Do not call staging accepted merely because deployment succeeds.

## 6. Acceptance evidence handling

Create a restricted evidence record per run containing:

- candidate Git SHA and immutable digest per service;
- staging hostnames and environment identifier;
- date/time, operator, approval references and synthetic account namespace;
- redacted command names, exit status, timing and pass/fail criteria;
- certificate/HTTPS/CORS/cache-header observations without cookies or signed URLs;
- migration version/checksum/schema status;
- Cloudinary outcomes using redacted provider IDs only;
- two-instance routing, drain/recovery and alert acknowledgement results;
- backup/PITR/restore timing, RPO/RTO comparison and cleanup record.

Keep evidence out of the Git repository and general CI artifacts if it could include sensitive infrastructure data. Apply the existing restrictions from [the staging acceptance report](PORISROM-STAGING-ACCEPTANCE-REPORT.md) and [the incident runbook](PORISROM-INCIDENT-RESPONSE-RUNBOOK.md).

## 7. Staging cleanup and preservation

Cleanup is a separately approved action after evidence has been retained and release/incident owners agree the environment is no longer needed.

1. Revoke synthetic users' sessions and disable ingress before deleting any test identity.
2. Preserve required sanitized evidence, image digests, migration/restore records and incident timelines in the restricted evidence location.
3. Delete only the identified synthetic Cloudinary objects/namespace using the approved provider procedure; record orphan outcomes rather than deleting uncertain objects.
4. Retire the isolated staging compute services, DNS records, secrets, database and backups according to the approved retention/hold policy. Never use a broad production/shared cleanup command.
5. Verify the unique staging resources—not merely names matching a pattern—were removed or retained as approved. Record the final state and any intentional retention.

Do not run `docker compose down -v`, platform-wide prune/reset operations, or destructive database commands against an environment unless the exact target was independently verified and an authorized cleanup owner approved it.

## 8. Decisions requiring human approval

1. Staging platform and deployment model: managed database/orchestrator/ingress versus an isolated Compose-hosted rehearsal; a platform-native manifest is required for the former.
2. Exact isolated hostnames, DNS/TLS/CDN/WAF/cache rules, WebSocket upgrade and affinity/transport policy.
3. Trusted-proxy/header model behind `AUTH_TRUST_HOST=true`.
4. Staging-only Cloudinary tenancy/namespace, least-privilege credential scopes and synthetic-object cleanup authority.
5. Database provider, persistent `LISTEN`/`NOTIFY` compatibility, migration/backup roles, encryption/key custody, backup retention, PITR window, RPO/RTO and restore/cutover authority.
6. Registry, immutable image digest, Node base-image digest, SBOM/vulnerability/provenance/signing thresholds and exception authority.
7. Monitoring telemetry destination, alert thresholds, named responders, incident channel and rollback/drain authority.
8. Public-ingress rate-limit/WAF policy, because application auth rate limits are process-local.
9. Credential-recovery, appeals, retention/erasure/holds, support/moderation/dispute ownership and review expectations before any real personal data or production promotion.
