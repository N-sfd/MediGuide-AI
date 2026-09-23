"""Synthetic radiology report fixtures for Imaging workspace testing.

These are educational demo documents only — not real patient records.
Each report uses the section headers Imaging's extractor expects
(exam / clinical history / technique / comparison / findings / impression /
recommendations) so native-PDF text extraction works without vision OCR.
JPEG renders are also written for photo-upload / vision OCR testing.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf

REPORTS: list[dict[str, object]] = [
    {
        "slug": "mri-shoulder-right",
        "modality": "mri",
        "modality_label": "MRI",
        "body_region": "Right shoulder",
        "title": "MRI Right Shoulder — Synthetic Demo Report",
        "body": [
            "EXAM:",
            "MRI of the right shoulder without contrast.",
            "",
            "CLINICAL HISTORY:",
            "45-year-old with shoulder pain after overhead activity. Evaluate rotator cuff.",
            "",
            "TECHNIQUE:",
            "Multiplanar T1- and T2-weighted sequences of the right shoulder were obtained.",
            "",
            "COMPARISON:",
            "None available.",
            "",
            "FINDINGS:",
            "A near-complete tear of the supraspinatus tendon is present at the footprint,",
            "with residual thin fibers. Fluid surrounds the remaining tendon. Mild AC joint",
            "degenerative changes are noted. The long head of the biceps tendon is intact.",
            "No full-thickness infraspinatus or subscapularis tear is identified.",
            "",
            "IMPRESSION:",
            "1. Near-complete tear of the right supraspinatus tendon.",
            "2. Fluid signal surrounding the residual tendon fibers.",
            "3. Mild acromioclavicular joint degenerative changes.",
            "",
            "RECOMMENDATIONS:",
            "Clinical correlation. Orthopedic follow-up as clinically indicated.",
        ],
    },
    {
        "slug": "ct-chest-contrast",
        "modality": "ct",
        "modality_label": "CT",
        "body_region": "Chest",
        "title": "CT Chest With Contrast — Synthetic Demo Report",
        "body": [
            "EXAM:",
            "CT chest with intravenous contrast.",
            "",
            "CLINICAL HISTORY:",
            "Abnormal chest radiograph with suspected right upper lobe opacity.",
            "",
            "TECHNIQUE:",
            "Helical CT of the chest was performed after IV contrast administration.",
            "",
            "COMPARISON:",
            "Chest radiograph from the same day.",
            "",
            "FINDINGS:",
            "Several discrete patchy air-space opacities are present in the right upper lobe,",
            "most compatible with infiltrate. The remainder of the lung parenchyma is clear.",
            "No pneumothorax or pleural effusion. Heart size and pulmonary vessels are",
            "unremarkable. No axillary, hilar, or mediastinal lymphadenopathy.",
            "Upper abdominal images are unremarkable. Osseous structures show no acute finding.",
            "",
            "IMPRESSION:",
            "Patchy right upper lobe air-space opacities, compatible with pneumonia.",
            "",
            "RECOMMENDATIONS:",
            "Clinical correlation and follow-up imaging after treatment as appropriate.",
        ],
    },
    {
        "slug": "xray-chest-pa-lateral",
        "modality": "xray",
        "modality_label": "X-ray",
        "body_region": "Chest",
        "title": "Chest Radiograph PA and Lateral — Synthetic Demo Report",
        "body": [
            "EXAM:",
            "Chest radiograph, PA and lateral views.",
            "",
            "CLINICAL HISTORY:",
            "Cough and low-grade fever for three days.",
            "",
            "TECHNIQUE:",
            "PA and lateral radiographs of the chest were obtained.",
            "",
            "COMPARISON:",
            "None.",
            "",
            "FINDINGS:",
            "The lungs are clear without focal consolidation, pleural effusion, or pneumothorax.",
            "The cardiac silhouette is normal in size. The mediastinal contours are unremarkable.",
            "No acute osseous abnormality is identified.",
            "",
            "IMPRESSION:",
            "No acute cardiopulmonary process.",
            "",
            "RECOMMENDATIONS:",
            "Clinical correlation.",
        ],
    },
    {
        "slug": "ultrasound-abdomen",
        "modality": "ultrasound",
        "modality_label": "Ultrasound",
        "body_region": "Abdomen",
        "title": "Abdominal Ultrasound — Synthetic Demo Report",
        "body": [
            "EXAM:",
            "Ultrasound of the abdomen.",
            "",
            "CLINICAL HISTORY:",
            "Right upper quadrant pain. Evaluate for gallstones.",
            "",
            "TECHNIQUE:",
            "Real-time gray-scale imaging of the abdomen was performed.",
            "",
            "COMPARISON:",
            "None.",
            "",
            "FINDINGS:",
            "The liver is normal in size and echotexture without focal mass. The gallbladder",
            "is nondistended without wall thickening or shadowing calculus. The common bile",
            "duct measures 4 mm. The pancreas and spleen appear unremarkable. Both kidneys",
            "are normal in size without hydronephrosis. No ascites is identified.",
            "",
            "IMPRESSION:",
            "Normal abdominal ultrasound without sonographic evidence of cholelithiasis.",
            "",
            "RECOMMENDATIONS:",
            "Clinical correlation.",
        ],
    },
    {
        "slug": "mri-brain-wo-contrast",
        "modality": "mri",
        "modality_label": "MRI",
        "body_region": "Brain",
        "title": "MRI Brain Without Contrast — Synthetic Demo Report",
        "body": [
            "EXAM:",
            "MRI of the brain without intravenous contrast.",
            "",
            "CLINICAL HISTORY:",
            "New headaches. Rule out intracranial mass.",
            "",
            "TECHNIQUE:",
            "Multiplanar T1, T2, FLAIR, and diffusion-weighted sequences were obtained.",
            "",
            "COMPARISON:",
            "None available.",
            "",
            "FINDINGS:",
            "No acute infarct, hemorrhage, or mass lesion. Ventricles and sulci are age-",
            "appropriate. No abnormal extra-axial collection. Orbits and visualized",
            "paranasal sinuses are unremarkable. No restricted diffusion.",
            "",
            "IMPRESSION:",
            "Normal MRI of the brain without contrast.",
            "",
            "RECOMMENDATIONS:",
            "Clinical correlation.",
        ],
    },
]


def _write_report_pdf(output_path: Path, title: str, body_lines: list[str]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    try:
        page = doc.new_page(width=612, height=792)
        y = 56
        page.insert_text((56, y), title, fontsize=13, fontname="helv")
        y += 22
        page.insert_text(
            (56, y),
            "Educational sample only — synthetic demo, not a real patient report.",
            fontsize=9,
            fontname="helv",
        )
        y += 28
        for line in body_lines:
            if y > 740:
                page = doc.new_page(width=612, height=792)
                y = 56
            page.insert_text((56, y), line, fontsize=10, fontname="helv")
            y += 14
        y += 10
        page.insert_text(
            (56, y),
            "MediGuide synthetic imaging fixture",
            fontsize=8,
            fontname="helv",
        )
        doc.save(output_path)
    finally:
        doc.close()


def _render_pdf_to_jpeg(pdf_path: Path, jpeg_path: Path, dpi: int = 140) -> None:
    doc = pymupdf.open(pdf_path)
    try:
        page = doc[0]
        pix = page.get_pixmap(dpi=dpi)
        jpeg_path.parent.mkdir(parents=True, exist_ok=True)
        pix.save(jpeg_path)
    finally:
        doc.close()


def generate_sample_imaging_reports(output_dir: Path) -> list[Path]:
    """Writes PDF + JPEG fixtures for each synthetic radiology report."""
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for report in REPORTS:
        slug = str(report["slug"])
        title = str(report["title"])
        body = [str(line) for line in report["body"]]  # type: ignore[index]
        pdf_path = output_dir / f"{slug}.pdf"
        jpeg_path = output_dir / f"{slug}.jpg"
        _write_report_pdf(pdf_path, title, body)
        _render_pdf_to_jpeg(pdf_path, jpeg_path)
        written.extend([pdf_path, jpeg_path])
    readme = output_dir / "README.md"
    readme.write_text(
        "# Synthetic imaging report fixtures\n\n"
        "Educational demo reports for MediGuide Imaging testing.\n"
        "Not real patient data. Prefer the `.pdf` files for native-text extraction;\n"
        "use the `.jpg` renders to exercise vision OCR on photo-like uploads.\n\n"
        "| File | Modality |\n| --- | --- |\n"
        + "\n".join(
            f"| `{r['slug']}.pdf` / `.jpg` | {r['modality_label']} |" for r in REPORTS
        )
        + "\n",
        encoding="utf-8",
    )
    written.append(readme)
    return written


def list_sample_metadata() -> list[dict[str, str]]:
    """Public sample catalog for the Imaging workspace UI."""
    return [
        {
            "slug": str(report["slug"]),
            "modality": str(report["modality"]),
            "modality_label": str(report["modality_label"]),
            "body_region": str(report["body_region"]),
            "title": str(report["title"]),
            "filename": f"{report['slug']}.pdf",
        }
        for report in REPORTS
    ]


def sample_pdf_path(slug: str, samples_dir: Path | None = None) -> Path | None:
    root = samples_dir or (Path(__file__).resolve().parents[1] / "data" / "samples" / "imaging")
    path = root / f"{slug}.pdf"
    return path if path.is_file() else None
