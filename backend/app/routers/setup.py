import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.models.settings import AppSettings
from app.models.user import User
from app.schemas.setup import SetupRequest, SetupStatus
from app.services.auth import hash_password

router = APIRouter(prefix="/api/setup", tags=["setup"])

# Supported media extensions (same as scanner.py)
_MEDIA_EXTS = {".cr2", ".nef", ".arw", ".cr3", ".orf", ".rw2", ".dng",
               ".jpg", ".jpeg", ".mp4", ".mov", ".mts", ".m4v", ".avi"}


def _count_media_files(root: str, limit: int = 500) -> int:
    """Count media files in root, stopping early at `limit` for speed."""
    count = 0
    try:
        for dirpath, _, filenames in os.walk(root):
            for fname in filenames:
                if os.path.splitext(fname)[1].lower() in _MEDIA_EXTS:
                    count += 1
                    if count >= limit:
                        return count
    except PermissionError:
        pass
    return count


async def _get_or_create_settings(db: AsyncSession) -> AppSettings:
    row = await db.scalar(select(AppSettings).limit(1))
    if row is None:
        row = AppSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/status", response_model=SetupStatus)
async def setup_status(db: AsyncSession = Depends(get_db)):
    """
    Returns the current setup state.
    Called by the frontend on every page load (via middleware) to decide
    whether to redirect to /setup.
    """
    app_cfg = await _get_or_create_settings(db)
    media_root = settings.MEDIA_ROOT
    media_accessible = os.path.isdir(media_root)
    file_count = _count_media_files(media_root) if media_accessible else 0

    return SetupStatus(
        setup_complete=app_cfg.setup_complete,
        media_accessible=media_accessible,
        media_root=media_root,
        file_count=file_count,
    )


@router.post("/complete", status_code=status.HTTP_201_CREATED)
async def complete_setup(body: SetupRequest, db: AsyncSession = Depends(get_db)):
    """
    Completes the first-run setup:
      - Creates the admin user
      - Saves app title / description
      - Marks setup as complete

    This endpoint is only callable when setup is not yet complete.
    """
    app_cfg = await _get_or_create_settings(db)
    if app_cfg.setup_complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Setup has already been completed.",
        )

    # Check no users exist (extra safety)
    existing_user = await db.scalar(select(User).limit(1))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An admin user already exists.",
        )

    # Create admin user
    admin = User(
        username=body.admin_username,
        hashed_pw=hash_password(body.admin_password),
    )
    db.add(admin)

    # Persist app settings
    app_cfg.setup_complete = True
    app_cfg.app_title = body.app_title
    app_cfg.app_description = body.app_description
    app_cfg.completed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"detail": "Setup complete. You can now log in."}
