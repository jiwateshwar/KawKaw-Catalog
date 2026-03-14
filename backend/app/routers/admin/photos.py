from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_user, get_db
from app.models.photo import Photo, PhotoSpecies
from app.models.species import Species
from app.models.user import User
from app.routers.public.photos import _photo_to_out
from app.schemas.photo import BulkPublishRequest, PhotoOut, PhotoPage, PhotoSpeciesUpdate, PhotoUpdate

router = APIRouter(prefix="/api/admin/photos", tags=["admin-photos"])


@router.get("", response_model=PhotoPage)
async def list_photos_admin(
    cursor: int | None = None,
    limit: int = Query(50, le=200),
    thumb_status: str | None = None,
    is_published: bool | None = None,
    location_id: int | None = None,
    trip_id: int | None = None,
    folder_path: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        select(Photo)
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
        .order_by(Photo.imported_at.desc(), Photo.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        q = q.where(Photo.id < cursor)
    if thumb_status:
        q = q.where(Photo.thumb_status == thumb_status)
    if is_published is not None:
        q = q.where(Photo.is_published == is_published)
    if location_id:
        q = q.where(Photo.location_id == location_id)
    if trip_id:
        q = q.where(Photo.trip_id == trip_id)
    if folder_path:
        prefix = folder_path.rstrip("/") + "/"
        q = q.where(Photo.relative_path.like(prefix + "%"))

    rows = (await db.execute(q)).scalars().all()
    has_more = len(rows) > limit
    items = [_photo_to_out(p) for p in rows[:limit]]
    return PhotoPage(items=items, next_cursor=items[-1].id if has_more else None)


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo_admin(
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        select(Photo)
        .where(Photo.id == photo_id)
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
    )
    photo = await db.scalar(q)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return _photo_to_out(photo)


@router.patch("/{photo_id}", response_model=PhotoOut)
async def update_photo(
    photo_id: int,
    body: PhotoUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    data = body.model_dump(exclude_unset=True)
    was_published = photo.is_published

    for field, value in data.items():
        setattr(photo, field, value)

    if data.get("is_published") and not was_published:
        photo.published_at = datetime.now(timezone.utc)
    elif data.get("is_published") is False:
        photo.published_at = None

    await db.commit()
    await db.refresh(photo)

    q = (
        select(Photo)
        .where(Photo.id == photo_id)
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
    )
    photo = await db.scalar(q)
    return _photo_to_out(photo)


@router.post("/{photo_id}/species", response_model=PhotoOut)
async def set_photo_species(
    photo_id: int,
    body: PhotoSpeciesUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Replace all species links
    await db.execute(
        PhotoSpecies.__table__.delete().where(PhotoSpecies.photo_id == photo_id)
    )
    for sid in body.species_ids:
        db.add(PhotoSpecies(photo_id=photo_id, species_id=sid))

    await db.commit()

    # Update photo_count on each affected species
    all_affected = set(body.species_ids)
    for sp_id in all_affected:
        sp = await db.get(Species, sp_id)
        if sp:
            count = await db.scalar(
                select(func.count()).select_from(PhotoSpecies).where(PhotoSpecies.species_id == sp_id)
            )
            sp.photo_count = count or 0
    await db.commit()

    q = (
        select(Photo)
        .where(Photo.id == photo_id)
        .options(selectinload(Photo.species_links).selectinload(PhotoSpecies.species))
    )
    photo = await db.scalar(q)
    return _photo_to_out(photo)


@router.post("/bulk-publish")
async def bulk_publish(
    body: BulkPublishRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Photo)
        .where(Photo.id.in_(body.photo_ids))
        .values(
            is_published=body.is_published,
            published_at=now if body.is_published else None,
        )
    )
    await db.commit()
    return {"updated": len(body.photo_ids)}
