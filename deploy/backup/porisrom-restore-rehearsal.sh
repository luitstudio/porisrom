#!/usr/bin/env bash
# Restores an integrity-verified set only into the exact disposable Compose design.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
die(){ printf '%s\n' "porisrom-restore-rehearsal: $*" >&2; exit 1; }
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly COMPOSE_FILE="$SCRIPT_DIR/compose.restore-rehearsal.yml"
[[ ${PORISROM_RESTORE_REHEARSAL_APPROVED:-} == I_APPROVE_DISPOSABLE_RESTORE_ONLY ]] || die 'explicit disposable-restore approval is required'
readonly SET_DIR="${1:?supply one integrity-verified backup-set directory}"
readonly IDENTITY_FILE="${PORISROM_BACKUP_AGE_IDENTITY_FILE:?Supply an age identity from controlled recovery custody}"
readonly PROJECT="${PORISROM_RESTORE_PROJECT:?Set a disposable porisrom_restore_* project name}"
[[ $PROJECT =~ ^porisrom_restore_[a-z0-9_-]+$ && $PROJECT != *production* ]] || die 'restore project must be disposable and non-production'
[[ ${RESTORE_POSTGRES_DB:-} =~ ^porisrom_restore_[a-z0-9_]+$ && ${RESTORE_POSTGRES_DB:-} != *production* ]] || die 'restore database must be disposable and non-production'
[[ -d $SET_DIR && -f $SET_DIR/INTEGRITY_VERIFIED && -f $SET_DIR/manifest.sha256 && -f $SET_DIR/metadata ]] || die 'backup set is not integrity verified'
grep -qx "set_id=$(basename "$SET_DIR")" "$SET_DIR/metadata" || die 'backup-set metadata identity mismatch'
[[ -f $IDENTITY_FILE ]] || die 'age identity file is unavailable'
for command in age docker sha256sum node; do command -v "$command" >/dev/null || die "required command is unavailable: $command"; done
( cd "$SET_DIR"; sha256sum --check --status manifest.sha256 ) || die 'backup-set checksum verification failed'
compose=(docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE")

# Reject arbitrary Compose overrides and any topology that could reach production.
"${compose[@]}" config --format json | node -e '
let data=""; process.stdin.on("data", c=>data+=c).on("end",()=>{const c=JSON.parse(data), bad=m=>{throw Error(m)};
if(c.name!==process.env.PORISROM_RESTORE_PROJECT) bad("project mismatch");
if(JSON.stringify(c).match(/production|external\s*:/i)) bad("production or external resource reference");
if(Object.keys(c.services||{}).sort().join(",")!=="assets,postgres") bad("unexpected service set");
const p=c.services.postgres,a=c.services.assets;
if(p.image!=="postgres:18.2-bookworm" || (p.ports&&p.ports.length) || (a.ports&&a.ports.length)) bad("postgres image or ports invalid");
for(const s of [p,a]) for(const v of (s.volumes||[])) { if(v.type!=="volume" || !String(v.source).startsWith("restore_")) bad("host/external mount rejected"); }
for(const [n,v] of Object.entries(c.volumes||{})) if(!n.startsWith("restore_") || v.external) bad("external volume rejected");
for(const [,n] of Object.entries(c.networks||{})) if(n.external) bad("external network rejected");
}).on("error",e=>{console.error(e.message);process.exit(1)});' || die 'approved disposable Compose validation failed'
"${compose[@]}" up -d --wait postgres assets
postgres_id=$("${compose[@]}" ps -q postgres); [[ -n $postgres_id ]] || die 'disposable postgres container was not created'
docker inspect "$postgres_id" --format '{{index .Config.Labels "com.docker.compose.project"}}' | grep -qx "$PROJECT" || die 'restore container ownership mismatch'
docker inspect "$postgres_id" --format '{{json .HostConfig.PortBindings}}' | grep -qx 'null' || die 'published restore port rejected'
docker inspect "$postgres_id" --format '{{json .Mounts}}' | node -e 'let x="";process.stdin.on("data",c=>x+=c).on("end",()=>{for(const m of JSON.parse(x)){if(m.Type!=="volume"||!m.Name.includes("_restore_postgres_18"))process.exit(1)}})' || die 'restore mount validation failed'
"${compose[@]}" exec -T postgres sh -ceu 'case "$POSTGRES_DB" in porisrom_restore_*) ;; *) exit 64;; esac; test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SHOW server_version")" = "18.2"'
age --decrypt -i "$IDENTITY_FILE" "$SET_DIR/database.dump.age" | "${compose[@]}" exec -T postgres sh -ceu 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error'
age --decrypt -i "$IDENTITY_FILE" "$SET_DIR/production_public_assets.tar.age" | "${compose[@]}" exec -T assets tar -C /restore/public -xf -
age --decrypt -i "$IDENTITY_FILE" "$SET_DIR/production_private_documents.tar.age" | "${compose[@]}" exec -T assets tar -C /restore/private -xf -
"${compose[@]}" exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT current_database();"; test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT count(*) FROM pg_constraint WHERE connamespace = '\''public'\''::regnamespace AND NOT convalidated")" = 0'
record="$SET_DIR/.RESTORE_VERIFIED.$$"
printf 'set_id=%s\nrestore_verified_at=%s\nproject=%s\ndatabase=%s\n' "$(basename "$SET_DIR")" "$(date -u +%FT%TZ)" "$PROJECT" "$RESTORE_POSTGRES_DB" > "$record"
mv -- "$record" "$SET_DIR/RESTORE_VERIFIED"
printf '%s\n' 'Disposable restore completed and recorded as restore verified.'
