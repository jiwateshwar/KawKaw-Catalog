from datetime import datetime

from pydantic import BaseModel


class SpeciesTag(BaseModel):
    id: int
    common_name: str
    scientific_name: str | None

    model_config = {"from_attributes": True}


class PhotoOut(BaseModel):
    id: int
    filename: str
    file_type: str
    thumb_sm_url: str | None
    thumb_md_url: str | None
    thumb_lg_url: str | None
    thumb_status: str
    width: int | None
    height: int | None
    crop_x: float | None
    crop_y: float | None
    crop_w: float | None
    crop_h: float | None
    captured_at: datetime | None
    camera_make: str | None
    camera_model: str | None
    lens_model: str | None
    focal_length_mm: float | None
    aperture: float | None
    shutter_speed: str | None
    iso: int | None
    title: str | None
    caption: str | None
    is_published: bool
    is_featured: bool
    published_at: datetime | None
    location_id: int | None
    trip_id: int | None
    imported_at: datetime
    species: list[SpeciesTag] = []

    model_config = {"from_attributes": True}


class PhotoUpdate(BaseModel):
    title: str | None = None
    caption: str | None = None
    is_published: bool | None = None
    is_featured: bool | None = None
    location_id: int | None = None
    trip_id: int | None = None


class BulkPublishRequest(BaseModel):
    photo_ids: list[int]
    is_published: bool


class PhotoSpeciesUpdate(BaseModel):
    species_ids: list[int]


class PhotoPage(BaseModel):
    items: list[PhotoOut]
    next_cursor: int | None
    total: int | None = None


class CropUpdate(BaseModel):
    crop_x: float
    crop_y: float
    crop_w: float
    crop_h: float


class BulkFolderUpdate(BaseModel):
    folder_path: str
    location_id: int | None = None        # use existing location
    location_name: str | None = None      # create new location with this name
    location_lat: float | None = None
    location_lng: float | None = None
    location_country: str | None = None
    shoot_date: str | None = None         # YYYY-MM-DD; overwrites captured_at for all photos
