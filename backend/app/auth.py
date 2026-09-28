from __future__ import annotations

import base64
import getpass
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

PASSWORD_HASH_ITERATIONS = 310_000
MIN_PASSWORD_HASH_ITERATIONS = 100_000
MAX_PASSWORD_HASH_ITERATIONS = 1_000_000


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str, iterations: int = PASSWORD_HASH_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_encode(salt)}${_encode(digest)}"


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iteration_text, salt_text, digest_text = encoded_hash.split("$", 3)
        iterations = int(iteration_text)
        if algorithm != "pbkdf2_sha256" or not MIN_PASSWORD_HASH_ITERATIONS <= iterations <= MAX_PASSWORD_HASH_ITERATIONS:
            return False
        salt = _decode(salt_text)
        expected = _decode(digest_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    except (AttributeError, ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def create_session_token(username: str, secret: str, ttl_seconds: int, now: int | None = None) -> str:
    payload = json.dumps(
        {"sub": username, "exp": (int(time.time()) if now is None else now) + ttl_seconds},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded_payload = _encode(payload)
    signature = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_encode(signature)}"


def read_session_token(token: str, secret: str, now: int | None = None) -> str | None:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        supplied_signature = _decode(encoded_signature)
        expected_signature = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(supplied_signature, expected_signature):
            return None
        payload: dict[str, Any] = json.loads(_decode(encoded_payload))
        expires_at = payload.get("exp")
        username = payload.get("sub")
        current_time = int(time.time()) if now is None else now
        if not isinstance(expires_at, int) or expires_at <= current_time or not isinstance(username, str):
            return None
        return username
    except (AttributeError, ValueError, TypeError, json.JSONDecodeError):
        return None


if __name__ == "__main__":
    password = getpass.getpass("New admin password (minimum 12 characters): ")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters.")
    confirmation = getpass.getpass("Confirm admin password: ")
    if not hmac.compare_digest(password, confirmation):
        raise SystemExit("Passwords do not match.")
    print(hash_password(password))