import re

from pydantic import BaseModel, field_validator, model_validator

from app.models.classroom import ROOM_TYPE_LABELS

# Canonical format: C1.1.101L
# block.floor_room_type  e.g. C1.2.305P
_CLASSROOM_RE = re.compile(
    r"^(C1\.[123])\.(\d)(\d{2})([LPK])$",
    re.IGNORECASE,
)


def parse_classroom_name(name: str) -> dict | None:
    """Parse C1.1.101L into block, floor, room_number, room_type. Returns None if no match."""
    m = _CLASSROOM_RE.match(name.strip())
    if not m:
        return None
    return {
        "block": m.group(1).upper(),
        "floor": int(m.group(2)),
        "room_number": m.group(2) + m.group(3),
        "room_type": m.group(4).upper(),
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
        if parsed and self.block is None:
            self.block = parsed["block"]
            self.floor = parsed["floor"]
            self.room_number = parsed["room_number"]
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
