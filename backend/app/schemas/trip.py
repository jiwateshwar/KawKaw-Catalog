from datetime import date, datetime

from pydantic import BaseModel


class TripOut(BaseModel):
    id: int
    title: str
    description: str | None
    start_date: date | None
    end_date: date | None
    location_id: int | None
    cover_photo_id: int | None
    is_published: bool
    created_at: datetime
    preview_photos: list[str] = []

    model_config = {"from_attributes": True}


class TripCreate(BaseModel):
    title: str
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    location_id: int | None = None
    is_published: bool = False


class TripUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    location_id: int | None = None
    cover_photo_id: int | None = None
    is_published: bool | None = None
