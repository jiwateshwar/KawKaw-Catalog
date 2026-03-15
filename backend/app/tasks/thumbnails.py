"""
Celery task: generate WebP thumbnails for a photo.

Three sizes:
  sm → 400px wide  (grid cards)
  md → 1200px wide (detail page)
  lg → 2400px wide (lightbox)
"""
from __future__ import annotations

import os
import time

from app.config import settings
from app.worker import celery_app

SIZES = {
    "sm": 400,
    "md": 1200,
    "lg": 2400,
}


def _thumb_paths(sha256: str) -> dict[str, str]:
    shard = f"{sha256[:2]}/{sha256[2:4]}"
    base = os.path.join(settings.THUMBS_ROOT, shard)
    return {
        "sm": os.path.join(base, f"{sha256}_sm.webp"),
        "md": os.path.join(base, f"{sha256}_md.webp"),
        "lg": os.path.join(base, f"{sha256}_lg.webp"),
    }


def _thumb_urls(sha256: str) -> dict[str, str]:
    shard = f"{sha256[:2]}/{sha256[2:4]}"
    base = f"{settings.THUMBS_URL_PREFIX}/{shard}"
    return {
        "sm": f"{base}/{sha256}_sm.webp",
        "md": f"{base}/{sha256}_md.webp",
        "lg": f"{base}/{sha256}_lg.webp",
    }


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_thumbnails(self, photo_id: int) -> None:
    """Generate sm/md/lg WebP thumbnails for a photo."""
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    from app.models.photo import Photo
    from app.services.media import file_to_pil, make_thumbnail, save_webp

    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _run():
        async with Session() as db:
            photo = await db.get(Photo, photo_id)
            if not photo:
                return

            photo.thumb_status = "processing"
            await db.commit()

            abs_path = os.path.join(settings.MEDIA_ROOT, photo.relative_path)

            if not os.path.exists(abs_path):
                photo.thumb_status = "error"
                await db.commit()
                return

            try:
                img = file_to_pil(abs_path, photo.file_type)

                # Apply crop if stored (coordinates are 0–1 fractions of original size)
                if photo.crop_x is not None:
                    iw, ih = img.size
                    left   = int(float(photo.crop_x) * iw)
                    top    = int(float(photo.crop_y) * ih)
                    right  = int((float(photo.crop_x) + float(photo.crop_w)) * iw)
                    bottom = int((float(photo.crop_y) + float(photo.crop_h)) * ih)
                    img = img.crop((left, top, right, bottom))

                # Store dimensions (after EXIF rotation + crop) for layout detection
                photo.width, photo.height = img.size

                # Use SHA256 for thumbnail path; fall back to photo id
                sha = photo.sha256 or f"id{photo_id:016x}"
                paths = _thumb_paths(sha)
                urls = _thumb_urls(sha)

                for size_name, max_width in SIZES.items():
                    thumb = make_thumbnail(img, max_width)
                    save_webp(thumb, paths[size_name])

                # Append a cache-busting version so browsers don't serve stale
                # thumbnails after a crop regeneration (nginx ignores query params
                # when serving static files, but the browser sees a new URL).
                v = int(time.time())
                photo.thumb_sm_path = f"{urls['sm']}?v={v}"
                photo.thumb_md_path = f"{urls['md']}?v={v}"
                photo.thumb_lg_path = f"{urls['lg']}?v={v}"
                photo.thumb_status = "done"

            except Exception as exc:
                photo.thumb_status = "error"
                await db.commit()
                raise self.retry(exc=exc)

            await db.commit()

    asyncio.run(_run())
    asyncio.get_event_loop().close() if asyncio.get_event_loop().is_closed() else None
