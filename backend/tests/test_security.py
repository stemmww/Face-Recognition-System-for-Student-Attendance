"""Unit tests for app.core.security — JWT tokens and password hashing."""

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    def test_hash_and_verify(self):
        raw = "my_secure_password"
        hashed = hash_password(raw)
        assert hashed != raw
        assert verify_password(raw, hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert not verify_password("wrong", hashed)

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------


class TestAccessToken:
    def test_create_and_decode(self):
        token = create_access_token(subject=42, role="admin")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"

    def test_expiry_is_in_future(self):
        token = create_access_token(subject=1, role="student")
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp > datetime.now(timezone.utc)

    def test_expired_token_returns_none(self):
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        payload = {"sub": "1", "role": "admin", "exp": past, "type": "access"}
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        assert decode_token(token) is None

    def test_invalid_token_returns_none(self):
        assert decode_token("not.a.valid.token") is None

    def test_tampered_token_returns_none(self):
        token = create_access_token(subject=1, role="admin")
        tampered = token[:-4] + "XXXX"
        assert decode_token(tampered) is None


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------


class TestRefreshToken:
    def test_create_and_decode(self):
        token = create_refresh_token(subject=7)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "7"
        assert payload["type"] == "refresh"
        assert "role" not in payload

    def test_expiry_is_days_ahead(self):
        token = create_refresh_token(subject=1)
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp - now
        assert delta.days >= settings.REFRESH_TOKEN_EXPIRE_DAYS - 1


# ---------------------------------------------------------------------------
# Reset tokens
# ---------------------------------------------------------------------------


class TestResetToken:
    def test_create_and_decode(self):
        token = create_reset_token(user_id=99)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "99"
        assert payload["type"] == "reset"

    def test_expiry_matches_config(self):
        token = create_reset_token(user_id=1)
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp - now
        assert delta.total_seconds() <= settings.PASSWORD_RESET_EXPIRE_MINUTES * 60
        assert delta.total_seconds() > (settings.PASSWORD_RESET_EXPIRE_MINUTES - 1) * 60
