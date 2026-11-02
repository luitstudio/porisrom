// Only the task-owned loopback cluster; restore always creates a NEW database.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const repo = resolve(import.meta.dirname, "..");
const location = JSON.parse(await readFile(join(repo, "tmp/security-test-state-location.json"), "utf8"));
const state = JSON.parse(await readFile(location.statePath, "utf8"));
const target = new URL(state.url);
if (process.env.NODE_ENV === "production" || target.hostname !== "127.0.0.1" || Number(target.port) !== state.port ||
    !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database) || await realpath(state.data) !== join(await realpath(state.root), "data")) throw Error("Refusing non-isolated backup");
const requireDb = createRequire(join(repo, "packages/database/package.json"));
const { Client } = requireDb("pg");
const source = new Client({ connectionString: state.url });
const restoredName = `porisrom_restore_${randomUUID().replaceAll("-", "")}_test`;
const restoredUrl = new URL(state.url); restoredUrl.pathname = `/${restoredName}`;
const restored = new Client({ connectionString: restoredUrl.href });
const dump = join(state.root, `synthetic-backup-${randomUUID()}.dump`);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(target.password), NODE_ENV: "test" };
const args = ["-h", "127.0.0.1", "-p", String(state.port), "-U", state.user];
function run(exe, command, extras = {}) {
  const result = spawnSync(exe, command, { windowsHide: true, encoding: "utf8", env: { ...env, ...extras }, cwd: join(repo, "packages/database") });
  if (result.error || result.status !== 0) throw Error("Isolated backup/restore verification failed (credentials and provider output withheld)");
  return result.stdout;
}
async function fingerprint(db) {
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'socket_io_attachments' ORDER BY tablename")).rows;
  const values = [];
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = (await db.query(`SELECT to_jsonb(t)::text AS row FROM ${quoted} t ORDER BY to_jsonb(t)::text`)).rows;
    values.push({ table: tablename, rows: rows.length, checksum: createHash("sha256").update(JSON.stringify(rows)).digest("hex") });
  }
  return values;
}
try {
  await source.connect();
  const info = (await source.query("SELECT current_database() AS name, current_setting('data_directory') AS directory")).rows[0];
  if (info.name !== state.database || await realpath(info.directory) !== await realpath(state.data)) throw Error("Cluster identity mismatch");
  const before = await fingerprint(source);
  run(join(state.bin, "pg_dump.exe"), [...args, "-d", state.database, "--format=custom", "--no-owner", "--no-acl", "--exclude-table-data=public.socket_io_attachments", "--file", dump]);
  await source.query(`CREATE DATABASE "${restoredName}"`);
  run(join(state.bin, "pg_restore.exe"), [...args, "-d", restoredName, "--no-owner", "--no-acl", "--exit-on-error", dump]);
  await restored.connect();
  const after = await fingerprint(restored);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error("Restored table contents differ");
  const constraints = (await restored.query("SELECT COUNT(*)::int AS invalid FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")).rows[0];
  if (constraints.invalid) throw Error("Unvalidated restored constraints");
  const prisma = join(dirname(requireDb.resolve("prisma/package.json")), "build/index.js");
  run(process.execPath, [prisma, "migrate", "status"], { DATABASE_URL: restoredUrl.href });
  run(process.execPath, [prisma, "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"], { DATABASE_URL: restoredUrl.href });
  const evidence = { isolated: true, sourcePreserved: true, restoredIntoNewDatabase: true, tablesMatched: after.length,
    rowsMatched: after.reduce((n, t) => n + t.rows, 0), constraintsValidated: true, migrationStatusPassed: true, schemaDrift: false,
    ephemeralSocketPayloadsExcluded: true, stagingOrProductionBackupVerified: false };
  await writeFile(join(repo, "tmp/staging-backup-rehearsal.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await source.end(); await restored.end(); }
