import { spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { X509Certificate } from "node:crypto";
import { createWriteStream } from "node:fs";
const repo = resolve(import.meta.dirname, ".."); const mode = process.argv[2];
const pointer = join(repo, "tmp/docker-acceptance-pointer.json");
let state;
if (mode === "prepare") {
  const project = `porisrom-acceptance-20261029-${randomBytes(4).toString("hex")}`;
  const root = await mkdtemp(join(tmpdir(), "porisrom-docker-acceptance-")); await mkdir(join(root, "tls"));
  state = { project, root, database: "porisrom_docker_acceptance_test", password: randomBytes(32).toString("hex"),
    access: randomBytes(48).toString("hex"), refresh: randomBytes(48).toString("hex"), auth: randomBytes(48).toString("hex") };
  await writeFile(join(root, "state.json"), JSON.stringify(state), { mode: 0o600 });
  await writeFile(pointer, JSON.stringify({ statePath: join(root, "state.json") }));
} else { state = JSON.parse(await readFile(JSON.parse(await readFile(pointer, "utf8")).statePath, "utf8")); }
if (!/^porisrom-acceptance-20261029-[a-f0-9]{8}$/.test(state.project) || !state.root.startsWith(join(tmpdir(), "porisrom-docker-acceptance-"))) throw Error("Unrecognized task resources");
const secrets = [state.password, state.access, state.refresh, state.auth];
const redact = (text) => secrets.reduce((s, secret) => s.replaceAll(secret, "[redacted]"), String(text)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]");
const evidence = join(repo, "tmp", state.project); await mkdir(evidence, { recursive: true });
async function docker(args, label = mode, quiet = false) {
  const chunks = [];
  const logName = `${label}-${Date.now()}-${randomBytes(3).toString("hex")}.log`;
  const log = createWriteStream(join(evidence, logName), { flags: "wx" });
  const code = await new Promise((done) => {
    const child = spawn("docker", ["--context", "desktop-linux", ...args], { cwd: repo, env: { ...process.env, DOCKER_BUILDKIT: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { const value = redact(chunk); chunks.push(value); log.write(value); });
    child.once("error", () => done(1)); child.once("exit", (code) => done(code ?? 1));
  });
  await new Promise((done) => log.end(done));
  await writeFile(join(evidence, `${logName}.command.json`), JSON.stringify({
    command: ["docker", "--context", "desktop-linux", ...args].map(redact), exitCode: code,
  }, null, 2), { flag: "wx" });
  const output = chunks.join("");
  console.log(JSON.stringify({ operation: label, exitCode: code, log: logName }));
  if (code !== 0) { console.log(output.slice(-4500)); throw Error(`Docker ${label} failed`); }
  if (!quiet && output.length < 2500) console.log(output.trim());
  return output.trim();
}
const compose = ["compose", "--project-name", state.project, "--file", join(state.root, "compose.json")];
if (["prepare", "configure"].includes(mode)) {
  const baseline = JSON.parse(await readFile(join(repo, "tmp/docker-resource-baseline-2026-10-29.json"), "utf8"));
  if (baseline.containers.some((x) => x.name.startsWith(state.project)) || baseline.volumes.some((x) => x.name.startsWith(state.project))) throw Error("Resource collision");
  const cert = `${join(state.root, "tls/cert.pem")}:/tls/cert.pem:ro`;
  const appEnvironment = { NODE_ENV: "production", DATABASE_URL: `postgresql://acceptance:${state.password}@postgres:5432/${state.database}`,
    JWT_ACCESS_SECRET: state.access, JWT_REFRESH_SECRET: state.refresh, FRONTEND_ORIGIN: "https://marketplace.porisrom.test:8443,https://admin.porisrom.test:8443",
    BACKEND_PUBLIC_URL: "https://api.porisrom.test:8443", SOCKET_ADAPTER: "postgres", SOCKET_CHANNEL_PREFIX: state.project,
    REALTIME_EXPECTED_INSTANCES: "2", KYC_LOCAL_FALLBACK_ENABLED: "false", NODE_EXTRA_CA_CERTS: "/tls/cert.pem",
    CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "" };
  const api = () => ({ image: `${state.project}:backend`, environment: appEnvironment, volumes: [cert], depends_on: { postgres: { condition: "service_healthy" } }, init: true,
    restart: "unless-stopped", stop_grace_period: "20s", mem_limit: "768m", cpus: 0.75, cap_drop: ["ALL"] });
  const config = { name: state.project, services: {
    postgres: { image: "postgres:18.2-bookworm", environment: { POSTGRES_USER: "acceptance", POSTGRES_PASSWORD: state.password, POSTGRES_DB: state.database },
      volumes: ["database:/var/lib/postgresql"], healthcheck: { test: ["CMD-SHELL", "pg_isready -U acceptance -d porisrom_docker_acceptance_test"], interval: "3s", timeout: "3s", retries: 30 }, mem_limit: "512m", cpus: 0.5, restart: "unless-stopped" },
    migrate: { image: `${state.project}:migrate`, environment: { DATABASE_URL: appEnvironment.DATABASE_URL }, profiles: ["migration"], restart: "no" },
    "api-a": api(), "api-b": api(),
    frontend: { image: `${state.project}:frontend`, environment: { BACKEND_URL: "https://api.porisrom.test:8443", AUTH_SECRET: state.auth, AUTH_URL: "https://marketplace.porisrom.test:8443", AUTH_TRUST_HOST: "true", NODE_EXTRA_CA_CERTS: "/tls/cert.pem" }, volumes: [cert], mem_limit: "768m", cpus: 0.75, init: true, restart: "unless-stopped" },
    admin: { image: `${state.project}:admin`, environment: { BACKEND_URL: "https://api.porisrom.test:8443", NODE_EXTRA_CA_CERTS: "/tls/cert.pem" }, volumes: [cert], mem_limit: "512m", cpus: 0.5, init: true, restart: "unless-stopped" },
    proxy: { image: `${state.project}:backend`, entrypoint: ["node", "/checks/acceptance-proxy.mjs"], environment: { NODE_EXTRA_CA_CERTS: "/tls/cert.pem" }, volumes: [`${join(repo, "deploy/acceptance-proxy.mjs")}:/checks/acceptance-proxy.mjs:ro`, `${join(state.root, "tls")}:/tls:ro`],
      healthcheck: { test: ["CMD", "node", "-e", "fetch('https://api.porisrom.test:8443/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
      ports: ["127.0.0.1::8443"], networks: { default: { aliases: ["api.porisrom.test", "api-a.porisrom.test", "api-b.porisrom.test", "marketplace.porisrom.test", "admin.porisrom.test"] } }, mem_limit: "128m", cpus: 0.25, init: true },
  }, volumes: { database: {} }, networks: { default: {} } };
  await writeFile(join(state.root, "compose.json"), JSON.stringify(config), { mode: 0o600 });
  await docker([...compose, "config", "--quiet"], "compose-validation");
  console.log(JSON.stringify({ project: state.project, existingResourcesReused: false, configOutsideBuildContext: true, serviceNames: Object.keys(config.services), newVolumes: [state.project + "_database"], syntheticTlsDomainsOnly: true }));
} else if (mode === "build") {
  for (const target of (process.argv.length > 3 ? process.argv.slice(3) : ["backend", "frontend", "admin", "migrate"])) {
    if (!["backend", "frontend", "admin", "migrate", "backend-build", "acceptance-tests"].includes(target)) throw Error("Unapproved build target");
    console.log(`Building isolated target ${target}`);
    const args = ["build", "--progress=plain", "--target", target, "--tag", `${state.project}:${target}`];
    if (["frontend", "admin"].includes(target)) args.push("--build-arg", "BACKEND_URL=https://api.porisrom.test:8443");
    if (target === "frontend") args.push("--build-arg", "NEXT_PUBLIC_BACKEND_URL=https://api.porisrom.test:8443");
    await docker([...args, "."], `build-${target}`, true);
  }
} else if (["start", "resume"].includes(mode)) {
  // Re-inventory before mutating anything, including after a Desktop restart.
  await docker(["version", "--format", "{{.Server.Version}}"], "engine-preflight");
  await docker(["ps", "--all", "--format", "{{.ID}} {{.Names}} {{.Status}}"], "resource-container-inventory");
  await docker(["image", "ls", "--format", "{{.Repository}}:{{.Tag}} {{.ID}}"], "resource-image-inventory", true);
  await docker(["network", "ls", "--format", "{{.ID}} {{.Name}}"], "resource-network-inventory");
  await docker(["volume", "ls", "--format", "{{.Name}}"], "resource-volume-inventory");
  await docker(["compose", "ls", "--all", "--format", "json"], "resource-project-inventory", true);
  await docker([...compose, "config", "--quiet"], "resume-compose-validation");
  if (mode === "resume") {
    const cert = new X509Certificate(await readFile(join(state.root, "tls/cert.pem")));
    if (Date.parse(cert.validTo) <= Date.now() + 60_000) throw Error("Synthetic TLS certificate expired or expiring. Renew it with task-owned services stopped before resuming; do not disable TLS validation.");
    const ownership = await docker(["volume", "inspect", "--format", '{{index .Labels "com.docker.compose.project"}}', `${state.project}_database`], "verify-retained-volume-ownership", true);
    if (ownership !== state.project) throw Error("Refusing an unidentified retained database volume");
  } else await docker(["run", "--name", `${state.project}-certgen`, "--label", `com.porisrom.acceptance=${state.project}`, "--network", "none", "--user", "root", "--volume", `${join(state.root, "tls")}:/tls`, "--entrypoint", "sh", `${state.project}:backend`, "-c",
    "openssl req -x509 -newkey rsa:2048 -nodes -keyout /tls/key.pem -out /tls/cert.pem -days 2 -subj /CN=api.porisrom.test -addext subjectAltName=DNS:api.porisrom.test,DNS:api-a.porisrom.test,DNS:api-b.porisrom.test,DNS:marketplace.porisrom.test,DNS:admin.porisrom.test && chmod 644 /tls/key.pem /tls/cert.pem"], "generate-synthetic-tls", true);
  await docker([...compose, "up", "--detach", "--wait", "postgres"], "start-isolated-postgres");
  await docker([...compose, "--profile", "migration", "run", "--name", `${state.project}-migration-${Date.now()}`, "migrate"], "migrate-isolated-database");
  await docker([...compose, "up", "--detach", "--wait", "--wait-timeout", "180", "api-a", "api-b", "frontend", "admin", "proxy"], "start-applications");
  await docker([...compose, "ps", "--format", "json"], "container-status");
} else if (mode === "stop") {
  await docker([...compose, "stop", "--timeout", "20"], "stop-task-services");
  console.log("Only task-owned Compose services stopped. Containers, networks, volumes and test data retained.");
} else if (mode === "status") await docker([...compose, "ps", "--all", "--format", "json"], "container-status");
else await (await import("./docker-acceptance-checks.mjs")).runChecks({ mode, state, docker, compose, evidence, repo });
