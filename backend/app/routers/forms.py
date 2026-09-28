from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.forms import Form, FormSubmission
from app.routers.auth import require_admin
from app.schemas.forms import (
    FormCreate,
    FormDetail,
    FormSummary,
    FormUpdate,
    PublicFormRead,
    PublicSubmissionCreate,
    PublicSubmissionRead,
)
from app.schemas.submissions import SubmissionDetail, SubmissionSummary
from app.services.pdf_service import generate_submission_pdf
from app.services.submissions import (
    SubmissionValidationError,
    build_submission_summary,
    validate_submission_data,
)

router = APIRouter(prefix="/api/forms", tags=["forms"], dependencies=[Depends(require_admin)])
public_router = APIRouter(prefix="/api/public/forms", tags=["public forms"])


def _slug_base(form_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", form_name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "form"


def _unique_slug(db: Session, form_name: str, exclude_form_id: Optional[int] = None) -> str:
    base = _slug_base(form_name)
    candidate = base
    suffix = 2
    while True:
        query = db.query(Form).filter(Form.form_slug == candidate)
        if exclude_form_id is not None:
            query = query.filter(Form.form_id != exclude_form_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _get_form_or_404(db: Session, form_id: int) -> Form:
    form = db.query(Form).filter(Form.form_id == form_id).first()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


def _set_form_status(db: Session, form_id: int, new_status: str) -> Form:
    form = _get_form_or_404(db, form_id)
    form.status = new_status
    form.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(form)
    return form


@router.post("", response_model=FormDetail, status_code=status.HTTP_201_CREATED, summary="Create a form")
def create_form(payload: FormCreate, db: Session = Depends(get_db)) -> Form:
    form = Form(
        form_name=payload.form_name,
        form_description=payload.form_description,
        form_slug=_unique_slug(db, payload.form_name),
        form_config=payload.form_config,
        status="DRAFT",
    )
    db.add(form)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not create form with a unique slug") from error
    db.refresh(form)
    return form


@router.get("", response_model=list[FormSummary], summary="List admin forms")
def list_forms(db: Session = Depends(get_db)) -> list[Form]:
    return db.query(Form).order_by(Form.created_at.desc(), Form.form_id.desc()).all()


@router.get("/{form_id}", response_model=FormDetail, summary="Get a form for editing")
def get_form(form_id: int, db: Session = Depends(get_db)) -> Form:
    return _get_form_or_404(db, form_id)


@router.put("/{form_id}", response_model=FormDetail, summary="Update a form")
def update_form(form_id: int, payload: FormUpdate, db: Session = Depends(get_db)) -> Form:
    form = _get_form_or_404(db, form_id)
    changes = payload.model_dump(exclude_unset=True)
    if "form_name" in changes:
        form.form_name = changes["form_name"]
        form.form_slug = _unique_slug(db, form.form_name, exclude_form_id=form_id)
    if "form_description" in changes:
        form.form_description = changes["form_description"]
    if "form_config" in changes:
        form.form_config = changes["form_config"]
    form.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not update form with a unique slug") from error
    db.refresh(form)
    return form


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a form")
def delete_form(form_id: int, db: Session = Depends(get_db)) -> Response:
    form = _get_form_or_404(db, form_id)
    db.delete(form)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{form_id}/publish", summary="Publish a form")
def publish_form(form_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    form = _set_form_status(db, form_id, "PUBLISHED")
    return {
        "message": "Form published successfully",
        "form_id": form.form_id,
        "status": form.status,
        "slug": form.form_slug,
        "updated_at": form.updated_at,
    }


@router.post("/{form_id}/deactivate", summary="Deactivate a form")
def deactivate_form(form_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    form = _set_form_status(db, form_id, "INACTIVE")
    return {
        "message": "Form deactivated successfully",
        "form_id": form.form_id,
        "status": form.status,
        "updated_at": form.updated_at,
    }


@router.get(
    "/{form_id}/submissions",
    response_model=list[SubmissionSummary],
    summary="List submissions for a form",
)
def list_form_submissions(form_id: int, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    form = _get_form_or_404(db, form_id)
    submissions = (
        db.query(FormSubmission)
        .filter(FormSubmission.form_id == form_id)
        .order_by(FormSubmission.submitted_at.desc(), FormSubmission.submission_id.desc())
        .all()
    )
    return [
        {
            "submission_id": submission.submission_id,
            "form_id": submission.form_id,
            "submitted_at": submission.submitted_at,
            "status": submission.status,
            "summary": build_submission_summary(form.form_config or {}, submission.submission_data or {}),
        }
        for submission in submissions
    ]


@router.get(
    "/{form_id}/submissions/{submission_id}",
    response_model=SubmissionDetail,
    summary="Get a submission belonging to a form",
)
def get_form_submission(
    form_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_form_or_404(db, form_id)
    submission = (
        db.query(FormSubmission)
        .filter(
            FormSubmission.form_id == form_id,
            FormSubmission.submission_id == submission_id,
        )
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission


@router.get(
    "/{form_id}/submissions/{submission_id}/pdf",
    summary="Download a submission PDF as an admin",
    responses={404: {"description": "Form or submission not found"}, 401: {"description": "Admin login required"}},
)
def download_admin_submission_pdf(
    form_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
) -> Response:
    form = _get_form_or_404(db, form_id)
    submission = (
        db.query(FormSubmission)
        .filter(
            FormSubmission.form_id == form_id,
            FormSubmission.submission_id == submission_id,
        )
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    try:
        pdf_content = generate_submission_pdf(form, submission)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate submission PDF",
        ) from error
    filename = f"{form.form_slug}-submission-{submission.submission_id}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@public_router.get("/{slug}", response_model=PublicFormRead, summary="Get a published public form")
def get_published_form(slug: str, db: Session = Depends(get_db)) -> Form:
    form = db.query(Form).filter(Form.form_slug == slug, Form.status == "PUBLISHED").first()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not available")
    return form


@public_router.post(
    "/{slug}/submit",
    response_model=PublicSubmissionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a published public form",
)
def submit_public_form(
    slug: str,
    payload: PublicSubmissionCreate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    form = db.query(Form).filter(Form.form_slug == slug, Form.status == "PUBLISHED").first()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not available")

    try:
        submission_data = validate_submission_data(form.form_config or {}, payload.submission_data)
    except SubmissionValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    submission = FormSubmission(
        form_id=form.form_id,
        submission_data=submission_data,
        submitted_by=None,
        status="SUBMITTED",
    )
    db.add(submission)
    try:
        db.commit()
        db.refresh(submission)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save submission",
        ) from error

    return {
        "message": "Form submitted successfully",
        "submission_id": submission.submission_id,
        "form_id": submission.form_id,
        "submitted_at": submission.submitted_at,
        "submission_data": submission.submission_data,
    }


@public_router.get(
    "/{slug}/submissions/{submission_id}/pdf",
    summary="Download a public submission PDF",
    responses={404: {"description": "Published form or submission not found"}},
)
def download_public_submission_pdf(
    slug: str,
    submission_id: int,
    db: Session = Depends(get_db),
) -> Response:
    form = db.query(Form).filter(Form.form_slug == slug, Form.status == "PUBLISHED").first()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not available")

    submission = (
        db.query(FormSubmission)
        .filter(
            FormSubmission.submission_id == submission_id,
            FormSubmission.form_id == form.form_id,
        )
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    try:
        pdf_content = generate_submission_pdf(form, submission)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate submission PDF",
        ) from error

    filename = f"{form.form_slug}-submission-{submission.submission_id}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )