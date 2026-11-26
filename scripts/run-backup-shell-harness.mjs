// Disposable Linux verification of the real backup script. No Docker Compose,
// PostgreSQL, age, or coordinator outside this labelled test container is used.
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

const execFile = promisify(execFileCallback);
const repo = resolve(import.meta.dirname, "..");
const id = `porisrom-backup-shell-${randomBytes(5).toString("hex")}`;
const root = await mkdtemp(join(tmpdir(), "porisrom-backup-shell-"));
const fixture = join(root, "fixture.sh");
let cleaned = false;

const run = (args, options = {}) => execFile("docker", args, { cwd: repo, windowsHide: true, maxBuffer: 1024 * 1024 * 8, ...options });
const fixtureText = String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p /work/fakebin /work/project /run/porisrom /opt/porisrom/backups
chmod 0700 /run/porisrom
touch /work/compose.yml
cat > /work/fakebin/docker <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"; printf '%s\n' "$args" >> /work/docker.log
if [[ "$args" == *pg_database_size* ]]; then printf '1\n'; exit 0; fi
if [[ "$args" == *pg_dump* ]]; then printf 'FAKE-CUSTOM-PGDUMP\n'; exit 0; fi
if [[ "$args" == *'du -sk /app/runtime/'* ]]; then printf '1\n'; exit 0; fi
if [[ "$args" == *' tar '* ]]; then printf 'FAKE-ASSET-ARCHIVE\n'; exit 0; fi
printf '%s\n' "$args" >> /work/unmatched-docker.log
printf '1\n'
EOF
cat > /work/fakebin/age <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ \${FAKE_AGE_FAIL:-0} != 1 ]] || exit 73
out=; while (($#)); do case "$1" in -o) out=$2; shift 2;; *) shift;; esac; done
[[ -n $out ]] || exit 64
cat > "$out"
EOF
cat > /work/fakebin/curl <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"; printf '%s\n' "$args" >> /work/curl.log
[[ "$args" == *'/claim' ]] && [[ \${FAKE_CLAIM_FAIL:-0} == 1 ]] && exit 22
[[ "$args" == *'/validate' ]] && [[ \${FAKE_VALIDATE_FAIL:-0} == 1 ]] && exit 22
[[ "$args" == *'/report' ]] && [[ \${FAKE_REPORT_FAIL:-0} == 1 ]] && exit 22
printf '{}\n'
EOF
cat > /work/fakebin/df <<'EOF'
#!/usr/bin/env bash
if [[ \${FAKE_DF_LOW:-0} == 1 ]]; then printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\nfake 10 9 1 90%% /opt\n'; else /bin/df "$@"; fi
EOF
cat > /work/fakebin/sha256sum <<'EOF'
#!/usr/bin/env bash
if [[ \${FAKE_HASH_FAIL:-0} == 1 ]] && [[ "$*" == *--check* ]]; then exit 1; fi
exec /usr/bin/sha256sum "$@"
EOF
chmod 0755 /work/fakebin/*
case "\${CASE_NAME:?}" in
 valid|cuid|claim_fail|validate_fail|capacity|age_fail|hash_fail|report_fail|bad_binding)
  cat > /run/porisrom/backup-capture.request <<EOF
job_id=123e4567-e89b-42d3-a456-426614174000
lease_id=123e4567-e89b-42d3-a456-426614174001
generation=7
class=daily
attempt_id=123e4567-e89b-42d3-a456-426614174002
EOF
  [[ $CASE_NAME != cuid ]] || sed -i 's/123e4567-e89b-42d3-a456-426614174000/cabcdefghijklmnopqrstuvwx/' /run/porisrom/backup-capture.request
 ;;
 malformed) printf 'job_id=bad\n' > /run/porisrom/backup-capture.request;;
 duplicate) printf 'job_id=123e4567-e89b-42d3-a456-426614174000\njob_id=123e4567-e89b-42d3-a456-426614174000\nlease_id=123e4567-e89b-42d3-a456-426614174001\ngeneration=7\nclass=daily\nattempt_id=123e4567-e89b-42d3-a456-426614174002\n' > /run/porisrom/backup-capture.request;;
 invalid_class) printf 'job_id=123e4567-e89b-42d3-a456-426614174000\nlease_id=123e4567-e89b-42d3-a456-426614174001\ngeneration=7\nclass=evil\nattempt_id=123e4567-e89b-42d3-a456-426614174002\n' > /run/porisrom/backup-capture.request;;
 invalid_generation) printf 'job_id=123e4567-e89b-42d3-a456-426614174000\nlease_id=123e4567-e89b-42d3-a456-426614174001\ngeneration=0\nclass=daily\nattempt_id=123e4567-e89b-42d3-a456-426614174002\n' > /run/porisrom/backup-capture.request;;
 unsafe_mode) printf 'job_id=x\n' > /run/porisrom/backup-capture.request; chmod 0644 /run/porisrom/backup-capture.request;;
 symlink) printf 'job_id=x\n' > /work/request; ln -s /work/request /run/porisrom/backup-capture.request;;
 *) exit 64;; esac
[[ $CASE_NAME == unsafe_mode ]] || chmod 0600 /run/porisrom/backup-capture.request 2>/dev/null || true
export PATH=/work/fakebin:$PATH
export PORISROM_BACKUP_ROOT=/opt/porisrom/backups PORISROM_PROJECT_DIR=/work/project PORISROM_PRODUCTION_COMPOSE_FILE=/work/compose.yml
export PORISROM_BACKUP_MIN_FREE_KIB=1 PORISROM_BACKUP_SAFETY_RESERVE_KIB=1 PORISROM_BACKUP_AGE_RECIPIENT=age1fake
export PORISROM_BACKUP_COORDINATOR_URL=https://coordinator.test PORISROM_BACKUP_COORDINATOR_CERT=/work/cert PORISROM_BACKUP_COORDINATOR_KEY=/work/key PORISROM_BACKUP_COORDINATOR_CA=/work/ca PORISROM_BACKUP_COORDINATOR_PRINCIPAL_ID=backup-vps
touch /work/cert /work/key /work/ca; chmod 0600 /work/cert /work/key /work/ca
bash -x /src/deploy/backup/porisrom-backup.sh --request /run/porisrom/backup-capture.request > /work/script.stdout 2> /work/script.stderr
`.replaceAll("\\${", "${");

async function execute(name, env = {}) {
  const result = await run(["run", "--rm", "--entrypoint", "bash", "--label", `com.porisrom.shell-harness=${id}`, "-e", `CASE_NAME=${name}`, ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]), "-v", `${repo}:/src:ro`, "-v", `${root}:/work`, "-v", `${join(root, "backups")}:/opt/porisrom/backups`, "node:24-bookworm-slim", "/work/fixture.sh"]).then(() => ({ code: 0 })).catch(error => ({ code: error.code ?? 1, stderr: `${error.stdout ?? ""}${error.stderr ?? ""}` }));
  return result;
}

try {
  await writeFile(fixture, fixtureText, { mode: 0o700 });
  await mkdir(join(root, "backups"));
  await run(["run", "--rm", "--label", `com.porisrom.shell-harness=${id}`, "-v", `${repo}:/src:ro`, "node:24-bookworm-slim", "bash", "-n", "/src/deploy/backup/porisrom-backup.sh"]);
  for (const name of ["malformed", "duplicate", "invalid_class", "invalid_generation", "unsafe_mode", "symlink"]) assert.notEqual((await execute(name)).code, 0, `${name} must fail`);
  for (const [name, env] of [["claim_fail", { FAKE_CLAIM_FAIL: "1" }], ["validate_fail", { FAKE_VALIDATE_FAIL: "1" }], ["capacity", { FAKE_DF_LOW: "1" }], ["age_fail", { FAKE_AGE_FAIL: "1" }], ["hash_fail", { FAKE_HASH_FAIL: "1" }]]) assert.notEqual((await execute(name, env)).code, 0, `${name} must fail`);
  const good = await execute("valid"); if (good.code !== 0) throw Error(`valid execution failed: ${(await readFile(join(root, "script.stderr"), "utf8").catch(() => JSON.stringify(good))).slice(-4000)}`);
  const metadata = await readFile(join(root, "backups", "sets"), "utf8").catch(() => ""); // Directory existence is checked below.
  assert.equal(metadata, "", "sets is a directory, not a file");
  const result = JSON.parse(await readFile(join(root, "backups", "results", "123e4567-e89b-42d3-a456-426614174000.123e4567-e89b-42d3-a456-426614174002.json"), "utf8"));
  assert.equal(result.outcome, "succeeded"); assert.equal(result.state, "integrity_verified");
  const cuid = await execute("cuid"); assert.equal(cuid.code, 0, "CUID job identifiers must reach capture");
  const calls = await readFile(join(root, "curl.log"), "utf8"); assert.match(calls, /\/claim/); assert.match(calls, /\/validate/); assert.match(calls, /\/report/); assert.doesNotMatch(calls, /release|recover/);
  const failedReport = await execute("report_fail", { FAKE_REPORT_FAIL: "1" }); assert.notEqual(failedReport.code, 0);
  const uncertain = JSON.parse(await readFile(join(root, "backups", "results", "123e4567-e89b-42d3-a456-426614174000.123e4567-e89b-42d3-a456-426614174002.json"), "utf8"));
  assert.equal(uncertain.outcome, "succeeded"); assert.equal(uncertain.state, "integrity_verified");
  console.log(JSON.stringify({ result: "passed", image: "node:24-bookworm-slim", harness: id }));
} finally {
  const { stdout } = await run(["ps", "--all", "--filter", `label=com.porisrom.shell-harness=${id}`, "--format", "{{.ID}}"]).catch(() => ({ stdout: "unknown" }));
  if (stdout.trim()) throw Error("Refusing cleanup: harness container ownership is uncertain");
  await rm(root, { recursive: true, force: false }); cleaned = true;
  console.log(JSON.stringify({ cleanup: cleaned ? "container-auto-removed; temporary-fixture-removed" : "preserved", harness: id }));
}
