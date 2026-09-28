from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SubmissionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    submission_id: int
    form_id: int
    submitted_at: datetime
    status: str
    summary: str


class SubmissionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    submission_id: int
    form_id: int
    submitted_at: datetime
    status: str
    submission_data: dict[str, Any]