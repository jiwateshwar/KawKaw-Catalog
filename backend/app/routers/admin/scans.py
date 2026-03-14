from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.location import Location
from app.models.photo import Photo
from app.models.scan import ScanJob
from app.models.trip import Trip
from app.models.user import User
from app.schemas.scan import DirectoryEntry, ScanJobOut, ScanRequest, ThumbnailStatus
from app.services.scanner import list_directory

router = APIRouter(prefix="/api/admin", tags=["admin-scans"])


@router.post("/scans", response_model=ScanJobOut, status_code=201)
async def start_scan(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.config import settings
    import os

    # Resolve location
    location_id = body.location_id
    if not location_id and body.location_name:
        loc = Location(name=body.location_name)
        db.add(loc)
        await db.flush()
        location_id = loc.id

    # Resolve path — must be inside MEDIA_ROOT
    media_root = settings.MEDIA_ROOT
    if os.path.isabs(body.path):
        abs_path = body.path
    else:
        abs_path = os.path.join(media_root, body.path.lstrip("/"))

    # Optionally create a trip
    trip_id = None
    if body.create_trip and body.trip_name:
        from datetime import date
        shoot = None
        if body.shoot_date:
            try:
                shoot = date.fromisoformat(body.shoot_date)
            except ValueError:
                pass
        trip = Trip(
            title=body.trip_name,
            start_date=shoot,
            end_date=shoot,
            location_id=location_id,
        )
        db.add(trip)
        await db.flush()
        trip_id = trip.id

    job = ScanJob(
        root_path=abs_path,
        location_id=location_id,
        trip_id=trip_id,
        shoot_date=body.shoot_date,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Dispatch the Celery task
    from app.tasks.scanner import run_scan
    run_scan.delay(job.id)

    return job


@router.get("/scans", response_model=list[ScanJobOut])
async def list_scans(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        await db.execute(select(ScanJob).order_by(ScanJob.started_at.desc()).limit(limit))
    ).scalars().all()
    return rows


@router.get("/scans/browse", response_model=list[DirectoryEntry])
async def browse_directory(
    path: str = Query(""),
    _: User = Depends(get_current_user),
):
    entries = await list_directory(path)
    return entries


@router.get("/scans/{job_id}", response_model=ScanJobOut)
async def get_scan(job_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    job = await db.get(ScanJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job


@router.get("/thumbnails/status", response_model=ThumbnailStatus)
async def thumbnail_status(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    counts = {}
    for status in ("pending", "processing", "done", "error"):
        count = await db.scalar(
            select(func.count()).select_from(Photo).where(Photo.thumb_status == status)
        )
        counts[status] = count or 0
    return ThumbnailStatus(**counts)


@router.post("/thumbnails/retry-errors", status_code=202)
async def retry_errors(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    from app.tasks.thumbnails import generate_thumbnails

    rows = (
        await db.execute(select(Photo.id).where(Photo.thumb_status == "error"))
    ).scalars().all()

    for photo_id in rows:
        generate_thumbnails.delay(photo_id)

    return {"queued": len(rows)}
