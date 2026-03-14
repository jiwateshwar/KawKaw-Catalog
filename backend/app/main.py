from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base  # noqa: F401 — ensure models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure the AppSettings row exists so /api/setup/status always works
    await _ensure_settings_row()
    yield


async def _ensure_settings_row():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.settings import AppSettings

    async with AsyncSessionLocal() as db:
        row = await db.scalar(select(AppSettings).limit(1))
        if row is None:
            db.add(AppSettings())
            await db.commit()


app = FastAPI(title="KawKaw Catalog API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup wizard (must be first — no auth required)
from app.routers.setup import router as setup_router
app.include_router(setup_router)

# Auth
from app.routers.auth import router as auth_router
app.include_router(auth_router)

# Public
from app.routers.public.photos import router as pub_photos
from app.routers.public.species import router as pub_species
from app.routers.public.albums import router as pub_albums
from app.routers.public.trips import router as pub_trips
from app.routers.public.locations import router as pub_locations
app.include_router(pub_photos)
app.include_router(pub_species)
app.include_router(pub_albums)
app.include_router(pub_trips)
app.include_router(pub_locations)

# Admin
from app.routers.admin.photos import router as adm_photos
from app.routers.admin.species import router as adm_species
from app.routers.admin.albums import router as adm_albums
from app.routers.admin.trips import router as adm_trips
from app.routers.admin.locations import router as adm_locations
from app.routers.admin.scans import router as adm_scans
app.include_router(adm_photos)
app.include_router(adm_species)
app.include_router(adm_albums)
app.include_router(adm_trips)
app.include_router(adm_locations)
app.include_router(adm_scans)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
