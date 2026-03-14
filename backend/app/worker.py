from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "kawkaw",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.thumbnails", "app.tasks.scanner"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,  # Fair task distribution for CPU-bound thumbnail work
    # Scheduled tasks
    beat_schedule={
        "nightly-scan": {
            "task": "app.tasks.scanner.scheduled_scan",
            "schedule": crontab(hour=2, minute=0),  # 2am UTC nightly
        },
    },
)

# Alias used by Celery CLI: celery -A app.worker ...
app = celery_app
