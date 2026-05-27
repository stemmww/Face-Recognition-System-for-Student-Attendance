from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

ROOM_TYPE_VALUES = ("L", "P", "K")   # L=lecture, P=PC room, K=room without PC
BLOCK_VALUES = ("C1.1", "C1.2", "C1.3")

ROOM_TYPE_LABELS: dict[str, str] = {
    "L": "Lecture hall",
    "P": "PC room",
    "K": "Room without PC",
}


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)   # canonical code e.g. C1.1.101L
    block: Mapped[str | None] = mapped_column(String(10), nullable=True)         # C1.1 / C1.2 / C1.3
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_number: Mapped[str | None] = mapped_column(String(10), nullable=True)
    room_type: Mapped[str | None] = mapped_column(String(5), nullable=True)      # L / P / K
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now(), onupdate=func.now())

    schedules = relationship("Schedule", back_populates="classroom")
