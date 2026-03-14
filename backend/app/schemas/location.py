from pydantic import BaseModel


class LocationOut(BaseModel):
    id: int
    name: str
    country: str | None
    region: str | None
    latitude: float | None
    longitude: float | None
    photo_count: int

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    name: str
    country: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None
