#!/usr/bin/env bash
# Audit H12 (area 7): removes from Cloudinary the pictures of people who deleted their account, then empties the queue.
#
# When someone deletes their account, the API cannot delete their pictures itself (the upload preset is public and the server holds
# no Cloudinary secret), so it writes their ADDRESSES into the table image_erasure_queue (with no link to the person). You run this
# script from your own computer, now and then (the Privacy text promises removal within 30 days):
#
#   export PURGE_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
#   export CLOUDINARY_URL='cloudinary://<api key>:<api secret>@<cloud name>'      # Cloudinary dashboard -> Settings -> API keys
#   ./scripts/purge-cloudinary.sh              # DRY RUN: shows what it would delete; nothing is deleted, no call to Cloudinary
#   ./scripts/purge-cloudinary.sh --apply      # deletes the pictures, then removes them from the queue
#
# - Type the two export lines yourself; the script never prints them or stores them.
# - A picture that Cloudinary says is already gone ("not_found") counts as done. Anything else stays in the queue for next time.
# - It only touches addresses of YOUR cloud (the cloud name in CLOUDINARY_URL must match the address); others are skipped.
# - --limit N changes how many queue entries one run handles (default 500). --parse <address> prints the cloud and public id of one
#   address and exits (a self-check; it needs no secrets).
#
# Needs: psql, curl. Run it from Git Bash on Windows or any Linux/macOS shell.
set -euo pipefail
umask 077

# The cloud name and the public id of a Cloudinary picture address, printed as "<cloud> <public id>".
# https://res.cloudinary.com/<cloud>/image/upload/[transformations/][v123/]<folder/name>.<ext>
public_id_of() {
  local url="$1" path cloud
  [[ "$url" =~ ^https?:// ]] || return 1
  path="${url#*://}"        # res.cloudinary.com/<cloud>/image/upload/...
  path="${path#*/}"         # <cloud>/image/upload/...
  cloud="${path%%/*}"
  path="${path#*/}"         # image/upload/...
  [[ "$path" == image/upload/* ]] || return 1
  path="${path#image/upload/}"
  # Drop any transformations and the version segment: everything up to and including "v<digits>/".
  if [[ "$path" =~ ^(.*/)?v[0-9]+/(.+)$ ]]; then
    path="${BASH_REMATCH[2]}"
  elif [[ "$path" == */* && "${path%%/*}" == *_* ]]; then
    return 1                # transformations but no version: cannot tell the public id with certainty
  fi
  path="${path%.*}"         # the file extension
  [ -n "$path" ] || return 1
  printf '%s %s\n' "$cloud" "$path"
}

apply=false
limit=500
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) apply=true ;;
    --limit) shift; limit="${1:?--limit needs a number}" ;;
    --parse) shift; public_id_of "${1:?--parse needs an address}" || { echo "cannot work out the cloud and public id of this address" >&2; exit 1; }; exit 0 ;;
    *) echo "Unknown option: $1 (see the top of this file)" >&2; exit 1 ;;
  esac
  shift
done

: "${PURGE_DATABASE_URL:?Set PURGE_DATABASE_URL to the database connection string first (see the top of this file). It is never printed.}"
for tool in psql curl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing tool: $tool" >&2; exit 1; }
done

if $apply; then
  : "${CLOUDINARY_URL:?Set CLOUDINARY_URL (cloudinary://<api key>:<api secret>@<cloud name>) to apply. It is never printed.}"
  if [[ ! "$CLOUDINARY_URL" =~ ^cloudinary://([^:]+):([^@]+)@(.+)$ ]]; then
    echo "CLOUDINARY_URL is not in the form cloudinary://<api key>:<api secret>@<cloud name>." >&2
    exit 1
  fi
  api_key="${BASH_REMATCH[1]}"; api_secret="${BASH_REMATCH[2]}"; my_cloud="${BASH_REMATCH[3]}"
fi

q() { psql "$PURGE_DATABASE_URL" -At -F '|' -c "$1" | tr -d '\r'; }

rows="$(q "select queue_id, image_url from image_erasure_queue order by queue_id limit $limit")"
if [ -z "$rows" ]; then
  echo "The queue is empty: nothing to remove."
  exit 0
fi

ids_ok=()       # queue ids whose picture is gone
declare -A batch_id_of_public   # public id -> queue id, for the current batch
batch=()        # public ids of the current batch
skipped=0
total=0

flush_batch() {
  [ ${#batch[@]} -gt 0 ] || return 0
  local args=() pid response status
  for pid in "${batch[@]}"; do args+=(--data-urlencode "public_ids[]=$pid"); done
  # The credentials go to curl through its config on stdin (-K -), not on the command line, so they never show in a process list.
  response="$(printf 'user = "%s:%s"\n' "$api_key" "$api_secret" | curl -sS -X DELETE -G -K - "https://api.cloudinary.com/v1_1/$my_cloud/resources/image/upload" "${args[@]}")" || {
    echo "Cloudinary could not be reached for a batch; those stay in the queue." >&2; batch=(); batch_id_of_public=(); return 0; }
  for pid in "${batch[@]}"; do
    status="$(printf '%s' "$response" | grep -o "\"$pid\":\"[a-z_]*\"" | head -1 | sed 's/.*:"\(.*\)"/\1/' || true)"
    if [ "$status" = "deleted" ] || [ "$status" = "not_found" ]; then
      ids_ok+=("${batch_id_of_public[$pid]}")
    else
      echo "Not removed (stays in the queue): $pid (${status:-no answer})" >&2
    fi
  done
  batch=(); batch_id_of_public=()
}

while IFS='|' read -r queue_id url; do
  total=$((total + 1))
  if ! parsed="$(public_id_of "$url")"; then
    echo "Skipped (cannot work out the public id): queue entry $queue_id" >&2; skipped=$((skipped + 1)); continue
  fi
  cloud="${parsed%% *}"; pid="${parsed#* }"
  if $apply && [ "$cloud" != "$my_cloud" ]; then
    echo "Skipped (a different cloud than yours): queue entry $queue_id" >&2; skipped=$((skipped + 1)); continue
  fi
  if $apply; then
    batch+=("$pid"); batch_id_of_public["$pid"]="$queue_id"
    [ ${#batch[@]} -ge 100 ] && flush_batch
  else
    echo "would delete: $pid   (cloud: $cloud)"
  fi
done <<< "$rows"

if ! $apply; then
  echo "Dry run: $total queue entries looked at, $skipped skipped. Nothing was deleted. Run with --apply to delete."
  exit 0
fi

flush_batch
if [ ${#ids_ok[@]} -gt 0 ]; then
  list="$(IFS=,; echo "${ids_ok[*]}")"
  q "delete from image_erasure_queue where queue_id in ($list)" >/dev/null
fi
echo "Removed ${#ids_ok[@]} pictures from Cloudinary and from the queue; $((total - ${#ids_ok[@]})) left in the queue (skipped or not removed)."
