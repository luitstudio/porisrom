// Fresh PG18 forward-upgrade regression. It applies the checked-in SQL through
// the pre-B2 baseline, deliberately grants the old verifier capability, then
// applies B2 and the production provisioner. The labelled container is removed
// only when this harness created it.
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";

const repo = resolve(import.meta.dirname, "..");
const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Client } = require("pg");
const runId = randomUUID().replaceAll("-", "");
const container = `porisrom-b2-upgrade-${runId}`;
const database = `porisrom_b2upgrade_${runId.slice(0, 12)}`;
const pgPassword = `fixture-${randomUUID()}`;
const verifierPassword = `fixture-${randomUUID()}`;
const admissionPassword = `fixture-${randomUUID()}`;
const backendPassword = `fixture-${randomUUID()}`;
let created = false;

const exec = (command, args, options = {}) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, { cwd: repo, windowsHide: true, ...options });
  let stdout = ""; let stderr = "";
  child.stdout?.on("data", part => { stdout += part; });
  child.stderr?.on("data", part => { stderr += part; });
  if (options.input !== undefined) child.stdin.end(options.input);
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolveRun({ stdout, stderr }) : reject(Error(`${command} failed (${code}): ${stderr || stdout}`)));
});
const freshPort = () => new Promise((resolvePort, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(error => error ? reject(error) : resolvePort(port));
  });
});
const query = async (url, text, values = []) => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { return await client.query(text, values); } finally { await client.end(); }
};
const assert = (condition, message) => { if (!condition) throw Error(message); };
const psql = async sql => exec("docker", ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: sql });

const port = await freshPort();
const ownerUrl = `postgresql://postgres:${encodeURIComponent(pgPassword)}@127.0.0.1:${port}/${database}`;
try {
  await exec("docker", ["run", "-d", "--rm", "--name", container, "--label", "com.porisrom.disposable=true", "--label", "com.porisrom.test=b2-upgrade", "-e", `POSTGRES_PASSWORD=${pgPassword}`, "-e", `POSTGRES_DB=${database}`, "-p", `127.0.0.1:${port}:5432`, "postgres:18.2"]);
  created = true;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try { await query(ownerUrl, "SELECT 1"); break; }
    catch (error) { if (attempt === 44) throw error; await new Promise(resolveDelay => setTimeout(resolveDelay, 1000)); }
  }
  const migrationsRoot = join(repo, "packages/database/prisma/migrations");
  const migrations = (await readdir(migrationsRoot)).filter(name => /^\d+_/.test(name)).sort();
  const cut = migrations.indexOf("20261127000000_authenticated_evidence_admission");
  assert(cut > 0, "pre-B2 migration boundary was not found");
  for (const name of migrations.slice(0, cut)) await psql(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
  await psql(`CREATE ROLE porisrom_verifier_runtime LOGIN NOINHERIT PASSWORD '${verifierPassword.replaceAll("'", "''")}'; CREATE ROLE porisrom_admission_runtime NOINHERIT; CREATE ROLE porisrom_backend_runtime NOINHERIT; GRANT USAGE ON SCHEMA public TO porisrom_verifier_runtime; GRANT EXECUTE ON FUNCTION public."backup_admit_verified_capture_verification"(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,"BackupCaptureClass",TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT) TO porisrom_verifier_runtime;`);
  const preUpgrade = await query(ownerUrl, "SELECT has_function_privilege('porisrom_verifier_runtime', 'public.\"backup_admit_verified_capture_verification\"(text,text,text,text,text,text,integer,\"BackupCaptureClass\",text,text,text,jsonb,text,text,text)', 'EXECUTE') AS allowed");
  assert(preUpgrade.rows[0].allowed === true, "fixture did not establish the pre-B2 verifier grant");
  for (const name of migrations.slice(cut)) await psql(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
  await psql(await readFile(join(repo, "deploy/backup-admission-role-provision.sql"), "utf8"));
  await psql(`ALTER ROLE porisrom_admission_runtime LOGIN PASSWORD '${admissionPassword.replaceAll("'", "''")}'; ALTER ROLE porisrom_backend_runtime LOGIN PASSWORD '${backendPassword.replaceAll("'", "''")}';`);
  const privileges = await query(ownerUrl, `SELECT has_function_privilege('porisrom_verifier_runtime', 'public."backup_admit_verified_capture_verification"(text,text,text,text,text,text,integer,"BackupCaptureClass",text,text,text,jsonb,text,text,text)', 'EXECUTE') AS "legacyVerifierExecute", has_function_privilege('porisrom_admission_runtime', 'public."backup_admit_verified_capture_verification"(text,text,text,text,text,text,integer,"BackupCaptureClass",text,text,text,jsonb,text,text,text)', 'EXECUTE') AS "admissionExecute", has_table_privilege('porisrom_admission_runtime', 'public."BackupVerifierCertificate"', 'UPDATE') AS "admissionRegistryUpdate", has_table_privilege('porisrom_backend_runtime', 'public."User"', 'INSERT,UPDATE,DELETE,SELECT') AS "backendCrud", pg_has_role('porisrom_admission_runtime', 'porisrom_admission_lookup_owner', 'MEMBER') AS "canAssumeLookupOwner"`);
  const result = privileges.rows[0];
  assert(!result.legacyVerifierExecute, "legacy verifier EXECUTE privilege survived B2 upgrade");
  assert(result.admissionExecute, "admission execute privilege was not provisioned");
  assert(!result.admissionRegistryUpdate, "admission gained registry mutation privilege");
  assert(result.backendCrud, "backend CRUD privilege was not preserved");
  assert(!result.canAssumeLookupOwner, "admission may assume SECURITY DEFINER owner");
  const verifierUrl = `postgresql://porisrom_verifier_runtime:${encodeURIComponent(verifierPassword)}@127.0.0.1:${port}/${database}`;
  let denied = false;
  try { await query(verifierUrl, "SELECT public.\"backup_admit_verified_capture_verification\"(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)"); } catch (error) { denied = error.code === "42501"; }
  assert(denied, "legacy verifier can still invoke protected admission function");
  console.log(JSON.stringify({ migrationCount: migrations.length, preUpgradeLegacyVerifierExecute: true, ...result, verifierInvocationDenied: denied }));
} finally {
  if (created) await exec("docker", ["rm", "-f", container]).catch(() => {});
}
