"""
Celery task: run a folder scan.
Called from the admin API or Celery Beat (scheduled_scan).
"""
from __future__ import annotations

from app.config import settings
from app.worker import celery_app


@celery_app.task
def run_scan(job_id: int) -> None:
    """Execute a scan job that was already created in the DB."""
    import asyncio

    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from datetime import datetime, timezone

    from app.models.scan import ScanJob
    from app.services.scanner import scan_folder
    from app.tasks.thumbnails import generate_thumbnails

    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _run():
        async with Session() as db:
            job = await db.get(ScanJob, job_id)
            if not job:
                return

            try:
                result = await scan_folder(
                    db=db,
                    job=job,
                    root=job.root_path,
                    location_id=job.location_id,
                    trip_id=job.trip_id,
                    shoot_date=job.shoot_date,
                )
                job.files_found = result.files_found
                job.files_imported = result.files_imported
                job.files_skipped = result.files_skipped
                job.status = "done" if not result.error else "error"
                job.error_message = result.error
            except Exception as exc:
                job.status = "error"
                job.error_message = str(exc)
            finally:
                job.finished_at = datetime.now(timezone.utc)
                await db.commit()

            # Enqueue thumbnail generation for newly imported photos
            if job.status == "done" and job.files_imported > 0:
                from sqlalchemy import select
                from app.models.photo import Photo

                q = select(Photo.id).where(
                    Photo.thumb_status == "pending",
                    Photo.location_id == job.location_id if job.location_id else True,
                )
                rows = (await db.execute(q)).scalars().all()
                for photo_id in rows:
                    generate_thumbnails.delay(photo_id)

    asyncio.run(_run())


@celery_app.task
def scheduled_scan() -> None:
    """Nightly scheduled scan of the full MEDIA_ROOT."""
    import asyncio
    from datetime import datetime, timezone

    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    from app.models.scan import ScanJob

    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _create_job():
        async with Session() as db:
            job = ScanJob(root_path=settings.MEDIA_ROOT)
            db.add(job)
            await db.commit()
            await db.refresh(job)
            return job.id

    job_id = asyncio.run(_create_job())
    run_scan.delay(job_id)
