import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateProductionConfiguration } from "./validate-production-database-url.mjs";

const deployDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(deployDirectory, "..");
const composeFile = resolve(deployDirectory, "compose.production.yml");
const productionEnvironmentFile = "/etc/porisrom/production.env";
const mode = process.argv[2] ?? "start";

export class ChildCommandError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export class ChildSignalError extends Error {
  constructor(signal) {
    super(`Production preflight child terminated by ${signal}`);
    this.signal = signal;
  }
}

export function runCommand(command, args, spawn = spawnSync) {
  const result = spawn(command, args, { stdio: "inherit", env: process.env, cwd: repositoryRoot });
  if (result.error) throw new ChildCommandError(`Production preflight failed: unable to execute ${command}`);
  if (result.signal) throw new ChildSignalError(result.signal);
  if (result.status !== 0) throw new ChildCommandError(`Production preflight command failed: ${command}`, result.status);
}

export function executePreflight(selectedMode = mode, commandRunner = runCommand, validate = validateProductionConfiguration) {
  if (!["start", "--validate-only", "--dry-run"].includes(selectedMode) || process.argv.length > 3) {
    throw new ChildCommandError("Usage: node production-preflight.mjs [--validate-only|--dry-run]");
  }

  if (selectedMode === "--dry-run") {
    validate(process.env);
    return "dry-run";
  }

  // Pin Compose interpolation to the production operator contract; never discover a .env file implicitly.
  const compose = ["compose", "--env-file", productionEnvironmentFile, "--project-directory", repositoryRoot, "--file", composeFile];
  if (selectedMode === "--validate-only") {
    commandRunner("docker", [...compose, "--profile", "validation", "run", "--rm", "--no-deps", "production-config-check"]);
    return "validate-only";
  }

  validate(process.env);
  commandRunner("docker", [...compose, "--profile", "validation", "run", "--rm", "--no-deps", "production-config-check"]);
  // Migrations are deliberately absent. They require separate database-owner approval.
  commandRunner("docker", [...compose, "up", "-d", "postgres", "backend", "frontend", "admin"]);
  return "start";
}

function main() {
  try {
    const result = executePreflight();
    if (result === "dry-run") console.log("Production preflight dry run passed; configuration only, not Docker deployment readiness.");
    if (result === "validate-only") console.log("Production validation service passed; application startup was not requested.");
    if (result === "start") console.log("Production preflight passed and application startup was requested.");
  } catch (error) {
    if (error instanceof ChildSignalError) {
      try { process.kill(process.pid, error.signal); } catch { /* Fall through on platforms without this signal. */ }
      process.exit(1);
    }
    console.error(error instanceof Error ? error.message : "Production preflight failed.");
    process.exit(error instanceof ChildCommandError && Number.isInteger(error.status) ? error.status : 1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
