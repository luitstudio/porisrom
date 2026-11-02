import { readFile, writeFile, cp, stat, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
const repo = resolve(import.meta.dirname, "..");
const pointer = JSON.parse(await readFile(join(repo, "tmp/security-test-state-location.json"), "utf8"));
const state = JSON.parse(await readFile(pointer.statePath, "utf8"));
const url = new URL(state.url);
if (process.env.NODE_ENV === "production" || url.hostname !== "127.0.0.1" || !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database) || await realpath(state.data) !== join(await realpath(state.root), "data")) throw Error("Isolated artifact test target required");
const runtime = join(repo, "tmp/acceptance-backend-runtime-verified");
const runtimeRequire = createRequire(join(runtime, "package.json"));
const checks = []; const children = [];
function check(name, value) { checks.push({ name, passed: !!value }); if (!value) throw Error(name); }
async function port() { const s = createServer(); await new Promise((r) => s.listen(0, "127.0.0.1", r)); const p = s.address().port; await new Promise((r) => s.close(r)); return p; }
const shared = { ...process.env, NODE_ENV: "production", DATABASE_URL: state.url, HOST: "127.0.0.1", HOSTNAME: "127.0.0.1",
  JWT_ACCESS_SECRET: randomBytes(48).toString("hex"), JWT_REFRESH_SECRET: randomBytes(48).toString("hex"), AUTH_SECRET: randomBytes(48).toString("hex"),
  BACKEND_URL: "https://api.example.test", NEXT_PUBLIC_BACKEND_URL: "https://api.example.test", FRONTEND_ORIGIN: "https://marketplace.example.test,https://admin.example.test",
  AUTH_TRUST_HOST: "true", CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "", SOCKET_ADAPTER: "memory", REALTIME_EXPECTED_INSTANCES: "1",
  KYC_LOCAL_FALLBACK_ENABLED: "false", PRIVATE_DOCUMENT_UPLOAD_DIR: join(state.root, "artifact-private"), PROFILE_PHOTO_UPLOAD_DIR: join(state.root, "artifact-public") };
async function start(cwd, entry, path, extras = {}) {
  const p = await port(); const base = `http://127.0.0.1:${p}`;
  const child = spawn(process.execPath, [entry], { cwd, env: { ...shared, PORT: String(p), ...extras }, windowsHide: true, stdio: "ignore" }); children.push(child);
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error("Artifact process exited before readiness (output withheld)");
    try { if ((await fetch(base + path)).ok) return base; } catch { /* Startup only. */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Artifact readiness timed out");
}
try {
  runtimeRequire("@porisrom/database"); check("Packaged compiled Prisma client loads", true);
  for (const name of ["typescript", "eslint", "vitest", "@nestjs/cli"]) {
    let found = false; try { found = runtimeRequire.resolve(`${name}/package.json`).startsWith(runtime); } catch { /* Correctly absent from runtime resolution. */ }
    check(`Runtime does not resolve ${name}`, !found);
  }
  const base = await start(runtime, "dist/main.js", "/health/ready");
  check("Packaged production API health and database readiness", (await fetch(base + "/health")).ok);
  const registration = await fetch(base + "/auth/signup", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://marketplace.example.test" },
    body: JSON.stringify({ name: "Synthetic artifact smoke", email: `artifact-${randomUUID()}@example.test`, password: "Synthetic-artifact-only-password!", role: "client" }) });
  check("Packaged production API synthetic authentication", registration.status === 201);
  const cookies = registration.headers.getSetCookie();
  check("Production auth responses declare HttpOnly Secure SameSite=Lax", cookies.length >= 2 && cookies.every((c) => /httponly/i.test(c) && /; secure/i.test(c) && /samesite=lax/i.test(c)));
  check("Exact approved CORS origin returned", registration.headers.get("access-control-allow-origin") === "https://marketplace.example.test");
  const unapproved = await fetch(base + "/health", { headers: { Origin: "https://unapproved.example.test" } });
  check("Unapproved origin receives no CORS allow header", !unapproved.headers.get("access-control-allow-origin"));
  const auth = await registration.json();
  const logout = await fetch(base + "/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` }, body: JSON.stringify({ refreshToken: auth.refreshToken }) });
  check("Packaged logout and persisted access revocation", logout.ok && (await fetch(base + "/auth/me", { headers: { Authorization: `Bearer ${auth.accessToken}` } })).status === 401);
  for (const [app, path] of [["admin", "/login"], ["frontend", "/auth/login"]]) {
    const build = join(repo, "apps", app, ".next"); const cwd = join(build, "standalone/apps", app);
    await cp(join(build, "static"), join(cwd, ".next/static"), { recursive: true });
    const publicDir = join(repo, "apps", app, "public");
    if (await stat(publicDir).then(() => true, () => false)) await cp(publicDir, join(cwd, "public"), { recursive: true });
    const origin = await start(cwd, "server.js", path);
    check(`${app} standalone production server serves login`, (await fetch(origin + path)).status === 200);
  }
} finally {
  await Promise.all(children.map((child) => new Promise((done) => { if (child.exitCode !== null) return done(); child.once("exit", done); child.kill("SIGTERM"); setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3000).unref(); })));
  const evidence = { generatedAt: new Date().toISOString(), localNativeArtifactsOnly: true, dockerExecutionVerified: false, httpsBrowserVerified: false, checks };
  await writeFile(join(repo, "tmp/final-acceptance-artifact-smoke.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
