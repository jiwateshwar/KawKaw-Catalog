from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.album import Album
from app.models.photo import AlbumPhoto, Photo, PhotoSpecies
from app.models.trip import Trip
from app.routers.public.photos import _photo_to_out
from app.schemas.photo import PhotoPage
from app.schemas.trip import TripOut

router = APIRouter(prefix="/api/trips", tags=["public-trips"])


@router.get("", response_model=list[TripOut])
async def list_trips(
    limit: int = Query(20, le=100),
    cursor: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Trip)
        .where(Trip.is_published == True)  # noqa: E712
        .order_by(Trip.start_date.desc(), Trip.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        q = q.where(Trip.id < cursor)
    rows = (await db.execute(q)).scalars().all()
    trips = rows[:limit]

    if not trips:
        return []

    # Fetch up to 5 preview photo URLs per trip via their albums
    trip_ids = [t.id for t in trips]
    preview_rows = (
        await db.execute(
            select(Album.trip_id, Photo.thumb_sm_path)
            .join(AlbumPhoto, AlbumPhoto.album_id == Album.id)
            .join(Photo, Photo.id == AlbumPhoto.photo_id)
            .where(
                Album.trip_id.in_(trip_ids),
                Photo.is_published == True,  # noqa: E712
                Photo.thumb_sm_path.isnot(None),
            )
            .order_by(Album.trip_id, AlbumPhoto.sort_order, AlbumPhoto.photo_id)
        )
    ).all()

    previews: dict[int, list[str]] = {}
    for trip_id_val, thumb_path in preview_rows:
        if trip_id_val not in previews:
            previews[trip_id_val] = []
        if len(previews[trip_id_val]) < 5 and thumb_path:
            previews[trip_id_val].append(thumb_path)

    result = []
    for t in trips:
        data = {c.name: getattr(t, c.name) for c in Trip.__table__.columns}
        data["preview_photos"] = previews.get(t.id, [])
        result.append(data)
    return result


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(trip_id: int, db: AsyncSession = Depends(get_db)):
    trip = await db.scalar(select(Trip).where(Trip.id == trip_id, Trip.is_published == True))  # noqa: E712
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("/{trip_id}/photos", response_model=PhotoPage)
async def trip_photos(
    trip_id: int,
    cursor: int | None = None,
    limit: int = Query(24, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Join via albums → album_photos → photos so this works even when
    # Photo.trip_id is not set (the scan flow sets Album.trip_id, not Photo.trip_id)
    q = (
        select(Photo)
        .join(AlbumPhoto, AlbumPhoto.photo_id == Photo.id)
        .join(Album, Album.id == AlbumPhoto.album_id)
        .where(Album.trip_id == trip_id, Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.captured_at.asc(), Photo.id.asc())
        .limit(limit + 1)
        .distinct()
    )
    if cursor:
        q = q.where(Photo.id > cursor)

    rows = (await db.execute(q)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    return PhotoPage(items=items, next_cursor=items[-1].id if has_more else None)
