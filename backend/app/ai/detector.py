"""SCRFD face detector using ONNX Runtime.

Uses the SCRFD model from the InsightFace model zoo for face detection
with 5-point facial landmarks (needed for alignment before recognition).
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    landmarks: np.ndarray | None = field(default=None, repr=False)  # (5, 2) keypoints


def _distance2bbox(points: np.ndarray, distance: np.ndarray) -> np.ndarray:
    x1 = points[:, 0] - distance[:, 0]
    y1 = points[:, 1] - distance[:, 1]
    x2 = points[:, 0] + distance[:, 2]
    y2 = points[:, 1] + distance[:, 3]
    return np.stack([x1, y1, x2, y2], axis=-1)


def _distance2kps(points: np.ndarray, distance: np.ndarray) -> np.ndarray:
    kps = distance.copy()
    for i in range(0, kps.shape[1], 2):
        kps[:, i] = points[:, 0] + kps[:, i]
        kps[:, i + 1] = points[:, 1] + kps[:, i + 1]
    return kps


def _nms(dets: np.ndarray, thresh: float) -> list[int]:
    x1 = dets[:, 0]
    y1 = dets[:, 1]
    x2 = dets[:, 2]
    y2 = dets[:, 3]
    scores = dets[:, 4]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(iou <= thresh)[0]
        order = order[inds + 1]
    return keep


class FaceDetector:
    """SCRFD face detector via ONNX Runtime."""

    def __init__(self, model_path: str | None = None, confidence: float = 0.3):
        self._session = None
        self._confidence = confidence
        self._model_path = model_path
        self._load_attempted = False
        self._input_size = (640, 640)
        self._fmc = 3
        self._feat_stride = [8, 16, 32]
        self._num_anchors = 2

    def _ensure_loaded(self) -> bool:
        if self._session is not None:
            return True
        if self._load_attempted:
            return False
        self._load_attempted = True
        try:
            import onnxruntime as ort

            path = self._model_path
            if path is None or not Path(path).exists():
                logger.warning("SCRFD model not found at %s — detector disabled", path)
                return False
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            options.enable_cpu_mem_arena = False
            options.enable_mem_pattern = False
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
            self._session = ort.InferenceSession(
                path,
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
            logger.info("SCRFD model loaded from %s", path)
            return True
        except Exception:
            logger.exception("Failed to load SCRFD model")
            return False

    @property
    def is_loaded(self) -> bool:
        return self._session is not None

    def unload(self) -> None:
        self._session = None

    def detect(self, image: np.ndarray) -> list[Detection]:
        if not self._ensure_loaded():
            return []

        img, scale, pad = self._preprocess(image)
        blob = cv2.dnn.blobFromImage(
            img, 1.0 / 128, self._input_size, (127.5, 127.5, 127.5), swapRB=True
        )

        outputs = self._session.run(None, {self._session.get_inputs()[0].name: blob})
        return self._postprocess(outputs, scale, pad, image.shape[:2])

    def _preprocess(self, image: np.ndarray):
        h, w = image.shape[:2]
        target_h, target_w = self._input_size
        scale = min(target_h / h, target_w / w)
        new_h, new_w = int(h * scale), int(w * scale)
        resized = cv2.resize(image, (new_w, new_h))
        padded = np.full((target_h, target_w, 3), 127, dtype=np.uint8)
        padded[:new_h, :new_w] = resized
        return padded, scale, (0, 0)

    def _postprocess(self, outputs, scale, pad, orig_shape):
        all_bboxes = []
        all_kpss = []
        all_scores = []

        for idx, stride in enumerate(self._feat_stride):
            score_blob = outputs[idx]
            bbox_blob = outputs[idx + self._fmc]
            kps_blob = outputs[idx + self._fmc * 2] if len(outputs) > self._fmc * 2 else None

            # Model outputs may or may not include a batch dimension
            if score_blob.ndim == 3:
                score_blob = score_blob[0]
            if bbox_blob.ndim == 3:
                bbox_blob = bbox_blob[0]
            if kps_blob is not None and kps_blob.ndim == 3:
                kps_blob = kps_blob[0]

            scores = score_blob
            bbox_preds = bbox_blob * stride
            if kps_blob is not None:
                kps_preds = kps_blob * stride

            h = self._input_size[0] // stride
            w = self._input_size[1] // stride

            anchor_centers = np.stack(np.mgrid[:h, :w][::-1], axis=-1).astype(np.float32)
            anchor_centers = (anchor_centers * stride).reshape((-1, 2))
            if self._num_anchors > 1:
                anchor_centers = np.stack(
                    [anchor_centers] * self._num_anchors, axis=1
                ).reshape((-1, 2))

            pos_inds = np.where(scores >= self._confidence)[0]
            if len(pos_inds) == 0:
                continue

            bboxes = _distance2bbox(anchor_centers, bbox_preds)
            bboxes = bboxes[pos_inds]

            kpss = None
            if kps_blob is not None:
                kpss = _distance2kps(anchor_centers, kps_preds)
                kpss = kpss[pos_inds].reshape(-1, 5, 2)

            s = scores[pos_inds].flatten()
            all_bboxes.append(bboxes)
            all_scores.append(s)
            if kpss is not None:
                all_kpss.append(kpss)

        if len(all_bboxes) == 0:
            return []

        all_bboxes = np.concatenate(all_bboxes, axis=0)
        all_scores = np.concatenate(all_scores, axis=0)
        kpss = np.concatenate(all_kpss, axis=0) if all_kpss else None

        dets = np.hstack([all_bboxes, all_scores[:, None]])
        keep = _nms(dets, 0.4)

        detections: list[Detection] = []
        for i in keep:
            bbox = all_bboxes[i] / scale
            x1, y1, x2, y2 = bbox.astype(int)
            kps = kpss[i] / scale if kpss is not None else None
            detections.append(
                Detection(
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=float(all_scores[i]),
                    landmarks=kps,
                )
            )
        return detections
