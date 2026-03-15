"""Extract EXIF metadata from JPEG and RAW files."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from fractions import Fraction
from typing import Any


def extract_jpeg_exif(path: str) -> dict[str, Any]:
    """Extract EXIF data from a JPEG file using Pillow."""
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        with Image.open(path) as img:
            raw_exif = img._getexif()  # type: ignore[attr-defined]
            if not raw_exif:
                return {}
            return {TAGS.get(k, k): v for k, v in raw_exif.items()}
    except Exception:
        return {}


def extract_raw_exif(path: str) -> dict[str, Any]:
    """Extract full EXIF from a RAW file via the embedded JPEG thumbnail."""
    try:
        import io

        import rawpy
        from PIL import Image
        from PIL.ExifTags import TAGS

        with rawpy.imread(path) as raw:
            try:
                thumb = raw.extract_thumb()
                if thumb.format == rawpy.ThumbFormat.JPEG:
                    img = Image.open(io.BytesIO(thumb.data))
                    raw_exif = img._getexif()  # type: ignore[attr-defined]
                    if raw_exif:
                        return {TAGS.get(k, k): v for k, v in raw_exif.items()}
            except Exception:
                pass
    except Exception:
        pass
    return {}


def parse_exif(raw_exif: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw EXIF dict to clean scalar values for DB columns."""
    result: dict[str, Any] = {}

    # DateTime
    for date_key in ("DateTimeOriginal", "DateTime", "DateTimeDigitized"):
        if date_key in raw_exif:
            try:
                dt = datetime.strptime(str(raw_exif[date_key]), "%Y:%m:%d %H:%M:%S")
                result["captured_at"] = dt.replace(tzinfo=timezone.utc)
                break
            except ValueError:
                pass

    # Camera
    result["camera_make"] = _str(raw_exif.get("Make"))
    result["camera_model"] = _str(raw_exif.get("Model"))
    result["lens_model"] = _str(raw_exif.get("LensModel")) or _str(raw_exif.get("Lens"))

    # Focal length
    fl = raw_exif.get("FocalLength")
    if fl is not None:
        result["focal_length_mm"] = float(Fraction(fl)) if hasattr(fl, "numerator") else float(fl)

    # Aperture (FNumber)
    fn = raw_exif.get("FNumber")
    if fn is not None:
        result["aperture"] = float(Fraction(fn)) if hasattr(fn, "numerator") else float(fn)

    # Shutter speed
    exp = raw_exif.get("ExposureTime")
    if exp is not None:
        frac = Fraction(exp) if hasattr(exp, "numerator") else Fraction(exp).limit_denominator(10000)
        result["shutter_speed"] = str(frac)

    # ISO
    iso = raw_exif.get("ISOSpeedRatings") or raw_exif.get("PhotographicSensitivity")
    if iso is not None:
        result["iso"] = int(iso)

    return result


def _str(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def extract_from_file(path: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Returns (parsed_fields, raw_exif_dict).
    parsed_fields: ready to set on Photo model columns.
    raw_exif_dict: serialisable dict for JSONB storage.
    """
    ext = os.path.splitext(path)[1].lower()

    if ext in {".jpg", ".jpeg"}:
        raw = extract_jpeg_exif(path)
    else:
        raw = extract_raw_exif(path)

    # Make raw JSON-serialisable (Pillow returns IFDRational objects etc.)
    safe_raw = {}
    for k, v in raw.items():
        try:
            import json
            json.dumps({str(k): v})
            safe_raw[str(k)] = v
        except (TypeError, ValueError):
            safe_raw[str(k)] = str(v)

    return parse_exif(raw), safe_raw
