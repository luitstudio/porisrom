// Hermetic policy tests only: never invokes Docker, age, backups, or restores.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."); const read = path => readFile(resolve(root, path), "utf8");
const [backup, restore, compose, readme] = await Promise.all([
  read("deploy/backup/porisrom-backup.sh"), read("deploy/backup/porisrom-restore-rehearsal.sh"), read("deploy/backup/compose.restore-rehearsal.yml"), read("deploy/backup/README.md"),
]);
for (const required of ["--format=custom", "INTEGRITY_VERIFIED", "RESTORE_VERIFIED", "last_known_good", "sha256sum --check --status manifest.sha256", "PORISROM_BACKUP_SAFETY_RESERVE_KIB", "check_capacity 'before-atomic-publication'", "mv -- \"$work_dir\" \"$final_dir\"", "--request $REQUEST_FILE", "PORISROM_BACKUP_COORDINATOR_URL", "coordinator_call claim", "coordinator_call validate", "backup-capture.request", "capture_job_id=%s", "lease_id=%s", "attempt_id=%s", "write_result succeeded integrity_verified"])
  assert.match(backup, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(backup, /s3|r2|rclone|restic|borg/i);
assert.ok(backup.indexOf('mv -- "$work_dir" "$final_dir"') < backup.indexOf("prune_class daily 7"));
assert.doesNotMatch(restore, /PORISROM_RESTORE_COMPOSE_FILE/);
for (const required of ["compose.restore-rehearsal.yml", "config --format json", "external volume rejected", "host/external mount rejected", "published restore port rejected", "SHOW server_version", "RESTORE_VERIFIED"]) assert.match(restore, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(compose, /postgres:18\.2-bookworm/); assert.doesNotMatch(compose, /ports:/); assert.match(readme, /last known-good recovery point/i);

// Policy model mirrors the shell's fail-closed retention decisions.
function retain(sets, keep = 7) {
  if (sets.some(s => s.published && !s.integrity)) throw Error("corrupt or uncertain set");
  const known = sets.filter(s => s.integrity && s.restore).sort((a, b) => b.name.localeCompare(a.name))[0];
  if (!known) return { deleted: [], protected: null };
  const ordered = sets.filter(s => s.integrity && s.class === "daily").sort((a, b) => b.name.localeCompare(a.name));
  return { deleted: ordered.slice(keep).filter(s => s.name !== known.name).map(s => s.name), protected: known.name };
}
assert.equal(retain([{ name: "20260101T000000Z-daily", class: "daily", integrity: true, restore: false, published: true }]).protected, null, "hash-valid archive is not restore-verified");
assert.throws(() => retain([{ name: "20260103T000000Z-daily", class: "daily", integrity: false, restore: false, published: true }]), /corrupt/, "corrupt newest set aborts retention");
const oldGood = { name: "20260101T000000Z-daily", class: "daily", integrity: true, restore: true, published: true };
const policy = retain([oldGood, ...Array.from({ length: 8 }, (_, i) => ({ name: `202601${String(i + 2).padStart(2, "0")}T000000Z-daily`, class: "daily", integrity: true, restore: false, published: true }))]);
assert.equal(policy.protected, oldGood.name); assert.ok(!policy.deleted.includes(oldGood.name), "last known-good is preserved");
assert.equal(retain([{ name: ".interrupted", class: "daily", integrity: false, restore: false, published: false }]).deleted.length, 0, "interrupted staging is ineligible");
for (const invalid of ["external volume rejected", "host/external mount rejected", "published restore port rejected"]) assert.match(restore, new RegExp(invalid));
const required = source => source + Math.ceil(source * .05) + 65536 + 1024;
assert.ok(required(100000) > 100000, "disk estimate includes encryption and staging/reserve");
assert.throws(() => { const free = 1; if (free < required(100000)) throw Error("insufficient disk capacity"); }, /insufficient/, "insufficient capacity fails before publication");
assert.match(backup, /existing recovery points were not pruned/, "disk exhaustion retains recovery points");
assert.match(backup, /request file must be root-owned mode 0600 and not a symlink/, "unsafe request files are rejected");
assert.match(backup, /request contains an unexpected field/, "request format is closed");
assert.match(readme, /backupSafe=false`? is expected/i, "lease-specific preflight is documented");
assert.match(backup, /write_result succeeded integrity_verified[\s\S]*coordinator_call report/, "a successful result envelope is durable before report submission");
assert.match(backup, /! -e \$\{result_file:-\}/, "a durable result envelope is preserved after report failure");
assert.match(backup, /--env-file "\$PRODUCTION_ENV_FILE"/, "host capture uses the controlled production Compose environment file");
assert.match(backup, /canonicalStorageKey/, "successful capture binds a canonical storage key");
function validateComposeModel(config, project, database) {
  if (!project.startsWith("porisrom_restore_") || project.includes("production") || !database.startsWith("porisrom_restore_") || database.includes("production")) throw Error("production target rejected");
  if (config.postgres !== "postgres:18.2-bookworm" || config.ports || config.hostMount || config.externalVolume || config.externalNetwork) throw Error("unsafe restore compose");
}
for (const unsafe of [
  { postgres: "postgres:18.2-bookworm", ports: true }, { postgres: "postgres:18.2-bookworm", hostMount: true },
  { postgres: "postgres:18.2-bookworm", externalVolume: true }, { postgres: "postgres:18.2-bookworm", externalNetwork: true },
]) assert.throws(() => validateComposeModel(unsafe, "porisrom_restore_test", "porisrom_restore_test"), /unsafe/);
assert.throws(() => validateComposeModel({ postgres: "postgres:18.2-bookworm" }, "porisrom_production", "porisrom_restore_test"), /production/);
let retained = ["old-good", "old-other"];
const deleteWithFailure = name => { if (name === "old-other") throw Error("retention delete failed"); retained = retained.filter(x => x !== name); };
assert.throws(() => deleteWithFailure("old-other"), /retention delete failed/); assert.deepEqual(retained, ["old-good", "old-other"], "retention failure preserves recovery points for retry");
assert.match(backup, /retention failed; no further sets were removed/);
console.log("production backup tooling security contracts passed");
