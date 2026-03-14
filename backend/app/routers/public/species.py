from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.photo import Photo, PhotoSpecies
from app.models.species import Species
from app.routers.public.photos import _photo_to_out
from app.schemas.photo import PhotoPage
from app.schemas.species import SpeciesOut

router = APIRouter(prefix="/api/species", tags=["public-species"])


@router.get("", response_model=list[SpeciesOut])
async def list_species(
    q: str | None = Query(None),
    limit: int = Query(50, le=200),
    cursor: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Species).order_by(Species.photo_count.desc(), Species.common_name).limit(limit)
    if q:
        stmt = stmt.where(Species.common_name.ilike(f"%{q}%"))
    if cursor:
        stmt = stmt.where(Species.id > cursor)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.get("/{species_id}", response_model=SpeciesOut)
async def get_species(species_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    sp = await db.get(Species, species_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Species not found")
    return sp


@router.get("/{species_id}/photos", response_model=PhotoPage)
async def species_photos(
    species_id: int,
    cursor: int | None = None,
    limit: int = Query(24, le=100),
    db: AsyncSession = Depends(get_db),
):
    q_stmt = (
        select(Photo)
        .join(PhotoSpecies, PhotoSpecies.photo_id == Photo.id)
        .where(PhotoSpecies.species_id == species_id, Photo.is_published == True)  # noqa: E712
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.published_at.desc(), Photo.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        q_stmt = q_stmt.where(Photo.id < cursor)

    rows = (await db.execute(q_stmt)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    return PhotoPage(items=items, next_cursor=items[-1].id if has_more else None)
