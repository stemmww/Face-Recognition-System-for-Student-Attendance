import re

from pydantic import BaseModel, field_validator, model_validator

from app.models.classroom import ROOM_TYPE_LABELS, ROOM_TYPE_VALUES

# Canonical format: C1.1.101L, with the room type suffix optional.
_CLASSROOM_RE = re.compile(
    r"^(C\d+\.\d+)\.(\d{3,4})([A-Z])?$",
    re.IGNORECASE,
)


def parse_classroom_name(name: str) -> dict | None:
    """Parse C1.1.101L into block, floor, room_number, room_type. Returns None if no match."""
    m = _CLASSROOM_RE.match(name.strip())
    if not m:
        return None
    room_type = m.group(3).upper() if m.group(3) else None
    if room_type and room_type not in ROOM_TYPE_VALUES:
        return None
    room_number = m.group(2)
    return {
        "block": m.group(1).upper(),
        "floor": int(room_number[0]),
        "room_number": room_number,
        "room_type": room_type,
    }


class ClassroomCreate(BaseModel):
    name: str
    capacity: int | None = None
    is_active: bool = True

    # These are auto-parsed from name; can also be passed explicitly
    block: str | None = None
    floor: int | None = None
    room_number: str | None = None
    room_type: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def parse_name_parts(self) -> "ClassroomCreate":
        parsed = parse_classroom_name(self.name)
        if not parsed:
            return self
        if self.block is None:
            self.block = parsed["block"]
        if self.floor is None:
            self.floor = parsed["floor"]
        if self.room_number is None:
            self.room_number = parsed["room_number"]
        if self.room_type is None:
            self.room_type = parsed["room_type"]
        return self


class ClassroomUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None
    room_type: str | None = None
    block: str | None = None
    floor: int | None = None
    room_number: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v

    @model_validator(mode="after")
    def parse_name_parts(self) -> "ClassroomUpdate":
        if not self.name:
            return self
        parsed = parse_classroom_name(self.name)
        if not parsed:
            return self
        if self.block is None:
            self.block = parsed["block"]
        if self.floor is None:
            self.floor = parsed["floor"]
        if self.room_number is None:
            self.room_number = parsed["room_number"]
        if self.room_type is None:
            self.room_type = parsed["room_type"]
        return self


class ClassroomOut(BaseModel):
    id: int
    name: str
    block: str | None = None
    floor: int | None = None
    room_number: str | None = None
    room_type: str | None = None
    room_type_label: str | None = None
    capacity: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, c) -> "ClassroomOut":
        return cls(
            id=c.id,
            name=c.name,
            block=c.block,
            floor=c.floor,
            room_number=c.room_number,
            room_type=c.room_type,
            room_type_label=ROOM_TYPE_LABELS.get(c.room_type or "", None),
            capacity=c.capacity,
            is_active=c.is_active,
        )
