#!/usr/bin/env bash
# Task 24: dump the production database to a compressed file.
#
#   ./scripts/backup-db.sh                # writes backups/closet-YYYY-MM-DD-HHMM.sql.gz
#
# Run it from the folder with docker-compose.yml, e.g. daily from cron:
#   0 3 * * *  cd /opt/closet && ./scripts/backup-db.sh
# Keeps the 14 newest dumps. Copy the folder off the machine too - a backup that
# lives only on the server dies with it. Restore: see DEPLOYMENT.md.
set -euo pipefail

mkdir -p backups
file="backups/closet-$(date +%F-%H%M).sql.gz"

docker compose exec -T db pg_dump -U postgres --no-owner closet_db | gzip > "$file"

# A failed dump leaves an almost-empty file: refuse to keep it.
if [ "$(wc -c < "$file")" -lt 1000 ]; then
  echo "Backup looks empty - removing $file" >&2
  rm -f "$file"
  exit 1
fi

ls -1t backups/closet-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "Wrote $file"
