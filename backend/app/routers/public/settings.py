from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models.settings import AppSettings

router = APIRouter(prefix="/api/settings", tags=["public-settings"])


class PublicSettingsOut(BaseModel):
    app_title: str
    app_description: str | None


@router.get("", response_model=PublicSettingsOut)
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(AppSettings).limit(1))
    if row is None:
        return PublicSettingsOut(app_title="KawKaw Catalog", app_description=None)
    return PublicSettingsOut(app_title=row.app_title, app_description=row.app_description)
