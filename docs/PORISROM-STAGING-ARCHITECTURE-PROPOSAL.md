# Staging architecture proposal

Prepared 2026-11-03, Asia/Calcutta. This proposal compares two deployment models for the approved [real staging acceptance plan](PORISROM-REAL-STAGING-ACCEPTANCE-PLAN.md) and [isolated staging deployment runbook](PORISROM-ISOLATED-STAGING-DEPLOYMENT-RUNBOOK.md). It makes no infrastructure change and does not select an existing provider, account, region, credential or price.

## Decision summary

**Recommendation: a managed-container staging environment with two backend replicas and managed PostgreSQL**—concretely, an AWS ECS/Fargate service behind an Application Load Balancer (ALB), Amazon RDS for PostgreSQL, a managed secret store and a private container registry.

This recommendation assumes that staging must exercise real HTTPS ingress, Cloudinary private objects, two-instance session revocation and PostgreSQL `LISTEN`/`NOTIFY`, while minimizing the chance that a single operator misses a host, TLS, backup or database-recovery duty. ECS maintains the desired task count and can use a load balancer to distribute traffic; ALB supports WebSocket upgrades. [ECS service documentation](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_CreateService.html) and [ALB listener documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html) support those capability claims.

This is a recommendation for the **staging acceptance phase**, not approval to provision AWS. The VPS option remains viable when a named operator accepts the additional host operations burden and the intent is a low-cost, single-host staging rehearsal rather than host-failure-resilient staging.

## Repository facts that govern either option

| Repository capability | Architecture consequence |
| --- | --- |
| Root Dockerfile produces non-root `backend`, `frontend`, `admin` and opt-in `migrate` images. | Both models can use the existing images. Registry publication, immutable digest use and SBOM/scan evidence remain external work. |
| `deploy/compose.staging.yml` is a local simulation: it includes PostgreSQL, loopback host ports and a one-shot migration profile. | It is directly useful for VPS Compose only after an operator-reviewed override removes local-Postgres coupling. It is a reference, not an ECS deployment definition. |
| Backend uses the PostgreSQL Socket.IO adapter when `SOCKET_ADAPTER=postgres`; readiness verifies its subscribed channel and expected peer count. | Both APIs must use the same dedicated database, `SOCKET_CHANNEL_PREFIX`, adapter mode and `REALTIME_EXPECTED_INSTANCES=2`. The database must support persistent sessions and `LISTEN`/`NOTIFY`; transaction-only pools are unsuitable for the adapter connections. |
| App CORS and server origins require exact HTTPS production origins; frontend/public backend origin is built into the frontend image. | Final marketplace, admin and API hostnames must be approved before building the frontend image. Backend/admin service URLs still require a production-valid HTTPS origin. |
| Private documents use Cloudinary in production; local KYC fallback is disabled. | Both options need an isolated staging Cloudinary cloud/namespace and must test authenticated delivery/expiry/cache behavior through real ingress. |
| `AUTH_TRUST_HOST=true` appears in the staging template. | Each model needs a documented trusted-proxy/header chain before it is enabled; never accept arbitrary forwarded-host headers. |

## Option A — managed containers: ECS/Fargate, ALB, RDS PostgreSQL

### Proposed topology

```text
Internet
  └─ DNS / TLS certificate / optional CDN-WAF
       └─ ALB (HTTPS: marketplace, admin, API host routing)
            ├─ ECS Fargate: frontend service (1+ task)
            ├─ ECS Fargate: admin service (1+ task)
            └─ ECS Fargate: backend service (desired count: 2)
                    └─ RDS PostgreSQL (private subnet; persistent LISTEN/NOTIFY)
                         └─ Socket.IO PostgreSQL adapter

ECS task roles → Secrets Manager / CloudWatch logs
Backend task → staging Cloudinary namespace
```

### Compatibility and two-instance realtime

The existing images map cleanly to separate ECS services/tasks. The migration image is run only as an explicitly approved one-off task before application rollout; it is not a sidecar and does not run on each API replica. ECS services maintain a configured desired count, while ALB distributes service traffic. [AWS documents those service and load-balancing behaviors](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html).

Set the backend service desired count to `2`, `SOCKET_ADAPTER=postgres`, `REALTIME_EXPECTED_INSTANCES=2`, and a staging-only `SOCKET_CHANNEL_PREFIX`. WebSocket connections can be upgraded through an ALB; the connection remains persistent to its selected task. The PostgreSQL adapter propagates rooms/disconnects between replicas, while every packet still validates current session state in the application. ALB has native WebSocket support for HTTP and HTTPS listeners. [AWS ALB documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html) describes that support.

Acceptance must prove cross-task delivery, logout/moderation disconnect, denied reconnect, no duplicate persistence, controlled task drain and adapter outage/recovery. The existing local real-time test is an implementation regression, not a substitute for ingress acceptance:

```powershell
pnpm --filter @porisrom/backend exec vitest run test/realtime-cluster-postgres.spec.ts --maxWorkers=1
```

### Database isolation, backups and recovery

Use a dedicated RDS PostgreSQL instance/database/security group for staging only, in private subnets, with no production peering or shared credentials. Give the runtime identity only connectivity/login rights; use distinct migration, diagnostics and backup/PITR roles. Before any migration, take/verify the approved backup point and rehearse it on an isolated restore target.

RDS automated backups support point-in-time restore within the configured retention period, restoring into a new DB instance rather than overwriting the source. [RDS backup documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html) and [the PITR restore procedure](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html) describe these constraints. The team must still choose retention, RPO/RTO, encryption/key ownership, restore network controls, session revocation after restore and a measured drill; managed backups do not by themselves prove recovery.

### HTTPS, ingress, rate limiting and trusted proxy

Use a single ALB with HTTPS listeners and host-based rules for the marketplace, admin and API. ALB target groups should use the repository health endpoints: backend `/health/ready`, frontend `/auth/login`, and admin `/login`. Keep ECS tasks private and allow inbound traffic only from the ALB security group; RDS accepts traffic only from backend tasks/security group.

The deployment must explicitly choose whether clients may use Socket.IO long polling. If yes, test ALB stickiness/affinity behavior. If WebSocket-only transport is selected, configure and validate it in the browser/client and ingress rather than assuming it. Add an approved WAF/gateway rate-limit policy because the app’s auth limit is process-local. Ensure the proxy sends only the expected forwarded host/proto headers and set `AUTH_TRUST_HOST=true` only after security review. Validate Secure/HttpOnly/Lax cookies, exact `FRONTEND_ORIGIN`, public cache behavior, and private-document cache denial through public HTTPS.

### Secrets and least privilege

Store runtime secrets in AWS Secrets Manager (or a separately approved equivalent). ECS supports references to Secrets Manager secrets; the execution role needs explicit permission and rotated environment-variable secrets require new tasks to receive updated values. [AWS ECS secret-injection guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html) documents both points. Use separate task execution, backend task, migration, CI publisher and human break-glass roles; no role should combine routine runtime, RDS restore and Cloudinary administration rights.

Secrets are still visible to processes and diagnostic tooling inside a task if injected as environment variables. Restrict ECS Exec/debug, redact logs, and rotate by updating the secret then deploying fresh tasks under the approved change process. Do not put secret values in task-definition source, CI logs, repository environments or Docker build arguments.

### Operational complexity, cost categories and failure modes

| Area | Assessment |
| --- | --- |
| Operational complexity | Moderate initially, lower ongoing host-management burden. Requires cloud IAM/networking, ECS/ALB/RDS knowledge and IaC/provider-native definitions not currently in this repository. |
| Recurring cost categories | Fargate task vCPU/memory/ephemeral storage, ALB hourly and traffic/LCU usage, RDS instance/storage/backup/PITR, registry storage/egress, CloudWatch logs/metrics, public IP/NAT/data transfer, DNS/certificates/WAF/CDN, Secrets Manager and Cloudinary. AWS bills Fargate by configured compute/storage consumption and ALB by time/traffic dimensions; use the selected-region calculators rather than copying an example price. [Fargate pricing](https://aws.amazon.com/fargate/pricing/) and [ALB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) explain those dimensions. RDS cost includes database compute, storage and potentially backup/snapshot retention. [RDS pricing](https://aws.amazon.com/rds/pricing/) is the authoritative calculator source. |
| Principal failure modes | Bad target-group health configuration; missing/blocked RDS `LISTEN`; stale secret after rotation without task replacement; incorrect ALB host/header/cache policy; CDN caching private response; task drain terminating a WebSocket; insufficient RDS connections; missing IAM permission during deploy/restore; regional control-plane outage. |
| Mitigations to accept | Two backend tasks, readiness gate, staged rollout/drain test, least-privilege IAM, private network boundaries, CloudWatch/approved alerts, backup/PITR restore drill, ingress and Cloudinary acceptance matrices. |

### Human approvals required

- AWS account, region, network segmentation, DNS/TLS, ALB, WAF/CDN and rate-limit design.
- RDS version/class, single- versus multi-AZ staging intent, connection/session limits, backup/PITR, encryption/key custody, RPO/RTO and restore authority.
- ECS task sizes/desired counts, deployment/drain policy, log retention/redaction, CI/registry, SBOM/vulnerability/provenance policy and immutable-digest promotion.
- Cloudinary staging tenancy/scopes and cleanup authority.
- `AUTH_TRUST_HOST` forwarded-header policy, product/privacy policies and named operational responders.

## Option B — VPS: Docker Compose, reverse proxy and separate managed PostgreSQL

### Proposed topology

```text
Internet
  └─ DNS / TLS certificate / optional CDN-WAF
       └─ Reverse proxy on one hardened VPS (HTTPS + host routing + rate limits)
            ├─ frontend container
            ├─ admin container
            ├─ backend container A
            └─ backend container B
                    └─ Separate managed PostgreSQL over private/TLS connection
                         └─ Socket.IO PostgreSQL adapter

VPS secret delivery → containers
Backend containers → staging Cloudinary namespace
```

### Compatibility and two-instance realtime

This is closest to `deploy/compose.staging.yml` and can reuse its services, health checks, non-root images and one-off `migrate` target. It requires a **new, operator-reviewed Compose override**: remove the local `postgres` service dependency when a managed `DATABASE_URL` is used; remove fixed per-backend host-port publication; keep only the reverse proxy public; and define two distinct backend services/containers or an internal-only scaled service.

Do not run `docker compose up --scale backend=2` against the repository template as written: both replicas would contend for `127.0.0.1:4400`. A proxy must route `/socket.io/` upgrades to either backend, and both need the same realtime settings described for Option A. Test long-poll affinity if it remains enabled; otherwise explicitly verify the WebSocket-only configuration. The PostgreSQL adapter makes cross-container rooms/disconnects possible, but the two containers share one VPS failure domain.

### Database isolation, backups and recovery

Use a dedicated managed PostgreSQL service/database and a private/TLS path from the VPS; do not run the application database on the VPS. The provider must document support for persistent `LISTEN`/`NOTIFY` sessions, connection limits, encrypted backups/PITR and restoration to a new isolated target. Apply the same separate runtime/migration/diagnostic/restore role model as Option A.

The VPS option avoids database administration but not application recovery responsibility: after a restore, validate migrations/schema/fingerprints, prevent outbound integrations, revoke restored sessions under the approved plan, and reconcile Cloudinary assets separately. The existing local backup rehearsal remains useful only as a guarded local check:

```powershell
node scripts/rehearse-security-backup.mjs
```

### HTTPS, ingress, rate limiting and trusted proxy

Use one supported reverse proxy (for example, an organization-approved Nginx, Caddy or Traefik deployment) as the only public listener. It must terminate TLS, route the three exact hosts, preserve required WebSocket upgrade headers, restrict `X-Forwarded-*` headers to proxy-generated values, define request/body/idle timeouts, deny unexpected hosts, and set distinct cache rules for public assets versus private documents. It must implement the approved WAF/rate-limit policy before external staging access.

`AUTH_TRUST_HOST=true` is safe only if the proxy strips client-supplied forwarded headers and establishes trusted headers itself. The VPS firewall must allow public traffic only to proxy ports; Docker service ports, SSH management, database traffic and observability endpoints must be restricted to approved networks/identities.

### Secrets and least privilege

Prefer the organization’s secret manager with short-lived/operator-audited retrieval. If Compose secrets are used, use the deployment mechanism’s supported secret mount path and keep the secret file outside the checkout; Docker notes that Compose secrets are mounted only into services explicitly granted access. [Docker Compose secrets documentation](https://docs.docker.com/compose/how-tos/use-secrets/) describes the model.

Separate VPS host administration, deployment automation, reverse-proxy configuration, runtime container access, database migration access, database restore access and Cloudinary administration. Disable routine shell access to application containers, restrict SSH to named administrators with MFA, and do not expose `.env` files through backups, image layers, diagnostics or process listings.

### Operational complexity, cost categories and failure modes

| Area | Assessment |
| --- | --- |
| Operational complexity | Lower initial infrastructure setup if the team already operates a hardened VPS; materially higher ongoing responsibility for OS patching, Docker engine, proxy/TLS renewal, disk pressure, host monitoring, firewalling, intrusion response, deploy rollback and secret delivery. |
| Recurring cost categories | VPS compute/disk/snapshot/backup, managed PostgreSQL compute/storage/PITR, IP/bandwidth, DNS/TLS, CDN/WAF/rate-limiting, registry, monitoring/log retention, secret management and Cloudinary. Obtain current regional/provider quotes at approval time; no price is assumed here. |
| Principal failure modes | Single VPS loss affects both API replicas, frontend/admin and proxy; kernel/Docker/volume pressure; reverse-proxy misrouting or header spoofing; missed patch/certificate renewal; accidental port exposure; host-level secrets access; database connectivity exhaustion; deployment that restarts both APIs simultaneously. |
| Mitigations to accept | Hardened/patch-managed VPS, off-host encrypted backups, monitoring/alerts, firewall and SSH controls, separate managed PostgreSQL, reverse-proxy peer review, explicit drain/restart procedure, testable rollback and optionally a second VPS/load balancer if host failure resilience is required. |

### Human approvals required

- VPS provider/region/size, hardening baseline, admin/MFA/SSH policy, patch ownership, host backup/restore and off-host evidence storage.
- Reverse proxy choice/configuration, DNS/TLS/CDN/WAF/rate limits, header trust model and Socket.IO transport/affinity policy.
- Managed PostgreSQL provider/version/networking/session support, backup/PITR/RPO/RTO/restore authority.
- Compose override design for managed DB/two private API containers, registry/digest/scan policy and deployment rollback process.
- Cloudinary isolation/cleanup, policy/operational ownership and staging-data restrictions.

## Comparative decision matrix

| Criterion | Option A: managed ECS/Fargate + RDS | Option B: VPS + Compose + managed PostgreSQL |
| --- | --- | --- |
| Current image compatibility | Direct; requires provider-native task/service definitions. | Direct; requires a peer-reviewed Compose override. |
| Two API replicas | Separate scheduler tasks and load-balancer targets; task-level failure isolation. | Two containers can verify adapter behavior, but on one VPS they share host failure. |
| WebSocket ingress | ALB native support; still requires timeout/drain and transport acceptance. | Proxy-dependent; full responsibility for upgrade/header/timeout/affinity configuration. |
| Database recovery | Managed RDS automated backup/PITR features; still needs policy and drill. | Managed DB can provide same class of recovery; VPS does not improve DB recovery. |
| Secrets | IAM-scoped managed secret references; rotation requires new tasks when injected as env. | Organization secret-manager or Compose secret integration; stronger host-access controls required. |
| Operational ownership | Cloud/IAM/IaC discipline; less host maintenance. | Smaller platform footprint, substantially more host/proxy maintenance. |
| Cost shape | Metered compute, load balancer, database, network and observability components. | Predictable VPS base plus managed DB and operational/security add-ons; host HA raises cost/complexity. |
| Best fit | Acceptance environment intended to resemble a scalable, operationally managed production topology. | Budget-constrained, temporary synthetic staging with an experienced host operator and explicit acceptance of a single-host failure domain. |

## Unresolved decisions and recommendation conditions

Approve **Option A** if all of the following are true:

1. The organization can use an AWS account/region and maintain provider-native infrastructure definitions outside this repository.
2. Staging must demonstrate two-replica behavior beyond two containers sharing one host.
3. The team prefers managed backup/PITR, task scheduling and load balancing over VPS host administration.
4. The higher number of metered services is acceptable within the approved staging budget.

Choose **Option B** only if the following are explicitly accepted:

1. A named operator owns hardening, patches, reverse-proxy configuration, TLS, backup evidence, monitoring and incident response.
2. A single VPS is sufficient for staging acceptance; it does not demonstrate host-level availability. If that is not sufficient, use two VPS instances plus a load balancer, which narrows the operational difference with Option A.
3. An organization-approved managed PostgreSQL provider supports persistent adapter sessions and PITR/restore drills.
4. The required Compose override and proxy configuration are peer-reviewed before deployment.

Still requiring human decisions under either option: exact region and data residency, hostnames, CDN/WAF/ingress rate limits, Cloudinary tenancy, image registry/SBOM/scan/signing policy, RDS/managed-DB backup retention and RPO/RTO, alert responders, rollback authority, credential-recovery/appeal policy, retention/erasure/holds and the treatment of any non-synthetic staging data.

## Evidence and non-claims

No real provider configuration, price quote, capacity estimate, Cloudinary operation, database migration, deployment, hosted CI run or acceptance result was performed for this proposal. Prices vary by region, consumption, commitment and provider terms; approval must use current official calculators/quotes. This document does not make the staging environment accepted; the acceptance plan remains the release gate.
