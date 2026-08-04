import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ImageScopeResult:
    allowed: bool
    reason: str | None = None


PROHIBITED_IMAGE_REQUESTS = {
    "radiology diagnosis": (
        r"\b("
        r"x[- ]?ray|ct scan|mri|ultrasound|radiograph"
        r")\b.*\b("
        r"diagnose|normal|abnormal|cancer|fracture|tumor"
        r")\b"
    ),
    "skin diagnosis": (
        r"\b("
        r"skin lesion|rash|mole|wound"
        r")\b.*\b("
        r"diagnose|cancer|infected|malignant"
        r")\b"
    ),
    "clinical confirmation": (
        r"\b(confirm my diagnosis|tell me what disease)\b"
        r"|\bis (?:this|it)\b.*\b(cancer|normal|abnormal)\b"
    ),
}


def check_image_request(
    question: str,
) -> ImageScopeResult:
    normalized = " ".join(
        (question or "").lower().split()
    )

    for label, pattern in PROHIBITED_IMAGE_REQUESTS.items():
        if re.search(pattern, normalized):
            return ImageScopeResult(
                allowed=False,
                reason=(
                    "This prototype cannot provide clinical image diagnosis "
                    f"or determine whether an image is medically normal or "
                    f"abnormal. Blocked category: {label}."
                ),
            )

    return ImageScopeResult(allowed=True)