from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models.location import Location
from app.schemas.location import LocationOut

router = APIRouter(prefix="/api/locations", tags=["public-locations"])


@router.get("", response_model=list[LocationOut])
async def list_locations(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(Location).order_by(Location.photo_count.desc(), Location.name))
    ).scalars().all()
    return rows
