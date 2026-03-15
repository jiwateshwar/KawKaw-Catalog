from datetime import date, datetime

from pydantic import BaseModel


class AlbumOut(BaseModel):
    id: int
    title: str
    description: str | None
    slug: str
    cover_photo_id: int | None
    trip_id: int | None
    location_id: int | None
    shoot_date: date | None
    sort_order: int
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlbumCreate(BaseModel):
    title: str
    description: str | None = None
    slug: str
    trip_id: int | None = None
    location_id: int | None = None
    shoot_date: date | None = None
    is_published: bool = False


class AlbumUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    slug: str | None = None
    cover_photo_id: int | None = None
    trip_id: int | None = None
    location_id: int | None = None
    shoot_date: date | None = None
    sort_order: int | None = None
    is_published: bool | None = None


class AlbumPhotosAdd(BaseModel):
    photo_ids: list[int]


class AlbumPhotosReorder(BaseModel):
    ordered_photo_ids: list[int]
