from pydantic import BaseModel


class SpeciesOut(BaseModel):
    id: int
    common_name: str
    scientific_name: str | None
    family: str | None
    order_name: str | None
    notes: str | None
    photo_count: int
    cover_photo_id: int | None

    model_config = {"from_attributes": True}


class SpeciesCreate(BaseModel):
    common_name: str
    scientific_name: str | None = None
    family: str | None = None
    order_name: str | None = None
    notes: str | None = None


class SpeciesUpdate(BaseModel):
    common_name: str | None = None
    scientific_name: str | None = None
    family: str | None = None
    order_name: str | None = None
    notes: str | None = None
    cover_photo_id: int | None = None
