from app.database import Base  # noqa: F401

# Import all models so Alembic autogenerate picks them up
from app.models.user import User  # noqa: F401
from app.models.location import Location  # noqa: F401
from app.models.species import Species  # noqa: F401
from app.models.trip import Trip  # noqa: F401
from app.models.album import Album  # noqa: F401
from app.models.photo import Photo, PhotoSpecies, AlbumPhoto  # noqa: F401
from app.models.scan import ScanJob  # noqa: F401
