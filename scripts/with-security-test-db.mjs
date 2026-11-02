import { readFile, realpath } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const repo = resolve(import.meta.dirname, "..");
const location = JSON.parse(await readFile(join(repo, "tmp/security-test-state-location.json"), "utf8"));
const state = JSON.parse(await readFile(location.statePath, "utf8"));
const url = new URL(state.url);
if (process.env.NODE_ENV === "production" || url.hostname !== "127.0.0.1" || Number(url.port) !== state.port ||
    url.pathname !== `/${state.database}` || !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database) ||
    !(await realpath(state.data)).startsWith(await realpath(state.root))) throw Error("Refusing an unverified test target");
const requireDb = createRequire(join(repo, "packages/database/package.json"));
const requireBackend = createRequire(join(repo, "apps/backend/package.json"));
const prismaCli = join(dirname(requireDb.resolve("prisma/package.json")), "build/index.js");
const vitestCli = join(dirname(requireBackend.resolve("vitest/package.json")), "vitest.mjs");
const mode = process.argv[2];
const args = process.argv.slice(3);
let cwd = repo; let entry; let cli = [];
if (["migrate-status", "migrate-deploy"].includes(mode)) {
  cwd = join(repo, "packages/database"); entry = prismaCli;
  cli = ["migrate", mode.slice(8), ...args];
} else if (mode === "schema-diff") {
  cwd = join(repo, "packages/database"); entry = prismaCli;
  cli = ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"];
} else if (mode === "migration-script") {
  cwd = join(repo, "packages/database"); entry = prismaCli;
  cli = ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script", "--output", "prisma/migrations/20261028000000_product_safety/migration.sql"];
} else if (mode === "backend-tests") {
  cwd = join(repo, "apps/backend"); entry = vitestCli; cli = ["run", ...args];
} else if (mode === "backend-start") {
  cwd = join(repo, "apps/backend"); entry = "dist/main.js";
} else if (["admin-start", "frontend-start", "frontend-build", "admin-dev", "frontend-dev"].includes(mode)) {
  cwd = join(repo, mode.startsWith("admin-") ? "apps/admin" : "apps/frontend");
  entry = "node_modules/next/dist/bin/next"; cli = mode === "frontend-build" ? ["build"] : [mode.endsWith("-dev") ? "dev" : "start", "-H", "127.0.0.1", "-p", mode.startsWith("admin-") ? "3101" : "3100"];
} else if (mode === "seed-browser") {
  cwd = join(repo, "apps/backend"); entry = "dist/scripts/seed-security-test.js";
} else if (mode === "db-evidence") {
  entry = "scripts/security-db-evidence.mjs";
} else if (mode === "revoke-browser-sessions") {
  entry = "scripts/security-db-evidence.mjs"; cli = ["--revoke-fixture-sessions"];
} else throw Error("Unknown isolated-test command");
const environment = {
  ...process.env, NODE_ENV: "test", DATABASE_URL: state.url,
  PORISROM_AUTH_TEST_DATABASE_URL: state.url, PORISROM_MODERATION_TEST_DATABASE_URL: state.url,
  PORISROM_ADMIN_TEST_DATABASE_URL: state.url, PORT: "4100", BACKEND_URL: "http://127.0.0.1:4100",
  PORISROM_SAFETY_TEST_DATABASE_URL: state.url, PORISROM_CLUSTER_TEST_DATABASE_URL: state.url,
  NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:4100", FRONTEND_ORIGIN: "http://127.0.0.1:3100,http://127.0.0.1:3101",
  JWT_ACCESS_SECRET: "synthetic-isolated-browser-access-secret", JWT_REFRESH_SECRET: "synthetic-isolated-browser-refresh-secret",
  AUTH_SECRET: "synthetic-isolated-browser-authjs-secret", AUTH_TRUST_HOST: "true",
  PORISROM_SECURITY_TEST_STATE_PATH: location.statePath,
  CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
  PRIVATE_DOCUMENT_UPLOAD_DIR: join(state.root, "private-documents"),
  PROFILE_PHOTO_UPLOAD_DIR: join(state.root, "public-uploads"),
  KYC_DOCUMENT_UPLOAD_DIR: join(state.root, "public-uploads"),
};
if (mode.endsWith("-dev")) { environment.NODE_ENV = "development"; environment.PORISROM_NEXT_DEV_DIST_DIR = ".next-security-dev"; }
// Next's production server needs production mode; this does not change DB isolation.
if (["admin-start", "frontend-start", "frontend-build"].includes(mode)) environment.NODE_ENV = "production";
const child = spawn(process.execPath, [entry, ...cli], { cwd, env: environment, windowsHide: true, stdio: ["inherit", "pipe", "pipe"] });
const redact = (chunk) => String(chunk).replaceAll(state.url, "[isolated test URL]").replaceAll(decodeURIComponent(url.password), "[redacted]");
child.stdout.on("data", (chunk) => process.stdout.write(redact(chunk)));
child.stderr.on("data", (chunk) => process.stderr.write(redact(chunk)));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
