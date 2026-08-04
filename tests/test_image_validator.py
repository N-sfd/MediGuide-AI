from pathlib import Path

from PIL import Image

from src.image_validator import validate_image_file


def create_test_image(
    tmp_path: Path,
    filename: str = "sample.png",
) -> Path:
    path = tmp_path / filename

    image = Image.new(
        "RGB",
        (200, 100),
        "white",
    )

    image.save(path)

    return path


def test_missing_image_is_rejected() -> None:
    result = validate_image_file(None)

    assert result.valid is False
    assert "Upload an image" in (
        result.error or ""
    )


def test_valid_png_is_accepted(
    tmp_path: Path,
) -> None:
    path = create_test_image(tmp_path)

    result = validate_image_file(
        str(path)
    )

    assert result.valid is True
    assert result.width == 200
    assert result.height == 100


def test_unsupported_extension_is_rejected(
    tmp_path: Path,
) -> None:
    path = tmp_path / "sample.txt"
    path.write_text("not an image")

    result = validate_image_file(
        str(path)
    )

    assert result.valid is False
    assert "Unsupported image format" in (
        result.error or ""
    )


def test_invalid_image_is_rejected(
    tmp_path: Path,
) -> None:
    path = tmp_path / "broken.png"
    path.write_bytes(b"not really an image")

    result = validate_image_file(
        str(path)
    )

    assert result.valid is False
