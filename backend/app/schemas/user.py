from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: Role


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


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
