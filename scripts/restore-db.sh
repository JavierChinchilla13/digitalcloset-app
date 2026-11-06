#!/usr/bin/env bash
# Audit C1: restores a backup made by scripts/backup-remote-db.sh into a LOCAL, EMPTY test database, then proves
# the restore by comparing the rows per table with the backup's manifest.
#
#   createdb vysvi_restore_test                       # an empty database, on your own computer
#   export RESTORE_DATABASE_URL='postgresql://postgres:<password>@localhost:5432/vysvi_restore_test'
#   ./scripts/restore-db.sh ~/vysvi-backups/vysvi-2026-11-06-120000.dump[.gpg]
#
# Safety rules (the script refuses, it never asks "are you sure"):
#   - the target must be on this computer (localhost / 127.0.0.1 / ::1);
#   - the target database name must contain "test", "local" or "restore";
#   - the target must have no tables yet (it never merges into existing data);
#   - the backup's SHA-256 must match its manifest before anything is touched.
# This script cannot restore into production: that would be a decision to take by hand, with the app stopped.
# After it succeeds you can point the API at the restored copy to check the app works on it (see DEPLOYMENT.md).
#
# Needs: pg_restore, psql, sha256sum (and gpg for a .gpg backup, with BACKUP_PASSPHRASE_FILE set).
set -euo pipefail
umask 077

backup="${1:-}"
[ -n "$backup" ] && [ -f "$backup" ] || { echo "Usage: $0 <backup file (.dump or .dump.gpg)>" >&2; exit 1; }
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to the LOCAL test database connection string first. It is never printed.}"

for tool in pg_restore psql sha256sum awk; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing tool: $tool" >&2; exit 1; }
done

# --- Where does the target point? (parsed without connecting, and never echoed) ---
url="$RESTORE_DATABASE_URL"
if [[ ! "$url" =~ ^postgres(ql)?://([^@/]*@)?(\[[^]]+\]|[^:/?]+)(:[0-9]+)?/([^?]+) ]]; then
  echo "RESTORE_DATABASE_URL is not a postgresql://user:password@host:port/database address." >&2
  exit 1
fi
host="${BASH_REMATCH[3]}"
dbname="${BASH_REMATCH[5]}"
# Runs one query against the target and prints the plain result (psql on Windows ends its lines with CR LF).
q() { psql "$url" -At -c "$1" | tr -d '\r'; }

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

# --- The manifest and the backup's checksum ---
name="$(basename "$backup")"
prefix="${backup%.dump.gpg}"; [ "$prefix" = "$backup" ] && prefix="${backup%.dump}"
manifest="$prefix.manifest.txt"
[ -f "$manifest" ] || { echo "Refusing: the manifest $manifest is missing (it must sit next to the backup)." >&2; exit 1; }

expected_sha="$(awk -F': ' '/^sha256: /{print $2}' "$manifest")"
actual_sha="$(sha256sum "$backup" | cut -d' ' -f1)"
if [ -z "$expected_sha" ] || [ "$expected_sha" != "$actual_sha" ]; then
  echo "Refusing: the backup does not match its manifest (checksum differs). It may be damaged." >&2
  exit 1
fi
echo "Checksum matches the manifest."

# --- Decrypt if needed (into a private temp file, removed at the end) ---
dump="$backup"
cleanup() { rm -f "${tmp_dump:-}" "${tmp_list:-}"; }
trap cleanup EXIT
if [[ "$name" == *.gpg ]]; then
  : "${BACKUP_PASSPHRASE_FILE:?This backup is encrypted: set BACKUP_PASSPHRASE_FILE to the file with its passphrase.}"
  command -v gpg >/dev/null 2>&1 || { echo "Missing tool: gpg" >&2; exit 1; }
  tmp_dump="$(mktemp)"
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" --decrypt --output "$tmp_dump" "$backup"
  dump="$tmp_dump"
fi

# --- The target must be empty: this never merges into existing data ---
existing="$(q "select count(*) from information_schema.tables where table_schema = 'public'")"
if [ "$existing" != "0" ]; then
  echo "Refusing: the target database already has $existing tables in its public schema. Use an empty database." >&2
  exit 1
fi

echo "Restoring into database '$dbname' on $host..."
# A new database already has its public schema, and the dump would try to create it again: leave that one entry out.
tmp_list="$(mktemp)"
pg_restore --list "$dump" | grep -vE ' SCHEMA - public( |$)| COMMENT - SCHEMA public( |$)' > "$tmp_list"
pg_restore --dbname="$url" --no-owner --no-privileges --exit-on-error --use-list="$tmp_list" "$dump"

# --- Prove it: every table's row count must equal the manifest's ---
problems=0
tables_seen=0
rows_total=0
while read -r t; do
  tables_seen=$((tables_seen + 1))
  actual="$(q "select count(*) from public.\"$t\"")"
  expected="$(awk -v key="table public.$t " 'index($0, key) == 1 { print $3 }' "$manifest")"
  expected="${expected:-0}"
  rows_total=$((rows_total + actual))
  if [ "$actual" != "$expected" ]; then
    echo "MISMATCH in table $t: manifest says $expected rows, restored $actual." >&2
    problems=$((problems + 1))
  fi
done < <(q "select tablename from pg_tables where schemaname = 'public' order by 1")

# A table the manifest lists but the restore lacks is also a failure.
while read -r t; do
  present="$(q "select count(*) from pg_tables where schemaname = 'public' and tablename = '$t'")"
  if [ "$present" != "1" ]; then
    echo "MISSING table $t (listed in the manifest, absent after the restore)." >&2
    problems=$((problems + 1))
  fi
done < <(awk '/^table public\./{ sub(/^public\./, "", $2); print $2 }' "$manifest" | tr -d '\r')

if [ "$problems" -ne 0 ]; then
  echo "Restore NOT verified: $problems problem(s)." >&2
  exit 1
fi
echo "Restore verified: $tables_seen tables, $rows_total rows, all matching the manifest."
