from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.species import Species
from app.models.user import User
from app.schemas.species import SpeciesCreate, SpeciesOut, SpeciesUpdate

router = APIRouter(prefix="/api/admin/species", tags=["admin-species"])


@router.get("", response_model=list[SpeciesOut])
async def list_species(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (await db.execute(select(Species).order_by(Species.common_name))).scalars().all()
    return rows


@router.post("", response_model=SpeciesOut, status_code=201)
async def create_species(
    body: SpeciesCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sp = Species(**body.model_dump())
    db.add(sp)
    await db.commit()
    await db.refresh(sp)
    return sp


@router.patch("/{species_id}", response_model=SpeciesOut)
async def update_species(
    species_id: int,
    body: SpeciesUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sp = await db.get(Species, species_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Species not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sp, field, value)
    await db.commit()
    await db.refresh(sp)
    return sp


@router.delete("/{species_id}", status_code=204)
async def delete_species(
    species_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sp = await db.get(Species, species_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Species not found")
    await db.delete(sp)
    await db.commit()
