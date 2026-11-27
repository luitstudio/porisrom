import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { finalizeStorageMaintenanceHarness, parseStorageMaintenanceHarnessOptions } from "./storage-maintenance-harness-safety.mjs";

const repo = resolve(import.meta.dirname, "..");
const { preserveResources } = parseStorageMaintenanceHarnessOptions(process.argv.slice(2));
const project = `porisrom-storage-maintenance-it-${randomBytes(5).toString("hex")}`;
const root = await mkdtemp(join(tmpdir(), "porisrom-storage-maintenance-it-"));
const database = `porisrom_storage_maintenance_${randomBytes(12).toString("hex")}_test`;
const password = randomBytes(32).toString("hex");
const composeFile = join(root, "compose.json");
const stateFile = join(root, "state.json");
const compose = ["compose", "--project-name", project, "--file", composeFile];
let postgresId = "";
let selectedPort = null;

if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL) throw Error("Refusing inherited or production DATABASE_URL");
if (!root.startsWith(join(tmpdir(), "porisrom-storage-maintenance-it-"))) throw Error("Invalid temporary root");

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: options.cwd ?? repo, env: options.env ?? process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", code => {
      if (options.echoOutput && stdout) process.stdout.write(stdout);
      if (options.echoOutput && stderr) process.stderr.write(stderr);
      code === 0 ? resolveRun(stdout.trim()) : options.allowFailure ? resolveRun(null) : reject(Error(`${command} ${args.join(" ")} failed (${code}): ${stderr.slice(-2000)}`));
    });
  });
}

async function availablePort(port) {
  const listenerFree = await new Promise(resolvePort => {
    const probe = createServer().once("error", () => resolvePort(false)).once("listening", () => probe.close(() => resolvePort(true)));
    probe.listen({ host: "127.0.0.1", port, exclusive: true });
  });
  if (!listenerFree) return false;
  const published = await run("docker", ["ps", "-a", "--filter", `publish=${port}`, "--format", "{{.ID}}"]);
  return !published;
}

async function selectPort() {
  for (let attempt = 0; attempt < 32; attempt++) {
    const port = 49152 + (randomBytes(2).readUInt16BE(0) % 10000);
    if (![54509, 55441, 56001].includes(port) && await availablePort(port)) return port;
  }
  throw Error("Could not allocate a fresh loopback port for the disposable storage-maintenance database");
}

function testEnvironment(url) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  return {
    ...env,
    NODE_ENV: "test",
    DATABASE_URL: url,
    PORISROM_STORAGE_MAINTENANCE_TEST_DATABASE_URL: url,
    PROFILE_PHOTO_UPLOAD_DIR: join(root, "public-uploads"),
    PRIVATE_DOCUMENT_UPLOAD_DIR: join(root, "private-documents"),
    KYC_DOCUMENT_UPLOAD_DIR: join(root, "private-documents"),
    CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
  };
}

async function verifyOwnership() {
  const owner = await run("docker", ["volume", "inspect", "--format", '{{index .Labels "com.docker.compose.project"}}', `${project}_database`]);
  if (owner !== project) throw Error("Refusing cleanup: database volume ownership is uncertain");
  const containerOwner = await run("docker", ["inspect", "--format", '{{index .Config.Labels "com.docker.compose.project"}}', postgresId]);
  if (containerOwner !== project) throw Error("Refusing cleanup: PostgreSQL container ownership is uncertain");
}

try {
  if (await run("docker", ["volume", "inspect", `${project}_database`], { allowFailure: true }) !== null) throw Error("Fresh-run volume collision detected");
  if (await run("docker", ["ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}"] )) throw Error("Fresh-run project collision detected");
  const port = await selectPort();
  selectedPort = port;
  await writeFile(composeFile, JSON.stringify({ name: project, services: {
    postgres: {
      image: "postgres:18.2-bookworm",
      environment: { POSTGRES_USER: "porisrom_it", POSTGRES_PASSWORD: password, POSTGRES_DB: database },
      ports: [`127.0.0.1:${port}:5432`], volumes: ["database:/var/lib/postgresql"],
      healthcheck: { test: ["CMD-SHELL", `pg_isready -U porisrom_it -d ${database}`], interval: "2s", timeout: "2s", retries: 30 },
    },
  }, volumes: { database: {} } }, null, 2), { mode: 0o600 });
  await run("docker", ["pull", "postgres:18.2-bookworm"]);
  const imageDigest = await run("docker", ["image", "inspect", "--format", "{{index .RepoDigests 0}}", "postgres:18.2-bookworm"]);
  if (!/^postgres@sha256:[a-f0-9]{64}$/.test(imageDigest)) throw Error("Could not resolve PostgreSQL image digest");
  await run("docker", [...compose, "config", "--quiet"]);
  await run("docker", [...compose, "up", "--detach", "--wait", "postgres"]);
  postgresId = await run("docker", [...compose, "ps", "--quiet", "postgres"]);
  await verifyOwnership();
  const mapping = await run("docker", [...compose, "port", "postgres", "5432"]);
  const mappedPort = Number(mapping.match(/:(\d+)\s*$/)?.[1]);
  if (mappedPort !== port) throw Error("Disposable PostgreSQL listener did not retain the verified loopback port");
  const url = `postgresql://porisrom_it:${password}@127.0.0.1:${port}/${database}`;
  await writeFile(stateFile, JSON.stringify({ root, project, database, port, imageDigest }), { mode: 0o600 });
  const env = testEnvironment(url);
  const requireDb = createRequire(join(repo, "packages/database/package.json"));
  const prisma = join(dirname(requireDb.resolve("prisma/package.json")), "build/index.js");
  await run(process.execPath, [prisma, "migrate", "deploy"], { cwd: join(repo, "packages/database"), env });
  await run(process.execPath, [prisma, "migrate", "status"], { cwd: join(repo, "packages/database"), env });
  await run(process.execPath, [prisma, "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"], { cwd: join(repo, "packages/database"), env });
  const requireBackend = createRequire(join(repo, "apps/backend/package.json"));
  const vitest = join(dirname(requireBackend.resolve("vitest/package.json")), "vitest.mjs");
  await run(process.execPath, [vitest, "run", "test/storage-maintenance-postgres.spec.ts", "--configLoader", "runner"], { cwd: join(repo, "apps/backend"), env, echoOutput: true });
  console.log(JSON.stringify({ result: "passed", imageDigest, database, project, migrationVerified: true }));
} finally {
  const finalization = await finalizeStorageMaintenanceHarness({
    preserveResources,
    postgresId,
    discoverPostgresId: () => run("docker", [...compose, "ps", "--quiet", "--all", "postgres"]),
    verifyOwnership: () => verifyOwnership(),
    down: () => run("docker", [...compose, "down", "--volumes", "--remove-orphans"]),
    removeRoot: () => rm(root, { recursive: true, force: false }),
  });
  console.log(JSON.stringify({ ...finalization, project, root, database, port: selectedPort, healthy: Boolean(postgresId), preserveResources }));
}
