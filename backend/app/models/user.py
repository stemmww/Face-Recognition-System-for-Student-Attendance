import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    ADMIN = "admin"
    PROFESSOR = "professor"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())

    # Face self-enrollment fields
    can_self_enroll_face: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    face_enrollment_status: Mapped[str | None] = mapped_column(String(30), default="NOT_STARTED", nullable=True, server_default="NOT_STARTED")
    face_enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    face_enrollment_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    enrollments = relationship("Enrollment", back_populates="student")
    face_embeddings = relationship("FaceEmbedding", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
