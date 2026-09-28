from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.config import get_settings
from app.database.session import Base, engine
from app.models.forms import Form, FormSubmission
from app.routers.auth import auth_router
from app.routers.forms import public_router as public_forms_router
from app.routers.forms import router as forms_router
from app.routers.health import router as health_router

settings = get_settings()

app = FastAPI(title="Dynamic Form Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(forms_router)
app.include_router(public_forms_router)


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "Dynamic Form Builder API"}
