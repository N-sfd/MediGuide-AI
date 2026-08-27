from __future__ import annotations

import re
from typing import Optional

TEST_NAME_MAP = {
    "hgb": "hemoglobin",
    "hb": "hemoglobin",
    "hemoglobin": "hemoglobin",
    "hemoglobin blood": "hemoglobin",
    "a1c": "hemoglobin_a1c",
    "hba1c": "hemoglobin_a1c",
    "hemoglobin a1c": "hemoglobin_a1c",
    "glycated hemoglobin": "hemoglobin_a1c",
    "glucose": "glucose",
    "blood glucose": "glucose",
    "fasting glucose": "glucose",
    "ldl": "ldl_cholesterol",
    "ldl cholesterol": "ldl_cholesterol",
    "hdl": "hdl_cholesterol",
    "hdl cholesterol": "hdl_cholesterol",
    "cholesterol": "total_cholesterol",
    "total cholesterol": "total_cholesterol",
    "creatinine": "creatinine",
    "serum creatinine": "creatinine",
    "wbc": "wbc",
    "white blood cell": "wbc",
    "white blood cells": "wbc",
    "white blood cell count": "wbc",
    "platelets": "platelets",
    "platelet": "platelets",
    "platelet count": "platelets",
    "plt": "platelets",
}

TRACKED_LAB_CODES = {
    "hemoglobin": "Hemoglobin",
    "hemoglobin_a1c": "Hemoglobin A1C",
    "glucose": "Glucose",
    "ldl_cholesterol": "LDL Cholesterol",
    "hdl_cholesterol": "HDL Cholesterol",
    "total_cholesterol": "Cholesterol",
    "creatinine": "Creatinine",
    "wbc": "WBC",
    "platelets": "Platelets",
}


def normalize_test_name(name: str) -> str:
    normalized = (
        name.lower()
        .replace("-", " ")
        .replace("_", " ")
        .strip()
    )
    normalized = re.sub(r"\s+", " ", normalized)
    return TEST_NAME_MAP.get(normalized, normalized.replace(" ", "_"))


def is_tracked_lab(code_or_name: str) -> bool:
    code = normalize_test_name(code_or_name)
    return code in TRACKED_LAB_CODES


def parse_numeric_value(value: str) -> Optional[float]:
    if not value:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def parse_reference_range(text: str) -> tuple[Optional[float], Optional[float]]:
    if not text:
        return None, None
    cleaned = text.replace(",", " ")
    match = re.search(
        r"(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)",
        cleaned,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None
    try:
        return float(match.group(1)), float(match.group(2))
    except ValueError:
        return None, None
