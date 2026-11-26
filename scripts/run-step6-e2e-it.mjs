// Step 6 live integration harness.  It deliberately requires explicit local
// disposable URLs/paths; it refuses production targets and never inserts
// verification evidence itself.
import { createHash, generateKeyPairSync, randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import net from "node:net";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const { Client } = require("pg");
const required = name => { const value = process.env[name]; if (!value) throw Error(`${name} is required`); return value; };
const ownerUrl = required("STEP6_E2E_OWNER_DATABASE_URL");
if (new URL(ownerUrl).hostname !== "127.0.0.1") throw Error("Step 6 E2E requires a loopback disposable database");
const sha = value => createHash("sha256").update(value).digest("hex");
const root = await mkdtemp(join(tmpdir(), "porisrom-step6-e2e-"));
const id = `e2e-${randomUUID()}`; let candidate;
const client = new Client({ connectionString: ownerUrl });
const children = [];
const child = (command, args, options) => new Promise((resolveRun, reject) => {
  const process = spawn(command, args, { windowsHide: true, ...options }); children.push(process);
  process.stderrText = "";
  process.stdoutText = "";
  process.stderr?.on("data", chunk => { process.stderrText += chunk; });
  process.stdout?.on("data", chunk => { process.stdoutText += chunk; });
  process.once("error", reject); resolveRun(process);
});
const port = () => new Promise((resolvePort, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(error => error ? reject(error) : resolvePort(value)); }); });
const waitFor = async (predicate, message, timeout = 20_000) => { const until = Date.now() + timeout; for (;;) { if (await predicate()) return; if (Date.now() >= until) throw Error(message); await new Promise(resolveDelay => setTimeout(resolveDelay, 100)); } };
const proxyToken = randomBytes(32).toString("base64url");
const backendPort = await port(); const proxyPort = await port();
const admissionPort = await port();
let proxy;
let backend;
const containers = [];
const docker = (...args) => execFileSync("docker", args, { stdio: "ignore" });
try {
  await mkdir(join(root, "inbox"), { recursive: true }); await mkdir(join(root, "staging")); await mkdir(join(root, "canonical"));
  const artifacts = { "database.dump.age": `db-${id}`, "production_public_assets.tar.age": `public-${id}`, "production_private_documents.tar.age": `private-${id}` };
  const stagingCandidate = join(root, "artifact-staging"); await mkdir(stagingCandidate);
  for (const [name, body] of Object.entries(artifacts)) await writeFile(join(stagingCandidate, name), body);
  const manifest = Object.entries(artifacts).map(([name, body]) => `${sha(body)}  ${name}`).join("\n") + "\n";
  await writeFile(join(stagingCandidate, "manifest.sha256"), manifest); await writeFile(join(stagingCandidate, "INTEGRITY_VERIFIED"), "opaque compatibility marker\n");
  // The caller creates the coordinator-owned request/job/canonical record by
  // invoking the real coordinator publication path, then supplies its exact
  // binding.  This harness writes only filesystem material, never evidence.
  const manifestSha256 = sha(manifest);
  await client.connect();
  // The proxy guard authenticates a certificate fingerprint that its trusted
  // loopback boundary verified.  Generate an ephemeral real certificate so
  // each run registers an identity that cannot collide with another run.
  const coordinatorKey = join(root, "coordinator.key");
  const coordinatorCert = join(root, "coordinator.crt");
  const openssl = process.env.OPENSSL ?? "C:\\Program Files\\Git\\usr\\bin\\openssl.exe";
  execFileSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", coordinatorKey, "-out", coordinatorCert, "-subj", `/CN=${id}`, "-days", "1", "-sha256"], { stdio: "ignore" });
  const coordinatorPrincipalId = `step6-coordinator-${randomUUID()}`;
  const coordinatorFingerprint = createHash("sha256").update(new X509Certificate(await readFile(coordinatorCert)).raw).digest("hex");
  const key = generateKeyPairSync("ed25519");
  const publicKey = key.publicKey.export({ type: "spki", format: "pem" }).toString();
  await writeFile(join(root, "signing-key.pem"), key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), { mode: 0o600 });
  await writeFile(join(root, "fixture.json"), JSON.stringify({ root, stagingCandidate, publicKey, manifestSha256 }), { mode: 0o600 });
  const tls = join(root, "tls"); await mkdir(tls);
  const caKey = join(tls, "ca.key"), caCert = join(tls, "ca.crt"), serverKey = join(tls, "server.key"), serverCsr = join(tls, "server.csr"), serverCert = join(tls, "server.crt"), clientKey = join(tls, "client.key"), clientCsr = join(tls, "client.csr"), clientCert = join(tls, "client.crt");
  execFileSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", caCert, "-subj", `/CN=${id}-ca`, "-days", "1", "-sha256"], { stdio: "ignore" });
  execFileSync(openssl, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", serverKey, "-out", serverCsr, "-subj", "/CN=localhost"], { stdio: "ignore" });
  const serverExtensions = join(tls, "server.ext"); await writeFile(serverExtensions, "subjectAltName=DNS:localhost\n");
  execFileSync(openssl, ["x509", "-req", "-in", serverCsr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", serverCert, "-days", "1", "-sha256", "-extfile", serverExtensions], { stdio: "ignore" });
  execFileSync(openssl, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", clientKey, "-out", clientCsr, "-subj", `/CN=${id}-verifier`], { stdio: "ignore" });
  execFileSync(openssl, ["x509", "-req", "-in", clientCsr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", clientCert, "-days", "1", "-sha256"], { stdio: "ignore" });
  const verifierFingerprint = createHash("sha256").update(new X509Certificate(await readFile(clientCert)).raw).digest("hex");
  const verifierPrincipalId = `step6-verifier-${randomUUID()}`;
  const verifierCertificateId = randomUUID();
  await client.query('INSERT INTO "BackupVerifierPrincipal" (id,name) VALUES ($1,$2)', [verifierPrincipalId, `Step 6 verifier ${id}`]);
  await client.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,"signingPublicKeyPem",purpose) VALUES ($1,$2,$3,$4,$5)', [verifierCertificateId, verifierPrincipalId, verifierFingerprint, publicKey, "artifact_verifier"]);
  await client.query('INSERT INTO "BackupVerifierWorkloadIdentity" (fingerprint,"principalId",purpose) VALUES ($1,$2,$3)', [verifierFingerprint, verifierPrincipalId, "artifact_verifier"]);
  // The proxy is the only component allowed to inject coordinator mTLS
  // assertions. It listens only on loopback and never trusts caller headers.
  proxy = createServer((request, response) => {
    const upstream = require("node:http").request({ hostname: "127.0.0.1", port: backendPort, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${backendPort}`, "x-porisrom-mtls-proxy-token": proxyToken, "x-porisrom-mtls-verified": "SUCCESS", "x-porisrom-mtls-fingerprint": coordinatorFingerprint } }, upstreamResponse => { response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers); upstreamResponse.pipe(response); });
    upstream.on("error", () => { response.writeHead(502); response.end(); }); request.pipe(upstream);
  });
  await new Promise((resolveListen, rejectListen) => proxy.listen(proxyPort, "127.0.0.1", error => error ? rejectListen(error) : resolveListen()));
  backend = await child(process.execPath, ["dist/main.js"], { cwd: fileURLToPath(new URL("../apps/backend/", import.meta.url)), env: { ...process.env, PORT: String(backendPort), DATABASE_URL: required("STEP6_E2E_BACKEND_DATABASE_URL"), BACKUP_COORDINATOR_MTLS_PROXY_TOKEN: proxyToken, BACKUP_COORDINATOR_TRUSTED_PROXY_IPS: "127.0.0.1", BACKUP_SCHEDULER_ENABLED: "false" } });
  await waitFor(() => new Promise(resolveReady => { if (backend.exitCode !== null) throw Error(`isolated backend exited ${backend.exitCode}: ${backend.stderrText || backend.stdoutText}`); const socket = net.connect(backendPort, "127.0.0.1"); socket.once("connect", () => { socket.destroy(); resolveReady(true); }); socket.once("error", () => resolveReady(false)); }), "isolated backend did not bind loopback port");
  await client.query('INSERT INTO "BackupCoordinatorPrincipal" (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [coordinatorPrincipalId, `Step 6 ${id}`]);
  await client.query('INSERT INTO "BackupCoordinatorCertificate" (id,"principalId",fingerprint) VALUES ($1,$2,$3) ON CONFLICT (fingerprint) DO NOTHING', [randomUUID(), coordinatorPrincipalId, coordinatorFingerprint]);
  // Invoke the existing internal scheduler service in-process. It owns request,
  // assignment, lease, and job creation; the harness never inserts them.
  const { createPrismaClient } = require(join(repoRoot, "packages/database/dist/index.js"));
  const { StorageMutationCoordinator } = require(join(repoRoot, "apps/backend/dist/storage-maintenance/storage-mutation-coordinator.service.js"));
  const schedulerDb = createPrismaClient(required("STEP6_E2E_BACKEND_DATABASE_URL"));
  const scheduler = new StorageMutationCoordinator({ db: schedulerDb }); await scheduler.onModuleInit();
  const occurrence = new Date(Date.now() - 60_000);
  const created = await scheduler.createSystemBackupCaptureRequest("backup-scheduler", { scheduleKey: `step6-${id}`, scheduledFor: occurrence, backupClass: "daily" }, "Step 6 E2E");
  await scheduler.assignSystemBackupCaptureCoordinator("backup-scheduler", created.request.id, coordinatorPrincipalId, "Step 6 E2E");
  await scheduler.advanceSystemBackupCaptureRequest("backup-scheduler", created.request.id, "Step 6 E2E");
  await scheduler.onModuleDestroy();
  await schedulerDb.$disconnect();
  const api = `http://127.0.0.1:${proxyPort}/internal/backup-coordinator/jobs`;
  const post = async (path, body) => {
    const response = await fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw Error(`authenticated coordinator ${path} failed: ${response.status} ${await response.text()}`);
    return response.json();
  };
  const delivery = await post("/delivery", { backupClass: "daily", limit: 1 });
  if (!delivery.jobs?.[0]) throw Error("scheduler created no coordinator-deliverable job");
  const reference = delivery.jobs[0];
  await post(`/${reference.jobId}/claim`, reference);
  await post(`/${reference.jobId}/validate`, reference);
  const canonicalStorageKey = `backup-canonical/${id}/manifest`;
  await post(`/${reference.jobId}/report`, { ...reference, outcome: "succeeded", resultIdempotencyKey: `result:${id}`, reason: "step6 synthetic artifact prepared", resultSetId: canonicalStorageKey, resultManifestSha256: manifestSha256 });
  const canonical = await post(`/${reference.jobId}/canonical-set`, { ...reference, manifestSha256, manifestFormatVersion: 1, canonicalStorageKey });
  candidate = join(root, "inbox", canonical.canonicalSetId); await mkdir(candidate);
  for (const name of [...Object.keys(artifacts), "manifest.sha256", "INTEGRITY_VERIFIED"]) await writeFile(join(candidate, name), await readFile(join(stagingCandidate, name)));
  await writeFile(join(candidate, "metadata"), [
    `set_id=${canonical.canonicalSetId}`,
    `class=${canonical.backupClass}`,
    `capture_job_id=${canonical.jobId}`,
    `capture_request_id=${canonical.requestId}`,
    `lease_id=${canonical.leaseId}`,
    `generation=${canonical.generation}`,
    `attempt_id=${canonical.attemptId}`,
    "state=created",
    "",
  ].join("\n"));
  const outbox = await client.query('SELECT "eventType", "aggregateId", status FROM "BackupWorkflowOutbox" WHERE "eventType" = $1 AND "aggregateId" = $2', ["backup.canonical-published", canonical.canonicalSetId]);
  if (outbox.rowCount !== 1 || outbox.rows[0].status !== "pending") throw Error("canonical publication did not create its pending outbox event");
  const toDockerHost = value => { const url = new URL(value); url.hostname = "host.docker.internal"; return url.toString(); };
  const admissionDatabaseUrl = toDockerHost(required("STEP6_E2E_ADMISSION_DATABASE_URL"));
  const dispatcherDatabaseUrl = toDockerHost(required("STEP6_E2E_DISPATCHER_DATABASE_URL"));
  const finalizerDatabaseUrl = toDockerHost(required("STEP6_E2E_FINALIZER_DATABASE_URL"));
  const admissionName = `porisrom-step6-admission-${randomUUID()}`;
  const verifierName = `porisrom-step6-verifier-${randomUUID()}`;
  const finalizerName = `porisrom-step6-finalizer-${randomUUID()}`;
  containers.push(admissionName, verifierName, finalizerName);
  docker("run", "-d", "--rm", "--name", admissionName, "--label", "com.porisrom.disposable=true", "-p", `127.0.0.1:${admissionPort}:7443`, "-v", `${tls}:/tls:ro`, "-e", `ADMISSION_DATABASE_URL=${admissionDatabaseUrl}`, "-e", "ADMISSION_HOST=0.0.0.0", "-e", "ADMISSION_TLS_KEY_FILE=/tls/server.key", "-e", "ADMISSION_TLS_CERT_FILE=/tls/server.crt", "-e", "ADMISSION_TLS_CLIENT_CA_FILE=/tls/ca.crt", "porisrom-b2-admission-validation:current");
  await waitFor(() => new Promise(resolveReady => { const socket = net.connect(admissionPort, "127.0.0.1"); socket.once("connect", () => { socket.destroy(); resolveReady(true); }); socket.once("error", () => resolveReady(false)); }), "admission container did not become ready");
  docker("run", "-d", "--rm", "--name", finalizerName, "--label", "com.porisrom.disposable=true", "-e", `FINALIZER_DATABASE_URL=${finalizerDatabaseUrl}`, "-e", `FINALIZER_WORKER_ID=${id}-finalizer`, "-e", "FINALIZER_POLL_MS=100", "porisrom-step6-finalizer-validation:current");
  docker("run", "-d", "--rm", "--name", verifierName, "--label", "com.porisrom.disposable=true", "-v", `${root}/inbox:/fixture/inbox:ro`, "-v", `${tls}:/tls:ro`, "-v", `${join(root, "signing-key.pem")}:/run/secrets/signing-key:ro`, "-e", `VERIFIER_DISPATCH_DATABASE_URL=${dispatcherDatabaseUrl}`, "-e", `VERIFIER_WORKER_ID=${id}-verifier`, "-e", "VERIFIER_POLL_MS=100", "-e", `ADMISSION_ENDPOINT=https://host.docker.internal:${admissionPort}/v1/capture-verifications`, "-e", "ADMISSION_TLS_SERVER_NAME=localhost", "-e", "VERIFIER_TLS_KEY_FILE=/tls/client.key", "-e", "VERIFIER_TLS_CERT_FILE=/tls/client.crt", "-e", "VERIFIER_TLS_CA_FILE=/tls/ca.crt", "-e", "VERIFIER_SIGNING_KEY_FILE=/run/secrets/signing-key", "-e", "VERIFIER_CANDIDATE_INBOX_ROOT=/fixture/inbox", "-e", "VERIFIER_STAGING_ROOT=/tmp/staging", "-e", "VERIFIER_CANONICAL_ROOT=/tmp/canonical", "-e", `VERIFIER_PRINCIPAL_ID=${verifierPrincipalId}`, "-e", `VERIFIER_CERTIFICATE_FINGERPRINT=${verifierFingerprint}`, "porisrom-step6-verifier-validation:current");
  await waitFor(async () => {
    const state = await client.query('SELECT j.status, s."captureJobId", s."captureLeaseId", (SELECT count(*)::int FROM "BackupCaptureVerificationAttempt" WHERE "canonicalSetId"=$1) AS evidence, (SELECT count(*)::int FROM "BackupCaptureFinalization" WHERE "canonicalSetId"=$1) AS finalization FROM "BackupCaptureJob" j CROSS JOIN "StorageMaintenanceState" s WHERE j.id=$2 AND s.id=$3', [canonical.canonicalSetId, canonical.jobId, "storage"]);
    const row = state.rows[0]; return row?.status === "finalized" && row.captureJobId === null && row.captureLeaseId === null && row.evidence === 1 && row.finalization === 1;
  }, "verifier/admission/finalizer chain did not reach terminal finalization", 60_000);
  const delivered = await client.query('SELECT "eventType", status FROM "BackupWorkflowOutbox" WHERE "aggregateId"=$1 AND "eventType" IN ($2,$3) ORDER BY "eventType"', [canonical.canonicalSetId, "backup.canonical-published", "backup.evidence-admitted"]);
  if (delivered.rowCount !== 2 || delivered.rows.some(row => row.status !== "delivered")) throw Error("workflow outbox acknowledgements were not fenced and delivered");
  console.log(JSON.stringify({ runId: id, requestId: canonical.requestId, jobId: canonical.jobId, canonicalSetId: canonical.canonicalSetId, canonicalOutbox: outbox.rows[0], artifactRoot: root, manifestSha256, signingPublicKeyPem: publicKey, backendPort, proxyPort, coordinatorApi: `http://127.0.0.1:${proxyPort}` }));
} catch (error) {
  if (backend?.stderrText) process.stderr.write(`isolated backend stderr:\n${backend.stderrText}\n`);
  throw error;
} finally { for (const name of containers) { try { docker("rm", "-f", name); } catch {} } proxy?.close(); for (const process of children) if (!process.killed) process.kill("SIGTERM"); await client.end().catch(() => undefined); await rm(root, { recursive: true, force: true }); }
