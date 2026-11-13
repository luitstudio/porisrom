# AWS staging implementation plan

Prepared 2026-11-03, Asia/Calcutta. This is an implementation-ready design for the managed-container option approved in [the staging architecture proposal](PORISROM-STAGING-ARCHITECTURE-PROPOSAL.md). It describes resources, dependencies, acceptance checks and approvals; it is **not** infrastructure-as-code, a deployment instruction, authorization to create AWS resources, or a production configuration.

All names below are logical roles only. The account, region, identifiers, CIDRs, domains, secret values, database engine minor version, instance sizes and resource tags must be approved before provisioning. Staging remains isolated and synthetic-data-only.

## 1. Target architecture and dependencies

```text
Public DNS
  └─ ACM certificate + optional approved CDN/WAF
       └─ Internet-facing ALB (HTTPS, host rules)
            ├─ marketplace target group → ECS/Fargate frontend service
            ├─ admin target group       → ECS/Fargate admin service
            └─ API target group         → ECS/Fargate backend service (desired count: 2)
                                           └─ RDS PostgreSQL (private)
                                                └─ PostgreSQL Socket.IO adapter

ECR (private immutable images) ───────→ ECS task execution role
Secrets Manager ──────────────────────→ ECS task execution role / task startup
CloudWatch Logs, metrics, alarms ────→ ECS/RDS/ALB observability
Backend tasks ────────────────────────→ staging-only Cloudinary namespace
```

| Dependency order | AWS resource or configuration | Purpose / repository mapping |
| --- | --- | --- |
| 1 | AWS account boundary, region, tags, budgets and audit logging | Isolates staging ownership/costs; no repository value can determine these. |
| 2 | VPC, Internet Gateway, route tables, two public subnets and at least two private application/database subnets across separate Availability Zones | Supplies ALB public reachability and private Fargate/RDS reachability. RDS DB subnet groups require subnets; AWS recommends two or more AZ subnets even when initially Single-AZ. [RDS VPC guidance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html). |
| 3 | Security groups, private egress design and optionally VPC endpoints | Limits public access to ALB and private access to tasks/database. Choose NAT gateway(s) or the approved endpoint/egress strategy before launch; Cloudinary needs controlled outbound HTTPS access. |
| 4 | ACM certificate and DNS validation; ALB, HTTPS listener and target groups | Provides exact marketplace, admin and API HTTPS hosts, health checks and WebSocket-compatible routing. ALB supports WebSocket upgrades. [ALB documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html). |
| 5 | ECR repositories, lifecycle policy, scan policy and immutable-image process | Stores `backend`, `frontend`, `admin` and `migrate` image artifacts by digest. ECR enhanced scanning can continuously scan OS and language packages via Amazon Inspector. [ECR scanning documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html). |
| 6 | RDS PostgreSQL, DB subnet group, parameter group, security group, backups/PITR and monitoring | Dedicated private database and Socket.IO adapter backplane. |
| 7 | Secrets Manager records, KMS/key policy as approved, and IAM roles | Provides staging-only runtime configuration outside Git and least-privilege retrieval. |
| 8 | ECS cluster, task definitions, services and one-off migration task definition | Runs frontend/admin and exactly two backend tasks from immutable digests. ECS services maintain desired task count. [ECS service behavior](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_CreateService.html). |
| 9 | CloudWatch log groups, dashboards, alarms, synthetic probes and incident notification destination | Required to verify health/readiness, backplane, RDS and ingress failure behavior. |

## 2. VPC, subnets and security groups

### Network layout

| Segment | Placement | Permitted role |
| --- | --- | --- |
| Public subnets | At least two AZs | Internet-facing ALB only, plus NAT gateways only if that egress choice is approved. No ECS task or RDS public address. |
| Private application subnets | At least two AZs | Fargate tasks for frontend, admin, backend and one-off migration. Tasks use `awsvpc` mode; that is required for Fargate and permits task-level security groups. [ECS network-security guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-network.html). |
| Private database subnets | At least two AZs; a dedicated RDS DB subnet group | RDS PostgreSQL only. `Publicly accessible` is `false`; no public IP or public security-group rule. |
| Administrative access | No routine bastion is required for application tasks. | Use narrowly approved break-glass/VPN/SSM procedures, read-only diagnostics and audited sessions. Direct public RDS access is prohibited. |

### Required security groups

| Security group | Inbound | Outbound | Notes |
| --- | --- | --- | --- |
| ALB | TCP 443 only from the approved internet/CDN/WAF sources; optional TCP 80 only for a documented redirect/challenge path | To frontend/admin/backend task security groups on their listener ports | Deny unrecognized host routing at ALB/app configuration; certificate terminates here unless a different reviewed policy is selected. |
| Frontend task | TCP 3000 only from ALB SG | HTTPS egress only as required for backend public origin, DNS, logs, ECR/Secrets endpoints and approved telemetry | Never public IP/direct internet listener. |
| Admin task | TCP 3001 only from ALB SG | HTTPS egress only as required for backend public origin, DNS, logs, ECR/Secrets endpoints and approved telemetry | Restrict access at the ALB host rule; application authorization remains mandatory. |
| Backend task | TCP 4000 only from ALB SG | TCP 5432 to RDS SG; HTTPS to Cloudinary and AWS service endpoints; DNS as needed | Must not accept arbitrary VPC-wide inbound traffic. |
| RDS | TCP 5432 only from backend task SG and separately approved one-off migration task SG | AWS-managed return traffic only | Security-group reference—not CIDR-wide access—is preferred. RDS private access limits reachability to the VPC/connected private paths. [AWS RDS private-access guidance](https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/security-public-private.html). |
| Migration task | No inbound | TCP 5432 to RDS SG; required AWS control-plane/log endpoints | Exists only for an explicitly approved migration run; it does not run with application services. |

Network ACLs remain coarse subnet controls; security groups remain the primary workload firewall. Enable VPC Flow Logs only with an approved retention/redaction policy—network metadata can still be sensitive operational evidence.

### Egress and endpoint decision

Fargate tasks need paths to pull images, retrieve secrets, write logs and call Cloudinary. Two acceptable patterns require selection before provisioning:

1. Private application subnets with approved NAT gateway egress controls. This is simpler for Cloudinary but adds NAT hourly/data-transfer cost and requires egress monitoring.
2. AWS interface/gateway endpoints for AWS services plus a tightly controlled HTTPS egress path for Cloudinary. This reduces broad AWS internet egress but does not remove the need to reach Cloudinary.

Do not attach public IPs to application tasks to avoid making egress easier.

## 3. ECS/Fargate services and two-backend-task configuration

| Workload | ECS service/task design | Configuration constraints |
| --- | --- | --- |
| Backend | ECS Fargate service, `desiredCount: 2`, `awsvpc`, private application subnets, backend task SG, ALB API target group, deployment/drain policy approved before release. | Image: ECR digest for Docker `backend` target. Port 4000. Health: `/health/ready`. Both tasks receive the same staging secret set with `SOCKET_ADAPTER=postgres`, a staging-unique `SOCKET_CHANNEL_PREFIX`, and `REALTIME_EXPECTED_INSTANCES=2`. |
| Frontend | ECS Fargate service, initially one task minimum, private application subnet(s), frontend task SG, ALB marketplace target group. | Image: ECR digest for Docker `frontend` target. Port 3000. Health: `/auth/login`. `NEXT_PUBLIC_BACKEND_URL` is a non-secret build-time public API origin; it must be finalized before the image is built. |
| Admin | ECS Fargate service, initially one task minimum, private application subnet(s), admin task SG, ALB admin target group. | Image: ECR digest for Docker `admin` target. Port 3001. Health: `/login`. `BACKEND_URL` must be a credential-free HTTPS API origin. |
| Migration | One-off ECS Fargate task only, using Docker `migrate` target and the migration role. | Never part of an ECS service or automatic application startup. Run only after database owner confirms target identity, restore point and migration approval. |

The repository’s `deploy/compose.staging.yml` is not the ECS definition: it contains local PostgreSQL, loopback port bindings and Compose dependencies. Recreate its validated **environment contract**, not its service topology. Do not create a task that embeds a Compose `.env` file or starts PostgreSQL alongside the application.

### Two-task Socket.IO acceptance configuration

1. Deploy exactly two healthy backend tasks with the same database endpoint and the same `SOCKET_CHANNEL_PREFIX`.
2. Confirm `/health/ready` from both targets only becomes healthy after their PostgreSQL adapter subscriptions and peer count satisfy `REALTIME_EXPECTED_INSTANCES=2`.
3. Confirm API target-group deregistration delay and ECS task stop grace period leave a documented drain window for WebSockets; test rather than assuming behavior.
4. Run the approved cross-task sequence through ALB: connect through task A, persist/send through task B, prove one delivered/persisted message; then test logout/moderation on B disconnecting A and denied reconnect.
5. During an approved fault window, drain one backend task and interrupt/recover database adapter connectivity. Capture readiness and alert evidence without session tokens or private payloads.

ALB supports the protocol upgrade; the PostgreSQL adapter, not load-balancer stickiness, provides inter-task room propagation. If Socket.IO HTTP long polling remains enabled, select and test ALB stickiness. If WebSocket-only is chosen, explicitly configure and test it in the client/ingress rather than treating it as an implied default.

## 4. ALB HTTPS, host routing and proxy trust

| Host role | Target group | Required behavior |
| --- | --- | --- |
| Marketplace HTTPS host | Frontend, port 3000 | Valid certificate; `/auth/login` health response; public assets may use approved cache policy. |
| Admin HTTPS host | Admin, port 3001 | Valid certificate; `/login` health response; no administrative action is authorized by ingress alone. |
| API HTTPS host | Backend, port 4000 | Valid certificate; `/health` liveness and `/health/ready` dependency readiness; HTTP and WebSocket `/socket.io/` routed to backend targets. |

Configure host-header rules for only the approved exact hostnames and an explicit default action that does not route unknown hosts to the application. TLS policy/certificate renewal, idle timeouts, request/body upload limits, access-log bucket/retention, CDN/WAF integration and rate limits require approval. The application’s auth attempt limits are process-local; an approved AWS WAF or gateway rate-limit policy is required for public staging/production exposure.

`AUTH_TRUST_HOST=true` may be used only after the ALB/proxy header contract is reviewed: the application must receive the authoritative host/proto values from the trusted ingress, and no path may preserve arbitrary client-supplied forwarded headers as authoritative. Validate exact `FRONTEND_ORIGIN`, `AUTH_URL`, `BACKEND_URL`, `BACKEND_PUBLIC_URL` and `NEXT_PUBLIC_BACKEND_URL` as approved HTTPS origins before rollout.

## 5. RDS PostgreSQL: isolation, backups and restore

### Database configuration

- Use a dedicated staging RDS PostgreSQL DB instance and DB subnet group; `Publicly accessible=false`.
- Use a supported PostgreSQL version compatible with the repository’s Prisma 7.8/database acceptance evidence. Select the exact engine minor version through database-owner approval; this plan does not infer it.
- Require TLS in transit, encryption at rest, an approved KMS/key ownership model, deletion protection policy and tags that identify it as isolated staging.
- Size database connections for Prisma plus each backend task’s adapter pool (current adapter code creates a pool with `max: 4` per backend process), migration work and approved diagnostics. Validate actual connection counts during two-task acceptance.
- Verify the managed service permits persistent PostgreSQL connections and `LISTEN`/`NOTIFY`; do not place the adapter behind a transaction-only pooler.
- Give runtime, migration, read-only diagnostics and restore/backup administration separate DB/IAM identities. No application runtime identity may create/drop databases or administer backups.

### Backup and PITR strategy

Before migration or acceptance data creation, database owner records the automated backup setting, retention period, latest restorable time, encryption, snapshot policy, recovery target network, RPO/RTO and restore operator. RDS automated backups support restoration to a new DB instance at a point within the configured retention period; restore does not overwrite the source. [AWS RDS PITR documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html).

Staging acceptance requires a measured restore drill into a **new isolated database**. It must verify migration status/checksums/schema, representative synthetic login/session/history/private-document-denial behavior, and that any restored sessions/outbound integrations are handled under the approved recovery plan. Cloudinary assets are a separate dependency—RDS restore cannot recreate deleted provider objects.

Never use `prisma db push`, `prisma migrate reset`, an automated migration on each ECS service task, an unapproved down migration, or a restore that overwrites the live staging database.

## 6. IAM, Secrets Manager and ECR integration

### IAM roles

| Role | Minimum permissions | Explicit exclusions |
| --- | --- | --- |
| CI build/publish role | Build/push only the approved staging ECR repositories; read scan results; attach approved SBOM/provenance artifacts; no task deployment or secret read. | No RDS, Secrets Manager value read, Cloudinary, production repository or broad account administration. |
| ECS task execution role | Pull only the task’s ECR images, write only the approved CloudWatch log streams, retrieve only the named staging secrets required at task startup. ECS documents this role as the one used for private ECR pulls, `awslogs`, and task-definition secret references. [AWS ECS execution-role documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html). | No RDS restore/create, Cloudinary administration, CI publishing or unrelated secret access. |
| Backend application task role | Only AWS API permissions truly called by the application at runtime. Current application access to Cloudinary uses its own credentials, not an AWS SDK role. | Do not grant generic `*` AWS permissions just because an execution role exists. |
| Migration task role | Retrieve only the migration database secret and write approved migration logs; create no AWS infrastructure. | No broad secret/list permissions, no RDS restore/delete and no CI publishing. |
| Read-only operator role | Describe/list health, ECS/RDS/ALB/CloudWatch evidence and audit metadata. | No secret values, image push, deployment, DB mutation or resource deletion. |
| Break-glass restore role | Time-bound, MFA/audited restore/snapshot authority under an approved incident. | Not usable for routine deploys; no unchecked production scope. |

### Secret records and injection

Create distinct staging-only records for the existing environment variable contract. Reference individual JSON keys/secret versions where the security owner approves that pattern; do not put secret values in task definitions, build arguments, image labels, CI logs or repository files. ECS supports injecting Secrets Manager values into task containers, but secret rotation does not update an already-running task; an approved new deployment/task replacement is required. [AWS ECS Secrets Manager guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html).

Required names only:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Non-secret configuration, still approval-controlled: `NODE_ENV`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `FRONTEND_ORIGIN`, `BACKEND_PUBLIC_URL`, `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, `AUTH_URL`, `AUTH_TRUST_HOST`, `SOCKET_ADAPTER`, `SOCKET_CHANNEL_PREFIX`, `REALTIME_EXPECTED_INSTANCES`, and `KYC_LOCAL_FALLBACK_ENABLED`.

Create private ECR repositories for each deployable image. Enable the approved scan policy; ECR enhanced scanning supports scan-on-push and continuous scanning through Amazon Inspector. [AWS ECR enhanced scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning-enhanced-enabling.html). Promote by immutable digest only after hosted CI, scan/SBOM/provenance and release approval—not a mutable tag.

## 7. Cost categories and estimate inputs

This plan deliberately includes no price because pricing depends on the selected AWS Region, capacity, traffic and organization agreements. Use current official calculators/quotes after decisions are approved.

| Cost category | Inputs required for an estimate |
| --- | --- |
| Fargate | Region; frontend/admin/backend/migration CPU and memory; number of running tasks; two-backend-task uptime; deployment overlap; ephemeral storage; OS/CPU architecture. AWS bills Fargate by configured vCPU, memory, storage and task duration. [Fargate pricing](https://aws.amazon.com/fargate/pricing/). |
| ALB | Region; hours; listener/rule count; new and active connections; WebSocket duration; processed bytes; LCU usage; public IPv4/data transfer. [ALB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/). |
| RDS | Region; DB class; Single-AZ or Multi-AZ; storage type/size/IOPS; backup retention/snapshot storage; performance insights/monitoring; data transfer; restore-drill duplicates. [RDS pricing](https://aws.amazon.com/rds/pricing/). |
| Network | NAT gateway count/hours/bytes or endpoint count/hours/bytes; cross-AZ traffic; Cloudinary and internet egress; DNS queries; VPC Flow Logs. |
| Security/observability | Secrets count/API calls; KMS key/request model; ECR storage/scanning; CloudWatch logs ingestion/retention/alarms; WAF request/rule usage; S3 evidence retention; CloudTrail. |
| External | Cloudinary staging plan/usage and any third-party incident/monitoring tool. |

## 8. Provisioning gates and rollback procedure

### Required approvals before provisioning

1. AWS account, region, data residency, staging budget/cost alerts and account audit/logging owner.
2. VPC CIDR, AZ strategy, NAT versus endpoint egress, DNS hostnames, ACM certificate and approved CDN/WAF/rate-limit policy.
3. ALB routing, request/idle/upload timeout behavior, access-log retention and trusted forwarded-header model for `AUTH_TRUST_HOST`.
4. ECR repository names/retention, image immutability, hosted CI publisher identity, SBOM/vulnerability/provenance/signing thresholds and exception authority.
5. RDS engine/version/class, Multi-AZ intent, parameter/connection/session requirements, KMS/key custody, backup/PITR retention, RPO/RTO, restore target and migration/restore authority.
6. ECS task resources, desired counts, auto-scaling policy (if any), deployment minimum/maximum healthy percentages, drain behavior, task execution/application/migration role boundaries and log retention.
7. Secrets ownership/rotation, Cloudinary staging tenancy/scopes, synthetic-test account namespace and cleanup owner.
8. Alert thresholds/destinations, incident commander, rollback authority and whether any data beyond synthetic data is ever permitted.

### Rollback rules

**Before any change:** capture the currently deployed image digests/task definitions, ALB target health, RDS migration ledger/checksum status, backup/PITR point, approved evidence location and named rollback authority.

**Application/image rollback:** if a new frontend/admin/backend task definition fails health, CORS/cookie, realtime or acceptance criteria, stop promotion and redeploy the last approved task definition that references the prior immutable image digest. Drain/deregister new backend tasks under the approved WebSocket drain policy; verify the prior two backend tasks meet `/health/ready` peer requirements before declaring recovery. Do not use mutable image tags.

**Migration rollback:** do not attempt an unreviewed schema downgrade. Stop application promotion, preserve logs/evidence, assess whether a forward repair is safe on an isolated clone, and require database-owner approval. If recovery requires PITR, restore to a **new isolated RDS instance**, validate it, then obtain explicit cutover authority. The source must not be overwritten by the restore operation.

**Security/secret rollback:** if a secret is exposed or an ingress/Cloudinary policy is wrong, restrict the affected route/identity first, rotate/revoke under the incident plan, deploy fresh tasks for injected secret changes, and preserve sanitized evidence. Never restore availability by making private files public, weakening CORS or disabling session validation.

No provisioning, deployment, migration, DNS switch, secret creation, RDS restore or cleanup is authorized by this document.

## 9. Completion evidence

The infrastructure owner records restricted evidence for the approved candidate SHA and each immutable image digest: VPC/SG intent, target health, exact public host checks, synthetic Cloudinary matrix, two-task socket/revocation/drain results, RDS backup/PITR/restore timing, alert acknowledgements, hosted CI/ECR scan/SBOM disposition, approvals and final synthetic-resource cleanup state. Do not attach secret values, database URLs, cookies, tokens, signed URLs, private files or raw provider errors to repository documents or general CI artifacts.
