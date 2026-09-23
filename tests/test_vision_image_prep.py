from __future__ import annotations

from pathlib import Path

from PIL import Image

from src.image_validator import prepare_vision_image


def test_prepare_vision_image_downscales_long_edge(tmp_path: Path):
    source = tmp_path / "page.png"
    Image.new("RGB", (2400, 1800), color=(255, 255, 255)).save(source)

    vision = prepare_vision_image(source, tmp_path / "page-vision.png", max_edge=1024)

    with Image.open(vision) as image:
        assert max(image.size) == 1024
        assert image.size == (1024, 768)


def test_prepare_vision_image_leaves_small_images_alone(tmp_path: Path):
    source = tmp_path / "small.png"
    Image.new("RGB", (800, 600), color=(240, 240, 240)).save(source)

    vision = prepare_vision_image(source, tmp_path / "small-vision.png", max_edge=1024)

    with Image.open(vision) as image:
        assert image.size == (800, 600)
