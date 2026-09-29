# Deploy: one US-East VPS

Nothing here has been provisioned. These files and steps describe the target; follow them by hand.

```
Internet ──443──► Caddy (TLS, Let's Encrypt)
                   ├─ /voice/twilio, /voice/prewarm ─► 127.0.0.1:8765  docent-voice   (voice/, Pipecat)
                   └─ everything else ──────────────► 127.0.0.1:3000  docent-app     (Next standalone)
                                                                        │  ▲ relay + tools over loopback
                                                                        ▼  │
                                              /var/lib/docent/data/  palmetto.sqlite (+ -wal, -shm)
                                                                      recordings/  attachments/  invoices/
                                                                        │
                        docent-litestream ── continuous ─► s3://$LITESTREAM_BUCKET/$LITESTREAM_PATH/db/
                        docent-files-backup (15 min) ────► s3://$LITESTREAM_BUCKET/$LITESTREAM_PATH/files/
```

| File | Installs to |
| --- | --- |
| `systemd/docent-app.service` | `/etc/systemd/system/` |
| `systemd/docent-voice.service` | `/etc/systemd/system/` |
| `systemd/docent-litestream.service` | `/etc/systemd/system/` |
| `systemd/docent-files-backup.{service,timer}` | `/etc/systemd/system/` |
| `Caddyfile` | `/etc/caddy/Caddyfile` |
| `litestream.yml` | `/etc/docent/litestream.yml` |
| `backup-files.sh` | `/srv/docent/deploy/backup-files.sh` |
| `render-env.mjs` output | `/etc/docent/{app,voice,litestream}.env.tpl` |

Checked on a Mac, not on the target: `caddy validate` (2.11.4) accepts the Caddyfile, and `litestream databases` (0.5.17) parses `litestream.yml`. The systemd units have not been run through `systemd-analyze verify`, and `backup-files.sh` has not been run against a real bucket.

## Host

- US-East (the voice path is latency-bound: the caller, Twilio, and this host should all be in the eastern US; see `voice/README.md` "Results").
- Ubuntu 24.04 LTS, x86_64, at least 4 vCPU and 8 GB RAM. The voice service runs Silero VAD and Smart Turn on the CPU. Parakeet and Kokoro stay on Together, so no GPU is needed.
- Local SSD. SQLite and Litestream need a real local filesystem, not NFS.

## Layout

```
/srv/docent/releases/<git-sha>/   one Next standalone build per release
/srv/docent/app -> releases/<sha> current release (symlink)
/srv/docent/voice/                voice/ from the same commit, with its uv virtualenv
/srv/docent/deploy/               this directory (backup-files.sh runs from here)
/var/lib/docent/data/             database, recordings/, attachments/, invoices/  (backed up)
/var/lib/docent/next-cache/       .next/cache (image optimizer); not backed up
/var/lib/docent/cache/            voice model caches; not backed up
/etc/docent/                      op.env (service-account token), *.env.tpl, litestream.yml
```

Why the data directory needs a symlink: the app puts the database and `recordings/` next to `DATABASE_PATH`, but it writes `attachments/` and `invoices/` under `<cwd>/data` (`lib/invoice.ts`, `lib/replay.ts`, `app/api/customer/[token]/upload`). Each release therefore gets `data -> /var/lib/docent/data`, which keeps all of it in one backed-up directory.

## Secrets

Secrets come from 1Password at process start. `op run` resolves the `op://` references in `/etc/docent/*.env.tpl` and passes the values only to the child process. No secret is written to disk on the host, and `op run` masks secret values in the service's stdout and stderr.

1. Create a 1Password **service account** with read-only access to the vault that holds the canonical items (today: `Dev`). Put its token in `/etc/docent/op.env`:
   ```
   OP_SERVICE_ACCOUNT_TOKEN=ops_…
   ```
   `sudo chown root:docent /etc/docent/op.env && sudo chmod 0640 /etc/docent/op.env`. This token is the only secret on disk. Rotate it in 1Password to cut off the host.
2. Resolve every `TODO` in `.1password/project.toml`: create the missing items and fields, and switch name-based refs to item-id refs.
3. Render the templates from the repo at the deployed commit. The output holds `op://` references only, with production overrides for `APP_BASE_URL`, `DATABASE_PATH`, `VOICE_STREAM_URL`, and so on:
   ```bash
   node deploy/render-env.mjs app        | sudo tee /etc/docent/app.env.tpl
   node deploy/render-env.mjs voice      | sudo tee /etc/docent/voice.env.tpl
   node deploy/render-env.mjs litestream | sudo tee /etc/docent/litestream.env.tpl
   ```
   `SITE_DOMAIN=…` overrides the domain from `lib/brand.ts`. The voice template includes `TOGETHER_API_KEY` pointing at an item that does not exist yet (`voice/README.md` reads it from `voice/.env` today). Create that item first.
4. Check that every reference resolves, printing names only:
   `sudo -u docent env $(cat /etc/docent/op.env) op run --env-file=/etc/docent/app.env.tpl -- sh -c 'env | cut -d= -f1 | sort' >/dev/null && echo ok`

## One-time setup

```bash
# Packages
sudo apt-get update && sudo apt-get install -y git curl unzip sqlite3 rclone debian-keyring debian-archive-keyring apt-transport-https
# Node 22 LTS or later (node:sqlite), from NodeSource or the official tarball
# Caddy: https://caddyserver.com/docs/install#debian-ubuntu-raspbian
# Litestream 0.5.x .deb: https://github.com/benbjohnson/litestream/releases (do not enable its own litestream.service)
# 1Password CLI: https://developer.1password.com/docs/cli/get-started/#install
# uv (Python 3.12 is pinned in voice/pyproject.toml): curl -LsSf https://astral.sh/uv/install.sh | sh

# User and directories
sudo useradd --system --home /var/lib/docent --shell /usr/sbin/nologin docent
sudo install -d -o docent -g docent -m 0750 /var/lib/docent /var/lib/docent/data /var/lib/docent/next-cache /var/lib/docent/cache
sudo install -d -o root -g docent -m 0750 /etc/docent
sudo install -d -o docent -g docent /srv/docent /srv/docent/releases

# Firewall: only SSH and web. The app (3000) and voice (8765) bind to loopback.
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

DNS: point `A`/`AAAA` for the domain and `www` at the host before starting Caddy, so certificate issuance succeeds on the first try.

## Build and release

Build on the VPS (or on a Linux x86_64 CI runner). The standalone output copies `node_modules`, which must match the target platform.

```bash
SHA=$(git rev-parse --short HEAD)
REL=/srv/docent/releases/$SHA
npm ci && npm test && npm run build
mkdir -p $REL
cp -a .next/standalone/. $REL/                # server.js, traced node_modules, assets/
cp -a .next/static $REL/.next/static
[ -d public ] && cp -a public $REL/public
ln -sfn /var/lib/docent/data $REL/data
ln -sfn /var/lib/docent/next-cache $REL/.next/cache
ln -sfn $REL /srv/docent/app
sudo systemctl restart docent-app
```

Voice service, from the same commit:

```bash
sudo rsync -a --delete --exclude .venv --exclude .env voice/ /srv/docent/voice/
sudo chown -R docent:docent /srv/docent/voice
cd /srv/docent/voice && sudo -u docent uv sync --frozen --no-dev
sudo systemctl restart docent-voice
```

This directory:

```bash
sudo rsync -a deploy/ /srv/docent/deploy/ && sudo chmod +x /srv/docent/deploy/backup-files.sh
```

Rollback: point `/srv/docent/app` at the previous release and restart `docent-app`. Schema changes are additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN`), so an older release runs against a newer database.

## Services

```bash
sudo cp deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
sudo cp deploy/litestream.yml /etc/docent/litestream.yml
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
echo "SITE_DOMAIN=$(node -e 'console.log(require("fs").readFileSync("lib/brand.ts","utf8").match(/domain: "([^"]+)"/)[1])')" | sudo tee /etc/default/caddy
sudo install -d -o caddy -g caddy /var/log/caddy
sudo systemctl daemon-reload
sudo systemctl enable --now docent-litestream docent-app docent-voice docent-files-backup.timer
sudo systemctl reload caddy
```

Start order: Litestream, then the app. The app creates the database on first boot, and Litestream picks it up once it exists. The voice service needs the app for the relay.

## Pointing providers at the host

Each of these is an outward-facing change, so do them deliberately:

- **Twilio**: the number's Voice webhook to `https://<domain>/api/webhooks/twilio/voice` and the status callback to `/api/webhooks/twilio/status`. Signature checks use `APP_BASE_URL`, so it must be exactly the public origin.
- **ElevenLabs**: re-run `setup:elevenlabs` / `setup:prospect-agent` with the new `APP_BASE_URL` (see `docs/SETUP.md`). The agents' tool and custom-LLM URLs point at `phone-demo.magro.dev` today.
- **AgentMail**: webhook to `https://<domain>/api/webhooks/agentmail`.
- **Voice engine**: ElevenLabs stays the default. The app template sets `VOICE_STREAM_URL=wss://<domain>/voice/twilio` but not `PROSPECT_VOICE_ENGINE`, so the self-hosted service is idle until `PROSPECT_VOICE_ENGINE=selfhosted` is added to the Environment. Running `docent-voice` is optional until then.

## Backups and restore

- **Database**: Litestream streams WAL changes every second, takes a snapshot daily, and keeps 30 days of snapshots.
- **Files**: `docent-files-backup.timer` runs `rclone copy` every 15 minutes for `recordings/`, `attachments/`, and `invoices/`. It uses `copy`, not `sync`, so deleting a file on the host does not delete the backup. Removing a recording from the bucket (for example, on a deletion request) is a manual step.
- Both use the `LITESTREAM_*` credentials. Give that key access to this bucket only, and turn on bucket versioning if the provider supports it.

Restore onto a fresh host (after one-time setup, before starting the app):

```bash
sudo systemctl stop docent-app docent-voice docent-litestream
sudo -u docent env $(cat /etc/docent/op.env) op run --env-file=/etc/docent/litestream.env.tpl -- \
  litestream restore -config /etc/docent/litestream.yml /var/lib/docent/data/palmetto.sqlite
sudo -u docent env $(cat /etc/docent/op.env) op run --env-file=/etc/docent/litestream.env.tpl -- sh -c '
  export RCLONE_CONFIG_BACKUP_TYPE=s3 RCLONE_CONFIG_BACKUP_PROVIDER=Other \
    RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$LITESTREAM_ACCESS_KEY_ID" RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$LITESTREAM_SECRET_ACCESS_KEY" \
    RCLONE_CONFIG_BACKUP_ENDPOINT="$LITESTREAM_ENDPOINT" RCLONE_CONFIG_BACKUP_REGION="$LITESTREAM_REGION"
  rclone copy "backup:$LITESTREAM_BUCKET/$LITESTREAM_PATH/files" /var/lib/docent/data'
sudo systemctl start docent-litestream docent-app docent-voice
```

Test the restore on a scratch host before launch. A backup that has never been restored is unverified.

## Checks after a deploy

- `curl -sI https://<domain>/` and `https://<domain>/demo` return 200 (the public homepage and the Palmetto lobby).
- `curl -s https://<domain>/voice/health` returns 404. Only `/voice/twilio` and `/voice/prewarm` are public.
- `journalctl -u docent-litestream -n 50` shows replication with no errors. `litestream ltx -config /etc/docent/litestream.yml /var/lib/docent/data/palmetto.sqlite` lists recent files.
- `systemctl list-timers docent-files-backup.timer` shows the next run.
- The dashboard's integration panel shows each provider as live or simulated, as expected.

## Security notes

- **Fix before going live:** `lib/prospect/sources.ts` `placeQuery` fetches a user-supplied Google Maps short link with `redirect: "follow"` after an unanchored hostname regex (`/goo\.gl|g\.page|share\.google/`), so a URL like `http://169.254.169.254/?goo.gl` passes. On a VPS that is a blind SSRF into the host's network. Route it through `lib/safeFetch.ts` (required by CLAUDE.md, not written yet).
- Caddy strips a client-sent `CF-Connecting-IP`. `app/api/prospects/route.ts` reads that header before `X-Forwarded-For`, and with no CDN in front it would let a client choose its own rate-limit key. If Cloudflare is later put in front, restrict origin access to Cloudflare's ranges before removing that line.
- Access logs redact token path segments (`/c/`, `/review/`, `/try/`, `/api/customer/`, `/api/review/`, `/api/prospects/`) and drop the `Cookie` and `Authorization` headers.
- The app and voice units run as `docent` with `ProtectSystem=strict`. They can write only under `/var/lib/docent`.
