from src.citations import (
    find_citation_numbers,
    validate_citation_numbers,
)


def test_citation_numbers_are_found() -> None:
    answer = (
        "Blood pressure has two measurements [1]. "
        "Lifestyle factors can affect it [2]."
    )

    assert find_citation_numbers(answer) == {
        1,
        2,
    }


def test_valid_citations_pass() -> None:
    valid, invalid = validate_citation_numbers(
        "Example statement [1].",
        {1, 2},
    )

    assert valid is True
    assert invalid == set()


def test_invented_citation_is_rejected() -> None:
    valid, invalid = validate_citation_numbers(
        "Example statement [7].",
        {1, 2},
    )

    assert valid is False
    assert invalid == {7}
