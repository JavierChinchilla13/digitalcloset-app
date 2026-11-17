#!/usr/bin/env bash
# Audit H12 (area 7): erases accounts that an admin deactivated and that have stayed deactivated for 30 days or more.
#
# The Terms and the Privacy Policy say "an account we deactivate is erased after 30 days". Nothing does that by itself: you run this
# script from your own computer, now and then. It signs in to the API as YOUR admin account and calls the admin endpoint, so the
# accounts go through the same full erasure as "Delete my account and data" (garments, outfits, share links, Stripe, the picture queue).
#
#   export PURGE_API_URL='https://<your-api-host>'          # the API's address, no trailing slash, no /api
#   export PURGE_ADMIN_EMAIL='<your admin email>'
#   ./scripts/purge-deactivated.sh              # DRY RUN (the default): lists how many accounts would be erased; nobody is erased
#   ./scripts/purge-deactivated.sh --apply      # erases them
#
# - The password is asked for when you run it (it is typed, never echoed, never stored, and never put on a command line).
#   For a non-interactive run you may `export PURGE_ADMIN_PASSWORD=...` yourself, typed by you; it is never printed.
# - Accounts deactivated BEFORE this feature existed started their 30 days on the day it was deployed. Admin accounts are never erased.
# - --days N asks for a longer wait (30 is the minimum; the server refuses less).
# - The pictures of erased accounts are queued: run ./scripts/purge-cloudinary.sh afterwards to remove them from Cloudinary.
# - Make a backup first (./scripts/backup-remote-db.sh) before the first --apply.
#
# Needs: curl. Run it from Git Bash on Windows or any Linux/macOS shell.
set -euo pipefail
umask 077

apply=false
days=30
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) apply=true ;;
    --days) shift; days="${1:?--days needs a number}" ;;
    *) echo "Unknown option: $1 (see the top of this file)" >&2; exit 1 ;;
  esac
  shift
done
[[ "$days" =~ ^[0-9]+$ ]] || { echo "--days must be a whole number." >&2; exit 1; }

: "${PURGE_API_URL:?Set PURGE_API_URL to the API address first (see the top of this file).}"
: "${PURGE_ADMIN_EMAIL:?Set PURGE_ADMIN_EMAIL to your admin email first.}"
command -v curl >/dev/null 2>&1 || { echo "Missing tool: curl" >&2; exit 1; }
api="${PURGE_API_URL%/}"
[[ "$api" == https://* || "$api" == http://localhost* ]] || { echo "PURGE_API_URL must start with https:// (or http://localhost for a local test)." >&2; exit 1; }

password="${PURGE_ADMIN_PASSWORD:-}"
if [ -z "$password" ]; then
  read -r -s -p "Admin password for $PURGE_ADMIN_EMAIL: " password; echo >&2
fi

# JSON string escaping (backslash and double quote) so the password can sit inside the request body.
json_escape() { local s="$1"; s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; printf '%s' "$s"; }

# The login body goes to curl on stdin (--data-binary @-), never on the command line, so it never shows in a process list.
login_response="$(printf '{"email":"%s","password":"%s"}' "$(json_escape "$PURGE_ADMIN_EMAIL")" "$(json_escape "$password")" \
  | curl -sS -X POST -H 'Content-Type: application/json' --data-binary @- "$api/api/auth/login")" \
  || { echo "The API could not be reached." >&2; exit 1; }
unset password
token="$(printf '%s' "$login_response" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
[ -n "$token" ] || { echo "Sign-in failed (wrong email or password, or this account is not allowed in)." >&2; exit 1; }

dry=true; $apply && dry=false
# The token goes through curl's config on stdin (-K -) for the same reason.
response="$(printf 'header = "Authorization: Bearer %s"\n' "$token" \
  | curl -sS -X POST -K - "$api/api/users/purge-deactivated?days=$days&dryRun=$dry")" \
  || { echo "The API could not be reached." >&2; exit 1; }
unset token

if [[ "$response" != *'"eligibleIds"'* ]]; then
  echo "The API refused the request (are you an admin? is --days at least 30?)." >&2
  exit 1
fi
# eligibleIds is a JSON list of account numbers (no emails or names are returned or printed).
ids="$(printf '%s' "$response" | sed -n 's/.*"eligibleIds":\[\([^]]*\)\].*/\1/p')"
count=0; [ -n "$ids" ] && count="$(printf '%s\n' "$ids" | tr ',' '\n' | wc -l | tr -d ' ')"
erased="$(printf '%s' "$response" | sed -n 's/.*"erased":\([0-9]*\).*/\1/p')"

if $apply; then
  echo "Erased $erased of $count accounts that had been deactivated for $days days or more."
  [ "${erased:-0}" -gt 0 ] && echo "Next: run ./scripts/purge-cloudinary.sh to remove their pictures from Cloudinary."
else
  echo "Dry run: $count account(s) have been deactivated for $days days or more${ids:+ (account numbers: $ids)}. Nobody was erased. Run with --apply to erase them."
fi
