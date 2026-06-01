# Student Attendance — Flutter Mobile App

Mobile application for **students only**. Connects to the existing FastAPI backend.

---

## Prerequisites

- Flutter SDK ≥ 3.2 ([install](https://flutter.dev/docs/get-started/install))
- Android Studio or VS Code with Flutter extension
- Android device / emulator, or iOS simulator

---

## First-time setup

The `lib/` source files are complete. Run Flutter's project generator once to create
the platform boilerplate (gradle, iOS, etc.), then your sources are preserved:

```bash
cd mobile_student_app
flutter create . --project-name mobile_student_app --org com.attendance
flutter pub get
```

---

## Running the app

### 1. Local backend (Android emulator)

Android emulator maps `10.0.2.2` → your host machine. Default config already uses this.

```bash
# Start backend
cd ../backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run Flutter app (in another terminal)
cd ../mobile_student_app
flutter run
```

### 2. Real phone via ngrok

```bash
# Start backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Expose backend via ngrok
ngrok http 8000
# Copy the HTTPS URL, e.g. https://abc-123.ngrok-free.app

# Add ngrok origin to backend CORS (in .env):
# EXTRA_CORS_ORIGINS=["https://abc-123.ngrok-free.app"]
# Restart backend after changing .env

# Run Flutter with ngrok URL
flutter run --dart-define=API_BASE_URL=https://abc-123.ngrok-free.app
```

### 3. Railway (future production)

```bash
flutter run --dart-define=API_BASE_URL=https://your-app.up.railway.app
```

---

## Build APK (debug)

```bash
flutter build apk --debug
# Output: build/app/outputs/flutter-apk/app-debug.apk
```

## Build APK (release)

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://your-backend.up.railway.app
```

---

## API_BASE_URL summary

| Scenario | Value |
|---|---|
| Android emulator | `http://10.0.2.2:8000` (default) |
| iOS simulator | `http://localhost:8000` |
| Real phone via ngrok | `https://abc-123.ngrok-free.app` |
| Railway production | `https://your-app.up.railway.app` |

Set via `--dart-define=API_BASE_URL=<url>` at build/run time.

---

## Backend — Railway deployment

### Required environment variables on Railway

| Variable | Example |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` |
| `JWT_SECRET_KEY` | 64-char random string |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `CORS_ORIGINS` | `["https://your-frontend.up.railway.app"]` |
| `EXTRA_CORS_ORIGINS` | `["https://your-ngrok.ngrok-free.app"]` |
| `ENVIRONMENT` | `production` |
| `PORT` | Set automatically by Railway |

### Run Alembic migrations on Railway

Open a Railway shell or use the CLI:

```bash
cd backend
alembic upgrade head
```

### Backend Dockerfile

The existing `backend/Dockerfile` is ready for Railway.
Make sure the `CMD` uses `$PORT`:

```dockerfile
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

---

## App screens

| Screen | Route | Backend endpoint |
|---|---|---|
| Splash / auth check | `/` | `GET /api/users/me` |
| Login | `/login` | `POST /api/auth/login` |
| Dashboard | `/dashboard` | `GET /api/sessions/student/active`, `GET /api/schedules/my` |
| Schedule | `/dashboard/schedule` | `GET /api/schedules/my` |
| Attendance | `/dashboard/attendance` | `GET /api/sessions/student/active` |
| Attendance History | `/dashboard/attendance-history` | `GET /api/attendance/student/me` |
| Subjects | `/dashboard/subjects` | `GET /api/courses` |
| Face Enrollment | `/dashboard/face-enrollment` | `GET/POST /api/face-enrollment/me` |
| Notifications | `/dashboard/notifications` | `GET /api/notifications` |
| Appeals | `/dashboard/appeals` | `GET /api/appeals/me`, `POST /api/appeals` |
| Profile | `/dashboard/profile` | `GET /api/users/me` |

---

## Known limitations

- **Face-verified attendance** (liveness + QR + GPS) requires the WebRTC web flow.
  The mobile app shows active sessions and informs the student to use the web portal or ask the professor for manual marking. A future iteration can implement camera-based face verification natively.
- **QR scanning** is not yet implemented. A `mobile_qr_scanner` integration can be added as a follow-up.
- The app targets Android only. iOS support requires Xcode, code-signing setup, and `NSCameraUsageDescription` in `Info.plist`.
