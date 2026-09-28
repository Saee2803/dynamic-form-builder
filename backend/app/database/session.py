from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.database.config import get_settings

settings = get_settings()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured. Set it in backend/.env before starting the app.")

if not settings.DATABASE_URL.startswith("mysql+"):
    raise RuntimeError(
        "This project requires a MySQL SQLAlchemy URL using the mysql+pymysql:// format. "
        f"Current value: {settings.DATABASE_URL}"
    )

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
