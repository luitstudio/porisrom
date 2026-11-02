import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const env = { ...process.env, NODE_ENV: "test" };
const workerOption = process.argv.find((arg) => arg.startsWith("--test-workers="));
const testWorkers = workerOption?.split("=")[1];
if (testWorkers !== undefined && !/^(?:[1-9]|1[0-6])$/.test(testWorkers)) throw Error("--test-workers must be an integer from 1 to 16");
if (process.argv.includes("--isolated-state")) {
  const pointer = JSON.parse(await readFile(join(root, "tmp/security-test-state-location.json"), "utf8"));
  const state = JSON.parse(await readFile(pointer.statePath, "utf8"));
  if (await realpath(state.data) !== join(await realpath(state.root), "data") || !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database)) throw Error("Unrecognized isolated cluster");
  env.DATABASE_URL = state.url;
}
const target = new URL(env.DATABASE_URL ?? "invalid:");
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !target.pathname.endsWith("_test") || process.env.NODE_ENV === "production") throw Error("Release verification requires an explicit isolated loopback _test database");
for (const name of ["AUTH", "MODERATION", "ADMIN", "SAFETY", "CLUSTER"]) env[`PORISROM_${name}_TEST_DATABASE_URL`] = env.DATABASE_URL;
// Test-only build origins, never proposed as deployment hosts or credentials.
Object.assign(env, { CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
  BACKEND_URL: "https://api.example.test", NEXT_PUBLIC_BACKEND_URL: "https://api.example.test",
  FRONTEND_ORIGIN: "https://marketplace.example.test,https://admin.example.test" });
const secrets = Object.entries(env).filter(([key, value]) => value && /SECRET|PASSWORD|DATABASE_URL/.test(key)).map(([, value]) => value);
if (target.password) secrets.push(decodeURIComponent(target.password));
const redact = (chunk) => secrets.reduce((text, secret) => text.replaceAll(secret, "[redacted]"), String(chunk));
function cli(workspace, pkg, file) {
  const require = createRequire(join(root, workspace, "package.json"));
  return join(dirname(require.resolve(`${pkg}/package.json`)), file);
}
const db = "packages/database", backend = "apps/backend", admin = "apps/admin", frontend = "apps/frontend";
const prisma = cli(db, "prisma", "build/index.js");
const steps = [
  [db, prisma, ["generate"]],
  [db, cli(db, "typescript", "bin/tsc"), []],
  [db, prisma, ["migrate", "deploy"]],
  [db, prisma, ["migrate", "status"]],
  [db, prisma, ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"]],
  [backend, cli(backend, "@nestjs/cli", "bin/nest.js"), ["build"]],
  [backend, cli(backend, "vitest", "vitest.mjs"), ["run", "--reporter=default", "--reporter=json", "--outputFile=../../tmp/backend-tests.json", ...(testWorkers ? [`--maxWorkers=${testWorkers}`] : [])]],
  [admin, cli(admin, "vitest", "vitest.mjs"), ["run", "--configLoader", "runner"]],
  [frontend, cli(admin, "vitest", "vitest.mjs"), ["run", "--config", "vitest.config.mjs", "--configLoader", "runner"]],
  [frontend, "", ["--test", "test/notification-state.test.mjs", "test/realtime-chat.test.mjs", "test/recovery-policy.test.mjs"]],
];
for (const workspace of [backend, admin, frontend]) {
  steps.push([workspace, cli(workspace, "eslint", "bin/eslint.js"), workspace === backend ? ["{src,test}/**/*.ts"] : ["."]]);
  if (workspace !== backend) steps.push([workspace, cli(workspace, "next", "dist/bin/next"), ["typegen"]]);
  steps.push([workspace, cli(workspace, "typescript", "bin/tsc"), ["--noEmit", "--incremental", "false"]]);
}
for (const workspace of [admin, frontend]) {
  steps.push([workspace, cli(workspace, "next", "dist/bin/next"), ["build"]]);
  steps.push([workspace, join(root, "scripts/sanitize-standalone.mjs"), []]);
}
await mkdir(join(root, "tmp"), { recursive: true });
const previous = process.argv.includes("--resume") ? JSON.parse(await readFile(join(root, "tmp/release-verification.json"), "utf8")).results : [];
const results = [];
for (const [workspace, executable, args] of steps) {
  const command = `${workspace}: ${executable ? executable.split(/[\\/]/).slice(-2).join("/") : "node"} ${args.join(" ")}`;
  const completed = previous.find((r) => r.command === command && r.code === 0);
  if (completed && !(process.argv.includes("--recheck-frontend") && workspace === frontend)) { results.push(completed); console.log(`RETAIN VERIFIED ${command}`); continue; }
  console.log(`VERIFY ${command}`);
  const started = Date.now();
  const code = await new Promise((done) => {
    const child = spawn(process.execPath, [...(executable ? [executable] : []), ...args], { cwd: join(root, workspace),
      env: args.includes("build") && workspace !== backend ? { ...env, NODE_ENV: "production" } : env,
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => process.stdout.write(redact(chunk)));
    child.stderr.on("data", (chunk) => process.stderr.write(redact(chunk)));
    child.once("error", () => done(1)); child.once("exit", (code) => done(code ?? 1));
  });
  results.push({ command, code, durationMs: Date.now() - started });
  await writeFile(join(root, "tmp/release-verification.json"), JSON.stringify({ generatedAt: new Date().toISOString(), isolated: true, results }, null, 2));
}
if (results.some((r) => r.code !== 0)) process.exitCode = 1;
