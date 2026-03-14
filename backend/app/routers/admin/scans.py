import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.models.location import Location
from app.models.photo import Photo
from app.models.scan import ScanJob
from app.models.trip import Trip
from app.models.user import User
from app.schemas.scan import DirectoryEntry, ScanJobOut, ScanRequest, ThumbnailStatus
from app.services.scanner import list_directory

async def _enrich_entries(entries: list[dict], db: AsyncSession) -> list[dict]:
    """Add photo_count and published_count from DB for each directory entry."""
    for entry in entries:
        if not entry["is_dir"]:
            continue
        prefix = entry["path"].rstrip("/") + "/"
        row = (
            await db.execute(
                select(
                    func.count(Photo.id).label("total"),
                    func.count(Photo.id).filter(Photo.is_published == True).label("published"),
                ).where(Photo.relative_path.like(prefix + "%"))
            )
        ).one()
        entry["photo_count"] = row.total or 0
        entry["published_count"] = row.published or 0
    return entries

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
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    entries = await list_directory(path)
    entries = await _enrich_entries(entries, db)
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


@router.get("/geocode")
async def geocode_search(
    q: str = Query(min_length=2),
    _: User = Depends(get_current_user),
):
    """Proxy to Nominatim (OpenStreetMap) for location autocomplete with lat/lng."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 6, "addressdetails": 1},
            headers={"User-Agent": "KawKawCatalog/1.0"},
        )
    if resp.status_code != 200:
        return []
    results = resp.json()
    return [
        {
            "display_name": r["display_name"],
            "name": (r.get("name") or r["display_name"].split(",")[0]).strip(),
            "lat": float(r["lat"]),
            "lng": float(r["lon"]),
            "country": r.get("address", {}).get("country"),
        }
        for r in results
    ]


@router.get("/ebird")
async def ebird_nearby(
    lat: float,
    lng: float,
    dist: int = Query(50, le=200),
    _: User = Depends(get_current_user),
):
    """
    Proxy to eBird API v2 — returns deduplicated species observed within `dist` km
    of the given coordinates in the last 30 days.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.ebird.org/v2/data/obs/geo/recent",
            params={"lat": lat, "lng": lng, "dist": dist, "back": 30, "maxResults": 1000},
            headers={"X-eBirdApiToken": settings.EBIRD_API_KEY},
        )
    if resp.status_code != 200:
        return []
    seen: dict[str, dict] = {}
    for obs in resp.json():
        code = obs.get("speciesCode")
        if code and code not in seen:
            seen[code] = {
                "species_code": code,
                "common_name": obs.get("comName", ""),
                "scientific_name": obs.get("sciName", ""),
            }
    return sorted(seen.values(), key=lambda x: x["common_name"])
