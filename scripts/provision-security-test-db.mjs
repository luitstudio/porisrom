// Creates a NEW loopback-only PostgreSQL cluster, never reuses DATABASE_URL.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

if (process.env.NODE_ENV === "production") throw Error("Test provisioning refuses production mode");
const root = process.argv[2] ? resolve(process.argv[2]) : await mkdtemp(join(tmpdir(), "porisrom-security-"));
if (!root.startsWith(join(tmpdir(), "porisrom-security-"))) throw Error("Only a newly provisioned Porisrom temporary cluster may be resumed");
const bin = process.env.PORISROM_PG_BIN || "C:/Program Files/PostgreSQL/18/bin";
const data = join(root, "data"); const passwordFile = join(root, "password.txt");
const resuming = !!process.argv[2];
const password = resuming ? (await readFile(passwordFile, "utf8")).trim() : randomBytes(32).toString("hex");
const database = `porisrom_security_${randomUUID().replaceAll("-", "")}_test`;
const user = "porisrom_test";
const probe = createServer();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
let port = probe.address().port; await new Promise((done) => probe.close(done));
if (resuming) {
  try { port = Number((await readFile(join(data, "postmaster.pid"), "utf8")).split(/\r?\n/)[3]); } catch { /* A stopped cluster can use the new port. */ }
}
await writeFile(passwordFile, password, { mode: 0o600 });
function run(exe, args, env = {}) {
  const result = spawnSync(join(bin, `${exe}.exe`), args, { windowsHide: true, encoding: "utf8", stdio: exe === "pg_ctl" ? "ignore" : ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  if (result.error || result.status !== 0) throw Error(`${exe} failed: ${(result.stderr || result.error?.message || "").replaceAll(password, "[redacted]")}`);
  return result.stdout;
}
if (!resuming) run("initdb", ["-D", data, "-U", user, "--pwfile", passwordFile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
const running = spawnSync(join(bin, "pg_ctl.exe"), ["-D", data, "status"], { windowsHide: true, stdio: "ignore" }).status === 0;
if (!running) run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
const connectionArgs = ["-h", "127.0.0.1", "-p", String(port), "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const serverData = run("psql", [...connectionArgs, "-Atc", "SHOW data_directory"], { PGPASSWORD: password }).trim();
if (resolve(serverData) !== resolve(data)) throw Error("Cluster isolation verification failed");
run("psql", [...connectionArgs, "-c", `CREATE DATABASE "${database}"`], { PGPASSWORD: password });
const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
const statePath = join(root, "state.json");
await writeFile(statePath, JSON.stringify({ root, data, bin, port, database, user, url }), { mode: 0o600 });
await writeFile(resolve("tmp/security-test-state-location.json"), JSON.stringify({ statePath }));
console.log(JSON.stringify({ isolated: true, host: "127.0.0.1", port, database, serverDataDirectoryVerified: true, stateOutsideRepository: true }));
