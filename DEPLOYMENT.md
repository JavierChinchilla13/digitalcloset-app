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

There is no free *managed* hosting that suits this stack well, but there is one
genuinely free machine:

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
| `SPRING_MAIL_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD` | yes | SMTP account (Gmail: `smtp.gmail.com`, 587, your address, the app password). |
| `MAIL_FROM` | no | From address (Gmail requires it to be the account itself - the default). |
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | yes | Image uploads. Baked into the site at build time - rebuild after changing. |
| `VITE_BG_REMOVER_MODE` | no | `browser` (default) removes backgrounds in the visitor's browser. |
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

- **No rate limiting** on login / register / forgot-password beyond the per-account
  email throttles. Put Cloudflare (free) in front, or add a limiter, before real traffic.
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
