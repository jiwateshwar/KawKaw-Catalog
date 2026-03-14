from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.photo import Photo, PhotoSpecies
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
    q = select(Trip).where(Trip.is_published == True).order_by(Trip.start_date.desc(), Trip.id.desc()).limit(limit + 1)  # noqa: E712
    if cursor:
        q = q.where(Trip.id < cursor)
    rows = (await db.execute(q)).scalars().all()
    return rows[:limit]


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
    q = (
        select(Photo)
        .where(Photo.trip_id == trip_id, Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.captured_at.asc(), Photo.id.asc())
        .limit(limit + 1)
    )
    if cursor:
        q = q.where(Photo.id > cursor)

    rows = (await db.execute(q)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    return PhotoPage(items=items, next_cursor=items[-1].id if has_more else None)
