#!/usr/bin/env bash
# Admin backup (developer only): restores an archive downloaded from the admin page ("Backup" -> Download backup, a .vbk file)
# into a LOCAL, EMPTY test database, then proves the restore by comparing the rows per table with the archive's manifest.
#
#   1. createdb vysvi_restore_test                     # an empty database on your own computer
#   2. start the API once against it, so Flyway creates the tables, then stop it (cd backend && ./mvnw spring-boot:run ...)
#   3. cd backend && ./mvnw -q compile                 # once: the archive reader runs from backend/target/classes
#   4. export RESTORE_DATABASE_URL='postgresql://postgres:<password>@localhost:5432/vysvi_restore_test'
#   5. ./scripts/restore-from-archive.sh ~/Downloads/vysvi-backup-2026-11-17.vbk
#      (it asks for the archive password; typed hidden, never on the command line)
#
# Safety rules (the script refuses, it never asks "are you sure"):
#   - the target must be on this computer (localhost / 127.0.0.1 / ::1);
#   - the target database name must contain "test", "local" or "restore";
#   - the tables must already exist (the API applied the migrations) at the SAME schema version as the archive, and be EMPTY:
#     it never merges into existing data;
#   - the archive is decrypted and every file checked against its manifest (size, SHA-256, row count) BEFORE the database is touched;
#   - the load is ONE transaction: it all happens or none of it does.
# This script cannot restore into production. The archive holds emails and password hashes: keep it, and the folder this script
# unpacks it into (a private temporary folder, removed when the script ends), away from shared places.
#
# Needs: java (17+), psql. Run it from Git Bash on Windows or any Linux/macOS shell.
set -euo pipefail
umask 077

archive="${1:-}"
[ -n "$archive" ] && [ -f "$archive" ] || { echo "Usage: $0 <archive.vbk>" >&2; exit 1; }
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to the LOCAL test database connection string first. It is never printed.}"

for tool in java psql; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing tool: $tool" >&2; exit 1; }
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
classes="$here/../backend/target/classes"
[ -f "$classes/com/javier/closetapp/backup/ArchiveTool.class" ] || {
  echo "The archive reader is not built yet: run  cd backend && ./mvnw -q compile  first." >&2; exit 1; }

# --- Where does the target point? (parsed without connecting, and never echoed) ---
url="$RESTORE_DATABASE_URL"
if [[ ! "$url" =~ ^postgres(ql)?://([^@/]*@)?(\[[^]]+\]|[^:/?]+)(:[0-9]+)?/([^?]+) ]]; then
  echo "RESTORE_DATABASE_URL is not a postgresql://user:password@host:port/database address." >&2
  exit 1
fi
host="${BASH_REMATCH[3]}"
dbname="${BASH_REMATCH[5]}"
host_lc="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
db_lc="$(printf '%s' "$dbname" | tr '[:upper:]' '[:lower:]')"
case "$host_lc" in
  localhost|127.0.0.1|"[::1]"|::1) ;;
  *) echo "Refusing: the target host is not this computer (only localhost is allowed)." >&2; exit 1 ;;
esac
case "$db_lc" in
  *test*|*local*|*restore*) ;;
  *) echo "Refusing: the target database name must contain 'test', 'local' or 'restore' (got '$dbname')." >&2; exit 1 ;;
esac
# One query against the target, plain result (psql on Windows ends its lines with CR LF).
q() { psql "$url" -X -At -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'; }

# --- The archive password: typed hidden (RESTORE_ARCHIVE_PASSWORD may be exported for a non-interactive run; it is never printed) ---
password="${RESTORE_ARCHIVE_PASSWORD:-}"
if [ -z "$password" ]; then
  read -r -s -p "Archive password: " password; echo >&2
fi
[ -n "$password" ] || { echo "No password given." >&2; exit 1; }

# --- A private working folder, removed on exit however the script ends ---
work="$(mktemp -d)"
chmod 700 "$work"
cleanup() { rm -rf "$work"; }
trap cleanup EXIT

# --- Decrypt and verify (the password goes to the reader on its standard input: not on the command line, not in a process list) ---
echo "Opening the archive..."
if ! printf '%s\n' "$password" | java -cp "$classes" com.javier.closetapp.backup.ArchiveTool "$archive" "$work/out" > "$work/tool.txt" 2> "$work/tool.err"; then
  cat "$work/tool.err" >&2
  echo "Refusing: the archive could not be opened or does not match its manifest. Nothing was changed." >&2
  exit 1
fi
unset password
schema="$(sed -n 's/^OK .* schema=\(.*\)$/\1/p' "$work/tool.txt" | head -1)"
created="$(sed -n 's/^OK created=\([^ ]*\) .*/\1/p' "$work/tool.txt" | head -1)"
echo "Archive verified (made $created, schema version $schema)."

# --- The target must have the same schema, with the tables present and EMPTY ---
target_schema="$(q "select version from flyway_schema_history where success order by installed_rank desc limit 1" 2>/dev/null || true)"
if [ -z "$target_schema" ]; then
  echo "Refusing: the target has no Flyway history. Start the API once against it so the migrations create the tables." >&2; exit 1
fi
if [ "$schema" != "unknown" ] && [ "$target_schema" != "$schema" ]; then
  echo "Refusing: the archive is at schema version $schema but the target is at $target_schema. Run the API version that made the archive." >&2; exit 1
fi

tables=()      # table names in load order
declare -A rows_of cols_of
while read -r _ name rows cols; do
  [[ "$name" =~ ^[a-z_]+$ && "$rows" =~ ^[0-9]+$ && "$cols" =~ ^[a-z_,]+$ ]] || { echo "Refusing: the archive lists something unexpected." >&2; exit 1; }
  tables+=("$name"); rows_of["$name"]="$rows"; cols_of["$name"]="$cols"
done < <(grep '^TABLE ' "$work/tool.txt")
[ "${#tables[@]}" -gt 0 ] || { echo "Refusing: the archive lists no tables." >&2; exit 1; }

for t in "${tables[@]}"; do
  present="$(q "select count(*) from information_schema.tables where table_schema = 'public' and table_name = '$t'")"
  [ "$present" = "1" ] || { echo "Refusing: the target has no table $t. Start the API once against it first." >&2; exit 1; }
  have="$(q "select count(*) from public.\"$t\"")"
  [ "$have" = "0" ] || { echo "Refusing: the target table $t already has $have rows. Use an empty database (this never merges)." >&2; exit 1; }
done

# --- Load: one transaction ---
# users and outfits point at each other (users.main_outfit_id -> outfits), so users go in first WITHOUT that column (from a staging
# table with no constraints) and the pointers are set after the outfits are in.
sql="$work/restore.sql"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  for t in "${tables[@]}"; do
    cols="${cols_of[$t]}"
    if [ "$t" = "users" ] && [[ ",$cols," == *",main_outfit_id,"* ]]; then
      plain="$(printf '%s' ",$cols," | sed 's/,main_outfit_id,/,/; s/^,//; s/,$//')"
      echo "create temp table users_stage as select * from public.users with no data;"
      echo "\\copy users_stage($cols) from 'out/$t.csv' with (format csv, header true)"
      echo "insert into public.users($plain) select $plain from users_stage;"
    else
      echo "\\copy public.\"$t\"($cols) from 'out/$t.csv' with (format csv, header true)"
    fi
  done
  if [[ ",${cols_of[users]:-}," == *",main_outfit_id,"* ]]; then
    echo "update public.users u set main_outfit_id = s.main_outfit_id from users_stage s where u.user_id = s.user_id and s.main_outfit_id is not null;"
  fi
  # Identity columns continue after the highest restored id (the first column of each table, where it is an identity).
  for t in "${tables[@]}"; do
    first="${cols_of[$t]%%,*}"
    # Only where the first column really has a sequence (stripe_events, for one, has a text id and none).
    [ -n "$(q "select pg_get_serial_sequence('public.$t', '$first')")" ] || continue
    echo "select setval((pg_get_serial_sequence('public.$t', '$first'))::regclass, coalesce(max($first), 0) + 1, false) from public.\"$t\" where pg_get_serial_sequence('public.$t', '$first') is not null;"
  done
  echo 'commit;'
} > "$sql"

echo "Restoring into database '$dbname' on $host..."
( cd "$work" && psql "$url" -X -q -v ON_ERROR_STOP=1 -f restore.sql > /dev/null )

# --- Prove it: every table's row count must equal the manifest's ---
problems=0; rows_total=0
for t in "${tables[@]}"; do
  actual="$(q "select count(*) from public.\"$t\"")"
  rows_total=$((rows_total + actual))
  if [ "$actual" != "${rows_of[$t]}" ]; then
    echo "MISMATCH in table $t: the archive says ${rows_of[$t]} rows, restored $actual." >&2
    problems=$((problems + 1))
  fi
done
if [ "$problems" -ne 0 ]; then
  echo "Restore NOT verified: $problems problem(s)." >&2
  exit 1
fi
echo "Restore verified: ${#tables[@]} tables, $rows_total rows, all matching the manifest."
