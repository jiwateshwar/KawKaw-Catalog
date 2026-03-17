import asyncio
import os
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.deps import get_db
from app.models.photo import Photo, PhotoSpecies
from app.models.species import Species
from app.schemas.photo import PhotoOut, PhotoPage

router = APIRouter(prefix="/api/photos", tags=["public-photos"])


def _photo_to_out(photo: Photo, *, has_album: bool = False, album_id: int | None = None) -> PhotoOut:
    species = [
        {"id": ps.species.id, "common_name": ps.species.common_name, "scientific_name": ps.species.scientific_name}
        for ps in photo.species_links
        if ps.species
    ]
    return PhotoOut(
        **{c.name: getattr(photo, c.name) for c in Photo.__table__.columns
           if c.name not in {"thumb_sm_path", "thumb_md_path", "thumb_lg_path"}},
        thumb_sm_url=photo.thumb_sm_path,
        thumb_md_url=photo.thumb_md_path,
        thumb_lg_url=photo.thumb_lg_path,
        species=species,
        has_album=has_album,
        album_id=album_id,
    )


@router.get("", response_model=PhotoPage)
async def list_photos(
    cursor: int | None = Query(None),
    limit: int = Query(24, le=100),
    location_id: int | None = None,
    trip_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Photo)
        .where(Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.published_at.desc(), Photo.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        q = q.where(Photo.id < cursor)
    if location_id:
        q = q.where(Photo.location_id == location_id)
    if trip_id:
        q = q.where(Photo.trip_id == trip_id)

    rows = (await db.execute(q)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    next_cursor = items[-1].id if has_more else None

    return PhotoPage(items=items, next_cursor=next_cursor)


@router.get("/featured", response_model=list[PhotoOut])
async def featured_photos(
    limit: int = Query(12, le=50),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Photo)
        .where(Photo.is_published == True, Photo.is_featured == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.published_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return [_photo_to_out(p) for p in rows]


@router.get("/{photo_id}/og-image", response_class=Response)
async def get_og_image(photo_id: int, db: AsyncSession = Depends(get_db)):
    """Return a JPEG version of the medium thumbnail for social-share link previews."""
    photo = await db.scalar(
        select(Photo).where(Photo.id == photo_id, Photo.is_published == True)  # noqa: E712
    )
    if not photo or not photo.thumb_md_path:
        raise HTTPException(status_code=404, detail="No thumbnail")

    # Derive filesystem path from stored URL (strip ?v= cache-buster suffix)
    url_path = photo.thumb_md_path.split("?")[0]
    relative = url_path.removeprefix(settings.THUMBS_URL_PREFIX)
    abs_path = settings.THUMBS_ROOT + relative

    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Thumbnail file not found")

    # Cache the converted JPEG alongside the WebP so repeat fetches skip Pillow entirely
    og_path = abs_path.replace("_md.webp", "_og.jpg")

    def _get_jpeg() -> bytes:
        if os.path.exists(og_path):
            with open(og_path, "rb") as f:
                return f.read()
        from PIL import Image
        img = Image.open(abs_path).convert("RGB")
        buf = BytesIO()
        img.save(buf, "JPEG", quality=85, optimize=True)
        data = buf.getvalue()
        try:
            with open(og_path, "wb") as f:
                f.write(data)
        except OSError:
            pass  # cache write failure is non-fatal
        return data

    jpeg_bytes = await asyncio.to_thread(_get_jpeg)
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(photo_id: int, db: AsyncSession = Depends(get_db)):
    q = (
        select(Photo)
        .where(Photo.id == photo_id, Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
    )
    photo = await db.scalar(q)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return _photo_to_out(photo)


@router.get("/{photo_id}/stream")
async def stream_photo(photo_id: int, db: AsyncSession = Depends(get_db)):
    """Stream a video file for playback in the browser."""
    import mimetypes
    photo = await db.scalar(
        select(Photo).where(Photo.id == photo_id, Photo.is_published == True)  # noqa: E712
    )
    if not photo or photo.file_type != "video":
        raise HTTPException(status_code=404, detail="Not found")
    abs_path = os.path.join(settings.MEDIA_ROOT, photo.relative_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    media_type = mimetypes.guess_type(abs_path)[0] or "video/mp4"
    return FileResponse(
        abs_path,
        media_type=media_type,
        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"},
    )
