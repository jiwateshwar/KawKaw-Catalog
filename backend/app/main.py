from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base  # noqa: F401 — ensure models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed admin user on first run
    await _seed_admin()
    yield


async def _seed_admin():
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.config import settings
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from app.services.auth import hash_password

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).limit(1))
        if not existing:
            admin = User(
                username=settings.ADMIN_USERNAME,
                hashed_pw=hash_password(settings.ADMIN_PASSWORD),
            )
            db.add(admin)
            await db.commit()


app = FastAPI(title="KawKaw Catalog API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
