"""
Admin settings endpoints:
  GET    /api/admin/settings                — fetch AppSettings (title, description)
  PATCH  /api/admin/settings                — update app title / description
  POST   /api/admin/settings/reset-app      — reset title/description to defaults
  POST   /api/admin/settings/reset-content  — delete all catalog content + thumbnails
  GET    /api/admin/settings/backup         — download full JSON backup
"""
from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.settings import AppSettings
from app.models.user import User

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AppSettingsOut(BaseModel):
    app_title: str
    app_description: str | None
    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    app_title: str | None = None
    app_description: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_settings(db: AsyncSession) -> AppSettings:
    row = await db.scalar(select(AppSettings).limit(1))
    if row is None:
        row = AppSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _row_to_dict(row) -> dict:
    """Serialize a SQLAlchemy model row to a plain dict."""
    return {k: v for k, v in row.__dict__.items() if not k.startswith("_")}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=AppSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _get_settings(db)


@router.patch("", response_model=AppSettingsOut)
async def update_settings(
    body: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = await _get_settings(db)
    if "app_title" in body.model_fields_set and body.app_title is not None:
        row.app_title = body.app_title
    if "app_description" in body.model_fields_set:
        row.app_description = body.app_description
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/reset-app", response_model=AppSettingsOut)
async def reset_app_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Reset app title and description to factory defaults (does not touch users or setup state)."""
    row = await _get_settings(db)
    row.app_title = "KawKaw Catalog"
    row.app_description = None
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/reset-content")
async def reset_content(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Delete ALL catalog content:
      - photos (cascades photo_species, album_photos; sets cover_photo_id NULL on species/albums)
      - albums
      - species
      - trips
      - locations
      - scan_jobs
    Also wipes thumbnail files from THUMBS_ROOT on disk.
    User accounts and app settings are preserved.
    """
    from app.config import settings as app_cfg
    from app.models.album import Album
    from app.models.location import Location
    from app.models.photo import Photo
    from app.models.scan import ScanJob
    from app.models.species import Species
    from app.models.trip import Trip

    # Delete photos first — DB-level ON DELETE cascades handle:
    #   photo_species (CASCADE), album_photos (CASCADE),
    #   species.cover_photo_id (SET NULL), album.cover_photo_id (SET NULL)
    await db.execute(delete(Photo))
    await db.execute(delete(Album))
    await db.execute(delete(Species))
    await db.execute(delete(Trip))
    await db.execute(delete(Location))
    await db.execute(delete(ScanJob))
    await db.commit()

    # Clear thumbnail files from disk (keep the THUMBS_ROOT directory itself)
    thumbs_root = app_cfg.THUMBS_ROOT
    if os.path.isdir(thumbs_root):
        for entry in os.scandir(thumbs_root):
            try:
                if entry.is_dir(follow_symlinks=False):
                    shutil.rmtree(entry.path, ignore_errors=True)
                else:
                    os.remove(entry.path)
            except OSError:
                pass

    return {"ok": True, "deleted": ["photos", "albums", "species", "trips", "locations", "scan_jobs"]}


@router.get("/backup")
async def download_backup(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Download a complete JSON backup of all catalog data (excluding user passwords)."""
    from app.models.album import Album
    from app.models.location import Location
    from app.models.photo import AlbumPhoto, Photo, PhotoSpecies
    from app.models.scan import ScanJob
    from app.models.species import Species
    from app.models.trip import Trip

    async def _dump(model):
        rows = (await db.execute(select(model))).scalars().all()
        return [_row_to_dict(r) for r in rows]

    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "tables": {
            "app_settings": await _dump(AppSettings),
            "locations": await _dump(Location),
            "trips": await _dump(Trip),
            "albums": await _dump(Album),
            "species": await _dump(Species),
            "photos": await _dump(Photo),
            "photo_species": await _dump(PhotoSpecies),
            "album_photos": await _dump(AlbumPhoto),
            "scan_jobs": await _dump(ScanJob),
        },
    }

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")

    return StreamingResponse(
        iter([json_bytes]),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="kawkaw-backup-{timestamp}.json"',
            "Content-Length": str(len(json_bytes)),
        },
    )
