import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { assertDisposableOwnerUrl, assertFreshDatabaseIdentity, assertHarnessMarkerIdentity, createInvoker, effectiveEnvironment } from "./backup-verifier-security-harness-safety.mjs";

const root = resolve(import.meta.dirname, "..");
const compose = resolve(root, "deploy/backup-verifier-security-test.compose.yml");
const provision = resolve(root, "deploy/backup-verifier-security-provision.sql");
const owner = "verifier_test_owner";
const database = "porisrom_verifier_security_test";
const harnessPort = process.env.PORISROM_VERIFIER_TEST_PORT;
const expected = {
  PORISROM_VERIFIER_TEST_COORDINATOR_URL: ["verifier_test_coordinator", "verifier_test_coordinator_only"],
  PORISROM_VERIFIER_TEST_FINALIZER_URL: ["verifier_test_finalizer", "verifier_test_finalizer_only"],
  PORISROM_VERIFIER_TEST_ARTIFACT_URL: ["verifier_test_artifact", "verifier_test_artifact_only"],
  PORISROM_VERIFIER_TEST_ADMISSION_URL: ["verifier_test_admission", "verifier_test_admission_only"],
  PORISROM_VERIFIER_TEST_RESTORE_URL: ["verifier_test_restore", "verifier_test_restore_only"],
};

if (process.env.PORISROM_EXECUTE_VERIFIER_SECURITY_HARNESS !== "yes") throw Error("Explicit execution authorization is required.");
if (!existsSync(compose) || !existsSync(provision)) throw Error("Harness artifacts are missing.");
if (!/^[1-9][0-9]{3,4}$/.test(harnessPort ?? "") || Number(harnessPort) > 65535 || harnessPort === "55439") throw Error("Harness requires a fresh non-55439 loopback port.");
const validate = (value, username, password) => {
  if (!value) throw Error("Required harness URL is missing.");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== harnessPort || url.pathname !== "/" + database ||
      decodeURIComponent(url.username) !== username || decodeURIComponent(url.password) !== password) throw Error("Harness URL failed exact synthetic-target validation.");
};
validate(process.env.PORISROM_VERIFIER_TEST_DATABASE_URL, owner, "verifier_test_owner_only");
for (const [name, [username, password]] of Object.entries(expected)) validate(process.env[name], username, password);

const runId = randomBytes(16).toString("hex");
const project = "porisrom-verifier-" + runId;
const volume = project + "-pg16";
const environment = { ...process.env, HARNESS_VOLUME: volume, HARNESS_PORT: harnessPort };
const invoke = createInvoker({ spawn: spawnSync, baseEnvironment: environment, root, shell: process.platform === "win32" });
const invokeDocker = (args, options = {}) => {
  const commandEnvironment = effectiveEnvironment(environment, options.env);
  const result = spawnSync("docker", args, { cwd: root, shell: false, encoding: "utf8", ...options, env: commandEnvironment });
  if (result.status !== 0) throw Error((result.stderr || result.stdout || "Docker harness command failed").trim());
  return result.stdout;
};
const freshVolume = spawnSync("docker", ["volume", "inspect", volume], { cwd: root, shell: false, encoding: "utf8" });
if (freshVolume.status === 0) throw Error("Fresh-run volume collision detected; harness refuses to reuse resources.");
const matchingContainers = invokeDocker(["ps", "-a", "--filter", "label=com.docker.compose.project=" + project, "--format", "{{.ID}}"]).trim();
if (matchingContainers) throw Error("Fresh-run project collision detected; harness refuses to reuse resources.");
const portContainers = invokeDocker(["ps", "-a", "--filter", "publish=" + harnessPort, "--format", "{{.ID}}"]).trim();
if (portContainers) throw Error("Fresh loopback port collision detected; harness refuses to reuse resources.");
const dockerContext = invokeDocker(["context", "show"]).trim();
const dockerEndpoint = JSON.parse(invokeDocker(["context", "inspect", dockerContext]))[0]?.Endpoints?.docker?.Host;
if (typeof dockerEndpoint !== "string" || !/^(npipe|unix):\/\//.test(dockerEndpoint)) throw Error("Harness requires a local Docker context.");
await new Promise((resolvePort, rejectPort) => {
  const probe = createServer().once("error", () => rejectPort(Error("Fresh loopback port is unavailable."))).once("listening", () => probe.close(resolvePort));
  probe.listen({ host: "127.0.0.1", port: Number(harnessPort), exclusive: true });
});
invokeDocker(["compose", "-p", project, "-f", compose, "config", "--quiet"]);
invokeDocker(["compose", "-p", project, "-f", compose, "up", "-d", "--wait"]);
const containerId = invokeDocker(["compose", "-p", project, "-f", compose, "ps", "-q", "postgres"]).trim();
if (!/^[a-f0-9]{12,64}$/i.test(containerId)) throw Error("Expected disposable PostgreSQL container was not selected.");
const inspect = JSON.parse(invokeDocker(["inspect", containerId]))[0];
if (inspect.Config.Labels["com.docker.compose.project"] !== project || inspect.Config.Labels["com.docker.compose.service"] !== "postgres" ||
    !inspect.Mounts.some((mount) => mount.Name === volume && mount.Destination === "/var/lib/postgresql/data")) throw Error("Container labels or fresh mounted volume do not match.");
const published = inspect.NetworkSettings.Ports["5432/tcp"];
if (!Array.isArray(published) || published.length !== 1 || published[0].HostIp !== "127.0.0.1" || published[0].HostPort !== harnessPort) throw Error("Disposable PostgreSQL listener is not the required loopback port.");
const identity = invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-AtF,", "-c", "SELECT current_database(),current_setting('server_version_num')"]);
if (!identity.startsWith(database + ",16")) throw Error("Disposable database/version identity check failed.");
const migrationEnvironment = assertDisposableOwnerUrl(effectiveEnvironment(environment, { DATABASE_URL: process.env.PORISROM_VERIFIER_TEST_DATABASE_URL }), process.env.PORISROM_VERIFIER_TEST_DATABASE_URL, harnessPort);
const preMigrationIdentity = invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-AtF,", "-c", "SELECT current_database(),current_user,current_setting('server_version_num'),(SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f'))"], { env: migrationEnvironment });
assertFreshDatabaseIdentity(preMigrationIdentity, { database, owner });
// Fresh fixtures need restricted role shells before migration 30 grants its
// admission entry point. The reviewed provisioner below still establishes all
// effective privileges after migration deployment.
invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-v", "ON_ERROR_STOP=1", "-c", "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='porisrom_admission_runtime') THEN CREATE ROLE porisrom_admission_runtime NOLOGIN NOINHERIT; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='porisrom_backend_runtime') THEN CREATE ROLE porisrom_backend_runtime NOLOGIN NOINHERIT; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='porisrom_verifier_runtime') THEN CREATE ROLE porisrom_verifier_runtime NOLOGIN NOINHERIT; END IF; END $$;"]);
invoke("pnpm.cmd", ["exec", "prisma", "migrate", "deploy"], { cwd: resolve(root, "packages/database"), env: migrationEnvironment, timeout: 60_000 });
invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE \"__verifier_harness_marker\" (run_id text primary key); INSERT INTO \"__verifier_harness_marker\" VALUES ('" + runId + "')"], { env: migrationEnvironment });
const postMigrationIdentity = invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-AtF,", "-c", "SELECT current_database(),current_user,current_setting('server_version_num'),(SELECT run_id FROM \"__verifier_harness_marker\")"], { env: migrationEnvironment });
assertHarnessMarkerIdentity(postMigrationIdentity, { database, owner, runId });
invokeDocker(["compose", "-p", project, "-f", compose, "exec", "-T", "postgres", "psql", "-U", owner, "-d", database, "-v", "ON_ERROR_STOP=1"], { input: readFileSync(provision, "utf8") });
const testOutput = invoke("pnpm.cmd", ["--dir", "apps/backend", "exec", "vitest", "run", "test/backup-verifier-postgres.spec.ts", "--testTimeout=10000", "--hookTimeout=10000"], { timeout: 90_000 });
process.stdout.write(testOutput + "\n");
if (!/Test Files\s+\d+ passed/.test(testOutput) || !/Tests\s+\d+ passed/.test(testOutput)) throw Error("Verifier PostgreSQL test reporter did not emit a complete passing summary.");
process.stdout.write("Disposable verifier harness passed: " + project + " run=" + runId + " port=" + harnessPort + "\n");
