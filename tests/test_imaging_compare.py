from __future__ import annotations

from src.imaging_compare import compare_section_text


def test_identical_text_is_all_present_in_both():
    text = "No acute fracture. Small joint effusion."
    result = compare_section_text(text, text)
    assert result["present_in_both"] == ["No acute fracture.", "Small joint effusion."]
    assert result["newly_mentioned"] == []
    assert result["no_longer_mentioned"] == []


def test_new_sentence_is_newly_mentioned():
    earlier = "No acute fracture."
    later = "No acute fracture. New ACL tear noted."
    result = compare_section_text(earlier, later)
    assert result["present_in_both"] == ["No acute fracture."]
    assert result["newly_mentioned"] == ["New ACL tear noted."]
    assert result["no_longer_mentioned"] == []


def test_removed_sentence_is_no_longer_mentioned():
    earlier = "No acute fracture. Mild joint effusion."
    later = "No acute fracture."
    result = compare_section_text(earlier, later)
    assert result["present_in_both"] == ["No acute fracture."]
    assert result["no_longer_mentioned"] == ["Mild joint effusion."]
    assert result["newly_mentioned"] == []


def test_wholly_different_sentence_is_both_new_and_removed():
    earlier = "No acute fracture."
    later = "New ACL tear noted."
    result = compare_section_text(earlier, later)
    assert result["present_in_both"] == []
    assert result["newly_mentioned"] == ["New ACL tear noted."]
    assert result["no_longer_mentioned"] == ["No acute fracture."]


def test_near_duplicate_wording_counts_as_present_in_both():
    """A minor rewording of the same underlying statement is treated as the
    same claim, not a removal + addition — this must never be labeled a
    clinical change."""
    earlier = "Mild joint effusion."
    later = "Small joint effusion."
    result = compare_section_text(earlier, later)
    assert result["present_in_both"] == ["Small joint effusion."]
    assert result["no_longer_mentioned"] == []
    assert result["newly_mentioned"] == []


def test_empty_sections_produce_no_buckets():
    result = compare_section_text("", "")
    assert result == {"present_in_both": [], "newly_mentioned": [], "no_longer_mentioned": []}


def test_result_never_contains_severity_language():
    """Guards against ever introducing clinical-judgment words into the
    comparison output — this module must stay purely textual."""
    earlier = "No acute fracture."
    later = "No acute fracture. New ACL tear noted."
    result = compare_section_text(earlier, later)
    forbidden = {"improved", "worsened", "progression", "regression", "better", "worse"}
    all_text = " ".join(
        sentence.lower()
        for bucket in result.values()
        for sentence in bucket
    )
    assert not any(word in all_text for word in forbidden)
