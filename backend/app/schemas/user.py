import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import Role

_PASSWORD_MIN_LENGTH = 8
_PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")
_PASSWORD_HINT = (
    "Password must be at least 8 characters and contain "
    "an uppercase letter, a lowercase letter, and a digit."
)


def _validate_password(v: str) -> str:
    if len(v) < _PASSWORD_MIN_LENGTH or not _PASSWORD_PATTERN.search(v):
        raise ValueError(_PASSWORD_HINT)
    return v


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: Role

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_password(v)
        return v


class PasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: Role
    photo_url: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkImportRow(BaseModel):
    email: str
    first_name: str
    last_name: str
    password: str
    course_codes: list[str] = []


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    enrolled: int
    errors: list[str]
