from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.album import Album
from app.models.photo import AlbumPhoto, Photo, PhotoSpecies
from app.routers.public.photos import _photo_to_out
from app.schemas.album import AlbumOut
from app.schemas.photo import PhotoPage

router = APIRouter(prefix="/api/albums", tags=["public-albums"])


@router.get("", response_model=list[AlbumOut])
async def list_albums(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Album).where(Album.is_published == True).order_by(Album.sort_order))).scalars().all()  # noqa: E712
    return rows


@router.get("/{slug}", response_model=AlbumOut)
async def get_album(slug: str, db: AsyncSession = Depends(get_db)):
    album = await db.scalar(select(Album).where(Album.slug == slug, Album.is_published == True))  # noqa: E712
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


@router.get("/{slug}/photos", response_model=PhotoPage)
async def album_photos(
    slug: str,
    cursor: int | None = None,
    limit: int = Query(24, le=100),
    db: AsyncSession = Depends(get_db),
):
    album = await db.scalar(select(Album).where(Album.slug == slug, Album.is_published == True))  # noqa: E712
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    q = (
        select(Photo)
        .join(AlbumPhoto, AlbumPhoto.photo_id == Photo.id)
        .where(AlbumPhoto.album_id == album.id, Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(AlbumPhoto.sort_order, Photo.id)
        .limit(limit + 1)
    )
    if cursor:
        q = q.where(Photo.id > cursor)

    rows = (await db.execute(q)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    return PhotoPage(items=items, next_cursor=items[-1].id if has_more else None)
