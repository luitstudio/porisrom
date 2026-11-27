#!/usr/bin/env bash
# Root-only coordinator for one fixed backup class. It never evaluates job data.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly STATE_DIR=/var/lib/porisrom/backup-coordinator
readonly PENDING_DIR="$STATE_DIR/pending"; readonly EVIDENCE_DIR="$STATE_DIR/evidence"
readonly REQUEST_DIR=/run/porisrom; readonly REQUEST_FILE="$REQUEST_DIR/backup-capture.request"
readonly BACKUP_RESULTS=/opt/porisrom/backups/results; readonly REPORTED_RESULTS="$BACKUP_RESULTS/reported"
readonly SETS_DIR=/opt/porisrom/backups/sets; readonly CANDIDATE_ROOT="${PORISROM_BACKUP_CANDIDATE_ROOT:-/opt/porisrom/backups/candidates}"
readonly VERIFIER_GID="${PORISROM_VERIFIER_GID:-1000}"
readonly CAPTURE_UNIT=porisrom-backup-capture.service
readonly SYSTEMCTL=/usr/bin/systemctl
readonly CURL=/usr/bin/curl
readonly NODE="${PORISROM_NODE_BIN:-/usr/local/bin/node}"
readonly RESULT_VALIDATOR="$(dirname "$0")/porisrom-validate-result-envelope.cjs"
die(){ printf '%s\n' "porisrom-backup-coordinator: $*" >&2; exit 1; }
[[ $(id -u) == 0 && (($# == 2 && $1 == --class) || ($# == 3 && $1 == --retry-report && $2 == --class)) && ${!#} =~ ^(daily|weekly|monthly)$ ]] || die 'usage: porisrom-backup-coordinator.sh [--retry-report] --class daily|weekly|monthly'
retry_report=0; [[ $1 == --retry-report ]] && retry_report=1
klass=${!#}
readonly JOB_FILE="$PENDING_DIR/$klass.json"
readonly COORDINATOR_URL="${PORISROM_BACKUP_COORDINATOR_URL:?Set coordinator URL}"
readonly COORDINATOR_CERT="${PORISROM_BACKUP_COORDINATOR_CERT:?Set coordinator certificate}"
readonly COORDINATOR_KEY="${PORISROM_BACKUP_COORDINATOR_KEY:?Set coordinator key}"
readonly COORDINATOR_CA="${PORISROM_BACKUP_COORDINATOR_CA:?Set coordinator CA}"
readonly COORDINATOR_PRINCIPAL_ID="${PORISROM_BACKUP_COORDINATOR_PRINCIPAL_ID:?Set coordinator principal ID}"
[[ $COORDINATOR_PRINCIPAL_ID =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$ && $VERIFIER_GID =~ ^[0-9]+$ ]] || die 'coordinator principal ID or verifier group is invalid'
[[ $COORDINATOR_URL =~ ^https://[A-Za-z0-9.-]+([:/][A-Za-z0-9._/-]+)?$ ]] || die 'coordinator URL must be fixed HTTPS'
for cmd in "$CURL" "$NODE" "$SYSTEMCTL" flock stat install cp; do [[ -x $cmd || $(command -v "$cmd") ]] || die "required executable unavailable: $cmd"; done
[[ -f $RESULT_VALIDATOR && ! -L $RESULT_VALIDATOR ]] || die 'result-envelope validator is unavailable or unsafe'
for d in "$STATE_DIR" "$PENDING_DIR" "$EVIDENCE_DIR" "$REQUEST_DIR" "$BACKUP_RESULTS" "$REPORTED_RESULTS"; do
 if [[ -e $d ]]; then
  [[ -d $d && ! -L $d && $(stat -c %u "$d") == 0 && $(stat -c %a "$d") == 700 ]] || die "required directory is unsafe: $d"
 else
  install -d -o root -g root -m 0700 "$d"
 fi
done
if [[ -e $CANDIDATE_ROOT ]]; then [[ -d $CANDIDATE_ROOT && ! -L $CANDIDATE_ROOT && $(stat -c %u "$CANDIDATE_ROOT") == 0 && $(stat -c %a "$CANDIDATE_ROOT") == 750 ]] || die 'candidate inbox is unsafe'; else install -d -o root -g "$VERIFIER_GID" -m 0750 "$CANDIDATE_ROOT"; fi
exec 9>"$STATE_DIR/coordinator.lock"; flock -n 9 || die 'another coordinator execution is active'
call(){ local action=$1 body=$2; "$CURL" --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --cacert "$COORDINATOR_CA" --cert "$COORDINATOR_CERT" --key "$COORDINATOR_KEY" -H 'content-type: application/json' -X POST --data "$body" "$COORDINATOR_URL/internal/backup-coordinator/jobs/$job_id/$action"; }
status(){ "$CURL" --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --cacert "$COORDINATOR_CA" --cert "$COORDINATOR_CERT" --key "$COORDINATOR_KEY" "$COORDINATOR_URL/internal/backup-coordinator/jobs/$job_id"; }
delivery(){ local recover=${1:-false}; "$CURL" --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --cacert "$COORDINATOR_CA" --cert "$COORDINATOR_CERT" --key "$COORDINATOR_KEY" -H 'content-type: application/json' -X POST --data "{\"backupClass\":\"$klass\",\"recover\":$recover}" "$COORDINATOR_URL/internal/backup-coordinator/jobs/delivery"; }
report_result(){ local json=$1 reason=$2; local payload; payload=$($NODE -e 'const x=JSON.parse(process.argv[1]); console.log(JSON.stringify({leaseId:x.leaseId,generation:x.generation,backupClass:x.backupClass,attemptId:x.attemptId,outcome:x.outcome,resultIdempotencyKey:x.resultIdempotencyKey,reason:process.argv[2],resultSetId:x.canonicalStorageKey,resultManifestSha256:x.manifestSha256}))' "$json" "$reason"); call report "$payload" >/dev/null; }
publish_candidate(){ local json=$1 canonical response source candidate temp; response=$(call canonical-set "$($NODE -e 'const x=JSON.parse(process.argv[1]); console.log(JSON.stringify({leaseId:x.leaseId,generation:x.generation,backupClass:x.backupClass,attemptId:x.attemptId,manifestSha256:x.manifestSha256,manifestFormatVersion:1,canonicalStorageKey:x.canonicalStorageKey}))' "$json")") || return; canonical=$($NODE -e 'const x=JSON.parse(process.argv[1]); if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(x.canonicalSetId)||x.manifestSha256!==process.argv[2]||typeof x.requestId!=="string")process.exit(64); process.stdout.write(x.canonicalSetId)' "$response" "$($NODE -e 'console.log(JSON.parse(process.argv[1]).manifestSha256)' "$json")") || return; source="$SETS_DIR/$($NODE -e 'console.log(JSON.parse(process.argv[1]).localSetId)' "$json")"; candidate="$CANDIDATE_ROOT/$canonical"; [[ -d $source && ! -L $source ]] || die 'local integrity set for canonical publication is unavailable'; if [[ -d $candidate ]]; then (cd "$candidate" && sha256sum --check --status manifest.sha256) || die 'existing verifier candidate is corrupt'; return; fi; temp="$CANDIDATE_ROOT/.${canonical}.$$"; install -d -o root -g "$VERIFIER_GID" -m 0750 "$temp"; for f in database.dump.age production_public_assets.tar.age production_private_documents.tar.age manifest.sha256 INTEGRITY_VERIFIED; do [[ -f $source/$f && ! -L $source/$f ]] || die 'local integrity set is incomplete'; install -o root -g "$VERIFIER_GID" -m 0640 "$source/$f" "$temp/$f"; done; $NODE -e 'const fs=require("fs"); const [out,id,x,response]=process.argv.slice(1); const v=JSON.parse(x), c=JSON.parse(response); fs.writeFileSync(out,[`set_id=${id}`,`class=${v.backupClass}`,`capture_job_id=${v.jobId}`,`capture_request_id=${c.requestId}`,`lease_id=${v.leaseId}`,`generation=${v.generation}`,`attempt_id=${v.attemptId}`,"state=created",""] .join("\\n"),{mode:0o640})' "$temp/metadata" "$canonical" "$json" "$response"; (cd "$temp" && sha256sum --check --status manifest.sha256) || die 'candidate copy checksum verification failed'; mv -- "$temp" "$candidate"; }
if ((retry_report)); then
 shopt -s nullglob; pending=("$BACKUP_RESULTS"/*.json); reported=("$REPORTED_RESULTS"/*.json); shopt -u nullglob
 (( ${#pending[@]} + ${#reported[@]} == 1 )) || die 'exactly one durable result envelope is required for report-only retry'
 result=${pending[0]:-${reported[0]}}; [[ -f $result && ! -L $result && $(stat -c %u "$result") == 0 && $(stat -c %a "$result") == 600 ]] || die 'result envelope is missing or unsafe'
 [[ -d $BACKUP_RESULTS && ! -L $BACKUP_RESULTS && $(stat -c %u "$BACKUP_RESULTS") == 0 && $(stat -c %a "$BACKUP_RESULTS") == 700 && -d $REPORTED_RESULTS && ! -L $REPORTED_RESULTS && $(stat -c %u "$REPORTED_RESULTS") == 0 && $(stat -c %a "$REPORTED_RESULTS") == 700 ]] || die 'result directory is unsafe'
 result_json=$("$NODE" "$RESULT_VALIDATOR" "$result" "$klass" "$COORDINATOR_PRINCIPAL_ID") || die 'result envelope is malformed, incomplete, or binding-mismatched'
 [[ $result == "$REPORTED_RESULTS"/* ]] && { printf '%s\n' 'report-only retry already acknowledged'; exit 0; }
 IFS=' ' read -r job_id lease_id generation backup_class attempt_id outcome result_key < <($NODE -e 'const x=JSON.parse(process.argv[1]); console.log([x.jobId,x.leaseId,x.generation,x.backupClass,x.attemptId,x.outcome,x.resultIdempotencyKey].join(" "))' "$result_json")
 payload=$($NODE -e 'const x=JSON.parse(process.argv[1]); console.log(JSON.stringify({leaseId:x.leaseId,generation:x.generation,backupClass:x.backupClass,attemptId:x.attemptId,outcome:x.outcome,resultIdempotencyKey:x.resultIdempotencyKey,reason:"persisted backup result report-only retry",resultSetId:x.setId}))' "$result_json")
 call report "$payload" >/dev/null || die 'backend report failed; durable result envelope was preserved'
 mv -n -- "$result" "$REPORTED_RESULTS/$(basename "$result")" || die 'backend acknowledged but result envelope could not be archived'
 printf '%s\n' 'report-only retry acknowledged and archived'; exit 0
fi
if [[ ! -e $JOB_FILE ]]; then
 delivery_json=$(delivery) || die 'backend delivery failed; no local capture request was created'
 [[ $($NODE -e 'const x=JSON.parse(process.argv[1]); process.stdout.write(String(Array.isArray(x?.jobs)&&x.jobs.length))' "$delivery_json") != 0 ]] || delivery_json=$(delivery true) || die 'backend delivery recovery failed; no local capture request was created'
 "$NODE" -e '
const fs=require("fs"),x=JSON.parse(process.argv[1]),file=process.argv[2],klass=process.argv[3]; const jobs=x?.jobs;
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const jobId=v=>uuid(v)||/^c[a-z0-9]{24}$/i.test(v);
if(!Array.isArray(jobs)||jobs.length!==1||!jobId(jobs[0].jobId)||!uuid(jobs[0].leaseId)||!uuid(jobs[0].attemptId)||!Number.isInteger(jobs[0].generation)||jobs[0].generation<1||jobs[0].backupClass!==klass||jobs[0].status!=="claimed")process.exit(64);
const body=JSON.stringify({jobId:jobs[0].jobId,leaseId:jobs[0].leaseId,generation:jobs[0].generation,backupClass:jobs[0].backupClass,attemptId:jobs[0].attemptId})+"\n";
const tmp=`${file}.${process.pid}`; const fd=fs.openSync(tmp,"wx",0o600); try{fs.writeFileSync(fd,body);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}; fs.renameSync(tmp,file); const dir=fs.openSync(require("path").dirname(file),"r");try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)};
' "$delivery_json" "$JOB_FILE" "$klass" || die 'delivery response was invalid or local persistence failed'
fi
[[ -f $JOB_FILE && ! -L $JOB_FILE && $(stat -c %u "$JOB_FILE") == 0 && $(stat -c %a "$JOB_FILE") == 600 ]] || die 'fixed class job document is missing or unsafe'
job=$($NODE -e '
const fs=require("fs"); const p=process.argv[1], klass=process.argv[2]; const x=JSON.parse(fs.readFileSync(p,"utf8"));
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); const jobId=v=>uuid(v)||/^c[a-z0-9]{24}$/i.test(v);
if(Object.keys(x).sort().join(",")!=="attemptId,backupClass,generation,jobId,leaseId"||!jobId(x.jobId)||!uuid(x.leaseId)||!uuid(x.attemptId)||!Number.isInteger(x.generation)||x.generation<1||x.backupClass!==klass)process.exit(64);
process.stdout.write(JSON.stringify(x));
' "$JOB_FILE" "$klass") || die 'job document is invalid'
IFS=' ' read -r job_id lease_id generation backup_class attempt_id < <($NODE -e 'const x=JSON.parse(process.argv[1]); console.log([x.jobId,x.leaseId,x.generation,x.backupClass,x.attemptId].join(" "))' "$job")
reported_result="$REPORTED_RESULTS/${job_id}.${attempt_id}.json"
if [[ -f $reported_result && ! -L $reported_result && $(stat -c %u "$reported_result") == 0 && $(stat -c %a "$reported_result") == 600 ]]; then
 status_json=$(status) || die 'cannot reconcile canonical capture status; lease remains protected'
 [[ $($NODE -e 'process.stdout.write(JSON.parse(process.argv[1]).status)' "$status_json") == finalized ]] || { printf '%s\n' 'capture is reported/canonical but independent verification or restricted finalization is still pending'; exit 0; }
 rm -f -- "$REQUEST_FILE" "$JOB_FILE"
 exit 0
fi
evidence="$EVIDENCE_DIR/${job_id}.${attempt_id}.json"
[[ ! -e $evidence ]] || die 'execution evidence already exists; uncertain work is never automatically rerun'
payload=$($NODE -e 'const x=JSON.parse(process.argv[1]); console.log(JSON.stringify({leaseId:x.leaseId,generation:x.generation,backupClass:x.backupClass,attemptId:x.attemptId}))' "$job")
call claim "$payload" >/dev/null || die 'backend unavailable or job claim rejected'
call validate "$payload" >/dev/null || die 'backend unavailable or job validation rejected'
tmp="$REQUEST_FILE.$$"; printf 'job_id=%s\nlease_id=%s\ngeneration=%s\nclass=%s\nattempt_id=%s\n' "$job_id" "$lease_id" "$generation" "$backup_class" "$attempt_id" > "$tmp"; chown root:root "$tmp"; chmod 0600 "$tmp"; mv -f -- "$tmp" "$REQUEST_FILE"
if ! "$SYSTEMCTL" start --wait "$CAPTURE_UNIT"; then
 printf '{"outcome":"uncertain","state":"capture_service_failed","jobId":"%s","attemptId":"%s"}\n' "$job_id" "$attempt_id" > "$evidence"
 chmod 0600 "$evidence"; die 'fixed capture service did not complete; do not rerun automatically'
fi
result="$BACKUP_RESULTS/${job_id}.${attempt_id}.json"
[[ -f $result && ! -L $result && $(stat -c %u "$result") == 0 && $(stat -c %a "$result") == 600 ]] || die 'capture result envelope is missing or unsafe'
result_json=$("$NODE" "$RESULT_VALIDATOR" "$result" "$backup_class" "$COORDINATOR_PRINCIPAL_ID") || die 'capture result envelope is malformed or unsafe'
$NODE -e 'const x=JSON.parse(process.argv[1]),j=process.argv.slice(2); if(x.jobId!==j[0]||x.leaseId!==j[1]||x.generation!==Number(j[2])||x.attemptId!==j[4])process.exit(64)' "$result_json" "$job_id" "$lease_id" "$generation" "$backup_class" "$attempt_id" || die 'capture result envelope binding is invalid'
cp --preserve=mode,ownership,timestamps -- "$result" "$evidence"
outcome=$($NODE -e 'console.log(JSON.parse(process.argv[1]).outcome)' "$result_json")
if [[ $outcome == succeeded ]]; then
 report_result "$result_json" 'integrity-verified local backup publication' || die 'result evidence preserved; backend report retry requires explicit coordinator invocation'
 publish_candidate "$result_json" || die 'capture was reported but canonical candidate publication failed; lease remains held'
 mv -n -- "$result" "$REPORTED_RESULTS/$(basename "$result")" || die 'backend report acknowledgement could not be archived'
 printf '%s\n' 'canonical candidate published; independent verification and restricted finalization remain pending'
 exit 0
fi
die 'non-success result envelope was preserved for report-only retry'
