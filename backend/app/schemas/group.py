import re

from pydantic import BaseModel, field_validator, model_validator

from app.models.group import GROUP_TYPE_VALUES, MAJOR_NAMES, TRIMESTER_VALUES, VALID_MAJORS

_CUSTOM_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{1,49}$")


class GroupCreate(BaseModel):
    code: str | None = None
    major: str | None = None
    # Accept either enrollment_year_short (23) or full year (2023) — normalised to short
    enrollment_year_short: int | None = None
    enrollment_year_full: int | None = None
    group_number: int | None = None
    group_type: str = "MAIN"
    semester: str | None = None       # TRIMESTER_1/2/3 for ELECTIVE
    academic_year: str | None = None  # e.g. 2025-2026

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if not _CUSTOM_CODE_RE.match(v):
            raise ValueError("code may contain uppercase letters, numbers, hyphens, and underscores")
        return v

    @field_validator("major")
    @classmethod
    def validate_major(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in VALID_MAJORS:
            raise ValueError(f"Unknown major '{v}'. Valid values: {', '.join(sorted(VALID_MAJORS))}")
        return v

    @field_validator("group_type")
    @classmethod
    def validate_group_type(cls, v: str) -> str:
        v = v.upper()
        if v not in GROUP_TYPE_VALUES:
            raise ValueError(f"group_type must be one of {GROUP_TYPE_VALUES}")
        return v

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in TRIMESTER_VALUES:
            raise ValueError(f"trimester must be one of {TRIMESTER_VALUES}")
        return v

    @model_validator(mode="after")
    def resolve_year(self) -> "GroupCreate":
        if self.enrollment_year_full is not None:
            self.enrollment_year_short = self.enrollment_year_full % 100
        if self.group_type == "MAIN":
            if self.major is None or self.enrollment_year_short is None or self.group_number is None:
                raise ValueError("MAIN groups require major, enrollment year, and group number")
            self.code = f"{self.major}-{self.enrollment_year_short:02d}{self.group_number:02d}"
        elif not self.code:
            raise ValueError("ELECTIVE groups require a custom code")
        return self


class GroupUpdate(BaseModel):
    code: str | None = None
    major: str | None = None
    enrollment_year_short: int | None = None
    group_number: int | None = None
    group_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if not _CUSTOM_CODE_RE.match(v):
            raise ValueError("code may contain uppercase letters, numbers, hyphens, and underscores")
        return v

    @field_validator("major")
    @classmethod
    def validate_major(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in VALID_MAJORS:
            raise ValueError(f"Unknown major '{v}'")
        return v

    @field_validator("group_type")
    @classmethod
    def validate_group_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in GROUP_TYPE_VALUES:
            raise ValueError(f"group_type must be one of {GROUP_TYPE_VALUES}")
        return v

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in TRIMESTER_VALUES:
            raise ValueError(f"trimester must be one of {TRIMESTER_VALUES}")
        return v


class GroupStudentAdd(BaseModel):
    student_ids: list[int]


class GroupOut(BaseModel):
    id: int
    code: str | None = None
    major: str | None = None
    major_name: str
    enrollment_year_short: int | None = None
    enrollment_year_full: int | None = None
    group_number: int | None = None
    group_type: str
    semester: str | None = None
    academic_year: str | None = None
    is_active: bool
    name: str
    current_study_year: int
    student_count: int = 0

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_count(cls, group, count: int = 0) -> "GroupOut":
        return cls(
            id=group.id,
            code=group.code,
            major=group.major,
            major_name=MAJOR_NAMES.get(group.major, group.major) if group.major else "",
            enrollment_year_short=group.enrollment_year_short,
            enrollment_year_full=group.enrollment_year_full,
            group_number=group.group_number,
            group_type=group.group_type,
            semester=group.semester,
            academic_year=group.academic_year,
            is_active=group.is_active,
            name=group.name,
            current_study_year=group.current_study_year,
            student_count=count,
        )
