// Hermetic checks for production credential separation and role provisioning.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateProductionDatabaseUrl } from "../deploy/validate-production-database-url.mjs";
import { executePreflight } from "../deploy/production-preflight.mjs";

const root = resolve(import.meta.dirname, "..");
const environment = {
  POSTGRES_USER: "controlled_migration_owner", POSTGRES_PASSWORD: "migration-password", POSTGRES_DB: "porisrom",
  MIGRATION_DATABASE_URL: "postgresql://controlled_migration_owner:migration-password@postgres:5432/porisrom",
  DATABASE_URL: "postgresql://porisrom_backend_runtime:backend-password@postgres:5432/porisrom",
};
validateProductionDatabaseUrl(environment);
assert.throws(() => validateProductionDatabaseUrl({ ...environment, DATABASE_URL: environment.MIGRATION_DATABASE_URL }), /separate credentials|porisrom_backend_runtime/);
assert.throws(() => validateProductionDatabaseUrl({ ...environment, DATABASE_URL: "postgresql://porisrom_backend_runtime:migration-password@postgres:5432/porisrom" }), /must not match POSTGRES_PASSWORD/);
assert.throws(() => validateProductionDatabaseUrl({ ...environment, MIGRATION_DATABASE_URL: "postgresql://porisrom_backend_runtime:backend-password@postgres:5432/porisrom" }), /MIGRATION_DATABASE_URL username/);

const commands = [];
assert.equal(executePreflight("--validate-only", (command, args) => commands.push([command, args]), () => {}), "validate-only");
assert.equal(commands.length, 1);
assert.deepEqual(commands[0][0], "docker");
assert.ok(commands[0][1].includes("--env-file") && commands[0][1].includes("production-config-check"));

const [compose, provision, bootstrap] = await Promise.all([
  readFile(resolve(root, "deploy/compose.production.yml"), "utf8"),
  readFile(resolve(root, "deploy/backup-admission-role-provision.sql"), "utf8"),
  readFile(resolve(root, "deploy/migration-role-shell-bootstrap.sql"), "utf8"),
]);
assert.match(compose, /DATABASE_URL: \$\{DATABASE_URL:\?Supply the restricted backend-runtime PostgreSQL URL\}/);
assert.match(compose, /DATABASE_URL: \$\{MIGRATION_DATABASE_URL:\?Supply the controlled migration-executor PostgreSQL URL\}/);
for (const role of ["porisrom_backend_runtime", "porisrom_admission_runtime", "porisrom_dispatcher_runtime", "porisrom_finalizer_runtime"]) {
  assert.match(bootstrap, new RegExp(`CREATE ROLE ${role} NOLOGIN NOINHERIT`));
  assert.match(provision, new RegExp(`ALTER ROLE ${role} LOGIN NOINHERIT NOSUPERUSER`));
}
for (const role of ["porisrom_db_owner", "porisrom_verifier_runtime"]) assert.match(provision, new RegExp(`CREATE ROLE ${role} NOLOGIN NOINHERIT`));
console.log("production deployment credential and role configuration passed");
