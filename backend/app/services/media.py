"""
Media processing: convert RAW / JPEG / video to Pillow Image for thumbnail generation.

Fast-path for RAW: extract embedded JPEG (all modern cameras include one).
Fallback: full LibRaw decode with half_size=True for speed.
"""
from __future__ import annotations

import io
import os
import tempfile

from PIL import Image, ImageOps


def raw_to_pil(path: str) -> Image.Image:
    import rawpy

    with rawpy.imread(path) as raw:
        # Fast path: use the embedded JPEG (~1s vs ~15s for full decode)
        try:
            thumb = raw.extract_thumb()
            if thumb.format == rawpy.ThumbFormat.JPEG:
                img = Image.open(io.BytesIO(thumb.data))
                img.load()
                return ImageOps.exif_transpose(img)
        except rawpy.LibRawNoThumbnailError:
            pass

        # Slow fallback: full RAW decode
        rgb = raw.postprocess(
            use_camera_wb=True,
            output_color=rawpy.ColorSpace.sRGB,
            output_bps=8,
            half_size=True,
        )

    return Image.fromarray(rgb)


def jpeg_to_pil(path: str) -> Image.Image:
    img = Image.open(path)
    img.load()
    return ImageOps.exif_transpose(img)


def video_to_pil(path: str) -> Image.Image:
    """Extract a frame at 1 second from the video."""
    import ffmpeg

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        (
            ffmpeg.input(path, ss=1)
            .output(tmp_path, vframes=1, format="image2", vcodec="mjpeg")
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        img = Image.open(tmp_path)
        img.load()
        return img
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def file_to_pil(path: str, file_type: str) -> Image.Image:
    """Dispatch to the correct loader based on file_type."""
    if file_type == "raw":
        return raw_to_pil(path)
    elif file_type == "jpeg":
        return jpeg_to_pil(path)
    elif file_type == "video":
        return video_to_pil(path)
    else:
        raise ValueError(f"Unknown file_type: {file_type}")


def make_thumbnail(img: Image.Image, max_width: int) -> Image.Image:
    """Resize image to max_width, preserving aspect ratio. Converts to RGB."""
    img = img.convert("RGB")
    w, h = img.size
    if w > max_width:
        ratio = max_width / w
        new_size = (max_width, int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    return img


def save_webp(img: Image.Image, path: str, quality: int = 85) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, format="WEBP", quality=quality, method=4)
