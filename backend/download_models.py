"""Download all required ONNX models.

- SCRFD detector + ArcFace recognizer from InsightFace's buffalo_l pack.
- MiniFASNet anti-spoofing models from yakhyo/face-anti-spoofing (which
  re-publishes the Minivision weights as ONNX).

Run: python download_models.py
"""

import os
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

MODELS_DIR = Path(__file__).parent / "models"

BUFFALO_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
BUFFALO_FILES = {
    "det_10g.onnx": "SCRFD face detector (10G FLOPs, with landmarks)",
    "w600k_r50.onnx": "ArcFace recognition model (ResNet-50, trained on 600K identities)",
}

ANTISPOOF_FILES = {
    "MiniFASNetV1SE.onnx": (
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx",
        "Anti-spoof V1SE (Minivision Silent-Face-Anti-Spoofing, scale 4.0)",
    ),
    "MiniFASNetV2.onnx": (
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
        "Anti-spoof V2  (Minivision Silent-Face-Anti-Spoofing, scale 2.7)",
    ),
}


def progress_hook(count, block_size, total_size):
    percent = min(100, int(count * block_size * 100 / total_size))
    sys.stdout.write(f"\r  Downloading... {percent}%")
    sys.stdout.flush()


def _ensure_buffalo() -> None:
    missing = [f for f in BUFFALO_FILES if not (MODELS_DIR / f).exists()]
    if not missing:
        return
    print(f"Missing InsightFace models: {', '.join(missing)}")
    print("Downloading buffalo_l model pack...")
    zip_path = MODELS_DIR / "buffalo_l.zip"
    urlretrieve(BUFFALO_URL, zip_path, progress_hook)
    print("\n  Download complete.")
    print("  Extracting required models...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.namelist():
            filename = os.path.basename(member)
            if filename in BUFFALO_FILES:
                target = MODELS_DIR / filename
                with zf.open(member) as src, open(target, "wb") as dst:
                    dst.write(src.read())
                size_mb = target.stat().st_size / 1024 / 1024
                print(f"  Extracted: {filename} ({size_mb:.1f} MB)")
    zip_path.unlink()


def _ensure_antispoof() -> None:
    for filename, (url, _desc) in ANTISPOOF_FILES.items():
        target = MODELS_DIR / filename
        if target.exists():
            continue
        print(f"Downloading {filename}...")
        urlretrieve(url, target, progress_hook)
        size_mb = target.stat().st_size / 1024 / 1024
        print(f"\n  Saved: {filename} ({size_mb:.1f} MB)")


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    _ensure_buffalo()
    _ensure_antispoof()

    print("\nModel setup complete. Files in:", MODELS_DIR)
    all_files = {**BUFFALO_FILES, **{k: v[1] for k, v in ANTISPOOF_FILES.items()}}
    for filename, desc in all_files.items():
        path = MODELS_DIR / filename
        if path.exists():
            size_mb = path.stat().st_size / 1024 / 1024
            print(f"  [OK] {filename} ({size_mb:.1f} MB) — {desc}")
        else:
            print(f"  [MISSING] {filename} — {desc}")


if __name__ == "__main__":
    main()
