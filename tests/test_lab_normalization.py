from src.labs.normalization import is_tracked_lab, normalize_test_name, parse_numeric_value


def test_normalize_common_aliases():
    assert normalize_test_name("Hgb") == "hemoglobin"
    assert normalize_test_name("HbA1c") == "hemoglobin_a1c"
    assert normalize_test_name("LDL Cholesterol") == "ldl_cholesterol"


def test_tracked_lab_detection():
    assert is_tracked_lab("Hemoglobin")
    assert is_tracked_lab("platelets")
    assert not is_tracked_lab("favorite_color")


def test_parse_numeric_value():
    assert parse_numeric_value("13.2 g/dL") == 13.2
    assert parse_numeric_value("n/a") is None
