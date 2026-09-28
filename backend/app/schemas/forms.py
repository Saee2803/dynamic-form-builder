from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

SUPPORTED_FIELD_TYPES = {
    "text",
    "textarea",
    "number",
    "email",
    "mobile",
    "date",
    "radio",
    "select",
    "multiselect",
    "checkbox",
    "heading",
    "paragraph",
    "file",
}


class FormFieldOption(BaseModel):
    label: str
    value: str


class FormField(BaseModel):
    fieldId: str
    label: str
    type: str
    required: bool = False
    order: int = 1
    isActive: bool = True
    options: Optional[list[FormFieldOption]] = None


class FormConfigBase(BaseModel):
    formId: Optional[int] = None
    formName: str
    formDescription: Optional[str] = None
    formStatus: str = "draft"
    publicSlug: Optional[str] = None
    fields: list[FormField] = Field(default_factory=list)


class FormCreate(FormConfigBase):
    pass


class FormRead(FormConfigBase):
    form_id: int
    created_at: datetime
    updated_at: datetime


class SubmissionCreate(BaseModel):
    form_id: int
    submission_data: dict[str, Any] = Field(default_factory=dict)
    submitted_by: Optional[str] = None
    status: str = "submitted"


class FormWriteBase(BaseModel):
    form_name: str = Field(min_length=1, max_length=255)
    form_description: Optional[str] = None
    form_config: dict[str, Any] = Field(default_factory=lambda: {"fields": []})

    @field_validator("form_name")
    @classmethod
    def form_name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Form name cannot be blank")
        return value.strip()

    @field_validator("form_config")
    @classmethod
    def validate_form_fields(cls, value: dict[str, Any]) -> dict[str, Any]:
        fields = value.get("fields", [])
        if not isinstance(fields, list):
            raise ValueError("form_config.fields must be a list")
        for field_config in fields:
            if not isinstance(field_config, dict):
                raise ValueError("Each form field must be an object")
            field_type = field_config.get("type")
            if field_type is not None and (
                not isinstance(field_type, str) or field_type not in SUPPORTED_FIELD_TYPES
            ):
                raise ValueError(f"Unsupported field type: {field_type}")
        return value


class FormCreate(FormWriteBase):
    pass


class FormUpdate(BaseModel):
    form_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    form_description: Optional[str] = None
    form_config: Optional[dict[str, Any]] = None

    @field_validator("form_name")
    @classmethod
    def form_name_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            raise ValueError("Form name cannot be blank")
        return value.strip()

    @field_validator("form_config")
    @classmethod
    def validate_form_fields(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if value is None:
            raise ValueError("form_config cannot be null")
        return FormWriteBase.validate_form_fields(value)


class FormSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    form_id: int
    form_name: str
    form_description: Optional[str]
    form_slug: str
    status: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FormDetail(FormSummary):
    form_config: dict[str, Any]


class PublicFormRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    form_id: int
    form_name: str
    form_description: Optional[str]
    form_slug: str
    status: str
    form_config: dict[str, Any]


class PublicSubmissionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submission_data: dict[str, Any] = Field(default_factory=dict)


class PublicSubmissionRead(BaseModel):
    message: str
    submission_id: int
    form_id: int
    submitted_at: datetime
    submission_data: dict[str, Any]
    form_snapshot: Optional[dict[str, Any]] = None
