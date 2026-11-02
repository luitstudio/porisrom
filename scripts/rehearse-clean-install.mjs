import { cp, mkdtemp, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { spawn } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const pnpmCli = process.argv[2];
if (!pnpmCli || !(await readFile(pnpmCli, "utf8")).includes("pnpm")) throw Error("Supply the installed pnpm 9.0.0 CLI path");
const destination = await mkdtemp(join(root, "tmp/clean-install-"));
const excluded = new Set([".git", "node_modules", ".next", "dist", "tmp", "uploads", "private-uploads", ".aws", ".codex", ".agents"]);
await mkdir(join(destination, "candidate"));
for (const entry of await readdir(root)) await cp(join(root, entry), join(destination, "candidate", entry), { recursive: true, filter: (path) => !excluded.has(basename(path)) && !basename(path).startsWith(".next") && !basename(path).startsWith(".env") && !/\.(dump|log|tsbuildinfo)$/.test(path) });
const cwd = join(destination, "candidate");
async function run(args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [pnpmCli, ...args], { cwd, env: { ...process.env, CI: "true", npm_config_offline: "false" }, windowsHide: true, stdio: "inherit" });
    child.once("error", () => done(1)); child.once("exit", (code) => done(code ?? 1));
  });
}
if (await run(["--version"]) !== 0) throw Error("Package manager unavailable");
const code = await run(["install", "--frozen-lockfile", "--offline=false"]);
await writeFile(join(root, "tmp/clean-install-result.json"), JSON.stringify({ candidateSnapshot: true, existingWorktreePreserved: true, copiedSecrets: false, frozenInstallExitCode: code }, null, 2));
process.exitCode = code;
