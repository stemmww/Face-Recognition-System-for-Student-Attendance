"""Camera client — captures frames from webcam and sends to the attendance session API.

Usage:
  python camera_client.py --session-id 1 --token <JWT_TOKEN>
  python camera_client.py --session-id 1 --email prof1@attendance.edu --password pass123

Options:
  --camera     Camera index (default: 0) or RTSP URL
  --interval   Seconds between frames (default: 3)
  --api-url    Backend API URL (default: http://localhost:8000/api)
  --show       Show camera preview window
"""

import argparse
import sys
import time

import cv2
import requests


def login(api_url: str, email: str, password: str) -> str:
    r = requests.post(f"{api_url}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def send_frame(api_url: str, session_id: int, frame_bytes: bytes, token: str) -> dict:
    r = requests.post(
        f"{api_url}/sessions/{session_id}/frame",
        files={"frame": ("frame.jpg", frame_bytes, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


def main():
    parser = argparse.ArgumentParser(description="Face recognition camera client")
    parser.add_argument("--session-id", type=int, required=True, help="Active session ID")
    parser.add_argument("--camera", default=0, help="Camera index or RTSP URL")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between frames")
    parser.add_argument("--api-url", default="http://localhost:8000/api", help="Backend API URL")
    parser.add_argument("--token", help="JWT access token (alternative to email/password)")
    parser.add_argument("--email", help="Login email")
    parser.add_argument("--password", help="Login password")
    parser.add_argument("--show", action="store_true", help="Show camera preview")
    args = parser.parse_args()

    if args.token:
        token = args.token
    elif args.email and args.password:
        print(f"Logging in as {args.email}...")
        token = login(args.api_url, args.email, args.password)
        print("Login successful.")
    else:
        print("ERROR: Provide either --token or --email + --password")
        sys.exit(1)

    cam_src = int(args.camera) if str(args.camera).isdigit() else args.camera
    cap = cv2.VideoCapture(cam_src)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera: {args.camera}")
        sys.exit(1)

    print(f"Camera opened. Sending frames every {args.interval}s to session {args.session_id}")
    print("Press Ctrl+C to stop.\n")

    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to capture frame, retrying...")
                time.sleep(1)
                continue

            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = buf.tobytes()

            try:
                result = send_frame(args.api_url, args.session_id, frame_bytes, token)
                frame_count += 1
                recognized = result.get("recognized", [])
                unknown = result.get("unknown_faces", 0)

                timestamp = time.strftime("%H:%M:%S")
                if recognized:
                    for r in recognized:
                        new_tag = " [NEW]" if r.get("is_new") else ""
                        print(
                            f"[{timestamp}] Frame #{frame_count}: "
                            f"{r['name']} -> {r['status']} "
                            f"({r['confidence']*100:.1f}%){new_tag}"
                        )
                elif unknown > 0:
                    print(f"[{timestamp}] Frame #{frame_count}: {unknown} unknown face(s)")
                else:
                    print(f"[{timestamp}] Frame #{frame_count}: no faces detected")

            except requests.exceptions.RequestException as e:
                print(f"API error: {e}")

            if args.show:
                try:
                    cv2.imshow("Camera", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                except cv2.error:
                    print("Warning: --show not supported (opencv-python-headless installed). Continuing without preview.")
                    args.show = False

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\nStopped after {frame_count} frames.")
    finally:
        cap.release()
        if args.show:
            try:
                cv2.destroyAllWindows()
            except cv2.error:
                pass


if __name__ == "__main__":
    main()
