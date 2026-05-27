from pydantic import BaseModel, field_validator, model_validator

from app.models.group import GROUP_TYPE_VALUES, MAJOR_NAMES, SEMESTER_VALUES, VALID_MAJORS


class GroupCreate(BaseModel):
    major: str
    # Accept either enrollment_year_short (23) or full year (2023) — normalised to short
    enrollment_year_short: int | None = None
    enrollment_year_full: int | None = None
    group_number: int
    group_type: str = "MAIN"
    semester: str | None = None       # required for ELECTIVE
    academic_year: str | None = None  # e.g. 2025-2026

    @field_validator("major")
    @classmethod
    def validate_major(cls, v: str) -> str:
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
        if v not in SEMESTER_VALUES:
            raise ValueError(f"semester must be one of {SEMESTER_VALUES}")
        return v

    @model_validator(mode="after")
    def resolve_year(self) -> "GroupCreate":
        if self.enrollment_year_full is not None:
            self.enrollment_year_short = self.enrollment_year_full % 100
        if self.enrollment_year_short is None:
            raise ValueError("Provide enrollment_year_short or enrollment_year_full")
        return self


class GroupUpdate(BaseModel):
    major: str | None = None
    enrollment_year_short: int | None = None
    group_number: int | None = None
    group_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    is_active: bool | None = None

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


class GroupStudentAdd(BaseModel):
    student_ids: list[int]


class GroupOut(BaseModel):
    id: int
    major: str
    major_name: str
    enrollment_year_short: int
    enrollment_year_full: int
    group_number: int
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
            major=group.major,
            major_name=MAJOR_NAMES.get(group.major, group.major),
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
