import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const read = p => readFile(resolve(root, p), "utf8");
const [script, coordinatorUnit, captureUnit, legacyTimer, dailyTimer, weeklyTimer, monthlyTimer] = await Promise.all([
  read("deploy/backup/porisrom-backup-coordinator.sh"), read("deploy/backup/porisrom-backup-coordinator@.service"), read("deploy/backup/porisrom-backup-capture.service"),
  read("deploy/backup/porisrom-backup@.timer"), read("deploy/backup/porisrom-backup-coordinator-daily.timer"), read("deploy/backup/porisrom-backup-coordinator-weekly.timer"), read("deploy/backup/porisrom-backup-coordinator-monthly.timer"),
]);
assert.match(script, /readonly SYSTEMCTL=\/usr\/bin\/systemctl/);
assert.match(script, /"\$SYSTEMCTL" start --wait "\$CAPTURE_UNIT"/);
assert.doesNotMatch(script, /eval\s|bash -c|sh -c|ExecStart=.*\$/);
for (const required of ["REQUEST_DIR=/run/porisrom", "/var/lib/porisrom/backup-coordinator", "flock -n 9", "--class", "daily|weekly|monthly", "systemctl", "porisrom-backup-capture.service", "job document is invalid", "execution evidence already exists", "stat -c %a", "call claim", "call validate"]) assert.ok(script.includes(required), `missing ${required}`);
for (const required of ["delivery true", "fs.openSync(tmp,\"wx\",0o600)", "fs.fsyncSync(fd)", "fs.renameSync(tmp,file)", "fs.fsyncSync(dir)", "local persistence failed", "call finalize"]) assert.ok(script.includes(required), `missing delivery/durability contract ${required}`);
assert.match(coordinatorUnit, /ExecStart=\/opt\/porisrom\/app\/deploy\/backup\/porisrom-backup-coordinator\.sh --class %i/);
assert.match(captureUnit, /ExecStart=\/opt\/porisrom\/app\/deploy\/backup\/porisrom-backup\.sh --request \/run\/porisrom\/backup-capture\.request/);
for (const [timer, expression, unit] of [[dailyTimer, /OnCalendar=\*-\*-\* 02:15:00 UTC/, "daily"], [weeklyTimer, /OnCalendar=Sun \*-\*-\* 03:15:00 UTC/, "weekly"], [monthlyTimer, /OnCalendar=\*-\*-01 04:15:00 UTC/, "monthly"]]) {
  assert.match(timer, expression); assert.match(timer, new RegExp(`Unit=porisrom-backup-coordinator@${unit}\\.service`));
}
assert.doesNotMatch(legacyTimer, /OnCalendar=/, "legacy timer must have no active schedule");
for (const unit of [coordinatorUnit, captureUnit]) for (const required of ["User=root", "NoNewPrivileges=true", "ProtectSystem=full", "UMask=0077", "CapabilityBoundingSet="]) assert.ok(unit.includes(required), `missing service hardening ${required}`);
console.log("backup coordinator foundation contracts passed");
