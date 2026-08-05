import json
from datetime import date
from pathlib import Path

from pypdf import PdfReader

from src.schemas import SourceDocument


REJECTED_SOURCE_STATUSES = {
    "retired",
    "replaced",
    "unapproved",
}


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        cleaned = " ".join(text.split())

        if cleaned:
            pages.append(
                f"[Page {page_number}]\n{cleaned}"
            )

    return "\n\n".join(pages)


def load_metadata(metadata_path: Path) -> dict:
    with metadata_path.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def load_source_document(
    document_path: Path,
) -> SourceDocument:
    metadata_path = document_path.with_suffix(".json")

    if not metadata_path.exists():
        raise ValueError(
            f"Missing metadata file for {document_path.name}"
        )

    metadata = load_metadata(metadata_path)

    if not metadata.get("approved"):
        raise ValueError(
            f"Source is not approved: {document_path.name}"
        )

    status = metadata.get("status", "active")

    if status in REJECTED_SOURCE_STATUSES:
        raise ValueError(
            f"Source status '{status}' is not permitted for "
            f"ingestion: {document_path.name}"
        )

    next_review_date = metadata.get("next_review_date")

    if next_review_date:
        try:
            review_due = date.fromisoformat(next_review_date)
        except ValueError:
            review_due = None

        if review_due is not None and date.today() > review_due:
            print(
                f"Warning: {document_path.name} is past its "
                f"next review date ({next_review_date})."
            )

    if document_path.suffix.lower() == ".pdf":
        text = extract_pdf_text(document_path)
    elif document_path.suffix.lower() == ".txt":
        text = document_path.read_text(
            encoding="utf-8"
        )
    else:
        raise ValueError(
            f"Unsupported knowledge document: {document_path.suffix}"
        )

    if not text.strip():
        raise ValueError(
            f"No readable text found in {document_path.name}"
        )

    return SourceDocument(
        source_id=metadata["source_id"],
        title=metadata["title"],
        publisher=metadata["publisher"],
        source_url=metadata.get("source_url", ""),
        publication_date=metadata.get(
            "publication_date",
            "",
        ),
        review_date=metadata.get(
            "review_date",
            "",
        ),
        document_type=metadata.get(
            "document_type",
            "patient_education",
        ),
        local_path=str(document_path),
        text=text,
    )
