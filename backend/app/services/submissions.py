from __future__ import annotations

import math
import re
from datetime import date
from typing import Any


class SubmissionValidationError(ValueError):
    pass


def resolve_submission_form_snapshot(form: Any, submission: Any) -> dict[str, Any]:
    snapshot = getattr(submission, "form_snapshot", None)
    if isinstance(snapshot, dict) and isinstance(snapshot.get("form_config"), dict):
        return snapshot
    return {
        "form_name": form.form_name,
        "form_description": form.form_description,
        "form_config": form.form_config if isinstance(form.form_config, dict) else {},
    }


VALUE_FIELD_TYPES = {
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
}
DISPLAY_FIELD_TYPES = {"heading", "paragraph"}
FILE_FIELD_TYPES = {"file"}


def _field_name(field: dict[str, Any]) -> str | None:
    name = field.get("name") or field.get("id") or field.get("fieldId")
    return name if isinstance(name, str) and name else None


def _field_options(field: dict[str, Any]) -> list[str]:
    options = field.get("options")
    if not isinstance(options, list):
        return []
    values = []
    for option in options:
        value = option.get("value", option.get("label")) if isinstance(option, dict) else option
        if isinstance(value, (str, int, float)) and not isinstance(value, bool):
            values.append(str(value))
    return values


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip()) or (isinstance(value, list) and not value)


def _check_length(field_name: str, value: str, validation: dict[str, Any]) -> None:
    for key, message in (
        ("minLength", f"Minimum length is {validation.get('minLength')} for {field_name}"),
        ("maxLength", f"Maximum length is {validation.get('maxLength')} for {field_name}"),
    ):
        limit = validation.get(key)
        if limit is None:
            continue
        try:
            limit = int(limit)
        except (TypeError, ValueError) as error:
            raise SubmissionValidationError(f"Invalid validation configuration for {field_name}") from error
        if key == "minLength" and len(value) < limit:
            raise SubmissionValidationError(message)
        if key == "maxLength" and len(value) > limit:
            raise SubmissionValidationError(message)


def _validate_value(field: dict[str, Any], name: str, value: Any) -> Any:
    field_type = field.get("type")
    validation = field.get("validation") if isinstance(field.get("validation"), dict) else {}

    if field_type in {"text", "textarea", "email", "mobile"}:
        if not isinstance(value, str):
            raise SubmissionValidationError(f"Invalid value for {name}")
        if field_type == "email" and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise SubmissionValidationError(f"Invalid email for {name}")
        if field_type == "mobile":
            digits = sum(character.isdigit() for character in value)
            if digits < 5 or not re.fullmatch(r"\+?[\d\s().-]+", value):
                raise SubmissionValidationError(f"Invalid mobile number for {name}")
        _check_length(name, value, validation)
        return value

    if field_type == "date":
        if not isinstance(value, str):
            raise SubmissionValidationError(f"Invalid date for {name}")
        try:
            date.fromisoformat(value)
        except ValueError as error:
            raise SubmissionValidationError(f"Invalid date for {name}") from error
        return value

    if field_type == "number":
        if isinstance(value, bool) or not isinstance(value, (str, int, float)) or _is_blank(value):
            raise SubmissionValidationError(f"Invalid number for {name}")
        try:
            number = float(value)
        except (TypeError, ValueError) as error:
            raise SubmissionValidationError(f"Invalid number for {name}") from error
        if not math.isfinite(number):
            raise SubmissionValidationError(f"Invalid number for {name}")
        for key, message in (("min", f"Value must be at least {validation.get('min')} for {name}"),
                             ("max", f"Value must be at most {validation.get('max')} for {name}")):
            limit = validation.get(key)
            if limit is None:
                continue
            try:
                limit = float(limit)
            except (TypeError, ValueError) as error:
                raise SubmissionValidationError(f"Invalid validation configuration for {name}") from error
            if key == "min" and number < limit:
                raise SubmissionValidationError(message)
            if key == "max" and number > limit:
                raise SubmissionValidationError(message)
        return int(number) if number.is_integer() else number

    options = _field_options(field)
    if field_type in {"radio", "select"}:
        if not isinstance(value, str) or value not in options:
            raise SubmissionValidationError(f"Invalid option for {name}")
        return value

    if field_type == "multiselect" or (field_type == "checkbox" and options):
        if not isinstance(value, list) or any(not isinstance(option, str) or option not in options for option in value):
            raise SubmissionValidationError(f"Invalid option for {name}")
        return value

    if field_type == "checkbox":
        if not isinstance(value, bool):
            raise SubmissionValidationError(f"Invalid value for {name}")
        return value

    raise SubmissionValidationError(f"Unsupported field type for {name}")


def validate_submission_data(form_config: dict[str, Any], submitted_data: dict[str, Any]) -> dict[str, Any]:
    fields = form_config.get("fields", []) if isinstance(form_config, dict) else []
    if not isinstance(fields, list):
        raise SubmissionValidationError("Invalid form configuration")

    allowed_fields: dict[str, dict[str, Any]] = {}
    file_fields: set[str] = set()
    for field in fields:
        if not isinstance(field, dict) or not (field.get("active") if "active" in field else field.get("isActive", True)):
            continue
        field_type = field.get("type")
        if field_type in DISPLAY_FIELD_TYPES:
            continue
        name = _field_name(field)
        if not name:
            raise SubmissionValidationError("Invalid form configuration")
        if field_type in FILE_FIELD_TYPES:
            file_fields.add(name)
            continue
        if field_type not in VALUE_FIELD_TYPES or name in allowed_fields:
            raise SubmissionValidationError("Invalid form configuration")
        allowed_fields[name] = field

    for name in submitted_data:
        if name in file_fields:
            if not _is_blank(submitted_data[name]) and submitted_data[name] is not False:
                raise SubmissionValidationError("File uploads are not supported")
        elif name not in allowed_fields:
            raise SubmissionValidationError(f"Unknown field: {name}")

    validated: dict[str, Any] = {}
    for name, field in allowed_fields.items():
        if name not in submitted_data:
            if field.get("required", False):
                raise SubmissionValidationError(f"{name} is required")
            continue

        value = submitted_data[name]
        blank = _is_blank(value)
        single_checkbox_false = field.get("type") == "checkbox" and not _field_options(field) and value is False
        if field.get("required", False) and (blank or single_checkbox_false):
            raise SubmissionValidationError(f"{name} is required")
        if blank:
            validated[name] = value
            continue
        if single_checkbox_false:
            validated[name] = False
            continue
        validated[name] = _validate_value(field, name, value)

    return validated


def build_submission_summary(form_config: dict[str, Any], submission_data: dict[str, Any]) -> str:
    fields = form_config.get("fields", []) if isinstance(form_config, dict) else []
    if not isinstance(fields, list) or not isinstance(submission_data, dict):
        return "No field values"

    values = []
    active_fields = [
        field for field in fields
        if isinstance(field, dict)
        and (field.get("active") if "active" in field else field.get("isActive", True))
        and field.get("type") not in DISPLAY_FIELD_TYPES | FILE_FIELD_TYPES
    ]
    active_fields.sort(key=lambda field: int(field.get("order") or 0))
    for field in active_fields:
        name = _field_name(field)
        value = submission_data.get(name) if name else None
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, list):
            value_text = ", ".join(map(str, value))
        elif isinstance(value, bool):
            value_text = "Yes" if value else "No"
        else:
            value_text = str(value)
        label = str(field.get("label") or name)
        values.append(f"{label}: {value_text}")
        if len(values) == 2:
            break

    summary = " · ".join(values) or "No field values"
    return summary[:180] + ("…" if len(summary) > 180 else "")