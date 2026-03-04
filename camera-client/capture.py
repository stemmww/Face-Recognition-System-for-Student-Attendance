"""Camera client — captures frames and sends them to the backend for recognition.

Usage:
    python capture.py --session-id 42 [--camera 0] [--interval 2]

This script runs on the machine physically connected to the camera.
It captures JPEG frames in a loop and POSTs them to the backend's
frame processing endpoint.
"""

import argparse
import io
import sys
import time

import cv2
import requests

from config import BACKEND_URL, CAMERA_INDEX, FRAME_INTERVAL_SECONDS, JPEG_QUALITY


def main():
    parser = argparse.ArgumentParser(description="Camera frame capture client")
    parser.add_argument("--session-id", type=int, required=True, help="Attendance session ID")
    parser.add_argument("--camera", type=int, default=CAMERA_INDEX, help="Camera device index")
    parser.add_argument("--interval", type=float, default=FRAME_INTERVAL_SECONDS, help="Seconds between frames")
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Error: cannot open camera {args.camera}")
        sys.exit(1)

    url = f"{BACKEND_URL}/api/sessions/{args.session_id}/frame"
    print(f"Sending frames to {url} every {args.interval}s ...")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Warning: failed to capture frame, retrying...")
                time.sleep(1)
                continue

            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            jpeg_bytes = io.BytesIO(buffer.tobytes())

            try:
                resp = requests.post(
                    url,
                    files={"frame": ("frame.jpg", jpeg_bytes, "image/jpeg")},
                    timeout=10,
                )
                if resp.ok:
                    data = resp.json()
                    recognized = data.get("recognized", [])
                    if recognized:
                        names = ", ".join(r["name"] for r in recognized)
                        print(f"  Recognized: {names}")
                    else:
                        print("  No matches in this frame")
                else:
                    print(f"  Server error: {resp.status_code} — {resp.text[:100]}")
            except requests.RequestException as e:
                print(f"  Connection error: {e}")

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\nStopped by user.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
