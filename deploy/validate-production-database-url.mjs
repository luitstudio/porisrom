import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const databaseRequiredNames = ["DATABASE_URL", "MIGRATION_DATABASE_URL", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"];
const googleRequiredNames = ["GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"];
const productionUrlRequiredNames = ["FRONTEND_ORIGIN", "BACKEND_PUBLIC_URL", "BACKEND_URL", "NEXT_PUBLIC_BACKEND_URL", "AUTH_URL"];
const marketplaceOrigin = "https://app.porisrom.com";
const adminOrigin = "https://admin.porisrom.com";
const apiOrigin = "https://api.porisrom.com";

function decodeUrlComponent(value, name, issues) {
  try {
    return decodeURIComponent(value);
  } catch {
    issues.push(`${name} must be correctly percent-encoded`);
    return undefined;
  }
}

function parseDatabaseUrl(value, name, issues) {
  try {
    return new URL(value);
  } catch {
    issues.push(`${name} must be a valid URL`);
    return undefined;
  }
}

function validateComposePostgresUrl(url, name, environment, issues) {
  if (url.protocol !== "postgresql:") issues.push(`${name} protocol must be postgresql:`);
  if (url.hostname !== "postgres") issues.push(`${name} hostname must be postgres`);
  if (url.port !== "5432") issues.push(`${name} port must be 5432`);
  return {
    username: decodeUrlComponent(url.username, `${name} username`, issues),
    password: decodeUrlComponent(url.password, `${name} password`, issues),
    databaseName: decodeUrlComponent(url.pathname.replace(/^\//, ""), `${name} database name`, issues),
  };
}

export function validateProductionDatabaseUrl(environment = process.env) {
  const issues = databaseRequiredNames.filter((name) => !environment[name]).map((name) => `${name} is required`);
  if (issues.length > 0) throw new Error(`Production database URL validation failed: ${issues.join("; ")}`);

  const runtimeUrl = parseDatabaseUrl(environment.DATABASE_URL, "DATABASE_URL", issues);
  const migrationUrl = parseDatabaseUrl(environment.MIGRATION_DATABASE_URL, "MIGRATION_DATABASE_URL", issues);
  if (runtimeUrl && migrationUrl) {
    const runtime = validateComposePostgresUrl(runtimeUrl, "DATABASE_URL", environment, issues);
    const migration = validateComposePostgresUrl(migrationUrl, "MIGRATION_DATABASE_URL", environment, issues);
    if (runtime.username !== undefined && runtime.username !== "porisrom_backend_runtime") issues.push("DATABASE_URL username must be porisrom_backend_runtime");
    if (runtime.password !== undefined && runtime.password === environment.POSTGRES_PASSWORD) issues.push("DATABASE_URL password must not match POSTGRES_PASSWORD");
    if (runtime.databaseName !== undefined && runtime.databaseName !== environment.POSTGRES_DB) issues.push("DATABASE_URL database name must match POSTGRES_DB");
    if (migration.username !== undefined && migration.username !== environment.POSTGRES_USER) issues.push("MIGRATION_DATABASE_URL username must match POSTGRES_USER");
    if (migration.password !== undefined && migration.password !== environment.POSTGRES_PASSWORD) issues.push("MIGRATION_DATABASE_URL password must match POSTGRES_PASSWORD");
    if (migration.databaseName !== undefined && migration.databaseName !== environment.POSTGRES_DB) issues.push("MIGRATION_DATABASE_URL database name must match POSTGRES_DB");
    if (environment.DATABASE_URL === environment.MIGRATION_DATABASE_URL) issues.push("DATABASE_URL and MIGRATION_DATABASE_URL must be separate credentials");
  }

  if (issues.length > 0) throw new Error(`Production database URL validation failed: ${issues.join("; ")}`);
}

export function validateGoogleOAuthConfiguration(environment = process.env) {
  const issues = googleRequiredNames.filter((name) => !environment[name]).map((name) => `${name} is required`);
  if (environment.GOOGLE_CLIENT_ID && environment.AUTH_GOOGLE_ID && environment.GOOGLE_CLIENT_ID !== environment.AUTH_GOOGLE_ID) {
    issues.push("GOOGLE_CLIENT_ID must match AUTH_GOOGLE_ID");
  }
  if (issues.length > 0) throw new Error(`Production Google OAuth validation failed: ${issues.join("; ")}`);
}

export function validateProductionUrls(environment = process.env) {
  const issues = productionUrlRequiredNames.filter((name) => !environment[name]).map((name) => `${name} is required`);
  const frontendOrigins = String(environment.FRONTEND_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (frontendOrigins.length !== 2 || new Set(frontendOrigins).size !== 2 ||
    !frontendOrigins.includes(marketplaceOrigin) || !frontendOrigins.includes(adminOrigin)) {
    issues.push("FRONTEND_ORIGIN must contain exactly the approved marketplace and admin origins");
  }
  for (const [name, expected] of [["BACKEND_PUBLIC_URL", apiOrigin], ["BACKEND_URL", apiOrigin], ["NEXT_PUBLIC_BACKEND_URL", apiOrigin], ["AUTH_URL", marketplaceOrigin]]) {
    if (environment[name] && environment[name] !== expected) issues.push(`${name} must match its approved production origin`);
  }
  if (issues.length > 0) throw new Error(`Production URL validation failed: ${issues.join("; ")}`);
}

export function validateProductionConfiguration(environment = process.env) {
  validateProductionDatabaseUrl(environment);
  validateGoogleOAuthConfiguration(environment);
  validateProductionUrls(environment);
}

function main() {
  try {
    validateProductionConfiguration();
    console.log("Production configuration validation passed.");
  } catch (error) {
    // Validation messages identify only configuration fields; they never include credentials or the URL.
    console.error(error instanceof Error ? error.message : "Production database URL validation failed.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
