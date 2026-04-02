"""Download InsightFace ONNX models (SCRFD detector + ArcFace recognizer).

Models are from the InsightFace buffalo_l model pack.
Run: python download_models.py
"""

import os
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

MODELS_DIR = Path(__file__).parent / "models"
BUFFALO_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"

REQUIRED_FILES = {
    "det_10g.onnx": "SCRFD face detector (10G FLOPs, with landmarks)",
    "w600k_r50.onnx": "ArcFace recognition model (ResNet-50, trained on 600K identities)",
}


def progress_hook(count, block_size, total_size):
    percent = min(100, int(count * block_size * 100 / total_size))
    sys.stdout.write(f"\r  Downloading... {percent}%")
    sys.stdout.flush()


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    missing = [f for f in REQUIRED_FILES if not (MODELS_DIR / f).exists()]
    if not missing:
        print("All models already present:")
        for f, desc in REQUIRED_FILES.items():
            size_mb = (MODELS_DIR / f).stat().st_size / 1024 / 1024
            print(f"  {f} ({size_mb:.1f} MB) — {desc}")
        return

    print(f"Missing models: {', '.join(missing)}")
    print("Downloading buffalo_l model pack from InsightFace...")

    zip_path = MODELS_DIR / "buffalo_l.zip"
    urlretrieve(BUFFALO_URL, zip_path, progress_hook)
    print("\n  Download complete.")

    print("  Extracting required models...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.namelist():
            filename = os.path.basename(member)
            if filename in REQUIRED_FILES:
                target = MODELS_DIR / filename
                with zf.open(member) as src, open(target, "wb") as dst:
                    dst.write(src.read())
                size_mb = target.stat().st_size / 1024 / 1024
                print(f"  Extracted: {filename} ({size_mb:.1f} MB)")

    zip_path.unlink()
    print("\nModel setup complete! Files in:", MODELS_DIR)

    for f, desc in REQUIRED_FILES.items():
        path = MODELS_DIR / f
        if path.exists():
            print(f"  [OK] {f} — {desc}")
        else:
            print(f"  [MISSING] {f} — {desc}")


if __name__ == "__main__":
    main()
