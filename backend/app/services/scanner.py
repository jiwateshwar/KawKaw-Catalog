"""
Folder scan logic: walk a directory, identify media files, and import them to the DB.
This is pure Python — the Celery task wraps this for async execution.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.album import Album
from app.models.location import Location
from app.models.photo import Photo
from app.models.scan import ScanJob
from app.models.trip import Trip
from app.services.exif import extract_from_file

RAW_EXTS = {".cr2", ".nef", ".arw", ".cr3", ".orf", ".rw2", ".dng"}
JPEG_EXTS = {".jpg", ".jpeg"}
VIDEO_EXTS = {".mp4", ".mov", ".mts", ".m4v", ".avi"}
ALL_EXTS = RAW_EXTS | JPEG_EXTS | VIDEO_EXTS


@dataclass
class ScanResult:
    files_found: int = 0
    files_imported: int = 0
    files_skipped: int = 0
    error: str | None = None


def _sha256_prefix(path: str, chunk_size: int = 65536) -> str:
    """Hash the first chunk of a file for fast duplicate detection."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        data = f.read(chunk_size)
        h.update(data)
    return h.hexdigest()


def _file_type(ext: str) -> str:
    if ext in RAW_EXTS:
        return "raw"
    elif ext in JPEG_EXTS:
        return "jpeg"
    return "video"


def _collect_files(root: str) -> list[str]:
    """Walk root and return all media file paths."""
    result = []
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext in ALL_EXTS:
                result.append(os.path.join(dirpath, fname))
    return result


def _has_raw_sidecar(path: str) -> bool:
    """Return True if a RAW file exists with the same stem as this JPEG."""
    stem = os.path.splitext(path)[0]
    for ext in RAW_EXTS:
        if os.path.exists(stem + ext) or os.path.exists(stem + ext.upper()):
            return True
    return False


async def scan_folder(
    db: AsyncSession,
    job: ScanJob,
    root: str,
    location_id: int | None,
    trip_id: int | None,
    shoot_date: str | None,
) -> ScanResult:
    result = ScanResult()
    media_root = settings.MEDIA_ROOT

    all_files = _collect_files(root)
    result.files_found = len(all_files)

    # Update job with file count
    job.files_found = result.files_found
    await db.commit()

    fallback_date: datetime | None = None
    if shoot_date:
        try:
            d = date.fromisoformat(shoot_date)
            fallback_date = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        except ValueError:
            pass

    for abs_path in all_files:
        ext = os.path.splitext(abs_path)[1].lower()

        # Skip JPEG sidecars when a RAW counterpart exists
        if ext in JPEG_EXTS and _has_raw_sidecar(abs_path):
            result.files_skipped += 1
            continue

        # relative_path is the unique key — relative to MEDIA_ROOT
        try:
            rel_path = os.path.relpath(abs_path, media_root).replace("\\", "/")
        except ValueError:
            rel_path = abs_path.replace("\\", "/")

        # Skip if already imported
        existing = await db.scalar(select(Photo).where(Photo.relative_path == rel_path))
        if existing is not None:
            result.files_skipped += 1
            continue

        # SHA256 of first 64KB for duplicate detection
        try:
            sha = _sha256_prefix(abs_path)
        except OSError:
            result.files_skipped += 1
            continue

        # Extract EXIF
        try:
            parsed_exif, raw_exif = extract_from_file(abs_path)
        except Exception:
            parsed_exif, raw_exif = {}, {}

        captured_at = parsed_exif.get("captured_at") or fallback_date

        photo = Photo(
            filename=os.path.basename(abs_path),
            relative_path=rel_path,
            file_type=_file_type(ext),
            file_size_bytes=os.path.getsize(abs_path),
            sha256=sha,
            captured_at=captured_at,
            camera_make=parsed_exif.get("camera_make"),
            camera_model=parsed_exif.get("camera_model"),
            lens_model=parsed_exif.get("lens_model"),
            focal_length_mm=parsed_exif.get("focal_length_mm"),
            aperture=parsed_exif.get("aperture"),
            shutter_speed=parsed_exif.get("shutter_speed"),
            iso=parsed_exif.get("iso"),
            exif_raw=raw_exif or None,
            location_id=location_id,
            trip_id=trip_id,
        )
        db.add(photo)

        try:
            await db.flush()  # get the photo.id without committing
        except Exception:
            await db.rollback()
            result.files_skipped += 1
            continue

        result.files_imported += 1

    # Commit all new photos
    await db.commit()

    # Update location photo_count
    if location_id:
        loc = await db.get(Location, location_id)
        if loc:
            loc.photo_count = loc.photo_count + result.files_imported
            await db.commit()

    return result


async def list_directory(path: str) -> list[dict]:
    """Return directory listing for the folder browser."""
    import asyncio

    media_root = settings.MEDIA_ROOT
    target = os.path.join(media_root, path.lstrip("/")) if not os.path.isabs(path) else path

    if not os.path.isdir(target):
        return []

    entries = []
    try:
        for name in sorted(os.listdir(target)):
            full = os.path.join(target, name)
            is_dir = os.path.isdir(full)
            entry = {
                "name": name,
                "path": os.path.relpath(full, media_root).replace("\\", "/"),
                "is_dir": is_dir,
                "child_count": None,
                "file_count": None,
            }
            if is_dir:
                try:
                    children = os.listdir(full)
                    entry["child_count"] = sum(1 for c in children if os.path.isdir(os.path.join(full, c)))
                    entry["file_count"] = sum(
                        1 for c in children
                        if os.path.splitext(c)[1].lower() in ALL_EXTS
                    )
                except PermissionError:
                    pass
            entries.append(entry)
    except PermissionError:
        pass

    return entries
