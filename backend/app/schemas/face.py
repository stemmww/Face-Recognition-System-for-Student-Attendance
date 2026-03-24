from datetime import datetime

from pydantic import BaseModel


class FaceEmbeddingOut(BaseModel):
    id: int
    user_id: int
    photo_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FaceEnrollResponse(BaseModel):
    id: int
    user_id: int
    photo_path: str
    faces_detected: int
    message: str
    quality_warnings: list[str] = []


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
