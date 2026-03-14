# KawKaw Catalog — Setup Guide

## Prerequisites

- Docker Engine + Compose v2 on your Portainer host
- TrueNAS accessible over SMB on your LAN
- `cifs-utils` installed on the Docker host (`apt install cifs-utils`)

---

## 1. Mount TrueNAS SMB Share on the Docker Host

Create a credentials file (keep it safe — not in the project folder):

```bash
sudo mkdir -p /etc/samba
sudo nano /etc/samba/kawkaw.creds
```

```
username=your_truenas_user
password=your_smb_password
```

```bash
sudo chmod 600 /etc/samba/kawkaw.creds
```

Add to `/etc/fstab` (replace IP and share name with your TrueNAS details):

```
//192.168.0.x/photos  /mnt/truenas_photos  cifs  credentials=/etc/samba/kawkaw.creds,uid=1000,gid=1000,file_mode=0444,dir_mode=0555,vers=3.0,_netdev  0  0
```

Mount it:

```bash
sudo mkdir -p /mnt/truenas_photos
sudo mount -a
ls /mnt/truenas_photos   # verify your photos are visible
```

---

## 2. Deploy with Portainer

> **No `.env` file needed.** All variables are set in Portainer's built-in
> environment editor — the compose file will never look for a file on disk.

1. In Portainer, go to **Stacks → Add Stack**
2. Name it `kawkaw-catalog`
3. Paste the contents of `docker-compose.yml` into the editor
   (or use **Repository** mode if the project is in a git repo)
4. Scroll down to **Environment variables** and add the following:

### Required variables

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | A strong password — e.g. `openssl rand -base64 24` |
| `JWT_SECRET_KEY` | Random hex string — run `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | `http://YOUR_HOST_IP/api` |

### Optional variables (defaults shown)

| Variable | Default | Override if… |
|---|---|---|
| `POSTGRES_USER` | `kawkaw` | You want a different DB username |
| `POSTGRES_DB` | `kawkaw` | You want a different DB name |
| `MEDIA_HOST_PATH` | `/mnt/truenas_photos` | You mounted the SMB share at a different path |

5. Click **Deploy the stack**

### Docker Compose CLI alternative

If running locally without Portainer, create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env and fill in POSTGRES_PASSWORD, JWT_SECRET_KEY, NEXT_PUBLIC_API_URL
docker compose up -d
```

---

## 3. First-Time Setup Wizard

Wait ~30 seconds for the database to initialize, then open `http://YOUR_HOST_IP/` in your browser.

You will be automatically redirected to the **Setup Wizard** (`/setup`), which:

1. **Status check** — confirms the API is running and shows how many media files are visible in your TrueNAS mount
2. **Create admin account** — choose your username, password, and gallery title
3. **Done** — redirects you to the admin panel

After setup is complete, any future visit skips the wizard entirely.

### Import Your First Folder

1. Go to **Admin → Import Folder** (Scans page)
2. You'll see your TrueNAS folder tree
3. Click **Import** next to a folder
4. In the modal:
   - Select or create a **Location**
   - Set the **Shoot Date**
   - Optionally create a **Trip**
5. Click **Start Import**

Thumbnails will be generated in the background — you can see progress on the **Dashboard**.

---

## 4. Updating the App

In Portainer: **Stacks → kawkaw-catalog → Editor → Update the stack** (rebuild images).

Or via CLI:

```bash
docker compose up -d --build
```

---

## 5. Backup

Critical data to back up:

- **PostgreSQL database**: `docker compose exec postgres pg_dump -U kawkaw kawkaw > backup.sql`
- **Thumbnails volume**: `docker run --rm -v kawkaw-catalog_thumbs:/data -v $(pwd):/backup alpine tar czf /backup/thumbs.tar.gz /data`

The original photos on TrueNAS are never modified — they are always mounted read-only.

---

## Troubleshooting

**Stack fails to deploy in Portainer with "env file not found":**
Remove any `env_file:` lines from the compose file — Portainer sets variables through its own editor, not a file on disk.

**SMB mount fails:** Check `dmesg | tail -20` and verify the TrueNAS IP, share name, and credentials.

**Thumbnails stuck at "pending":** Check `docker compose logs celery_worker`. Ensure `libraw-dev` and `ffmpeg` are installed correctly in the container.

**RAW files show "No preview":** The camera model may not be supported by LibRaw. Check the worker log for the specific error.

**API returns 500 on first run:** The database may still be initializing. Wait 30 seconds and reload.

**Setup wizard re-appears after setup:** The `kk_setup_complete` cookie may have been cleared. Completing the wizard again is safe — it will return a 409 if already set up and redirect you to sign in.
