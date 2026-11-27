#!/usr/bin/env bash
# Creates encrypted local backup sets. Integrity verification is not restore verification.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly BACKUP_ROOT="${PORISROM_BACKUP_ROOT:-/opt/porisrom/backups}"
readonly SETS_DIR="$BACKUP_ROOT/sets"; readonly STAGING_DIR="$BACKUP_ROOT/.staging"
readonly COMPOSE_FILE="${PORISROM_PRODUCTION_COMPOSE_FILE:-/opt/porisrom/app/deploy/compose.production.yml}"
readonly PROJECT_DIR="${PORISROM_PROJECT_DIR:-/opt/porisrom/app}"
readonly MIN_FREE_KIB="${PORISROM_BACKUP_MIN_FREE_KIB:?Set PORISROM_BACKUP_MIN_FREE_KIB}"
readonly SAFETY_RESERVE_KIB="${PORISROM_BACKUP_SAFETY_RESERVE_KIB:?Set PORISROM_BACKUP_SAFETY_RESERVE_KIB}"
readonly ENCRYPTION_OVERHEAD_PCT="${PORISROM_BACKUP_ENCRYPTION_OVERHEAD_PCT:-5}"
readonly TEMP_OVERHEAD_KIB="${PORISROM_BACKUP_TEMP_OVERHEAD_KIB:-65536}"
readonly AGE_RECIPIENT="${PORISROM_BACKUP_AGE_RECIPIENT:?Set the public age recipient}"
readonly REQUEST_FILE=/run/porisrom/backup-capture.request
readonly RESULTS_DIR="$BACKUP_ROOT/results"
readonly COORDINATOR_URL="${PORISROM_BACKUP_COORDINATOR_URL:?Set the restricted coordinator HTTPS URL}"
readonly COORDINATOR_CERT="${PORISROM_BACKUP_COORDINATOR_CERT:?Set the mTLS client certificate path}"
readonly COORDINATOR_KEY="${PORISROM_BACKUP_COORDINATOR_KEY:?Set the mTLS client key path}"
readonly COORDINATOR_CA="${PORISROM_BACKUP_COORDINATOR_CA:?Set the mTLS CA path}"
readonly COORDINATOR_PRINCIPAL_ID="${PORISROM_BACKUP_COORDINATOR_PRINCIPAL_ID:?Set the fixed coordinator principal ID}"
die(){ if [[ ${claimed:-0} == 1 && ! -e ${result_file:-} ]]; then write_result uncertain "interrupted_or_failed" "${set_name:-}" 2>/dev/null || true; fi; printf '%s\n' "porisrom-backup: $*" >&2; exit 1; }; log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
[[ $# == 2 && $1 == --request && $2 == "$REQUEST_FILE" ]] || die "usage: porisrom-backup.sh --request $REQUEST_FILE"
[[ $(id -u) == 0 ]] || die 'backup capture must run as root'
[[ $COORDINATOR_URL =~ ^https://[A-Za-z0-9.-]+([:/][A-Za-z0-9._/-]+)?$ ]] || die 'coordinator URL must be a fixed HTTPS URL'
[[ $COORDINATOR_PRINCIPAL_ID =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$ ]] || die 'coordinator principal ID is invalid'
[[ -f $COORDINATOR_CERT && -f $COORDINATOR_KEY && -f $COORDINATOR_CA ]] || die 'coordinator mTLS material is unavailable'
for f in "$COORDINATOR_KEY" "$COORDINATOR_CERT" "$COORDINATOR_CA"; do [[ ! -L $f ]] || die 'coordinator mTLS material must not be symlinked'; done
[[ -d /run/porisrom && ! -L /run/porisrom && $(stat -c %u /run/porisrom) == 0 && $(stat -c %a /run/porisrom) == 700 ]] || die 'request directory must be root-owned mode 0700'
[[ -f $REQUEST_FILE && ! -L $REQUEST_FILE && $(stat -c %u "$REQUEST_FILE") == 0 && $(stat -c %a "$REQUEST_FILE") == 600 ]] || die 'request file must be root-owned mode 0600 and not a symlink'
job_id= lease_id= generation= backup_class= attempt_id=
line_count=0
while IFS='=' read -r key value || [[ -n $key ]]; do
 ((++line_count)); [[ $value != *$'\r'* && -n $value ]] || die 'request contains invalid line ending or empty value'
 case "$key" in
  job_id) [[ -z $job_id ]] || die 'duplicate request job_id'; job_id=$value;;
  lease_id) [[ -z $lease_id ]] || die 'duplicate request lease_id'; lease_id=$value;;
  generation) [[ -z $generation ]] || die 'duplicate request generation'; generation=$value;;
  class) [[ -z $backup_class ]] || die 'duplicate request class'; backup_class=$value;;
  attempt_id) [[ -z $attempt_id ]] || die 'duplicate request attempt_id'; attempt_id=$value;;
  *) die 'request contains an unexpected field';;
 esac
done < "$REQUEST_FILE"
[[ $line_count == 5 && ($job_id =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ || $job_id =~ ^c[a-zA-Z0-9]{24}$) ]] || die 'request job_id is invalid'
[[ $lease_id =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]] || die 'request lease_id is invalid'
[[ $attempt_id =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ && $generation =~ ^[1-9][0-9]*$ && $backup_class =~ ^(daily|weekly|monthly)$ ]] || die 'request generation, class, or attempt is invalid'
case "$BACKUP_ROOT" in /opt/porisrom/backups|/opt/porisrom/backups/*) ;; *) die 'backup root must stay below /opt/porisrom/backups';; esac
for n in "$MIN_FREE_KIB" "$SAFETY_RESERVE_KIB" "$ENCRYPTION_OVERHEAD_PCT" "$TEMP_OVERHEAD_KIB"; do [[ $n =~ ^[0-9]+$ ]] || die 'capacity settings must be non-negative integers'; done
(( MIN_FREE_KIB > 0 && SAFETY_RESERVE_KIB > 0 )) || die 'minimum free space and reserve must be positive'
[[ -f $COMPOSE_FILE && -d $PROJECT_DIR ]] || die 'production Compose file or project directory is missing'
for command in age docker df flock sha256sum sort tar awk du find grep curl node stat; do command -v "$command" >/dev/null || die "required command is unavailable: $command"; done
mkdir -p "$SETS_DIR" "$STAGING_DIR" "$RESULTS_DIR"; chmod 0700 "$BACKUP_ROOT" "$SETS_DIR" "$STAGING_DIR" "$RESULTS_DIR"
exec 9>"$BACKUP_ROOT/.backup.lock"; flock -n 9 || die 'another backup or retention run is active'
compose=(docker compose --project-directory "$PROJECT_DIR" --file "$COMPOSE_FILE")
request_json(){ node -e 'console.log(JSON.stringify({leaseId:process.argv[1],generation:Number(process.argv[2]),backupClass:process.argv[3],attemptId:process.argv[4]}))' "$lease_id" "$generation" "$backup_class" "$attempt_id"; }
coordinator_call(){ local path=$1 body=$2; curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --cacert "$COORDINATOR_CA" --cert "$COORDINATOR_CERT" --key "$COORDINATOR_KEY" -H 'content-type: application/json' -X POST --data "$body" "$COORDINATOR_URL/internal/backup-coordinator/jobs/$job_id/$path"; }
result_file="$RESULTS_DIR/${job_id}.${attempt_id}.json"
write_result(){ local outcome=$1 state=$2 set_id=${3:-}; node -e 'const fs=require("fs"),path=require("path"); const [file,outcome,state,job,lease,generation,klass,attempt,principal,setId]=process.argv.slice(1); const tmp=file+"."+process.pid; const body=JSON.stringify({outcome,state,jobId:job,leaseId:lease,generation:Number(generation),backupClass:klass,attemptId:attempt,principalId:principal,resultIdempotencyKey:attempt,setId:setId||undefined,recordedAt:new Date().toISOString()})+"\n"; const fd=fs.openSync(tmp,"wx",0o600); try{fs.writeFileSync(fd,body);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}; fs.renameSync(tmp,file); const dir=fs.openSync(path.dirname(file),"r");try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)};' "$result_file" "$outcome" "$state" "$job_id" "$lease_id" "$generation" "$backup_class" "$attempt_id" "$COORDINATOR_PRINCIPAL_ID" "$set_id"; }
claimed=0; published=0
on_error(){ rc=$?; if ((claimed)) && [[ ! -e $result_file ]]; then write_result uncertain "interrupted_or_failed" "${set_name:-}" || true; fi; exit "$rc"; }
trap on_error ERR
payload=$(request_json)
coordinator_call claim "$payload" >/dev/null || die 'coordinator rejected capture job claim'
claimed=1
coordinator_call validate "$payload" >/dev/null || die 'coordinator lease preflight rejected capture'
kib(){ [[ $1 =~ ^[0-9]+$ ]] || die 'could not measure backup source size'; printf '%s' "$1"; }
database_kib=$("${compose[@]}" exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT pg_database_size(current_database()) / 1024"')
public_kib=$("${compose[@]}" exec -T backend sh -ceu 'du -sk /app/runtime/public | awk "{print \$1}"')
private_kib=$("${compose[@]}" exec -T backend sh -ceu 'du -sk /app/runtime/private | awk "{print \$1}"')
database_kib=$(kib "$database_kib"); public_kib=$(kib "$public_kib"); private_kib=$(kib "$private_kib")
source_kib=$((database_kib + public_kib + private_kib))
planned_output_kib=$(((source_kib * (100 + ENCRYPTION_OVERHEAD_PCT) + 99) / 100))
free_kib(){ df -Pk "$BACKUP_ROOT" | awk 'NR==2 {print $4}'; }
check_capacity(){
 local phase=$1 staged=0 remaining free
 [[ -d ${work_dir:-$STAGING_DIR} ]] && staged=$(du -sk "${work_dir:-$STAGING_DIR}" | awk '{print $1}')
 remaining=$((planned_output_kib - staged)); (( remaining < 0 )) && remaining=0
 free=$(free_kib); [[ $free =~ ^[0-9]+$ ]] || die 'could not determine available backup disk space'
 (( free >= MIN_FREE_KIB && free >= remaining + TEMP_OVERHEAD_KIB + SAFETY_RESERVE_KIB )) || die "available disk space is insufficient during ${phase}; existing recovery points were not pruned"
}
check_capacity 'pre-staging'
stamp=$(date -u +%Y%m%dT%H%M%SZ); set_name="${stamp}-${backup_class}"; work_dir="$STAGING_DIR/.${set_name}.$$"; final_dir="$SETS_DIR/$set_name"
[[ ! -e $final_dir ]] || die 'backup set name collision; retry later'; mkdir "$work_dir"
cleanup(){ rc=$?; if ((rc)); then rm -rf -- "$work_dir"; fi; exit "$rc"; }; trap cleanup EXIT
printf 'set_id=%s\ncreated_at=%s\nclass=%s\npostgres_image=postgres:18.2-bookworm\ncapture_job_id=%s\nlease_id=%s\ngeneration=%s\nattempt_id=%s\nstate=created\n' "$set_name" "$stamp" "$backup_class" "$job_id" "$lease_id" "$generation" "$attempt_id" > "$work_dir/metadata"
encrypt_stream(){ local output=$1; age -r "$AGE_RECIPIENT" -o "$work_dir/$output"; }
check_capacity 'before-database'; log "creating ${backup_class} PostgreSQL archive"
"${compose[@]}" exec -T postgres sh -ceu 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl --exclude-table-data=public.socket_io_attachments' | encrypt_stream database.dump.age
archive_volume(){ local source=$1 output=$2; check_capacity "before-${output}"; log "creating encrypted ${output} archive"; "${compose[@]}" exec -T backend tar --numeric-owner --one-file-system -C "$source" -cf - . | encrypt_stream "$output"; }
archive_volume /app/runtime/public production_public_assets.tar.age; archive_volume /app/runtime/private production_private_documents.tar.age
check_capacity 'before-integrity-verification'
(
 cd "$work_dir"; sha256sum database.dump.age production_public_assets.tar.age production_private_documents.tar.age > manifest.sha256
 sha256sum --check --status manifest.sha256 || die 'new backup set checksum verification failed'
 printf 'integrity_verified_at=%s\n' "$(date -u +%FT%TZ)" > INTEGRITY_VERIFIED
)
check_capacity 'before-atomic-publication'
mv -- "$work_dir" "$final_dir"; log "published integrity-verified backup set ${set_name}"
published=1

valid_integrity_set(){
 local candidate=$1 expected_class=${2:-}
 [[ -f "$candidate/INTEGRITY_VERIFIED" && -f "$candidate/manifest.sha256" && -f "$candidate/metadata" ]] || return 1
 [[ -z $expected_class || $(awk -F= '$1=="class"{print $2}' "$candidate/metadata") == "$expected_class" ]] || return 1
 (cd "$candidate" && sha256sum --check --status manifest.sha256) || return 2
}
last_known_good=''
while IFS= read -r candidate; do
 valid_integrity_set "$candidate" || die "retention aborted: corrupt, incomplete, or uncertain set $(basename "$candidate")"
 [[ -f "$candidate/RESTORE_VERIFIED" ]] || continue
 grep -qx "set_id=$(basename "$candidate")" "$candidate/RESTORE_VERIFIED" || die "retention aborted: invalid restore-verification record $(basename "$candidate")"
 [[ -z $last_known_good || $candidate > $last_known_good ]] && last_known_good=$candidate
done < <(find "$SETS_DIR" -mindepth 1 -maxdepth 1 -type d -name '????????T??????Z-*' -print | LC_ALL=C sort)
if [[ -z $last_known_good ]]; then
 log 'no restore-verified recovery point exists yet; retention will not delete integrity-only sets'
else
prune_class(){
 local class=$1 keep=$2 index=0 candidate
 while IFS= read -r candidate; do
  valid_integrity_set "$candidate" "$class" || die "retention aborted: corrupt, incomplete, or uncertain set $(basename "$candidate")"
  ((++index)); ((index<=keep)) && continue
  [[ $candidate != "$last_known_good" ]] || { log "retention preserved last known-good $(basename "$candidate")"; continue; }
  case "$candidate" in "$SETS_DIR"/[0-9]*T[0-9]*Z-"$class") ;; *) die 'refusing an unexpected retention path';; esac
  rm -rf -- "$candidate" || die "retention failed; no further sets were removed"
  log "retention removed expired ${class} set $(basename "$candidate")"
 done < <(find "$SETS_DIR" -mindepth 1 -maxdepth 1 -type d -name "????????T??????Z-${class}" -print | LC_ALL=C sort -r)
}
 prune_class daily 7; prune_class weekly 4; prune_class monthly 3
fi
success_payload=$(node -e 'console.log(JSON.stringify({leaseId:process.argv[1],generation:Number(process.argv[2]),backupClass:process.argv[3],attemptId:process.argv[4],outcome:"succeeded",resultIdempotencyKey:process.argv[5],reason:"integrity-verified local backup publication",resultSetId:process.argv[6]}))' "$lease_id" "$generation" "$backup_class" "$attempt_id" "$attempt_id" "$set_name")
write_result succeeded integrity_verified "$set_name"
if ! coordinator_call report "$success_payload" >/dev/null; then
 die 'backup set was published but coordinator outcome reporting is uncertain; lease remains held'
fi
log 'backup completed successfully (integrity verified; restore verification is separate)'
