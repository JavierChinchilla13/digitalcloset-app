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
- **Before real traffic:** ad networks set tracking cookies, so you need a privacy policy page, and visitors
  in the EU / UK need a cookie-consent banner before personalised ads. Neither is built yet.

### What to expect on the free plans

- **The API sleeps after 15 minutes without traffic**; the next visit waits roughly
  30-60 s while Spring Boot starts. A free uptime pinger (UptimeRobot, every 5 min on
  `/actuator/health`) keeps it awake; Render gives 750 free instance hours a month,
  which covers one service running around the clock (744 h).
- **Memory is small.** `render.yaml` caps the JVM (`-Xmx320m`). If the API dies with
  "out of memory", lower it further (`-Xmx256m`) or move to a paid instance.
- **Neon pauses when idle** (the first query after a pause takes about a second
  longer) and has **no backup you control** on the free plan: run `pg_dump` against
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
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | yes | Image uploads. Baked into the site at build time - rebuild after changing. |
| `VITE_BG_REMOVER_MODE` | no | `browser` (default) removes backgrounds in the visitor's browser. |
| `GOOGLE_CLIENT_ID` (API) / `VITE_GOOGLE_CLIENT_ID` (site) | no | The Google OAuth client id, the same value in both places. Empty = no "Continue with Google" button. See "Sign in with Google". |
| `VITE_AD_PROVIDER` | no | `adsense` or `adsterra` turns ads on for signed-in free accounts; empty (default) = no ads. Needs the matching values below; see "Ads for free accounts". |
| `VITE_ADSENSE_CLIENT` / `VITE_ADSENSE_SLOT` | with `adsense` | Your AdSense publisher id (`ca-pub-...`) and the ad unit's slot number. |
| `VITE_ADSTERRA_SCRIPT_URL` / `_KEY` / `_WIDTH` / `_HEIGHT` | with `adsterra` | From the banner unit's code: its `invoke.js` address, key and size. |
| `RATE_LIMIT_AUTH_MAX` | no | Requests per minute per visitor on the login / register / password-reset endpoints (default 30). |
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
