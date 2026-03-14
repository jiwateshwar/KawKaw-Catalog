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
username=kawkaw_reader
password=your_smb_password
```

```bash
sudo chmod 600 /etc/samba/kawkaw.creds
```

Add to `/etc/fstab`:

```
//192.168.1.x/photos  /mnt/truenas_photos  cifs  credentials=/etc/samba/kawkaw.creds,uid=1000,gid=1000,file_mode=0444,dir_mode=0555,vers=3.0,_netdev  0  0
```

Mount it:

```bash
sudo mkdir -p /mnt/truenas_photos
sudo mount -a
ls /mnt/truenas_photos   # verify your photos are visible
```

---

## 2. Configure Environment

Copy the example env file:

```bash
cp .env.example .env
nano .env
```

Update these values at minimum:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Strong password for the database |
| `JWT_SECRET_KEY` | Run `openssl rand -hex 32` and paste the result |
| `ADMIN_USERNAME` | Your admin login username |
| `ADMIN_PASSWORD` | Your admin login password (change immediately after first login) |
| `NEXT_PUBLIC_API_URL` | Set to `http://YOUR_HOST_IP/api` for access from your browser |

The SMB credentials in `.env` (`SMB_HOST`, `SMB_USER`, `SMB_PASS`) are only used for reference — the actual mount is done via `/etc/fstab` on the host.

---

## 3. Deploy with Portainer

### Option A: Portainer Stack (recommended)

1. In Portainer, go to **Stacks → Add Stack**
2. Name it `kawkaw-catalog`
3. Either paste the contents of `docker-compose.yml`, or use **Repository** mode pointing to your git repo
4. Add the environment variables from your `.env` file in the "Environment variables" section
5. Click **Deploy the stack**

### Option B: Docker Compose CLI

```bash
cd "KawKaw Catalog"
docker compose up -d
```

Check logs:

```bash
docker compose logs -f api
docker compose logs -f celery_worker
```

---

## 4. First-Time Setup

Wait ~30 seconds for the database to initialize, then open:

- **Admin panel**: `http://YOUR_HOST_IP/admin`
- **Public gallery**: `http://YOUR_HOST_IP/`

Log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

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

## 5. Updating the App

```bash
docker compose pull
docker compose up -d --build
```

Or in Portainer: **Stacks → kawkaw-catalog → Editor → Update the stack**.

---

## 6. Backup

Critical data to back up:

- **PostgreSQL database**: `docker compose exec postgres pg_dump -U kawkaw kawkaw > backup.sql`
- **Thumbnails volume**: `docker run --rm -v kawkaw-catalog_thumbs:/data -v $(pwd):/backup alpine tar czf /backup/thumbs.tar.gz /data`
- Your `.env` file (keep it secure)

The original photos on TrueNAS are never modified — they are always mounted read-only.

---

## Troubleshooting

**SMB mount fails:** Check `dmesg | tail -20` and verify the TrueNAS share name and credentials.

**Thumbnails stuck at "pending":** Check the Celery worker: `docker compose logs celery_worker`. Ensure `libraw-dev` and `ffmpeg` installed correctly in the container.

**RAW files show "No preview":** The file might be from a camera not supported by LibRaw. Check the worker log for the specific error.

**API returns 500:** Check `docker compose logs api`. The most common cause on first run is the database not being ready — wait 30s and reload.
