from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Literal

import pymupdf
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from ollama import Client
from PIL import Image
from pydantic import BaseModel, Field

from src.citations import build_citation_sources
from src.config import (
    BASE_DIR,
    MAX_IMAGE_MB,
    MODEL_NAME,
    OLLAMA_HOST,
    RAG_MAX_PASSAGE_WORDS,
    VISION_MODEL_NAME,
)
from src.image_validator import validate_image_file
from src.labs.service import create_observations_from_document
from src.retriever import diversify_results, retrieve_chunks
from src.safety import check_for_emergency


router = APIRouter(prefix="/api/documents/v2", tags=["Document Intelligence V2"])

TEMP_DIR = Path(
    os.getenv("DOC_INTEL_TEMP_DIR", str(BASE_DIR / "outputs" / "document_intelligence"))
)
VISION_MODEL = VISION_MODEL_NAME
TEXT_MODEL = MODEL_NAME
MAX_MB = int(os.getenv("DOC_INTEL_MAX_MB", "20"))
MAX_PAGES = int(os.getenv("DOC_INTEL_MAX_PAGES", "25"))
RENDER_DPI = int(os.getenv("DOC_INTEL_RENDER_DPI", "140"))
RETENTION_MINUTES = int(os.getenv("DOC_INTEL_RETENTION_MINUTES", "120"))

SUPPORTED_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

Confidence = Literal["clearly_visible", "needs_review", "could_not_read"]
Status = Literal["in_listed_range", "outside_listed_range", "not_applicable", "unknown"]


class ExtractedField(BaseModel):
    field_id: str
    label: str
    value: str = ""
    unit: str = ""
    reference_range: str = ""
    status: Status = "unknown"
    confidence: Confidence = "needs_review"
    page_number: int = Field(ge=1)
    source_text: str = ""
    user_edited: bool = False


class PageInfo(BaseModel):
    page_number: int
    preview_url: str
    text_available: bool
    extracted_field_count: int


class DocumentState(BaseModel):
    document_id: str
    filename: str
    page_count: int
    status: str
    pages: list[PageInfo]
    fields: list[ExtractedField]
    confirmed: bool = False


class ConfirmRequest(BaseModel):
    fields: list[ExtractedField]
    reviewed_names_values_units_dates: bool


class ExplainRequest(BaseModel):
    question: str = (
        "Explain the confirmed information in plain language and suggest "
        "questions for a qualified healthcare professional."
    )


class EvidenceSource(BaseModel):
    citation_number: int
    title: str
    publisher: str
    source_url: str = ""
    passage: str = ""


class ExplainResponse(BaseModel):
    document_id: str
    answer_markdown: str
    document_pages_cited: list[int]
    sources: list[EvidenceSource]
    limitations: list[str]


def _folder(document_id: str) -> Path:
    return TEMP_DIR / document_id


def _state_path(document_id: str) -> Path:
    return _folder(document_id) / "state.json"


def _save_state(state: DocumentState) -> None:
    folder = _folder(state.document_id)
    folder.mkdir(parents=True, exist_ok=True)
    _state_path(state.document_id).write_text(
        json.dumps(state.model_dump(), indent=2),
        encoding="utf-8",
    )


def _load_state(document_id: str) -> DocumentState:
    path = _state_path(document_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document session not found.")
    return DocumentState.model_validate_json(path.read_text(encoding="utf-8"))


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return json.loads(cleaned.strip())


def _field_id(page: int, index: int, label: str) -> str:
    digest = hashlib.sha256(f"{page}|{index}|{label}".encode()).hexdigest()[:10]
    return f"p{page}-{digest}"


def _cleanup_expired_sessions() -> None:
    """Best-effort sweep of stale document sessions.

    There is no background scheduler anywhere in this app, so sessions
    are swept opportunistically on each upload rather than on a timer.
    """
    if not TEMP_DIR.exists():
        return

    cutoff = time.time() - (RETENTION_MINUTES * 60)

    for session_dir in TEMP_DIR.iterdir():
        if not session_dir.is_dir():
            continue

        try:
            if session_dir.stat().st_mtime < cutoff:
                shutil.rmtree(session_dir, ignore_errors=True)
        except OSError:
            continue


_LEADING_NUMBER_PATTERN = re.compile(r"-?\d+(?:\.\d+)?")
_RANGE_SEARCH_PATTERN = re.compile(r"(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)")
_COMPARISON_SEARCH_PATTERN = re.compile(r"(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)")


def _recompute_status(
    value: str,
    reference_range: str,
    model_status: Status,
) -> Status:
    """Deterministically overrides the model's in/out-of-range call when
    both the value and the printed reference range parse cleanly as
    numbers, so "based only on the report's printed reference range" is
    a mechanical check for the common numeric case rather than an LLM
    guess. Qualitative ranges (e.g. "Negative", "Normal") have nothing
    to parse, so they fall back to the model's already-constrained
    judgment (the extraction prompt forbids claiming in/out of range
    unless a printed range is visible).
    """
    if not value or not reference_range:
        return model_status

    number_match = _LEADING_NUMBER_PATTERN.search(value)

    if not number_match:
        return model_status

    number = float(number_match.group())
    normalized = (
        reference_range.strip()
        .replace("–", "-")
        .replace("—", "-")
        .replace("≤", "<=")
        .replace("≥", ">=")
    )

    range_match = _RANGE_SEARCH_PATTERN.search(normalized)

    if range_match:
        low, high = sorted(
            (float(range_match.group(1)), float(range_match.group(2)))
        )
        return "in_listed_range" if low <= number <= high else "outside_listed_range"

    comparison_match = _COMPARISON_SEARCH_PATTERN.search(normalized)

    if comparison_match:
        operator, bound_text = comparison_match.groups()
        bound = float(bound_text)
        in_range = {
            "<": number < bound,
            "<=": number <= bound,
            ">": number > bound,
            ">=": number >= bound,
        }[operator]
        return "in_listed_range" if in_range else "outside_listed_range"

    return model_status


EXTRACTION_PROMPT = """
You are MediGuide's medical DOCUMENT extraction engine.
Do not diagnose. Extract only visible information.

Return JSON only:
{
  "fields": [
    {
      "label": "",
      "value": "",
      "unit": "",
      "reference_range": "",
      "status": "unknown",
      "confidence": "clearly_visible",
      "source_text": ""
    }
  ]
}

Rules:
- Preserve numbers, decimals, dates, names, and units exactly.
- Never invent unreadable content.
- Use needs_review for partial/uncertain content.
- Use could_not_read when a value cannot be read.
- Only use in_listed_range/outside_listed_range when the printed document
  itself contains a visible reference range that supports that comparison.
- Otherwise status=unknown.
"""


def _extract_page_fields(
    image_path: Path,
    page_number: int,
    native_text: str,
) -> list[ExtractedField]:
    client = Client(host=OLLAMA_HOST)
    response = client.chat(
        model=VISION_MODEL,
        messages=[{
            "role": "user",
            "content": EXTRACTION_PROMPT + "\n\n<native_document_text>\n"
                       + native_text[:12000] + "\n</native_document_text>",
            "images": [str(image_path)],
        }],
        options={"temperature": 0.0},
    )
    data = _parse_json(response.message.content)
    result: list[ExtractedField] = []
    for i, item in enumerate(data.get("fields", [])):
        label = str(item.get("label", "")).strip() or "Unlabeled field"
        confidence = item.get("confidence", "needs_review")
        if confidence not in {"clearly_visible", "needs_review", "could_not_read"}:
            confidence = "needs_review"
        status = item.get("status", "unknown")
        if status not in {"in_listed_range", "outside_listed_range", "not_applicable", "unknown"}:
            status = "unknown"
        value = str(item.get("value", "")).strip()
        reference_range = str(item.get("reference_range", "")).strip()
        status = _recompute_status(value, reference_range, status)
        result.append(ExtractedField(
            field_id=_field_id(page_number, i, label),
            label=label,
            value=value,
            unit=str(item.get("unit", "")).strip(),
            reference_range=reference_range,
            status=status,
            confidence=confidence,
            page_number=page_number,
            source_text=str(item.get("source_text", "")).strip(),
        ))
    return result


def retrieve_approved_evidence(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    """Pulls real approved sources from the same RAG pipeline the chat
    endpoint uses (`src.retriever`, `src.citations`), so document
    explanations cite genuine local sources instead of an empty stub.
    Returns [] when the approved knowledge base does not support the
    query, or if retrieval itself fails (e.g. Ollama/Chroma unreachable)
    — callers already treat an empty list as "no supporting evidence".
    """
    try:
        chunks = diversify_results(retrieve_chunks(query, top_k=top_k))
    except Exception:
        return []

    if not chunks:
        return []

    sources = build_citation_sources(chunks)
    chunk_by_source_id = {
        str(chunk.metadata.get("source_id", chunk.chunk_id)): chunk
        for chunk in reversed(chunks)
    }

    evidence: list[dict[str, Any]] = []

    for source in sources:
        chunk = chunk_by_source_id.get(source.source_id)
        passage = ""

        if chunk is not None:
            words = chunk.text.split()
            passage = " ".join(words[:RAG_MAX_PASSAGE_WORDS])
            if len(words) > RAG_MAX_PASSAGE_WORDS:
                passage += " …"

        evidence.append(
            {
                "title": source.title,
                "publisher": source.publisher,
                "source_url": source.source_url,
                "passage": passage,
            }
        )

    return evidence


def _confirmed_context(fields: list[ExtractedField]) -> str:
    lines = []
    for f in fields:
        unit = f" {f.unit}" if f.unit else ""
        rr = f"; printed reference range: {f.reference_range}" if f.reference_range else ""
        lines.append(f"[D{f.page_number}] {f.label}: {f.value}{unit}{rr}")
    return "\n".join(lines)


async def _ingest_pdf(
    file: UploadFile,
    folder: Path,
    pages_dir: Path,
    document_id: str,
) -> tuple[list[PageInfo], list[ExtractedField]]:
    pdf_path = folder / "document.pdf"
    max_bytes = MAX_MB * 1024 * 1024
    total = 0

    with pdf_path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status_code=413, detail=f"PDF exceeds {MAX_MB} MB.")
            out.write(chunk)

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF.") from e

    try:
        if doc.page_count < 1:
            raise HTTPException(status_code=400, detail="PDF has no pages.")
        if doc.page_count > MAX_PAGES:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_PAGES} pages.")

        pages: list[PageInfo] = []
        fields: list[ExtractedField] = []

        for i, page in enumerate(doc):
            n = i + 1
            text = page.get_text("text", sort=True).strip()
            preview = pages_dir / f"page-{n}.png"
            page.get_pixmap(dpi=RENDER_DPI, alpha=False).save(str(preview))
            page_fields = _extract_page_fields(preview, n, text)
            fields.extend(page_fields)
            pages.append(PageInfo(
                page_number=n,
                preview_url=f"/api/documents/v2/{document_id}/pages/{n}/preview",
                text_available=bool(text),
                extracted_field_count=len(page_fields),
            ))
    finally:
        doc.close()

    return pages, fields


async def _ingest_image(
    file: UploadFile,
    suffix: str,
    pages_dir: Path,
    document_id: str,
) -> tuple[list[PageInfo], list[ExtractedField]]:
    raw_path = pages_dir / f"upload{suffix}"
    max_bytes = MAX_IMAGE_MB * 1024 * 1024
    total = 0

    with raw_path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(
                    status_code=413, detail=f"Image exceeds {MAX_IMAGE_MB} MB."
                )
            out.write(chunk)

    validation = validate_image_file(str(raw_path))

    if not validation.valid or not validation.path:
        raise HTTPException(status_code=422, detail=validation.error)

    # Normalize to PNG so preview() and every downstream path (vision
    # model, page-1 filename convention) stay format-agnostic.
    preview = pages_dir / "page-1.png"

    with Image.open(validation.path) as image:
        image.convert("RGB").save(preview, format="PNG")

    raw_path.unlink(missing_ok=True)

    # A plain image has no native text layer — the vision model reads
    # everything directly from the page image.
    page_fields = _extract_page_fields(preview, 1, "")

    pages = [
        PageInfo(
            page_number=1,
            preview_url=f"/api/documents/v2/{document_id}/pages/1/preview",
            text_available=False,
            extracted_field_count=len(page_fields),
        )
    ]

    return pages, page_fields


@router.post("/upload", response_model=DocumentState)
async def upload(file: UploadFile = File(...)) -> DocumentState:
    _cleanup_expired_sessions()

    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{suffix or 'unknown'}'. "
                f"Accepted: {', '.join(sorted(SUPPORTED_SUFFIXES))}."
            ),
        )

    document_id = uuid.uuid4().hex
    folder = _folder(document_id)
    pages_dir = folder / "pages"
    folder.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)

    try:
        if suffix == ".pdf":
            pages, fields = await _ingest_pdf(file, folder, pages_dir, document_id)
        else:
            pages, fields = await _ingest_image(file, suffix, pages_dir, document_id)

        state = DocumentState(
            document_id=document_id,
            filename=file.filename or f"document{suffix}",
            page_count=len(pages),
            status="review_required",
            pages=pages,
            fields=fields,
            confirmed=False,
        )
        _save_state(state)
        return state

    except HTTPException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"MediGuide could not process this document: {type(e).__name__}",
        ) from e


@router.get("/{document_id}", response_model=DocumentState)
async def get_document(document_id: str) -> DocumentState:
    return _load_state(document_id)


@router.get("/{document_id}/pages/{page_number}/preview")
async def preview(document_id: str, page_number: int):
    state = _load_state(document_id)
    if page_number < 1 or page_number > state.page_count:
        raise HTTPException(status_code=404, detail="Page not found.")
    path = _folder(document_id) / "pages" / f"page-{page_number}.png"
    return FileResponse(path, media_type="image/png")


@router.post("/{document_id}/confirm")
async def confirm(document_id: str, request: ConfirmRequest):
    state = _load_state(document_id)
    if not request.reviewed_names_values_units_dates:
        raise HTTPException(
            status_code=400,
            detail="Review names, values, units, dates, and ranges first.",
        )
    if not request.fields:
        raise HTTPException(status_code=400, detail="No reviewed fields supplied.")

    state.fields = [
        field.model_copy(update={"user_edited": True})
        for field in request.fields
    ]
    state.confirmed = True
    state.status = "confirmed"
    _save_state(state)

    persistence: dict[str, object] = {"persisted": False, "lab_observation_count": 0}
    try:
        persistence = {
            "persisted": True,
            **create_observations_from_document(
                document_id=document_id,
                filename=state.filename,
                page_count=state.page_count,
                pages=[page.model_dump() for page in state.pages],
                fields=[field.model_dump() for field in state.fields],
                storage_path=str(_folder(document_id)),
            ),
        }
    except Exception as error:
        # Session confirmation still succeeds; relational store is best-effort
        # until migrations/Docker Postgres are running.
        persistence = {
            "persisted": False,
            "lab_observation_count": 0,
            "detail": f"{type(error).__name__}: {error}",
        }

    return {
        "document_id": document_id,
        "confirmed": True,
        "fields": state.fields,
        "persistence": persistence,
    }


@router.post("/{document_id}/explain", response_model=ExplainResponse)
async def explain(document_id: str, request: ExplainRequest) -> ExplainResponse:
    state = _load_state(document_id)
    if not state.confirmed:
        raise HTTPException(
            status_code=409,
            detail="Human review and confirmation are required before explanation.",
        )

    emergency = check_for_emergency(request.question)

    if emergency.is_emergency:
        return ExplainResponse(
            document_id=document_id,
            answer_markdown=emergency.message or "Call emergency services immediately.",
            document_pages_cited=[],
            sources=[],
            limitations=["This response did not use the document or approved sources."],
        )  

    context = _confirmed_context(state.fields)
    evidence = retrieve_approved_evidence(request.question + "\n" + context, top_k=5)
    pages = sorted({f.page_number for f in state.fields})

    if not evidence:
        return ExplainResponse(
            document_id=document_id,
            answer_markdown=(
                "### Limited trusted information available\n\n"
                "MediGuide preserved the user-confirmed document information, "
                "but no sufficiently relevant approved educational source was "
                "retrieved. It will not add unsupported medical explanation.\n\n"
                + context
            ),
            document_pages_cited=pages,
            sources=[],
            limitations=[
                "No sufficiently relevant approved knowledge source was retrieved.",
                "Document fields were reviewed and confirmed by the user.",
                "This is not a diagnosis or treatment recommendation.",
            ],
        )

    source_text = []
    sources = []
    for idx, item in enumerate(evidence, 1):
        sources.append(EvidenceSource(
            citation_number=idx,
            title=item.get("title", "Untitled source"),
            publisher=item.get("publisher", "Unknown publisher"),
            source_url=item.get("source_url", ""),
            passage=item.get("passage", ""),
        ))
        source_text.append(f"[{idx}] {item.get('title','')} — {item.get('passage','')}")

    prompt = f"""
QUESTION
{request.question}

USER-CONFIRMED DOCUMENT INFORMATION
{context}

APPROVED EVIDENCE
{chr(10).join(source_text)}

Write a plain-language educational explanation.
Use [D1], [D2], etc. for document-page claims.
Use [1], [2], etc. for general claims from approved sources.
Do not diagnose, prescribe, recommend dose changes, or invent citations.
Include:
- What the document shows
- General explanation
- What cannot be determined
- Questions to ask your clinician
"""

    client = Client(host=OLLAMA_HOST)
    response = client.chat(
        model=TEXT_MODEL,
        messages=[
            {"role": "system", "content": "Use only confirmed document data and supplied approved evidence."},
            {"role": "user", "content": prompt},
        ],
        options={"temperature": 0.1},
    )

    return ExplainResponse(
        document_id=document_id,
        answer_markdown=response.message.content.strip(),
        document_pages_cited=pages,
        sources=sources,
        limitations=[
            "Automated extraction can be incorrect.",
            "The user confirmed the fields used in this explanation.",
            "Printed reference ranges vary by laboratory and context.",
            "This explanation is educational and is not a diagnosis.",
        ],
    )
