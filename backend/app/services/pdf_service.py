from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from app.models.forms import Form, FormSubmission


def _font_names() -> tuple[str, str]:
    regular_name, bold_name = "PortalSans", "PortalSans-Bold"
    registered = set(pdfmetrics.getRegisteredFontNames())
    if regular_name in registered and bold_name in registered:
        return regular_name, bold_name

    windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = [
        (windows_fonts / "arial.ttf", windows_fonts / "arialbd.ttf"),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
        (Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf")),
        (Path(__import__("reportlab").__file__).parent / "fonts" / "Vera.ttf", Path(__import__("reportlab").__file__).parent / "fonts" / "VeraBd.ttf"),
    ]
    for regular_path, bold_path in candidates:
        if regular_path.exists():
            pdfmetrics.registerFont(TTFont(regular_name, str(regular_path)))
            pdfmetrics.registerFont(TTFont(bold_name, str(bold_path if bold_path.exists() else regular_path)))
            pdfmetrics.registerFontFamily(regular_name, normal=regular_name, bold=bold_name, italic=regular_name, boldItalic=bold_name)
            return regular_name, bold_name
    return "Helvetica", "Helvetica-Bold"


def _display_value(value: Any, field: dict[str, Any] | None = None) -> str:
    if isinstance(value, list):
        return ", ".join(_display_value(item, field) for item in value)
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if field and field.get("type") in {"radio", "select", "multiselect", "checkbox"}:
        for option in field.get("options", []):
            option_value = option.get("value", option.get("label")) if isinstance(option, dict) else option
            if option_value is not None and str(option_value) == str(value):
                return str(option.get("label", option_value) if isinstance(option, dict) else option)
    return str(value)


def _field_name(field: dict[str, Any]) -> str | None:
    name = field.get("name") or field.get("id") or field.get("fieldId")
    return name if isinstance(name, str) and name else None


def generate_submission_pdf(form: Form, submission: FormSubmission) -> bytes:
    regular_font, _ = _font_names()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "SubmissionTitle",
        parent=styles["Title"],
        fontName=regular_font,
        fontSize=20,
        leading=25,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#154e43"),
        spaceAfter=7 * mm,
    )
    metadata_style = ParagraphStyle(
        "SubmissionMetadata",
        parent=styles["Normal"],
        fontName=regular_font,
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#586760"),
    )
    label_style = ParagraphStyle(
        "SubmissionLabel",
        parent=styles["Normal"],
        fontName=regular_font,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#154e43"),
        spaceBefore=4 * mm,
        spaceAfter=1 * mm,
    )
    value_style = ParagraphStyle(
        "SubmissionValue",
        parent=styles["Normal"],
        fontName=regular_font,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#192a28"),
        splitLongWords=True,
    )

    buffer = __import__("io").BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title=f"{form.form_name} submission {submission.submission_id}",
    )
    story = [Paragraph(escape(form.form_name), title_style)]
    if form.form_description:
        story.extend([Paragraph(escape(form.form_description).replace("\n", "<br/>"), metadata_style), Spacer(1, 4 * mm)])

    submitted_at = submission.submitted_at.strftime("%d %b %Y %H:%M UTC")
    story.extend([
        Paragraph(f"<b>Submission ID:</b> {submission.submission_id}", metadata_style),
        Paragraph(f"<b>Submitted at:</b> {escape(submitted_at)}", metadata_style),
        Spacer(1, 5 * mm),
        HRFlowable(width="100%", thickness=0.7, color=colors.HexColor("#dfe5df")),
        Spacer(1, 3 * mm),
    ])

    form_config = form.form_config if isinstance(form.form_config, dict) else {}
    fields = form_config.get("fields", [])
    active_fields = [field for field in fields if isinstance(field, dict) and (field.get("active") if "active" in field else field.get("isActive", True))]
    active_fields.sort(key=lambda field: int(field.get("order") or 0))
    data = submission.submission_data if isinstance(submission.submission_data, dict) else {}
    for field in active_fields:
        if field.get("type") in {"heading", "paragraph", "file"}:
            continue
        name = _field_name(field)
        if not name or name not in data:
            continue
        if data[name] is None or data[name] == "" or data[name] == []:
            continue
        label = escape(str(field.get("label") or name))
        value = escape(_display_value(data[name], field)).replace("\n", "<br/>")
        story.extend([Paragraph(f"<b>{label}</b>", label_style), Paragraph(value, value_style)])

    document.build(story)
    return buffer.getvalue()