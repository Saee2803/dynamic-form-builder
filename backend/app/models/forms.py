from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class Form(Base):
    __tablename__ = "forms"

    form_id = Column(Integer, primary_key=True, index=True)
    form_name = Column(String(255), nullable=False)
    form_description = Column(Text, nullable=True)
    form_slug = Column(String(255), unique=True, nullable=False, index=True)
    form_config = Column(JSON, nullable=False, default={})
    status = Column(String(50), nullable=False, default="draft")
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    submissions = relationship("FormSubmission", back_populates="form", cascade="all, delete-orphan")


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    submission_id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.form_id", ondelete="CASCADE"), nullable=False, index=True)
    submission_data = Column(JSON, nullable=False, default={})
    form_snapshot = Column(JSON, nullable=True)
    submitted_by = Column(String(255), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False, default="submitted")

    form = relationship("Form", back_populates="submissions")
