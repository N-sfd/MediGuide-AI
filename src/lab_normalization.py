"""Backward-compatible re-exports for lab modules."""

from src.labs.normalization import TEST_NAME_MAP, normalize_test_name
from src.labs.service import (
    create_observations_from_document,
    get_observation_detail,
    list_tests,
    timeline_for_test,
)

__all__ = [
    "TEST_NAME_MAP",
    "normalize_test_name",
    "create_observations_from_document",
    "get_observation_detail",
    "list_tests",
    "timeline_for_test",
]
