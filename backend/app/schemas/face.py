from datetime import datetime

from pydantic import BaseModel


class FaceEmbeddingOut(BaseModel):
    id: int
    user_id: int
    photo_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FaceCoverageOut(BaseModel):
    user_id: int
    embedding_count: int
    latest_embedding_at: datetime | None = None


class FaceRegistryStudentOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    photo_url: str | None = None
    is_active: bool
    created_at: datetime
    embedding_count: int
    latest_embedding_at: datetime | None = None


class FaceRegistryCountsOut(BaseModel):
    all: int
    missing: int
    needs_more: int
    complete: int


class FaceRegistryStudentsPage(BaseModel):
    items: list[FaceRegistryStudentOut]
    counts: FaceRegistryCountsOut
    filtered_total: int
    limit: int
    offset: int


class FaceEnrollResponse(BaseModel):
    id: int
    user_id: int
    photo_path: str
    faces_detected: int
    message: str


class FaceVerifyMatch(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    similarity: float


class FaceVerifyResponse(BaseModel):
    faces_detected: int
    matches: list[FaceVerifyMatch]


class PipelineStatusResponse(BaseModel):
    insightface_loaded: bool  # ArcFace recognizer (w600k_r50.onnx)
    yolo_loaded: bool  # SCRFD detector (det_10g.onnx)
