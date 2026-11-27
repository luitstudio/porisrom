// Build and load the engine at the exact relative location used by the
// production verifier entrypoint. A Docker build alone cannot catch this.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const workspace of ["@porisrom/shared-types", "@porisrom/backend", "@porisrom/artifact-verifier"]) {
  if (process.platform === "win32") {
    execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm.cmd --filter ${workspace} build`], { cwd: root, stdio: "inherit" });
  } else {
    execFileSync("pnpm", ["--filter", workspace, "build"], { cwd: root, stdio: "inherit" });
  }
}

const layout = join(root, "tmp", "verifier-runtime-module-resolution");
const entrypoint = join(layout, "dist", "verifier", "src", "main.js");
const engine = join(dirname(entrypoint), "backup-artifact-verifier.engine.js");
await rm(layout, { recursive: true, force: true });
try {
  await mkdir(dirname(entrypoint), { recursive: true });
  await copyFile(join(root, "apps", "backend", "dist", "storage-maintenance", "backup-artifact-verifier.engine.js"), engine);
  const sharedRuntime = join(layout, "node_modules", "@porisrom", "shared-types");
  await mkdir(join(sharedRuntime, "dist"), { recursive: true });
  await copyFile(join(root, "packages", "shared-types", "package.json"), join(sharedRuntime, "package.json"));
  for (const file of await readdir(join(root, "packages", "shared-types", "dist"))) {
    if (file.endsWith(".js")) await copyFile(join(root, "packages", "shared-types", "dist", file), join(sharedRuntime, "dist", file));
  }
  await writeFile(entrypoint, "module.exports = require('./backup-artifact-verifier.engine.js');\n");
  const loaded = createRequire(entrypoint)("./backup-artifact-verifier.engine.js");
  assert.equal(typeof loaded.BackupArtifactVerifierEngine, "function");
  console.log("verifier runtime engine module resolution passed");
} finally {
  await rm(layout, { recursive: true, force: true });
}
