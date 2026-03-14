from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.album import Album
from app.models.photo import AlbumPhoto
from app.models.user import User
from app.schemas.album import AlbumCreate, AlbumOut, AlbumPhotosAdd, AlbumPhotosReorder, AlbumUpdate

router = APIRouter(prefix="/api/admin/albums", tags=["admin-albums"])


@router.get("", response_model=list[AlbumOut])
async def list_albums(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (await db.execute(select(Album).order_by(Album.sort_order, Album.id))).scalars().all()
    return rows


@router.post("", response_model=AlbumOut, status_code=201)
async def create_album(body: AlbumCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    album = Album(**body.model_dump())
    db.add(album)
    await db.commit()
    await db.refresh(album)
    return album


@router.patch("/{album_id}", response_model=AlbumOut)
async def update_album(
    album_id: int,
    body: AlbumUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    album = await db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(album, field, value)
    await db.commit()
    await db.refresh(album)
    return album


@router.delete("/{album_id}", status_code=204)
async def delete_album(album_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    album = await db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    await db.delete(album)
    await db.commit()


@router.post("/{album_id}/photos")
async def add_photos_to_album(
    album_id: int,
    body: AlbumPhotosAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    album = await db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    # Get current max sort_order
    existing = (await db.execute(select(AlbumPhoto).where(AlbumPhoto.album_id == album_id))).scalars().all()
    existing_ids = {ap.photo_id for ap in existing}
    max_order = max((ap.sort_order for ap in existing), default=-1)

    for i, pid in enumerate(body.photo_ids):
        if pid not in existing_ids:
            db.add(AlbumPhoto(album_id=album_id, photo_id=pid, sort_order=max_order + i + 1))

    await db.commit()
    return {"added": len(body.photo_ids)}


@router.delete("/{album_id}/photos/{photo_id}", status_code=204)
async def remove_photo_from_album(
    album_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ap = await db.scalar(
        select(AlbumPhoto).where(AlbumPhoto.album_id == album_id, AlbumPhoto.photo_id == photo_id)
    )
    if ap:
        await db.delete(ap)
        await db.commit()


@router.patch("/{album_id}/photos/order")
async def reorder_album_photos(
    album_id: int,
    body: AlbumPhotosReorder,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    for i, pid in enumerate(body.ordered_photo_ids):
        ap = await db.scalar(
            select(AlbumPhoto).where(AlbumPhoto.album_id == album_id, AlbumPhoto.photo_id == pid)
        )
        if ap:
            ap.sort_order = i
    await db.commit()
    return {"reordered": len(body.ordered_photo_ids)}
