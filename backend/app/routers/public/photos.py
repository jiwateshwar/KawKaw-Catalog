from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.photo import Photo, PhotoSpecies
from app.models.species import Species
from app.schemas.photo import PhotoOut, PhotoPage

router = APIRouter(prefix="/api/photos", tags=["public-photos"])


def _photo_to_out(photo: Photo, *, has_album: bool = False) -> PhotoOut:
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
