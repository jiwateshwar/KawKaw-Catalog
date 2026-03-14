from datetime import datetime

from pydantic import BaseModel


class ScanRequest(BaseModel):
    path: str
    location_id: int | None = None
    location_name: str | None = None   # create a new location if location_id is not provided
    shoot_date: str | None = None      # YYYY-MM-DD
    create_trip: bool = False
    trip_name: str | None = None


class ScanJobOut(BaseModel):
    id: int
    started_at: datetime
    finished_at: datetime | None
    status: str
    root_path: str | None
    location_id: int | None
    trip_id: int | None
    shoot_date: str | None
    files_found: int
    files_imported: int
    files_skipped: int
    error_message: str | None

    model_config = {"from_attributes": True}


class DirectoryEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    child_count: int | None = None   # number of subdirs (for dirs)
    file_count: int | None = None    # media files directly in this dir
    photo_count: int = 0             # photos in DB within this folder (recursive)
    published_count: int = 0         # published photos in DB within this folder


class ThumbnailStatus(BaseModel):
    pending: int
    processing: int
    done: int
    error: int
