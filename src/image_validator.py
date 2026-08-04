from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from src.config import (
    MAX_IMAGE_HEIGHT,
    MAX_IMAGE_MB,
    MAX_IMAGE_WIDTH,
)


SUPPORTED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


@dataclass(frozen=True)
class ImageValidationResult:
    valid: bool
    path: Path | None = None
    error: str | None = None
    width: int | None = None
    height: int | None = None
    format: str | None = None


def validate_image_file(
    image_path: str | None,
) -> ImageValidationResult:
    if not image_path:
        return ImageValidationResult(
            valid=False,
            error="Upload an image before analysis.",
        )

    path = Path(image_path)

    if not path.exists() or not path.is_file():
        return ImageValidationResult(
            valid=False,
            error="The uploaded image could not be found.",
        )

    extension = path.suffix.lower()

    if extension not in SUPPORTED_IMAGE_EXTENSIONS:
        supported = ", ".join(
            sorted(SUPPORTED_IMAGE_EXTENSIONS)
        )

        return ImageValidationResult(
            valid=False,
            error=(
                f"Unsupported image format `{extension or 'unknown'}`. "
                f"Supported formats: {supported}."
            ),
        )

    size_mb = path.stat().st_size / (1024 * 1024)

    if size_mb > MAX_IMAGE_MB:
        return ImageValidationResult(
            valid=False,
            error=(
                f"The image is {size_mb:.1f} MB. "
                f"The maximum size is {MAX_IMAGE_MB} MB."
            ),
        )

    if path.stat().st_size == 0:
        return ImageValidationResult(
            valid=False,
            error="The uploaded image is empty.",
        )

    try:
        with Image.open(path) as image:
            image.verify()

        with Image.open(path) as image:
            width, height = image.size
            image_format = image.format

    except UnidentifiedImageError:
        return ImageValidationResult(
            valid=False,
            error="The uploaded file is not a valid image.",
        )

    except OSError as error:
        return ImageValidationResult(
            valid=False,
            error=f"The image could not be opened: {error}",
        )

    if width > MAX_IMAGE_WIDTH or height > MAX_IMAGE_HEIGHT:
        return ImageValidationResult(
            valid=False,
            error=(
                f"The image dimensions are {width} × {height}. "
                f"The current maximum is "
                f"{MAX_IMAGE_WIDTH} × {MAX_IMAGE_HEIGHT}."
            ),
        )

    return ImageValidationResult(
        valid=True,
        path=path,
        width=width,
        height=height,
        format=image_format,
    )