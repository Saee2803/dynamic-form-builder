from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from fastapi.security import APIKeyCookie

from app.auth import create_session_token, read_session_token, verify_password
from app.database.config import get_settings

auth_router = APIRouter(prefix="/api/auth", tags=["admin authentication"])
SESSION_COOKIE = "admin_session"
session_cookie = APIKeyCookie(
    name=SESSION_COOKIE,
    scheme_name="AdminSessionCookie",
    description="HttpOnly admin session cookie from POST /api/auth/login",
    auto_error=False,
)


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)


class AdminSessionRead(BaseModel):
    username: str


def _auth_is_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.ADMIN_USERNAME
        and settings.ADMIN_PASSWORD_HASH
        and settings.ADMIN_SECRET_KEY
        and len(settings.ADMIN_SECRET_KEY) >= 32
        and settings.ADMIN_SESSION_TTL_SECONDS > 0
    )


def require_admin(token: str | None = Depends(session_cookie)) -> str:
    settings = get_settings()
    if not token or not _auth_is_configured():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    username = read_session_token(token, settings.ADMIN_SECRET_KEY)
    if username is None or not hmac.compare_digest(username, settings.ADMIN_USERNAME):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return username


@auth_router.post("/login", response_model=AdminSessionRead, summary="Create an admin session")
def login_admin(payload: AdminLoginRequest, response: Response) -> dict[str, str]:
    settings = get_settings()
    if not _auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin login is not configured",
        )

    username_matches = hmac.compare_digest(payload.username, settings.ADMIN_USERNAME or "")
    password_matches = verify_password(payload.password, settings.ADMIN_PASSWORD_HASH or "")
    if not username_matches or not password_matches:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_session_token(
        settings.ADMIN_USERNAME or "",
        settings.ADMIN_SECRET_KEY or "",
        settings.ADMIN_SESSION_TTL_SECONDS,
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.ADMIN_SESSION_TTL_SECONDS,
        httponly=True,
        secure=settings.ADMIN_COOKIE_SECURE,
        samesite="strict",
        path="/api",
    )
    return {"username": settings.ADMIN_USERNAME or ""}


@auth_router.get("/session", response_model=AdminSessionRead, summary="Check the current admin session")
def get_admin_session(username: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": username}


@auth_router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="End the current admin session",
)
def logout_admin(
    response: Response,
    _username: str = Depends(require_admin),
) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/api", httponly=True, samesite="strict")