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
    rows = (
        await db.execute(
            select(Album)
            .where(Album.is_published == True)  # noqa: E712
            .order_by(Album.sort_order, Album.id.desc())
        )
    ).scalars().all()

    if not rows:
        return []

    # Fetch up to 5 preview photo URLs per album in a single batch query
    album_ids = [a.id for a in rows]
    preview_rows = (
        await db.execute(
            select(AlbumPhoto.album_id, Photo.thumb_sm_path)
            .join(Photo, Photo.id == AlbumPhoto.photo_id)
            .where(
                AlbumPhoto.album_id.in_(album_ids),
                Photo.is_published == True,  # noqa: E712
                Photo.thumb_sm_path.isnot(None),
            )
            .order_by(AlbumPhoto.album_id, AlbumPhoto.sort_order, AlbumPhoto.photo_id)
        )
    ).all()

    previews: dict[int, list[str]] = {}
    for album_id, thumb_path in preview_rows:
        if album_id not in previews:
            previews[album_id] = []
        if len(previews[album_id]) < 5 and thumb_path:
            previews[album_id].append(thumb_path)

    result = []
    for a in rows:
        data = {c.name: getattr(a, c.name) for c in Album.__table__.columns}
        data["preview_photos"] = previews.get(a.id, [])
        result.append(data)
    return result


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
