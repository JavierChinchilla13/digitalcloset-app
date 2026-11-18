# Deploying VYSVI

VYSVI runs as three managed pieces plus a few optional services:

```
 visitor ──▶ Render Static Site (the React website)
                │  calls  https://<api>.onrender.com/api
                ▼
        Render Web Service (the Spring Boot API, built from backend/Dockerfile)
                │  JDBC over SSL (Supabase session pooler)          images ──▶ Cloudinary
                ▼
        Supabase (PostgreSQL)                      email ──▶ Google Apps Script relay (your Gmail)
```

- **Render** hosts the website (static files) and the API (a Docker web service). `render.yaml` describes both.
- **Supabase** hosts the PostgreSQL database. The API connects through the **session pooler**. (The project started on Neon; nothing of that remains.)
- **Cloudinary** stores the garment photos.
- **Email** leaves through a small Google Apps Script that sends from a Gmail account over HTTPS (Render's free tier blocks SMTP).
- Optional: Google sign-in, Sentry, Stripe (Premium) and ads. Each one is off until its settings are present.
- Background removal runs **in the visitor's browser**, so no Python service is deployed. (`backend-ai/` still exists if you ever want a server-side remover: deploy it
  separately and set `VITE_BG_REMOVER_MODE` / `VITE_BG_REMOVER_API_URL` when building the site.)

A single-machine Docker setup also exists (last section). Everything below is about the Render + Supabase setup.

## 1. What you need

| Thing | Why | Notes |
|---|---|---|
| A GitHub repo with this code | Render builds from it | `render.yaml` is read from the repo root. |
| A Render account | Hosts the API and the website | Free plan is enough to start (see "On the free plans"). |
| A Supabase account | The database | Free plan; keep your own backups (section 5). |
| A Cloudinary account | Garment image storage | Settings -> Upload -> an **unsigned** upload preset. The cloud name and preset name are public by design. |
| A Gmail account with 2-Step Verification | Sends reset / confirmation emails through the relay | See "Email without SMTP". |
| Your own computer with Git Bash (Windows) or a Linux/macOS shell, the PostgreSQL client tools and a JDK | Runs the backup, restore and purge scripts in `scripts/` | Optional until you need those. |

## 2. First deployment

### Step 1 - the database (Supabase)

1. Create a project at supabase.com. Pick the region closest to your Render region and set a strong database password (keep it in your password manager; never paste
   it in chat or git).
2. **Use the Session pooler address, not the direct one.** Project -> **Connect** -> **Session pooler**. The direct host (`db.<ref>.supabase.co`) is IPv6-only and Render's
   free tier cannot reach it; the session pooler is IPv4 and behaves like a normal connection (Flyway and prepared statements work; do **not** use the "Transaction pooler"
   on port 6543). The three values for the API:
   - `DB_URL` = `jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
   - `DB_USERNAME` = `postgres.<project-ref>` (the pooler needs the project ref after the dot)
   - `DB_PASSWORD` = the database password from step 1
3. The first time the API starts, Flyway creates every table in the empty database; from then on the data lives in Supabase and survives any API restart or redeploy.
   (Do not use Render's own free Postgres: it is deleted after 30 days. A Render web service's disk is wiped on each restart, so it cannot hold a database either.)
4. Supabase pauses a free project after 7 days **without database requests**; the API's health check (`/actuator/health`) asks the database, so a pinger on it keeps the
   project active.

### Step 2 - the API and the website (Render)

1. In Render: **New + -> Blueprint**, pick the repo. Render reads `render.yaml` and proposes two services, `vysvi-api` and `vysvi-web`.
2. Render asks for the values marked `sync: false`. Fill the API's database values now; the two address values need the website's URL, which you do not have yet, so
   put a placeholder (`https://placeholder.invalid`) and fix them in step 3:

   | Service | Variable | Value |
   |---|---|---|
   | vysvi-api | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | from Supabase (above) |
   | vysvi-api | `JWT_SECRET` | `openssl rand -base64 64` |
   | vysvi-api | `MAIL_MODE` / `MAIL_RELAY_URL` / `MAIL_RELAY_SECRET` | `relay` / the Apps Script URL / its secret - see "Email without SMTP" |
   | vysvi-api | `CONTACT_EMAIL` | the address emails show for questions |
   | vysvi-api | `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` | the website's URL (step 3) |
   | vysvi-web | `VITE_API_URL` | the API's URL + `/api` (step 3) |
   | vysvi-web | `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | from Cloudinary |

3. After the first deploy each service has an address like `https://vysvi-api.onrender.com` and `https://vysvi-web.onrender.com`. Now set, on the **API**:
   `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` = the website's address (no trailing `/`); on the **website**: `VITE_API_URL` = `<api address>/api`. Save; the API restarts,
   and the website needs a **Manual Deploy -> Clear build cache & deploy** (the value is baked in at build time).
4. Check `https://<api address>/actuator/health` shows `{"status":"UP",...}` (the first request after a sleep takes up to a minute), then open the website and register.

Different addresses for site and API mean the browser makes cross-origin requests: that is what `CORS_ALLOWED_ORIGINS` is for, and why a wrong value shows up as
"Network error" in the browser console.

### The first admin

Registering always creates a normal user (there is deliberately no self-service way to become an admin). Register your own account on the site, then promote it once
in the database (Supabase -> **SQL Editor**):

```sql
UPDATE users SET role = 'ROLE_ADMIN' WHERE email = 'you@example.com';
```

An admin can create other users and admins from the admin page, deactivate or reactivate accounts, change a plan, and download backups (section 5).

### Email without SMTP (the Apps Script relay)

Render's free tier cannot open SMTP connections, and the free email services want a domain you own. A tiny Google Apps Script, running as your Gmail account, receives
the app's emails over HTTPS and sends them. It is free, needs no domain, and the mail really comes from Gmail. A normal Gmail account can send to 100 recipients a day
this way - far more than password resets and 6-digit codes need.

1. Open <https://script.google.com> signed in as the Gmail that should send the mail, choose **New project**, delete the sample code and paste in `scripts/mail-relay.gs`.
2. **Project Settings** (the gear) -> **Script properties** -> **Add script property**: name `RELAY_SECRET`, value a long random string (e.g. `openssl rand -hex 32`).
   Keep a copy: the API needs the same value.
3. In the editor pick the function `authorize` and press **Run**. Google asks you to allow the script to send email as you (**Advanced** -> **Go to ... (unsafe)** is
   normal for your own script). This is a one-time step.
4. **Deploy** -> **New deployment** -> type **Web app**; *Execute as*: **Me**; *Who has access*: **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`). The
   secret is what protects it, so do not share the URL.
5. On Render, `vysvi-api` -> Environment: `MAIL_MODE=relay`, `MAIL_RELAY_URL` (the URL from step 4) and `MAIL_RELAY_SECRET` (the value from step 2). Saving redeploys the API.
6. Ask for a password reset on the site and check the inbox (and spam the first time).

If it fails, the API log says why (search for `Could not send`): "unauthorized" = the two secrets differ; "did not answer JSON" = step 4's access is not **Anyone**, or the
URL is wrong; a quota message = the 100-a-day limit. After editing the script, use **Deploy -> Manage deployments -> edit -> New version**: saving alone does not change
the live URL.

### What uses email

Password reset links, the 6-digit codes for changing the password or email, and the alert sent to an admin before a backup download.

## 3. Optional services

### Sign in with Google

Adds a "Continue with Google" button to the login and sign-up pages. Google's script is loaded **only after the visitor clicks** our own button (a second click then opens
Google's). A new Google identity goes through a second step (birth month and year, the two acceptances) before any account exists; a person who already has a password
account with the same email is linked to it, and that account's old password is removed (they can set a new one with "Forgot password"; their garments and outfits are kept).

1. <https://console.cloud.google.com>: create a project (e.g. "VYSVI").
2. **APIs & Services -> OAuth consent screen**: **External**, fill in the app name, support email and developer email, save. Then **Publish app** ("In production"): the basic
   email / profile permissions need no Google review. While it stays in "Testing", only the test users you list can sign in.
3. **Credentials -> Create credentials -> OAuth client ID**, type **Web application**. Under **Authorized JavaScript origins** add the site's address and
   `http://localhost:5173` for local work. (No redirect URI and no client secret are needed.)
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). It is public, not a secret.
5. On Render set `GOOGLE_CLIENT_ID` on the **API** and `VITE_GOOGLE_CLIENT_ID` on the **site**, both to that value. The site must be **rebuilt** (baked in at build time).

If the button does not appear, `VITE_GOOGLE_CLIENT_ID` is empty in the build. If it appears but signing in fails with "Google sign-in failed", the two ids differ, or the
site's address is not in the authorized origins. When the site moves to its own domain, add it to the authorized origins too.

Google proofs used for sensitive actions (deleting an account, downloading a backup) must be tokens issued in the last 5 minutes and can be used once.

### Error monitoring with Sentry

Sentry reports when the app breaks for someone, with the place in the code. It is off until you set a DSN, and even then the website sends nothing until the visitor
chooses **Accept all** on the cookie banner. Errors only: no performance tracing, no session replay, no user, headers or cookies; query strings are cut from URLs, console
output is not kept, and emails / long tokens are blanked. The API reports only unexpected 500s (not wrong passwords, 404s, 403s...) and not 502/503/504 (the host waking up).

1. Create a free account and an organization at sentry.io.
2. Create **two projects**: one **React** (website) and one **Java** (API). Each shows a **DSN** (`https://...@o....ingest.sentry.io/...`). A DSN is not a secret key, but keep it
   out of git anyway.
3. Render -> `vysvi-web` -> `VITE_SENTRY_DSN` = the React DSN, then redeploy the site. Render -> `vysvi-api` -> `SENTRY_DSN` = the Java DSN (redeploys by itself).
   `SENTRY_ENVIRONMENT` (default `production`) labels the events.
4. Check: accept optional services on the site, then in the browser console run `setTimeout(() => { throw new Error('sentry test') })` - the error should appear in the React
   project within a minute.

### Payments with Stripe (Premium subscription)

Premium is a monthly subscription (300 garments, no ads) for people who declared they are 18 or older. Nothing is charged and no upgrade button shows until the three
variables below are **all** set (all three empty = payments off; some but not all is a start-up error). **Try everything in Stripe's test mode first** (the "Test mode"
switch, test card `4242 4242 4242 4242`); going live needs Stripe's business verification and the public Terms/Privacy pages (they are in the app).

1. In test mode: **Product catalog -> Add product** "VYSVI Premium", a **recurring** monthly price. Copy the **Price ID** (`price_...`).
2. **Developers -> API keys**: copy the **Secret key** (`sk_test_...`). It is a secret: only on Render, never in git.
3. **Settings -> Billing -> Customer portal**: turn it on (allow cancelling and updating the card).
4. **Developers -> Webhooks -> Add endpoint**: URL `https://<your-api>.onrender.com/api/billing/webhook`, events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the endpoint's **Signing secret** (`whsec_...`).
5. On the Render **API** service set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. It redeploys.

The plan changes only when Stripe's signed webhook arrives (the page the buyer returns to is never trusted); if a payment succeeds but the account stays Free, look at
**Developers -> Webhooks -> your endpoint -> Events** for failed deliveries (a wrong signing secret is the usual cause). Cancelling happens in Stripe's portal; the account
keeps Premium until the paid period ends. Deactivating or deleting an account cancels its subscription. A Premium plan given by an admin has no subscription and is never
changed by Stripe events.

### Ads for free accounts

Free accounts of declared adults see one banner above the footer; Premium accounts, admins and minors never do (and never download the ad script). Nothing shows until you pick
a network. Set the variables on the **site** (baked in at build time, so rebuild after changing them). Ads load only after a visitor chooses "Accept all" on the cookie banner.

- **Google AdSense:** it only approves a site on a domain you own. Create a display ad unit and set `VITE_AD_PROVIDER=adsense`, `VITE_ADSENSE_CLIENT` (`ca-pub-...`) and
  `VITE_ADSENSE_SLOT`. AdSense also asks for an `ads.txt` at the site root: put it in `frontend/public/ads.txt` with the line Google shows you.
- **A network that accepts free subdomains** (e.g. Adsterra): create a **banner** unit and copy the `.../invoke.js` address, the `key`, and the width and height. Set
  `VITE_AD_PROVIDER=adsterra`, `VITE_ADSTERRA_SCRIPT_URL`, `VITE_ADSTERRA_KEY`, `VITE_ADSTERRA_WIDTH`, `VITE_ADSTERRA_HEIGHT`. Use banner units only. A banner wider than the
  visitor's screen is not shown (320x50 fits every phone). That network's code runs in a sandboxed frame that cannot read the site's storage.

### On the free plans

- **The API sleeps after 15 minutes without traffic**; the next visit waits roughly 30-60 s while Spring Boot starts. A free uptime pinger (e.g. UptimeRobot, every 5 minutes on
  `/actuator/health`) keeps it awake; Render gives 750 free instance hours a month, enough for one service around the clock.
- **Memory is small.** `render.yaml` caps the JVM (`-Xmx320m`). If the API dies with "out of memory", lower it (`-Xmx256m`) or move to a paid instance.
- **Render's free tier blocks outbound SMTP** (ports 25, 465, 587): that is why mail uses the relay.
- **Supabase's free plan has no backup you can restore yourself:** make your own (section 5).

## 4. Updating

Render rebuilds when the branch it follows changes (or on **Manual Deploy**). The API and the website that depend on each other should be deployed together: deploy the API first,
wait for `/actuator/health`, then the website.

Database changes ship as Flyway migrations (`backend/src/main/resources/db/migration`) and are applied automatically when the API starts. **They are not reversible, so take a
backup before any deploy that changes the database** (section 5). The latest migration is **V22**; the recent ones:

| Migration | Adds |
|---|---|
| V17 | birth month/year, the guardian declaration and the record of what each person accepted (existing accounts confirm these once, at their next sign-in) |
| V18 | `image_erasure_queue`: picture addresses waiting for removal from Cloudinary after an account is deleted |
| V19 | `users.deactivated_at`, for the 30-day purge of deactivated accounts |
| V20 | `backup_downloads`: the last 50 admin backup downloads |
| V21 | `reauth_failures`: wrong "it is me" attempts, counted per account |
| V22 | `google_token_uses`: fingerprints of Google tokens already used as proof |

If a deploy fails with Flyway complaining about an existing schema without history, do not "baseline" production by hand: ask what state the database is in first.

## 5. Backups, deletion and data scripts

All scripts live in `scripts/` and run **from your own computer** (Git Bash on Windows, or any Linux/macOS shell). You type secrets yourself (as environment variables
or when asked); none of the scripts prints or stores them.

### Backing up the production database from your computer

Supabase's free plan has no automatic restore, so make your own backups with `scripts/backup-remote-db.sh`. It refuses to write inside the repository.

```bash
# Needs the PostgreSQL client tools (pg_dump, pg_restore).
export BACKUP_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
# Optional but recommended: encrypt it. Put a long random passphrase in a file and keep a copy in your password manager.
export BACKUP_PASSPHRASE_FILE="$HOME/vysvi-backup-passphrase.txt"
./scripts/backup-remote-db.sh              # writes ~/vysvi-backups/vysvi-<date>.dump(.gpg) + a manifest; keeps 14
```

Use the **Session pooler** address (port 5432), the same one the API uses. Make a backup before every deploy that changes the database and regularly otherwise. Copy the
folder somewhere private off this computer; the files hold every user's email, password hashes and closet. Garment pictures live in Cloudinary and are not part of any database backup.

**A backup you have never restored is a hope.** Test it into an empty local database:

```bash
createdb vysvi_restore_test
export RESTORE_DATABASE_URL='postgresql://postgres:<local password>@localhost:5432/vysvi_restore_test'
./scripts/restore-db.sh ~/vysvi-backups/vysvi-2026-11-06-120000.dump.gpg
```

`restore-db.sh` refuses anything that is not a local database named `*test*`, `*local*` or `*restore*`, refuses a database that already has tables, checks the backup's checksum
against its manifest first, and compares the rows per table with the manifest afterwards ("Restore verified: N tables, M rows"). To go one step further, start the API on the
restored copy (`DB_URL=jdbc:postgresql://localhost:5432/vysvi_restore_test`) and sign in. Restoring into production is a decision to take by hand, with the API stopped; these
scripts will not do it.

### The in-app admin backup (encrypted `.vbk`)

An admin can download an encrypted copy of the whole database from the admin page (**Backup -> Download backup**; endpoint `POST /api/admin/backup`).

- **The file** is `vysvi-backup-<date>.vbk`: a tar of one CSV per table plus a manifest (rows, SHA-256 per file, schema version), compressed and sealed with AES-256-GCM in
  chunks under a key derived (PBKDF2-HMAC-SHA256, 600,000 iterations, stored in the authenticated file header) from a password the admin types at download time.
  `password_reset_tokens`, `pending_account_changes`, `reauth_failures` and `google_token_uses` are not included.
- **It contains every user's email and password hash: treat it as a secret.** Keep it off shared folders, email and chat, store its password in a password manager, and delete
  downloads after 90 days. It is never stored on the server (a private, encrypted temp file for the length of the request, deleted always, also when the client disconnects).
- **Who and how:** admins only; `POST` with the admin's own password (or a fresh Google sign-in if the account has no password) and the archive password (at least 12
  characters, different from the account password). A wrong proof counts toward the limits: **3 per hour and 10 per day per admin**, one backup at a time on the server, 200 MB cap
  (`BACKUP_MAX_BYTES`). For a database larger than that, use `backup-remote-db.sh`.
- **Alert email:** before the first byte, an email tells the admin that a backup was requested from their account. If the email cannot be sent the download still happens; the
  Backup page then shows a red **"Backup alert failed"** and the list of the last 10 downloads marks it (`alert_sent=false`).
- **In the page:** it shows "Last backup N days ago" (a warning at 7 days or none), explains how to keep the file private, can generate a random passphrase in the browser and
  checks the strength of a typed one.

Restoring an archive is for developers, into an EMPTY **local** database only. The script refuses anything else (a non-local host, a database name without `test`, `local` or
`restore`, tables that are not empty, a schema version different from the archive's, a wrong password, a changed file):

```bash
createdb vysvi_restore_test                          # an empty database on your computer
# start the API once against it so Flyway creates the tables, then stop it
cd backend && ./mvnw -q compile && cd ..             # the archive reader runs from backend/target/classes (JDK only, no network)
export RESTORE_DATABASE_URL='postgresql://postgres:<password>@localhost:5432/vysvi_restore_test'
./scripts/restore-from-archive.sh ~/Downloads/vysvi-backup-<date>.vbk      # asks for the archive password, typed hidden
```

It decrypts and checks every file against the manifest before touching the database, loads everything in **one transaction** (all or nothing; `users.main_outfit_id` is set after
the outfits exist), restarts the id sequences after the highest restored id, and finally compares the rows per table with the manifest. Then start the API against the restored
database and sign in.

**Rehearsal on a real throwaway PostgreSQL (18.4), 2026-11-17** - the first run of the `COPY` dumper outside the test suite:
1. `initdb` a cluster and `createdb` two databases; start the API (test profile, Flyway on, `ddl-auto=validate`, 600,000 iterations) on the first: sign-up, a garment named
   `Blue "shirt", with comma`, an outfit (so `users.main_outfit_id` is set), an admin.
2. `POST /api/admin/backup` through the real endpoint: 200, `Cache-Control: no-store`, `nosniff`, attachment; the archive starts with the magic `VYSVIBK1` and contains none of the
   plain text.
3. Start the API once on the second (empty) database so Flyway builds the tables, stop it, run `restore-from-archive.sh`: "Restore verified: 10 tables, 5 rows, all matching the
   manifest". The refusals were exercised too: wrong password, one flipped byte, a database name without `test|local|restore`, a non-local host, and a second restore into the
   now non-empty database all stop with nothing changed.
4. Start the API on the restored database: sign-in with the original password works (the hashes came back), the garment (comma and quotes intact) and the outfit are there,
   `users.main_outfit_id` is set, and a new sign-up gets the next id.
5. Scale: 150,000 extra wide rows (a 238 MB table) with the API's JVM limited to `-Xmx110m`: the backup finished (5.4 MB, 28 s) with no memory error, and restoring it gave 150,005
   rows with an identical hash of the content column in the source and the restored copy.

### Account deletion and "download my data"

In **Settings**, **Download my data** gives the person a JSON file of everything held about their account, and **Delete my account and data** erases it for real: the person types
`DELETE` and proves who they are (password, or a fresh Google sign-in). In one transaction the garments (including ones already removed), outfits, share links, categories and the
record of what they agreed to are erased, then the Stripe subscription is cancelled and the Stripe customer deleted (best effort). Wrong proofs are counted (5 wrong in 15 minutes
give 429 for all "it is me" actions until the window passes).

### Removing pictures after an account is deleted

The API cannot delete Cloudinary pictures itself (the upload preset is public and the server holds no Cloudinary secret), so it writes the pictures' **addresses** (no link to the
person) into `image_erasure_queue`. Empty that queue from your computer with `scripts/purge-cloudinary.sh`, now and then (the Privacy text promises removal within 30 days):

```bash
export PURGE_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
export CLOUDINARY_URL='cloudinary://<api key>:<api secret>@<cloud name>'     # Cloudinary dashboard -> Settings -> API keys
./scripts/purge-cloudinary.sh            # dry run: lists what it would delete, deletes nothing, does not call Cloudinary
./scripts/purge-cloudinary.sh --apply    # deletes the pictures, then removes them from the queue
```

A picture Cloudinary reports as already gone counts as done; anything else stays in the queue for next time. Only addresses of **your** cloud are touched.

### Erasing accounts that stayed deactivated for 30 days

The Terms say an account an admin deactivated is erased after 30 days. Nothing does it on a schedule: run `scripts/purge-deactivated.sh` now and then. It signs in as your admin
account and calls an admin-only endpoint, so each account goes through the same full erasure as "Delete my account and data". The time of deactivation is kept in
`users.deactivated_at`. Admins are never erased, and the server refuses fewer than 30 days.

```bash
export PURGE_API_URL='https://<your-api-host>'        # no trailing slash, no /api
export PURGE_ADMIN_EMAIL='<your admin email>'
./scripts/purge-deactivated.sh            # dry run (default): says how many accounts are due, erases nobody
./scripts/purge-deactivated.sh --apply    # erases them; then run ./scripts/purge-cloudinary.sh for their pictures
```

The password is typed when asked (not echoed, not stored, not on a command line). Take a backup first.

## 6. Settings reference

Environment variables of the **API** (Render -> `vysvi-api` -> Environment) unless it says "site". Defaults are those of `application.properties`.

| Variable | Needed | Meaning |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | set by the Docker image | `prod` turns on the start-up checks and quiet logs (see below). |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | yes | The Supabase session pooler connection (section 2). The API refuses to start without a password. |
| `DB_POOL_SIZE` | no | Database connections kept open (default 5). |
| `JWT_SECRET` | yes | Base64 signing key for login tokens. Refuses to start without it. Changing it logs everyone out. |
| `CORS_ALLOWED_ORIGINS` | yes | The website's https address(es), comma separated; no wildcard. |
| `FRONTEND_URL` | yes | The website's public https address; used in password-reset links and Stripe return pages. |
| `MAIL_MODE` | yes | `relay` (Apps Script) on Render; `smtp` is the production default; `log` is refused in production. |
| `MAIL_RELAY_URL` / `MAIL_RELAY_SECRET` | with `relay` | The Apps Script web app URL and its shared secret. |
| `SPRING_MAIL_HOST` / `_USERNAME` / `_PASSWORD`, `MAIL_PORT` | with `smtp` | An SMTP account (not usable on Render's free tier). |
| `MAIL_FROM` | no | From address (Gmail requires it to be the account itself). |
| `CONTACT_EMAIL` | recommended | The address emails show for questions (and replies go to). Not kept in the code; if unset, emails fall back to the From address. |
| `GOOGLE_CLIENT_ID` (API) / `VITE_GOOGLE_CLIENT_ID` (site) | no | The Google OAuth client id, the same value in both. Empty = no "Continue with Google". |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | no | Premium by Stripe. All three empty = payments off; only some = start-up error. |
| `SENTRY_DSN` (API) / `VITE_SENTRY_DSN` (site) | no | Error monitoring DSNs. Empty = off. `SENTRY_ENVIRONMENT` labels events (default `production`). |
| `RATE_LIMIT_ENABLED` | no | Default `true`; `false` is refused in production. |
| `RATE_LIMIT_AUTH_MAX` | no | Requests per minute per visitor address on `/api/auth/**` (default 30). |
| `RATE_LIMIT_PUBLIC_MAX` | no | Requests per minute per visitor address on `/api/public/**` (default 120). |
| `RATE_LIMIT_AGE_REJECTION_ENABLED` / `_MAX` / `_WINDOW_SECONDS` | no | Limits repeated sign-ups refused for age: after `MAX` refusals (default 5) from one client address within the window (default 3600 s) the address gets 429. **Off by default** (`false`); set it to `true` on `vysvi-api` and redeploy to enable it once the client address the API sees has been confirmed. |
| `GARMENT_LIMIT_FREE` / `GARMENT_LIMIT_PREMIUM` | no | Garments per plan (defaults 15 and 300). |
| `APP_IMAGES_ALLOWED_HOSTS` | no | Hosts garment image addresses may point to (default `res.cloudinary.com`). |
| `BACKUP_PBKDF2_ITERATIONS` | no | Key derivation iterations of admin backups (default 600000; the API refuses to start below that, or above 10,000,000, which the restore tool cannot read). |
| `BACKUP_MAX_BYTES` | no | Size cap of an in-app backup (default 209715200 = 200 MB). |
| `BACKUP_TEMP_DIR` | no | Folder for the short-lived temp files of a backup (default: a `vysvi-backup` folder in the system temp directory). |
| `JAVA_TOOL_OPTIONS` | no | JVM flags; `render.yaml` sets `-Xmx320m -XX:+UseSerialGC -XX:TieredStopAtLevel=1` for the free plan. |
| `VITE_API_URL` (site) | yes | The API's address + `/api`. Baked in at build time. |
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` (site) | yes | Image uploads. Baked in at build time - rebuild after changing. |
| `VITE_BG_REMOVER_MODE` (site) | no | `browser` removes backgrounds in the visitor's browser (set by `render.yaml`). |
| `VITE_AD_PROVIDER` and the `VITE_ADSENSE_*` / `VITE_ADSTERRA_*` values (site) | no | Ads for adult free accounts; empty = no ads. See "Ads for free accounts". |

Never put a secret in a `VITE_` variable: those end up in the public JavaScript.

### Sessions and logging out

Login tokens last 24 hours. Each carries a version number that is stored on the account; changing or resetting the password, deactivating the account and linking Google bump it, which
makes every older token stop working at once. Signing out in the app also clears the account's data from the browser.

## 7. Start-up checks (production)

In production (`SPRING_PROFILES_ACTIVE=prod`) the API refuses to start when a setting would make it unsafe, and says which one (never its value):

- `JWT_SECRET` not Base64, shorter than 32 bytes, or a placeholder;
- `CORS_ALLOWED_ORIGINS` empty, with a wildcard, or a local or plain-http address;
- `FRONTEND_URL` not a public https address;
- `MAIL_MODE=log`;
- `RATE_LIMIT_ENABLED=false`;
- only some of the three Stripe settings set.

Independently of the profile, the API also refuses to start if `BACKUP_PBKDF2_ITERATIONS` is below 600000 or above 10,000,000. If a deploy fails with "Refusing to start", read the
message in the Render log and fix that setting.

## 8. Checking that it works

- `https://<api>/actuator/health` answers `{"status":"UP"}` (it also asks the database).
- Open the website, register (the sign-up asks for birth month and year and two acceptances), sign in, upload a garment, build an outfit.
- "Forgot password" really sends an email (check spam the first time).
- Settings: **Download my data** gives a JSON file; a throwaway account can be deleted with **Delete my account and data**.
- As admin: the admin page lists accounts, and **Backup** shows the last backup and downloads one (then open it with `scripts/restore-from-archive.sh` into a local database to prove it).
- Render's logs show no stack traces in normal use.

## 9. Settings you apply in other dashboards

These live in other services' dashboards, so they cannot be checked from the code. Dashboards get rearranged: if a field is named differently, look for the closest one.

**Cloudinary: what the upload preset accepts** (the preset name is public in the site's JavaScript)
1. cloudinary.com -> Settings -> **Upload** -> **Upload presets** -> open the unsigned preset the site uses.
2. **Allowed formats:** `jpg, png, webp`. **Max file size:** 5 MB. **Folder:** a fixed folder such as `garments`, with unique file names. Leave **Overwrite** off. Save.
3. Optional: Settings -> Security -> **Restricted media types**: untick what you do not serve (video, raw).

**Supabase: keep the database off Supabase's own REST API**
1. Project -> **Integrations -> Data API** (or Settings -> API): turn it **off** (the app talks to Postgres directly through the pooler and never uses it).
2. If it stays on: **Database -> Tables**, and for `users`, `clothing_items`, `outfits`, `collections` and the other app tables enable **Row Level Security** with no policies (the app's own
   database user is not affected).
3. **Settings -> Database -> Connection string:** use the *Session pooler*; never share the password.

## 10. Alternative: one machine with Docker

`docker-compose.yml` runs the whole stack on one Linux machine: PostgreSQL, the API and a Caddy web server that serves the site, gets the HTTPS certificate by itself and forwards
`/api` to the API. Only ports 80 and 443 are open; the database and API are not. A CI job (`docker-stack`) builds the images and smoke-tests the running stack on every push.

```bash
git clone https://github.com/JavierChinchilla13/digitalcloset-app.git closet && cd closet
cp .env.production.example .env && nano .env      # fill in every value - see the comments inside
docker compose up -d --build && docker compose ps  # all three should become "healthy"/"running"
```

Generate the secrets with `openssl rand -base64 64` (`JWT_SECRET`) and `openssl rand -base64 24` (`DB_PASSWORD`). In this setup `SITE_ADDRESS` is the public hostname (turns on automatic
HTTPS; `:80` = plain HTTP for trying it locally), `PUBLIC_URL` the same as a URL, and the SMTP variables (`SPRING_MAIL_*`) or `MAIL_MODE=relay` configure email. Make the first admin with
`docker compose exec db psql -U postgres closet_db -c "UPDATE users SET role='ROLE_ADMIN' WHERE email='you@example.com';"`.

Update with `git pull && docker compose up -d --build` (migrations run on start; back up first). Back up with `./scripts/backup-db.sh` (writes `backups/closet-YYYY-MM-DD-HHMM.sql.gz`, keeps 14;
run it from cron and copy the folder off the machine). Restore into an empty database:

```bash
docker compose down
docker volume rm closet_db_data            # DESTROYS the current data (the volume is named <folder>_db_data; `docker volume ls` shows it)
docker compose up -d db
gunzip -c backups/closet-2026-10-01-0300.sql.gz | docker compose exec -T db psql -U postgres closet_db
docker compose up -d
```

The API's health check is `/actuator/health` (inside the network only in this setup; Caddy answers 404 for it publicly). Everything in sections 3, 5, 6 and 7 applies here too.
