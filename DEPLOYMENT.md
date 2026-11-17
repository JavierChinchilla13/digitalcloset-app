# Deploying VYSVI

This guide puts the whole app on **one machine** with Docker: a PostgreSQL
database, the Spring Boot API, and a Caddy web server that serves the site, gets
the HTTPS certificate by itself, and forwards `/api` to the API. Only ports 80 and
443 are open to the internet; the database and API are not.

```
 visitor ──https──▶ Caddy (web) ──/api──▶ Spring Boot (backend) ──▶ PostgreSQL
                      │
                      └─ the React site (static files)        images ──▶ Cloudinary
```

Background removal runs **in the visitor's browser**, so no Python service is
deployed. (`backend-ai/` still works if you want it later: deploy it separately and
set `VITE_BG_REMOVER_MODE` / `VITE_BG_REMOVER_API_URL` when building the site.)

## 1. What you need

| Thing | Why | Notes |
|---|---|---|
| A machine that runs Docker | Runs the three containers | See "Where to host" below. 2 GB RAM is comfortable, 1 GB is tight. |
| A domain name (or a free subdomain) | HTTPS needs a name | Point an **A record** at the machine's public IP. |
| A Gmail account with 2-Step Verification | Sends reset / confirmation emails | Create an **App password** (Google Account → Security → App passwords). Gmail limits how many emails you can send per day - fine for a small app. |
| A Cloudinary account | Garment image storage | Settings → Upload → an **unsigned** upload preset. Both values are public by design. |

## 2. Where to host

Two free routes: one machine you control (below, then section 3), or Render + Neon
with no machine at all (section 3b). Free managed hosting has more limits (sleeping,
small memory), but needs no card.

The free machine:

- **Oracle Cloud "Always Free"** - an ARM virtual machine that stays free (not a
  12-month trial). Reported limits as of mid-2026: about 2 OCPU / 12 GB RAM -
  plenty. Catches: it needs a payment card to sign up, new VMs are sometimes
  "out of capacity" in a region (retry later or pick another availability domain),
  and Oracle can reclaim a VM that sits idle for a long time. **Check Oracle's own
  Always Free page for the current limits before relying on it.** Choose an
  *Ubuntu* image, and open ports 80 and 443 both in the instance's security list
  *and* in the OS firewall (`sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT`,
  same for 443, then save the rules).
- **Any small VPS** (a few dollars a month) works identically.
- The Postgres container can be replaced by a managed free database (e.g. Neon):
  remove the `db` service and set `DB_URL` (`jdbc:postgresql://HOST/DB?sslmode=require`),
  `DB_USERNAME`, `DB_PASSWORD` on the backend. Mind the size limits (Neon free: 0.5 GB).

Free "app platforms" that sleep when idle (Render free) are a poor fit: the Java
backend needs ~512 MB just to start and would be asleep for the first visitor.

## 3. First deployment

On the machine (Ubuntu example):

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # log out and back in afterwards

# 2. The code
git clone https://github.com/JavierChinchilla13/digitalcloset-app.git closet
cd closet

# 3. Your settings
cp .env.production.example .env
nano .env                          # fill in every value - see the comments inside

# 4. Build and start (the first build takes several minutes)
docker compose up -d --build
docker compose ps                  # all three should become "healthy"/"running"
```

Open `https://your-domain`. Caddy requests the certificate on the first visit
(needs the DNS record to be live and ports 80/443 reachable). Watch it with
`docker compose logs -f web`.

Generate the secrets in `.env` with:

```bash
openssl rand -base64 64      # JWT_SECRET
openssl rand -base64 24      # DB_PASSWORD
```

### The first admin

Registering always creates a normal user (there is deliberately no self-service
way to become an admin). Register your own account on the site, then promote it
once in the database:

```bash
docker compose exec db psql -U postgres closet_db \
  -c "UPDATE users SET role='ROLE_ADMIN' WHERE email='you@example.com';"
```

## 3b. Free hosting with Render + Neon (no server of your own)

Instead of one machine, split the app across free services. Everything below is
free and needs no credit card, with the trade-offs listed at the end.

```
 visitor ──▶ Render Static Site (the React website)
                │  calls  https://<api>.onrender.com/api
                ▼
        Render Web Service (the Spring Boot API, from backend/Dockerfile)
                │  JDBC over SSL
                ▼
        Neon (PostgreSQL)                     images ──▶ Cloudinary
```

**Where does the database live?** At Neon, a separate company. The API connects to
it with the three values `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. The first time the
API starts, Flyway creates every table in that empty database; from then on the data
lives at Neon and survives any API restart or redeploy. (Don't use Render's own free
Postgres: it is deleted 30 days after creation. A Render web service's disk is wiped
on each restart, so it can't hold a database either.)

### Step 1 - the database (Neon)

1. Sign up at neon.com (free plan), create a project (any region near your Render region).
2. On the project's dashboard open **Connect**. Turn **"Connection pooling" OFF** (or
   copy the host that does *not* contain `-pooler`): Flyway needs a direct connection.
3. From the connection string
   `postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require`
   build the three values:
   - `DB_URL` = `jdbc:postgresql://ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require`
   - `DB_USERNAME` = `USER`
   - `DB_PASSWORD` = `PASSWORD`

### Moving the database from Neon to Supabase (if Neon's free compute runs out)

Neon's free plan allows 100 compute-hours a month and cannot be told to stay asleep. The API's health check
(`/actuator/health`) also asks the database, so Render and an uptime pinger kept it awake around the clock and
the allowance ran out (Neon then refuses every connection until the next cycle). Supabase's free plan has no
compute-hour limit; it pauses a project after 7 days **without database requests**, and the API's own health
check is such a request, so keep the pinger running. Free storage is 500 MB.

Nothing in the code changes: only `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` on the API.

1. **Create the project** at supabase.com (free plan). Pick the region closest to your Render region and set a
   strong database password (save it in your password manager; never paste it in chat or git).
2. **Use the Session pooler address, not the direct one.** Project -> **Connect** -> **Session pooler**. The
   direct host (`db.<ref>.supabase.co`) is IPv6-only and Render's free tier cannot reach it; the session pooler
   is IPv4 and behaves like a normal connection (Flyway and prepared statements work; do NOT use the
   "Transaction pooler" on port 6543). The values are:
   - `DB_URL` = `jdbc:postgresql://aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require`
   - `DB_USERNAME` = `postgres.<project-ref>` (the pooler needs the project ref after the dot)
   - `DB_PASSWORD` = the database password from step 1
3. **Bring the data over (only if Neon answers; otherwise start fresh, see below).** On your own computer, in a
   terminal, with the PostgreSQL tools installed. The passwords stay in your terminal; set them first so they
   are not typed into the commands:

   ```bash
   # Neon's DIRECT connection string (the host without "-pooler")
   export NEON_URL='postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require'
   # Supabase's SESSION pooler string, from Connect -> Session pooler
   export SUPA_URL='postgresql://postgres.<project-ref>:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require'

   pg_dump --schema=public --no-owner --no-privileges --format=custom -f vysvi.dump "$NEON_URL"
   pg_restore --schema=public --no-owner --no-privileges --exit-on-error -d "$SUPA_URL" vysvi.dump
   ```

   Only the `public` schema is moved (Supabase has its own `auth`, `storage`... schemas that must be left alone).
   The dump includes Flyway's history table, so the API sees the schema as already up to date and only applies
   the migrations that are newer than the data. Check the result in Supabase's **Table editor** (users, clothing,
   outfits have rows), then delete `vysvi.dump` (it contains everyone's data).
4. **Point the API at it.** Render -> `vysvi-api` -> **Environment**: replace the three values and save; the API
   redeploys. In the logs look for Flyway's "Successfully validated" and "Started ClosetAppApplication".
5. **Check:** `https://<api>.onrender.com/actuator/health` answers `{"status":"UP"}`, you can sign in, and your
   garments and outfits are there. Keep the Neon project (do not delete it) until you are sure.

**If Neon will not answer** (its allowance is spent until the next cycle) the data cannot be dumped. Either wait
for the reset and run step 3 then, or skip step 3: the API creates an empty database on first start and accounts
register again. Garment pictures live at Cloudinary and are not lost, but nothing points at them any more.

### Step 2 - the API and the website (Render)

1. Push this repo to GitHub (it is already there). In Render: **New + -> Blueprint**,
   pick the repo. Render reads `render.yaml` and proposes two services,
   `vysvi-api` and `vysvi-web`, both on the **Free** plan.
2. Render asks for the values marked `sync: false`. Fill the API's now; the two
   address values need the website's URL, which you don't have yet, so put a
   placeholder (`https://placeholder.invalid`) and fix them in step 3:

   | Service | Variable | Value |
   |---|---|---|
   | vysvi-api | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | from Neon (above) |
   | vysvi-api | `JWT_SECRET` | `openssl rand -base64 64` |
   | vysvi-api | `MAIL_MODE` / `MAIL_RELAY_URL` / `MAIL_RELAY_SECRET` | `relay` / the Apps Script URL / its secret - see "Email without SMTP" below |
   | vysvi-api | `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` | the website's URL (step 3) |
   | vysvi-web | `VITE_API_URL` | the API's URL + `/api` (step 3) |
   | vysvi-web | `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | from Cloudinary |

3. After the first deploy each service has an address like
   `https://vysvi-api.onrender.com` and `https://vysvi-web.onrender.com` (the name is
   adjusted if it was taken). Now set, on the **API**: `CORS_ALLOWED_ORIGINS` and
   `FRONTEND_URL` = the website's address (no trailing `/`); on the **website**:
   `VITE_API_URL` = `<api address>/api`. Save; the API restarts, and the website
   needs a **Manual Deploy -> Clear build cache & deploy** (the value is baked in at
   build time).
4. Check `https://<api address>/actuator/health` shows `{"status":"UP",...}` (the
   first request after a sleep takes up to a minute), then open the website,
   register, and make the first admin as in section 3 - with Neon, run that SQL in
   Neon's **SQL Editor**.

### Step 3 - Email without SMTP (the Apps Script relay)

Render's free tier cannot open SMTP connections, and the free email services want a
domain you own. This works around both: a tiny Google Apps Script, running as your
Gmail account, receives the app's emails over HTTPS and sends them. It is free, needs
no domain, and the mail really comes from Gmail (so it is not flagged as spam for
being sent through a stranger's server). A normal Gmail account can send to 100
recipients a day this way - far more than password resets and 6-digit codes need.

1. Open <https://script.google.com> signed in as the Gmail that should send the mail,
   choose **New project**, delete the sample code and paste in `scripts/mail-relay.gs`.
2. **Project Settings** (the gear) -> **Script properties** -> **Add script property**:
   name `RELAY_SECRET`, value a long random string (e.g. `openssl rand -hex 32`).
   Keep a copy: the backend needs the same value.
3. In the editor pick the function `authorize` and press **Run**. Google asks you to
   allow the script to send email as you (**Advanced** -> **Go to ... (unsafe)** is
   normal for your own script). This is a one-time step.
4. **Deploy** -> **New deployment** -> type **Web app**; *Execute as*: **Me**; *Who has
   access*: **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`). The
   secret is what protects it, so do not share the URL.
5. On Render, `vysvi-api` -> Environment: add `MAIL_MODE=relay`, `MAIL_RELAY_URL` (the
   URL from step 4) and `MAIL_RELAY_SECRET` (the value from step 2). The `SPRING_MAIL_*`
   variables are no longer used and can be removed. Saving redeploys the API.
6. Ask for a password reset on the site and check the inbox (and spam the first time).

If it fails, the API log says why (search for `Could not send`): "unauthorized" = the two
secrets differ; "did not answer JSON" = step 4's access is not **Anyone**, or the URL is
wrong; a quota message = the 100-a-day limit. After editing the script, use **Deploy ->
Manage deployments -> edit -> New version**: saving alone does not change the live URL.

### Sign in with Google (optional)

Adds a "Continue with Google" button to the login and signup pages. Signing in with Google creates an
account the first time (a normal free account, no password); a person who already has a password account
with the same email is linked to it, and that account's old password is removed (they can set a new one
with "Forgot password"; their garments and outfits are kept). It is free and needs no domain.

1. Go to <https://console.cloud.google.com>, create a project (e.g. "VYSVI").
2. **APIs & Services -> OAuth consent screen**: choose **External**, fill in the app name, your support
   email and developer email, save. Then **Publish app** (set it "In production"): the basic email / profile
   permissions this uses need no Google review. While it stays in "Testing", only the test users you list
   can sign in.
3. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**, type **Web application**.
   Under **Authorized JavaScript origins** add the site's address (`https://vysvi-web.onrender.com`) and
   `http://localhost:5173` for local work. (No redirect URI and no client secret are needed.)
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). It is public, not a secret.
5. On Render set `GOOGLE_CLIENT_ID` on the **API** and `VITE_GOOGLE_CLIENT_ID` on the **site**, both to that
   value. The site must be **rebuilt** (it is baked in at build time), the API redeploys when saved.

If the button does not appear, `VITE_GOOGLE_CLIENT_ID` is empty in the build. If it appears but signing in
fails with "Google sign-in failed", the two ids differ, or the site's address is not in the authorized origins.
When you later put the site on your own domain, add it to the authorized origins too.

### Error monitoring with Sentry (optional)

Sentry tells you when the app breaks for someone (a crashed page, a server error) with the place in the code. It is
off until you set a DSN, and even then the website sends nothing until the visitor chooses **Accept all** on the cookie
banner (the Privacy Policy already says so). Errors only: no performance tracing, no session replay, no user, headers
or cookies; query strings are cut from URLs, console output is not kept, and emails / long tokens are blanked. The API
reports only unexpected 500s (not wrong passwords, 404s, 403s...). Server answers 502/503/504 (the free host waking
up) are not reported.

1. Sign up at sentry.io (free plan) and create an organization.
2. Create **two projects**: one **React** (for the website) and one **Java** (for the API). Each shows a **DSN**
   (`https://...@o....ingest.sentry.io/...`). A DSN is not a secret key, but keep it out of git anyway.
3. Render -> `vysvi-web` -> Environment: `VITE_SENTRY_DSN` = the React DSN, then redeploy the site (it is baked in
   at build time). Render -> `vysvi-api` -> Environment: `SENTRY_DSN` = the Java DSN (redeploys by itself).
4. Check: accept optional services on the site, then in the browser console run `setTimeout(() => { throw new Error('sentry test') })`
   - the error should appear in the React project within a minute (then ignore or resolve it in Sentry).

### Payments with Stripe - Premium subscription (optional)

Premium is a monthly subscription (300 garments, no ads). Nothing is charged and no upgrade button shows until
the three variables below are set, so this is safe to leave off. **Try everything in Stripe's test mode first**
(the "Test mode" switch of the dashboard, test card `4242 4242 4242 4242`); going live needs Stripe's business
verification, a public site with contact details and the Terms/Privacy pages (they are in the app).

1. Create a Stripe account. In **test mode**: **Product catalog -> Add product** "VYSVI Premium", a **recurring**
   monthly price (you choose the amount). Copy the **Price ID** (`price_...`).
2. **Developers -> API keys**: copy the **Secret key** (`sk_test_...`). It is a secret: only on Render, never in git.
3. **Settings -> Billing -> Customer portal**: turn it on (allow cancelling the subscription and updating the card).
4. **Developers -> Webhooks -> Add endpoint**: URL `https://<your-api>.onrender.com/api/billing/webhook`, events
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the
   endpoint's **Signing secret** (`whsec_...`).
5. On the Render **API** service set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. It redeploys.

The plan changes only when Stripe's signed webhook arrives (the page the buyer returns to is never trusted), so
if a payment succeeds but the account stays Free, look at **Developers -> Webhooks -> your endpoint -> Events**
for failed deliveries (a wrong signing secret is the usual cause). Cancelling happens in Stripe's portal; the
account keeps Premium until the paid period ends. Deactivating an account cancels its subscription. A Premium
plan given by an admin has no subscription and is never changed by Stripe events.

### Ads for free accounts (optional)

Free accounts see one banner above the footer; premium accounts and admins never do (and never
download the ad script). Nothing shows until you pick a network, so this is safe to leave off.
Set the variables on the **site** (they are baked in at build time, so rebuild it after changing them).

- **Google AdSense** (best pay, strict rules): it only approves a site on a domain **you own**
  (a free `*.onrender.com` address is refused). Once you have a domain and an approved account, create a
  display ad unit and set `VITE_AD_PROVIDER=adsense`, `VITE_ADSENSE_CLIENT` (`ca-pub-...`) and
  `VITE_ADSENSE_SLOT` (the unit's number). AdSense also asks for a file `ads.txt` at the site root: put it in
  `frontend/public/ads.txt` with the line Google shows you (the site must really serve that file).
- **A network that accepts free subdomains** (e.g. Adsterra): sign up, add the site, create a **banner**
  unit and copy three things from its code: the `.../invoke.js` address, the `key`, and the width and height.
  Set `VITE_AD_PROVIDER=adsterra`, `VITE_ADSTERRA_SCRIPT_URL`, `VITE_ADSTERRA_KEY`, `VITE_ADSTERRA_WIDTH`,
  `VITE_ADSTERRA_HEIGHT`. Use banner units only (avoid popunder / redirect formats: they spoil the app and
  annoy users). A banner wider than the visitor's screen is simply not shown (320x50 fits every phone). This
  network's code runs in a sandboxed frame that cannot read the site's storage (where the sign-in token lives).
- **Privacy and consent (built):** the site has `/privacy` and `/terms` (drafts: review them and fill in the
  `[COUNTRY]` spot in `frontend/src/config/legal.ts`, then set `LEGAL_IS_DRAFT = false`) and a cookie banner.
  Ads only load after a visitor chooses "Accept all"; "Only essentials" keeps them off.

### What to expect on the free plans

- **The API sleeps after 15 minutes without traffic**; the next visit waits roughly
  30-60 s while Spring Boot starts. A free uptime pinger (UptimeRobot, every 5 min on
  `/actuator/health`) keeps it awake; Render gives 750 free instance hours a month,
  which covers one service running around the clock (744 h).
- **Memory is small.** `render.yaml` caps the JVM (`-Xmx320m`). If the API dies with
  "out of memory", lower it further (`-Xmx256m`) or move to a paid instance.
- **Neon pauses when idle** (the first query after a pause takes about a second
  longer), allows only 100 compute-hours a month on the free plan - an uptime pinger on `/actuator/health`
  keeps the database awake and exhausts that (see "Moving the database from Neon to Supabase") - and has **no backup you control** on the free plan: run `pg_dump` against
  the direct connection now and then (`pg_dump "postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" | gzip > backup.sql.gz`).
  Free storage is 0.5 GB.
- **Render's free tier blocks outbound SMTP** (ports 25, 465, 587) since September
  2025, so Gmail over SMTP times out there. Use the free Apps Script relay below.
- Different addresses for site and API means the browser makes cross-origin
  requests: that is what the CORS setting is for, and why a wrong
  `CORS_ALLOWED_ORIGINS` shows up as "Network error" in the browser console.

## 4. Updating

```bash
cd closet
git pull
docker compose up -d --build       # rebuilds what changed; migrations run on start
```

Database changes ship as Flyway migrations (`backend/src/main/resources/db/migration`)
and are applied automatically when the backend starts. They are not reversible, so
**take a backup before updating** (below).

## 5. Backups

```bash
./scripts/backup-db.sh             # backups/closet-YYYY-MM-DD-HHMM.sql.gz, keeps 14
```

Run it daily from cron (`crontab -e`):

```
0 3 * * *  cd /home/ubuntu/closet && ./scripts/backup-db.sh
```

**Copy `backups/` off the machine** (another computer, cloud storage) - a backup
that lives only on the server is lost with it. Garment images live in Cloudinary,
not in the database, so they are not part of this backup.

Restore into an empty database:

```bash
docker compose down
docker volume rm closet_db_data            # DESTROYS the current data
docker compose up -d db
gunzip -c backups/closet-2026-10-01-0300.sql.gz | docker compose exec -T db psql -U postgres closet_db
docker compose up -d
```

(The volume name is `<folder>_db_data`; `docker volume ls` shows it.)

### Backing up the production database (Supabase) and testing the restore

The commands above are for the Docker stack. The live site's database is on Supabase (free plan: **no automatic
restore**), so make your own backups from your computer with `scripts/backup-remote-db.sh`. You type the connection
string yourself; the script never prints or stores it, and it refuses to write inside the repository.

```bash
# Git Bash on Windows, or any Linux/macOS shell. Needs the PostgreSQL client tools (pg_dump, pg_restore).
export BACKUP_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
# Optional but recommended: encrypt it. Put a long random passphrase in a file and keep a copy in your password manager.
export BACKUP_PASSPHRASE_FILE="$HOME/vysvi-backup-passphrase.txt"
./scripts/backup-remote-db.sh              # writes ~/vysvi-backups/vysvi-<date>.dump(.gpg) + a manifest; keeps 14
```

Use the **Session pooler** address (port 5432), the same one the API uses. Make a backup before every deploy that
changes the database and at least weekly. Copy the folder somewhere private off this computer; the files hold every
user's email, password hashes and closet. Garment pictures live in Cloudinary and are not part of this backup.

**A backup you have never restored is a hope.** Test it into an empty database on your own computer:

```bash
createdb vysvi_restore_test
export RESTORE_DATABASE_URL='postgresql://postgres:<local password>@localhost:5432/vysvi_restore_test'
./scripts/restore-db.sh ~/vysvi-backups/vysvi-2026-11-06-120000.dump.gpg
```

The restore script refuses anything that is not a local database named `*test*`, `*local*` or `*restore*`, refuses a
database that already has tables, checks the backup's checksum against its manifest first, and compares the rows per
table with the manifest afterwards ("Restore verified: N tables, M rows"). To go one step further, start the API on
the restored copy (`DB_URL=jdbc:postgresql://localhost:5432/vysvi_restore_test`) and sign in. Restoring into
production is a decision to take by hand, with the API stopped; these scripts will not do it.

### Removing pictures after someone deletes their account

When a person uses **Settings -> Delete my account and data**, everything about them in the database is erased at once. Their garment
pictures live in Cloudinary, which the API cannot clean (the upload preset is public and the server holds no Cloudinary secret), so the API
writes the pictures' **addresses** (no link to the person) into the table `image_erasure_queue`. You empty that queue from your own computer
with `scripts/purge-cloudinary.sh`, now and then (the Privacy text will promise removal within 30 days):

```bash
export PURGE_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
export CLOUDINARY_URL='cloudinary://<api key>:<api secret>@<cloud name>'     # Cloudinary dashboard -> Settings -> API keys
./scripts/purge-cloudinary.sh            # dry run: lists what it would delete, deletes nothing, does not call Cloudinary
./scripts/purge-cloudinary.sh --apply    # deletes the pictures, then removes them from the queue
```

Type the export lines yourself; the script never prints or stores them (the secret goes to `curl` through stdin, not the command line). A picture
Cloudinary reports as already gone counts as done; anything else stays in the queue for next time. Only addresses of **your** cloud are touched.
Signed uploads with the API removing pictures by itself are the planned replacement once the domain is in place.

### Erasing accounts that stayed deactivated for 30 days

The Terms say an account an admin deactivated is erased after 30 days. Nothing does it on a schedule: you run `scripts/purge-deactivated.sh` from
your own computer, now and then. It signs in as your admin account and calls an admin-only endpoint, so each account goes through the same full
erasure as "Delete my account and data". The time an account was deactivated is kept in `users.deactivated_at` (accounts already deactivated when
migration V19 ran started their 30 days that day). Admins are never erased, and the server refuses fewer than 30 days.

```bash
export PURGE_API_URL='https://<your-api-host>'        # no trailing slash, no /api
export PURGE_ADMIN_EMAIL='<your admin email>'
./scripts/purge-deactivated.sh            # dry run (default): says how many accounts are due, erases nobody
./scripts/purge-deactivated.sh --apply    # erases them; then run ./scripts/purge-cloudinary.sh for their pictures
```

The password is typed when asked (not echoed, not stored, not on a command line). Take a backup first.

### Admin backup: the downloaded archive and how to restore it

An admin can download an encrypted copy of the whole database from the admin page (Backup -> Download backup; endpoint `POST /api/admin/backup`).
The file is `vysvi-backup-<date>.vbk`: a tar of one CSV per table plus a manifest (rows, SHA-256 per file, schema version), compressed and sealed with
AES-256-GCM under a key derived (PBKDF2-HMAC-SHA256, 600,000 iterations, stored in the file header) from a password the admin types at download time.
**It contains every user's email and password hash: treat it as a secret**, keep it off shared folders, email and chat, store its password in a password
manager, and delete downloads after 90 days. It is never stored on the server (a private temp file for the length of the request, deleted always). The
tables `password_reset_tokens` and `pending_account_changes` are not included. Limits: 3 per hour and 10 per day per admin, one at a time, 200 MB.
For a database too large for that, use `scripts/backup-remote-db.sh` from your computer.

Restoring is for developers, into an EMPTY **local** database only (the script refuses anything else: a non-local host, a database name without
`test`, `local` or `restore`, tables that are not empty, a schema version different from the archive's, a wrong password, or a file that was changed):

```bash
createdb vysvi_restore_test                          # an empty database on your computer
# start the API once against it so Flyway creates the tables, then stop it
cd backend && ./mvnw -q compile && cd ..             # the archive reader runs from backend/target/classes (JDK only, no network)
export RESTORE_DATABASE_URL='postgresql://postgres:<password>@localhost:5432/vysvi_restore_test'
./scripts/restore-from-archive.sh ~/Downloads/vysvi-backup-2026-11-17.vbk      # asks for the archive password, typed hidden
```

It decrypts and checks every file against the manifest before touching the database, loads everything in ONE transaction (it all happens or none of it
does; `users.main_outfit_id` is set after the outfits exist), restarts the id sequences after the highest restored id, and finally compares the rows per
table with the manifest. Then start the API against the restored database and sign in.

**Rehearsal on a real throwaway PostgreSQL (18.4 here), 2026-11-17** — the first run of the `COPY` dumper outside the H2 test suite:
1. `initdb` a cluster, `createdb` two databases; start the API (test profile, Flyway on, `ddl-auto=validate`, 600,000 iterations) on the first: sign-up, a garment
   named `Blue "shirt", with comma`, an outfit (so `users.main_outfit_id` is set), an admin (promoted in SQL).
2. `POST /api/admin/backup` through the real endpoint: 200, `Cache-Control: no-store`, `nosniff`, attachment, 2,401 bytes, the alert logged first, the
   archive starts with the magic `VYSVIBK1` and contains none of the plain text.
3. Start the API once on the second (empty) database so Flyway built the tables (schema version 20), stop it, run `restore-from-archive.sh`:
   "Restore verified: 10 tables, 5 rows, all matching the manifest". The refusals were exercised too: wrong password, one flipped byte, a database name
   without `test|local|restore`, a non-local host, and a second restore into the now non-empty database all stop with nothing changed.
4. Start the API on the restored database: sign-in with the original password works (the hashes came back), `/users/me` shows `mainOutfitId: 1`, the garment
   (comma and quotes intact) and the outfit are there, and a new sign-up gets the next id (the sequences were restarted).
5. Scale: 150,000 extra wide rows (a 238 MB table) with the API's JVM limited to `-Xmx110m`: the backup finished (200, 5.4 MB, 28 s) with no memory
   error, and restoring it gave 150,005 rows with an identical hash of the content column in the source and the restored copy.

## 6. Settings reference

Set in `.env` (see `.env.production.example`); `docker-compose.yml` passes them on.

| Variable | Needed | Meaning |
|---|---|---|
| `SITE_ADDRESS` | yes | Public hostname (`closet.example.com`) - turns on automatic HTTPS. `:80` = plain HTTP, for trying it locally. |
| `PUBLIC_URL` | yes | The same as a URL (`https://closet.example.com`); used in password-reset links and CORS. |
| `DB_PASSWORD` | yes | Database password. The backend refuses to start without it. |
| `JWT_SECRET` | yes | Base64 signing key for login tokens. Refuses to start without it. Changing it logs everyone out. |
| `SPRING_MAIL_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD` | yes (SMTP mode) | SMTP account (Gmail: `smtp.gmail.com`, 587, your address, the app password). Not needed with `MAIL_MODE=relay`. |
| `MAIL_FROM` | no | From address (Gmail requires it to be the account itself - the default). |
| `MAIL_MODE` | no | `smtp` (default in production) or `relay` (Apps Script, for hosts that block SMTP). |
| `MAIL_RELAY_URL` / `MAIL_RELAY_SECRET` | yes (relay mode) | The Apps Script web app URL and its shared secret. |
| `CONTACT_EMAIL` | recommended | The address emails show for questions (and replies go to). Not kept in the code; if unset, emails fall back to the From address. |
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | yes | Image uploads. Baked into the site at build time - rebuild after changing. |
| `VITE_BG_REMOVER_MODE` | no | `browser` (default) removes backgrounds in the visitor's browser. |
| `GOOGLE_CLIENT_ID` (API) / `VITE_GOOGLE_CLIENT_ID` (site) | no | The Google OAuth client id, the same value in both places. Empty = no "Continue with Google" button. See "Sign in with Google". |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` (API) | no | Premium by Stripe subscription. All three empty = payments off. See "Payments with Stripe". |
| `VITE_AD_PROVIDER` | no | `adsense` or `adsterra` turns ads on for signed-in free accounts; empty (default) = no ads. Needs the matching values below; see "Ads for free accounts". |
| `VITE_ADSENSE_CLIENT` / `VITE_ADSENSE_SLOT` | with `adsense` | Your AdSense publisher id (`ca-pub-...`) and the ad unit's slot number. |
| `VITE_ADSTERRA_SCRIPT_URL` / `_KEY` / `_WIDTH` / `_HEIGHT` | with `adsterra` | From the banner unit's code: its `invoke.js` address, key and size. |
| `RATE_LIMIT_AUTH_MAX` | no | Requests per minute per visitor on the login / register / password-reset endpoints (default 30). |
| `RATE_LIMIT_PUBLIC_MAX` | no | Requests per minute per visitor on the public shared-outfit endpoint `/api/public/outfits/{token}` (default 120). Separate from the login limit. |
| `RATE_LIMIT_AGE_REJECTION_ENABLED` / `_MAX` / `_WINDOW_SECONDS` | no | Counts sign-ups **refused for age** per client address (in memory only) and answers 429 after `MAX` (default 5) within the window (default 3600 s). **Off by default** (`false`): behind Render's proxy the address the app sees may be the proxy's, so one counter would be shared by every visitor. To turn it on later: first measure the real client address (audit H2), then set `RATE_LIMIT_AGE_REJECTION_ENABLED=true` on `vysvi-api` and redeploy. Size `MAX` for shared mobile networks. |
| `JAVA_TOOL_OPTIONS` | no | JVM flags; e.g. `-Xmx512m` on a small machine. |

Never put a secret in a `VITE_` variable: those end up in the public JavaScript.

## 7. Checking that it works

- `docker compose ps` - `db`, `backend` healthy, `web` running.
- `curl -I https://your-domain` - 200 with the security headers.
- Register an account, sign in, upload a garment, build an outfit.
- "Forgot password" really sends an email (check spam the first time).
- `docker compose logs backend` has no SQL and no stack traces in normal use.

The backend's own health check is `/actuator/health` (inside the network only;
Caddy answers 404 for it publicly).

## 8. Not done yet (worth knowing)

- **Rate limiting is basic.** `/api/auth/**` (login, register, forgot/reset password)
  allows 30 requests per minute per visitor address (`RATE_LIMIT_AUTH_MAX`; counts are
  in memory, so they reset on a restart). It stops password-guessing and sign-up
  floods from one address, not a distributed attack - Cloudflare (free) in front
  would add that. Behind Caddy/Render the visitor's address comes from
  `X-Forwarded-For` (`server.forward-headers-strategy=native`).
- **No Content-Security-Policy header** yet: the in-browser background remover
  loads its model files from a third-party CDN, so a CSP needs to be written and
  tested against it.
- **No monitoring/alerting.** Free options: UptimeRobot on the site URL.
- **Sessions are 24 h JWTs kept in the browser**; there is no refresh-token or
  server-side logout.
- **`closet-browsing-demo.gif` is 2.7 MB** (landing page) - worth compressing.
- The production image build was verified by the **CI job `docker-stack`** (it
  builds the images and smoke-tests the running stack on every push), not on the
  development machine, which has no Docker.


## Start-up checks (production)

In production (`SPRING_PROFILES_ACTIVE=prod`) the API refuses to start when a setting would make it unsafe, and
says which one (never its value): `JWT_SECRET` not Base64, shorter than 32 bytes or a placeholder;
`CORS_ALLOWED_ORIGINS` empty, with a wildcard, local or plain-http address; `FRONTEND_URL` not a public https
address; `MAIL_MODE=log`; `RATE_LIMIT_ENABLED=false`; or only some of the three Stripe settings set. If a deploy
fails with "Refusing to start in production", read the message in the Render log and fix that setting.

## Console hardening checklist (things only you can set)

These live in other websites' dashboards, so they cannot be checked from the code. Dashboards get rearranged: if a field
is named differently from what is written here, look for the closest one (or ask).

**Cloudinary: limit what the public upload preset accepts** (the preset name is public in the site's JavaScript)
1. cloudinary.com -> Settings (gear) -> **Upload** -> **Upload presets** -> open the unsigned preset the site uses.
2. **Allowed formats:** `jpg, png, webp` (nothing else).
3. **Max file size:** 5 MB (5242880 bytes), under the preset's upload-control options.
4. **Folder:** a fixed folder such as `garments`, and turn **Use filename / Unique filename** so names cannot collide.
5. Leave **Overwrite** off. Save.
6. Optional: Settings -> Security -> **Restricted media types**: untick anything you do not serve (video, raw).

**Supabase: make sure the database is not reachable through Supabase's own REST API**
1. supabase.com -> your project -> **Integrations -> Data API** (or Settings -> API): if the Data API is on,
   **turn it off** (the app talks to Postgres directly through the pooler and never uses it).
2. If you must keep it on: **Database -> Tables**, and for `users`, `clothing_items`, `outfits`, `collections` and
   the other app tables enable **Row Level Security** with no policies (this denies the public key everything;
   the app's own database user is not affected).
3. **Database -> Backups:** note which backups your plan has (free: none you can restore yourself, so use the script).
4. **Settings -> Database -> Connection string:** you are using the *Session pooler*; never share the password.
