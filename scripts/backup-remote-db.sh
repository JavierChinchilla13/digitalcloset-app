#!/usr/bin/env bash
# Audit C1: a backup of the PRODUCTION database (Supabase), made from your own computer.
#
#   export BACKUP_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
#   ./scripts/backup-remote-db.sh
#
# - The connection string is read from the environment only. It is never printed or written anywhere.
#   Use the Session pooler address (port 5432), the same one the API uses. Type the export line yourself.
# - Reads only (pg_dump). Only the app's own `public` schema is dumped (that includes Flyway's history table).
# - The files go OUTSIDE the repository (default ~/vysvi-backups, or BACKUP_DIR). The script refuses a folder
#   inside the repo, because a backup holds emails, password hashes and every closet.
# - Optional encryption: BACKUP_PASSPHRASE_FILE=/path/to/file-with-a-passphrase makes it write <name>.dump.gpg
#   (AES-256) instead of a plain .dump. Keep that passphrase in your password manager; without it the backup is
#   unreadable. Strongly recommended if the folder is synced or copied anywhere.
# - Each backup comes with <name>.manifest.txt: the dump's SHA-256 and the number of rows per table, counted FROM the
#   dump itself. scripts/restore-db.sh checks both, so a backup you have never restored is at least a verified one.
# - Keeps the newest 14 backups (BACKUP_KEEP). Backups are personal data: delete old copies you no longer need.
#
# Needs: pg_dump, pg_restore, sha256sum (and gpg if you encrypt). Run it from Git Bash on Windows or any Linux/macOS shell.
set -euo pipefail
umask 077

: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL to the database connection string first (see the top of this file). It is never printed.}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/vysvi-backups}"
KEEP="${BACKUP_KEEP:-14}"

for tool in pg_dump pg_restore sha256sum awk; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing tool: $tool" >&2; exit 1; }
done

mkdir -p "$BACKUP_DIR"
abs_dir="$(cd "$BACKUP_DIR" && pwd)"

# Never write a backup inside the repository.
# Both paths go through `cd ... && pwd` so they are written the same way (git says D:/x, Git Bash says /d/x).
repo_root="$(cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /nonexistent)" 2>/dev/null && pwd || true)"
if [ -n "$repo_root" ]; then
  case "$abs_dir/" in
    "$repo_root"/*)
      rmdir "$abs_dir" 2>/dev/null || true   # the folder was just created by mkdir above; remove it if empty
      echo "Refusing to write backups inside the repository ($abs_dir). Choose another BACKUP_DIR." >&2; exit 1 ;;
  esac
fi

stamp="$(date +%Y-%m-%d-%H%M%S)"
base="$abs_dir/vysvi-$stamp"
dump="$base.dump"
manifest="$base.manifest.txt"

echo "Dumping the public schema..."
pg_dump --dbname="$BACKUP_DATABASE_URL" --schema=public --format=custom --no-owner --no-privileges --file="$dump"

# A failed dump leaves an almost-empty file: refuse to keep it.
if [ "$(wc -c < "$dump")" -lt 2000 ]; then
  echo "The dump looks empty; removing it." >&2
  rm -f "$dump"
  exit 1
fi

# Rows per table, counted from the dump itself (so the numbers describe exactly what is in the file).
counts="$(pg_restore --data-only --file=- "$dump" | tr -d '\r' | awk '
  /^COPY /      { table = $2; rows = 0; inside = 1; next }
  inside && /^\\\.$/ { print "table " table " " rows; inside = 0; next }
  inside        { rows++ }
')"

final="$dump"
if [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  command -v gpg >/dev/null 2>&1 || { echo "Missing tool: gpg (needed because BACKUP_PASSPHRASE_FILE is set)" >&2; rm -f "$dump"; exit 1; }
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 --output "$dump.gpg" "$dump"
  rm -f "$dump"
  final="$dump.gpg"
else
  echo "Note: no BACKUP_PASSPHRASE_FILE set, so this backup is NOT encrypted. Keep it somewhere private." >&2
fi

{
  echo "created: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "pg_dump: $(pg_dump --version)"
  echo "file: $(basename "$final")"
  echo "sha256: $(sha256sum "$final" | cut -d' ' -f1)"
  echo "$counts"
} > "$manifest"

# Retention: keep the newest $KEEP backups (each is a file plus its manifest).
ls -1t "$abs_dir"/vysvi-*.manifest.txt 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  prefix="${old%.manifest.txt}"
  rm -f "$prefix".dump "$prefix".dump.gpg "$old"
done

tables="$(printf '%s\n' "$counts" | grep -c '^table ' || true)"
rows="$(printf '%s\n' "$counts" | awk '/^table /{s+=$3} END{print s+0}')"
echo "Wrote $final ($(wc -c < "$final") bytes; $tables tables, $rows rows) and its manifest."
