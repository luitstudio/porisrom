import { readFile, writeFile, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const repo = resolve(import.meta.dirname, "..");
const state = JSON.parse(await readFile(process.env.PORISROM_SECURITY_TEST_STATE_PATH, "utf8"));
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== state.url || !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database)) throw Error("Explicit isolated target required");
const { Client } = createRequire(join(repo, "packages/database/package.json"))("pg");
const db = new Client({ connectionString: state.url });
try {
  await db.connect();
  const info = (await db.query("SELECT current_database() AS database, current_setting('data_directory') AS directory, version() AS version")).rows[0];
  if (info.database !== state.database || await realpath(info.directory) !== await realpath(state.data)) throw Error("Connected cluster does not match isolated state");
  if (process.argv.includes("--revoke-fixture-sessions")) {
    const ids = Object.values(state.browserUsers).map((user) => user.id);
    const result = await db.query('UPDATE "AuthSession" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "userId"=ANY($1::text[]) AND "revokedAt" IS NULL', [ids]);
    console.log(`Revoked ${result.rowCount} task-owned synthetic browser sessions; no shared account was touched.`);
  }
  const migrations = (await db.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  const checksums = [];
  for (const row of migrations) {
    const sql = await readFile(join(repo, "packages/database/prisma/migrations", row.migration_name, "migration.sql"));
    const matches = createHash("sha256").update(sql).digest("hex") === row.checksum;
    if (!matches || !row.finished_at || row.rolled_back_at) throw Error("Migration ledger verification failed");
    checksums.push({ name: row.migration_name, checksumMatches: matches, completed: true });
  }
  const sessions = (await db.query('SELECT u.role, COUNT(s.id)::int AS sessions, COUNT(s.id) FILTER (WHERE s."revokedAt" IS NULL)::int AS active FROM "User" u LEFT JOIN "AuthSession" s ON s."userId"=u.id WHERE u.id LIKE $1 GROUP BY u.role ORDER BY u.role', [state.browserNamespace + "-%"])).rows;
  const decisions = (await db.query('SELECT metadata->>\'outcome\' AS outcome, COUNT(*)::int AS count FROM "AdminActionLog" WHERE "adminId"=$1 AND action=\'resolve_payment_dispute\' GROUP BY metadata->>\'outcome\' ORDER BY outcome', [state.browserUsers.admin.id])).rows;
  const evidence = { isolated: true, host: "127.0.0.1", port: state.port, database: state.database, clusterDirectoryVerified: true,
    version: info.version, migrations: checksums, browserSessions: sessions, browserDecisions: decisions };
  await writeFile(join(repo, "tmp/security-db-evidence-2026-10-22.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await db.end(); }
