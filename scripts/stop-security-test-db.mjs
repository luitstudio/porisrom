import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
const repo = resolve(import.meta.dirname, "..");
const location = JSON.parse(await readFile(join(repo, "tmp/security-test-state-location.json"), "utf8"));
const state = JSON.parse(await readFile(location.statePath, "utf8"));
const root = await realpath(state.root); const data = await realpath(state.data);
if (!root.startsWith((await realpath(tmpdir())) + sep + "porisrom-security-") || data !== join(root, "data") ||
    !/^porisrom_security_[a-f0-9]{32}_test$/.test(state.database)) throw Error("Refusing to stop an unrecognized cluster");
const result = spawnSync(join(state.bin, "pg_ctl.exe"), ["-D", state.data, "-m", "fast", "-w", "stop"], { windowsHide: true, stdio: "ignore" });
if (result.error || result.status !== 0) throw Error("Temporary cluster stop failed");
console.log("Stopped only the task-owned temporary PostgreSQL cluster. Its data and all existing databases were preserved.");
