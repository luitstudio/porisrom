import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repo = resolve(import.meta.dirname, "..");
const harnessId = `porisrom-report-retry-${randomBytes(5).toString("hex")}`;
const root = await mkdtemp(join(tmpdir(), "porisrom-report-retry-"));
const envelopeName = "123e4567-e89b-42d3-a456-426614174000.123e4567-e89b-42d3-a456-426614174002.json";

const fixture = `#!/usr/bin/env bash
set -Eeuo pipefail
rm -f /work/curl.log /work/systemctl.log /work/pending.json /work/reported.json /work/before.json
rm -rf /opt/porisrom/backups/results/*
mkdir -p /opt/porisrom/backups/results/reported
chmod 0700 /opt/porisrom/backups /opt/porisrom/backups/results /opt/porisrom/backups/results/reported
ln -sf /usr/local/bin/node /usr/bin/node
export PORISROM_BACKUP_COORDINATOR_URL=https://coordinator.test
export PORISROM_BACKUP_COORDINATOR_CERT=/work/cert PORISROM_BACKUP_COORDINATOR_KEY=/work/key PORISROM_BACKUP_COORDINATOR_CA=/work/ca
export PORISROM_BACKUP_COORDINATOR_PRINCIPAL_ID=backup-vps
touch /work/cert /work/key /work/ca
j=123e4567-e89b-42d3-a456-426614174000; l=123e4567-e89b-42d3-a456-426614174001; t=123e4567-e89b-42d3-a456-426614174002
f=/opt/porisrom/backups/results/$j.$t.json
valid(){ printf '%s\n' '{"outcome":"uncertain","state":"interrupted_or_failed","jobId":"123e4567-e89b-42d3-a456-426614174000","leaseId":"123e4567-e89b-42d3-a456-426614174001","generation":7,"backupClass":"daily","attemptId":"123e4567-e89b-42d3-a456-426614174002","principalId":"backup-vps","resultIdempotencyKey":"123e4567-e89b-42d3-a456-426614174002","recordedAt":"2026-01-01T00:00:00.000Z"}'; }
case "$CASE_NAME" in
  valid|report_fail) valid > "$f" ;;
  cuid) valid | sed 's/123e4567-e89b-42d3-a456-426614174000/cabcdefghijklmnopqrstuvwx/' > "$f" ;;
  archived) valid > "/opt/porisrom/backups/results/reported/$j.$t.json"; chmod 0600 "/opt/porisrom/backups/results/reported/$j.$t.json" ;;
  invalid_json) printf '{' > "$f" ;;
  missing) printf '{}' > "$f" ;;
  unexpected) valid | sed 's/}$/,"extra":true}/' > "$f" ;;
  duplicate) valid | sed 's/"jobId"/"jobId":"duplicate","jobId"/' > "$f" ;;
  escaped_duplicate) valid | sed 's/"jobId"/"jobId":"duplicate","job\\u0049d"/' > "$f" ;;
  nested_duplicate) valid | sed 's/}$/,"extra":{"key":1,"key":2}}/' > "$f" ;;
  invalid_uuid) valid | sed 's/123e4567/bad/' > "$f" ;;
  invalid_generation) valid | sed 's/"generation":7/"generation":0/' > "$f" ;;
  invalid_class) valid | sed 's/"daily"/"evil"/' > "$f" ;;
  invalid_outcome) valid | sed 's/"uncertain"/"evil"/' > "$f" ;;
  invalid_principal) valid | sed 's/"backup-vps"/"other-principal"/' > "$f" ;;
  invalid_key) valid | sed 's/"resultIdempotencyKey":"[^"]*"/"resultIdempotencyKey":"wrong"/' > "$f" ;;
  symlink_envelope) valid > /work/target; ln -s /work/target "$f" ;;
  symlink_directory) rm -rf /opt/porisrom/backups/results; mkdir -p /work/real-results/reported; chmod 0700 /work/real-results /work/real-results/reported; valid > /work/real-results/$j.$t.json; ln -s /work/real-results /opt/porisrom/backups/results ;;
  unsafe_file_mode) valid > "$f"; chmod 0644 "$f" ;;
  unsafe_directory_mode) chmod 0755 /opt/porisrom/backups/results; valid > "$f" ;;
  unsafe_directory_owner) chown 1000:1000 /opt/porisrom/backups/results; valid > "$f" ;;
  ambiguous) valid > "$f"; valid > "/opt/porisrom/backups/results/other.json" ;;
  *) exit 64 ;;
esac
[[ $CASE_NAME == unsafe_file_mode ]] || chmod 0600 "$f" 2>/dev/null || true
[[ $CASE_NAME != report_fail ]] || cp -- "$f" /work/before.json
if bash /src/deploy/backup/porisrom-backup-coordinator.sh --retry-report --class daily; then rc=0; else rc=$?; fi
[[ ! -e "$f" ]] || cp -- "$f" /work/pending.json
[[ ! -e "/opt/porisrom/backups/results/reported/$j.$t.json" ]] || cp -- "/opt/porisrom/backups/results/reported/$j.$t.json" /work/reported.json
exit "$rc"
`;

const curlStub = `#!/usr/bin/env bash
printf '%s\n' "$*" >> /work/curl.log
[[ ${"${"}FAIL_REPORT:-0} != 1 ]] || exit 22
printf '{}\n'
`;
const systemctlStub = "#!/usr/bin/env bash\nprintf 'invoked\\n' >> /work/systemctl.log\nexit 99\n";

async function docker(args) {
  return execFile("docker", args, { cwd: repo, windowsHide: true });
}

async function runCase(name, environment = {}) {
  await writeFile(join(root, "fixture.sh"), fixture, { mode: 0o700 });
  const args = ["run", "--rm", "--label", `com.porisrom.report-retry=${harnessId}`, "-e", `CASE_NAME=${name}`];
  for (const [key, value] of Object.entries(environment)) args.push("-e", `${key}=${value}`);
  args.push("-v", `${repo}:/src:ro`, "-v", `${root}:/work`, "--tmpfs", "/opt/porisrom/backups:rw,mode=0700", "-v", `${join(root, "curl")}:/usr/bin/curl:ro`, "-v", `${join(root, "systemctl")}:/usr/bin/systemctl:ro`, "node:24-bookworm-slim", "bash", "/work/fixture.sh");
  return docker(args).then(() => ({ code: 0 })).catch(error => ({ code: error.code ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` }));
}

async function assertNoSideEffects() {
  await assert.rejects(access(join(root, "systemctl.log")), "report retry must not invoke systemctl");
  const calls = await readFile(join(root, "curl.log"), "utf8").catch(() => "");
  assert.doesNotMatch(calls, /\/claim|\/validate|\/release|\/recover|\/fence|authorize/i, "retry must only report");
}

let cleaned = false;
try {
  await writeFile(join(root, "curl"), curlStub, { mode: 0o755 });
  await writeFile(join(root, "systemctl"), systemctlStub, { mode: 0o755 });
  await chmod(join(root, "curl"), 0o755); await chmod(join(root, "systemctl"), 0o755);
  await docker(["run", "--rm", "--label", `com.porisrom.report-retry=${harnessId}`, "-v", `${repo}:/src:ro`, "node:24-bookworm-slim", "bash", "-n", "/src/deploy/backup/porisrom-backup-coordinator.sh"]);

  for (const name of ["invalid_json", "missing", "unexpected", "duplicate", "escaped_duplicate", "nested_duplicate", "invalid_uuid", "invalid_generation", "invalid_class", "invalid_outcome", "invalid_principal", "invalid_key", "symlink_envelope", "symlink_directory", "unsafe_file_mode", "unsafe_directory_mode", "unsafe_directory_owner", "ambiguous"]) {
    assert.notEqual((await runCase(name)).code, 0, `${name} must fail`);
    await assertNoSideEffects();
  }

  const failed = await runCase("report_fail", { FAIL_REPORT: "1" });
  assert.notEqual(failed.code, 0, "failed report must preserve the result envelope");
  const before = await readFile(join(root, "pending.json"));
  assert.deepEqual(before, await readFile(join(root, "before.json")), "failed report must leave the pending envelope byte-for-byte unchanged");
  await assert.rejects(access(join(root, "reported.json")), "failed report must not archive the envelope");
  await assertNoSideEffects();

  const cuid = await runCase("cuid");
  assert.equal(cuid.code, 0, cuid.output);
  await assertNoSideEffects();

  const successful = await runCase("valid");
  assert.equal(successful.code, 0, successful.output);
  assert.deepEqual(await readFile(join(root, "reported.json")), before, "acknowledged envelope bytes must be archived unchanged");
  const calls = await readFile(join(root, "curl.log"), "utf8");
  assert.match(calls, /\/jobs\/123e4567-e89b-42d3-a456-426614174000\/report/);
  for (const value of ['"leaseId":"123e4567-e89b-42d3-a456-426614174001"', '"generation":7', '"backupClass":"daily"', '"attemptId":"123e4567-e89b-42d3-a456-426614174002"', '"resultIdempotencyKey":"123e4567-e89b-42d3-a456-426614174002"']) assert.ok(calls.includes(value), `missing report payload ${value}`);
  await assertNoSideEffects();

  const idempotent = await runCase("archived");
  assert.equal(idempotent.code, 0, idempotent.output);
  await assertNoSideEffects();
  console.log(JSON.stringify({ result: "passed", image: "node:24-bookworm-slim", harness: harnessId }));
} finally {
  const ownership = await docker(["ps", "--all", "--filter", `label=com.porisrom.report-retry=${harnessId}`, "--format", "{{.ID}}"]).then(({ stdout }) => stdout).catch(() => null);
  if (ownership?.trim()) throw new Error("owned report-retry container remained");
  await rm(root, { recursive: true, force: false }); cleaned = true;
  console.log(JSON.stringify({ cleanup: cleaned ? "container-auto-removed; temporary-fixture-removed" : "preserved", harness: harnessId }));
}
