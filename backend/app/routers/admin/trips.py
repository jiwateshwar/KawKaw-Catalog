from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripCreate, TripOut, TripUpdate

router = APIRouter(prefix="/api/admin/trips", tags=["admin-trips"])


@router.get("", response_model=list[TripOut])
async def list_trips(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (await db.execute(select(Trip).order_by(Trip.start_date.desc(), Trip.id.desc()))).scalars().all()
    return rows


@router.post("", response_model=TripOut, status_code=201)
async def create_trip(body: TripCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    trip = Trip(**body.model_dump())
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


@router.patch("/{trip_id}", response_model=TripOut)
async def update_trip(
    trip_id: int,
    body: TripUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(trip, field, value)
    await db.commit()
    await db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    await db.delete(trip)
    await db.commit()
