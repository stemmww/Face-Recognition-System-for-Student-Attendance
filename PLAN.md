# Face Recognition System for Student Attendance Tracking

## System Overview

AI-powered attendance system where professors start QR-based sessions, students scan the QR code on their phone, complete a liveness challenge, and have their face verified against enrolled embeddings. GPS verification is optionally enforced.

---

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Frontend   │────▶│     Backend      │────▶│  PostgreSQL  │
│  React + TS  │     │  FastAPI + ONNX  │     │  + pgvector  │
│  Ant Design  │◀────│  SQLAlchemy 2.0  │◀────│              │
└─────────────┘     └─────────────────┘     └──────────────┘
     :3000               :8000                   :5433
```

- **Frontend:** React 18, TypeScript, Ant Design, Zustand, i18next (EN/KK/RU), Vite
- **Backend:** FastAPI, async SQLAlchemy + asyncpg, ONNX Runtime (SCRFD + ArcFace), Alembic
- **Database:** PostgreSQL 16 with pgvector for face embedding similarity search
- **Deployment:** Docker Compose (3 services: db, backend, frontend via Nginx)

---

## Completed Phases

### Phase 1 — Authentication & User Management

- JWT access/refresh tokens with auto-refresh via Axios interceptor
- Role-based access control (admin, professor, student) via `require_role()` dependency
- User CRUD (admin-only), bulk CSV student import
- Admin seed on first startup
- Password change (profile), forgot/reset password flow with SMTP email
- Login page with dark/light theme toggle and language switcher (EN/KK/RU)

### Phase 2 — Courses, Schedules & Enrollment

- Course CRUD with professor assignment and student enrollment
- Schedule management (day, time, room, class type)
- Role-filtered course listing (admin sees all, professor sees own, student sees enrolled)

### Phase 3 — Face Registration & AI Pipeline

- SCRFD face detector + ArcFace recognizer (512-dim embeddings via ONNX Runtime)
- Face enrollment: upload photo → detect → align → extract embedding → store in pgvector
- Face verification: compare against enrolled embeddings with cosine similarity
- Embedding management: list, delete per student, delete all
- Admin Face Registry page with pipeline status, photo upload, and verification testing
- AI model weights downloaded via `download_models.py` (excluded from git)

### Phase 4 — QR Attendance & Live Sessions

- **QR-based flow** (replaced the old professor-camera approach):
  1. Professor starts session → backend generates a rotating JWT-signed QR token
  2. Student scans QR on their phone
  3. Student completes an active liveness challenge (blink / head turn / nod)
  4. Student's camera captures 5 frames → sent with QR token for face verification
  5. Backend verifies: QR token → GPS (if required) → liveness → face recognition → attendance recorded
- Configurable QR rotation interval (15s–90s), one-time-use nonce per QR code
- GPS enforcement: if professor provides coordinates, students must be within radius
- Rate limiting per student per session to prevent spam
- Early duplicate check: instant return if already recorded
- Auto-mark absent on session stop for unrecorded students
- Manual roll-call tab for professors (batch mark students present/late/absent)
- Session attendance export to CSV

### Phase 5 — Student Dashboard & Notifications

- Student dashboard with per-course attendance summary and trend charts
- Per-course detailed attendance history with date/status/time
- Notification system: auto-created on absent mark and appeal status change
- Notification bell in header with unread count badge

### Phase 6 — Appeals & Statistics

- Student appeal submission for specific attendance records
- Professor appeal review (approve/reject, auto-updates attendance + notifies student)
- Duplicate appeal prevention
- Course statistics: per-student breakdown, attendance rates, session trends
- Professor and admin dashboards with bar/area charts (Recharts)
- Attendance trend charts for students

### Phase 7 — Polish & Testing

- **Face quality gate (`app/ai/quality.py`):** every frame is scored for size,
  sharpness (Laplacian variance), brightness, contrast, and pose (yaw/pitch
  from 5-point landmarks) before reaching ArcFace. Hard failures are rejected
  with a user-facing reason; soft failures emit warnings only. Strict mode
  promotes soft → hard for admin enrollment and verification auto-enroll, so
  the stored centroid cannot drift toward low-quality embeddings. All
  thresholds are tunable via `QUALITY_*` env vars.
- **Test suite (116 tests):** pytest + pytest-asyncio with in-memory SQLite
  - Unit tests: JWT tokens, password hashing, haversine GPS distance, liveness detection (passive + active challenges)
  - API integration tests: auth endpoints (login, refresh, forgot/reset), user CRUD, RBAC enforcement
- Error boundary at layout level (page crash keeps sidebar/header visible)
- Single `.env` file (eliminated duplicate `backend/.env` that caused config drift)
- Shared theme constants (`styles/theme.ts`) for dark/light mode colors and auth page styles
- All TypeScript types consolidated in `src/types/index.ts`
- Alembic migrations with auto-generated hex revision IDs
- Internationalization: English, Kazakh, Russian (all pages)
- Dark mode with system-wide Ant Design theme integration
- Mobile-responsive layout (sidebar, login, all pages)

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (auth, users, courses, sessions, attend, ...)
│   │   ├── core/           # Security (JWT, bcrypt), RBAC, exceptions
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response validation
│   │   ├── services/       # Business logic layer
│   │   ├── ai/             # Face detection + recognition pipeline (ONNX)
│   │   ├── utils/          # Helpers (geo, liveness, time, file storage)
│   │   ├── config.py       # Pydantic Settings (auto-discovers .env)
│   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   └── main.py         # FastAPI app, lifespan, router registration
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt / requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API functions (thin wrappers, no type defs)
│   │   ├── components/     # Layout (AppLayout, Sidebar, Header, ErrorBoundary, ProtectedRoute)
│   │   ├── hooks/          # useAuth, useAttendance, useIsMobile
│   │   ├── i18n/           # i18next config + locale files (en, kk, ru)
│   │   ├── pages/          # admin/, professor/, student/ page components
│   │   ├── stores/         # Zustand (auth, theme, notifications)
│   │   ├── styles/         # Shared theme constants (colors, auth page styles)
│   │   ├── types/          # All TypeScript interfaces (single source of truth)
│   │   └── utils/          # Formatters, constants
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env                    # Single source of truth for all config
└── .env.example
```

---

## Configuration

All environment variables live in a single root `.env` file. Docker Compose reads it directly; the backend's `config.py` auto-discovers it from the current or parent directory. Do **not** create a separate `backend/.env`.

Key settings: `DATABASE_URL`, `JWT_SECRET_KEY`, `SMTP_*` (for password reset emails), `FRONTEND_URL`, `RECOGNITION_THRESHOLD`, `QR_TOKEN_EXPIRE_SECONDS`, `GPS_RADIUS_METERS`.

See `.env.example` for all options with documentation.

---

## Running Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

Tests use an in-memory SQLite database — no Docker or PostgreSQL required.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Face recognition accuracy too low | Multiple reference photos per student (3–5); tunable cosine threshold (default 0.5); quality gate rejects blurry/dark/off-angle frames before they reach ArcFace; professor manual override + manual roll-call tab |
| Auto-enrollment poisoning the stored centroid | Strict quality gate on auto-enroll: only frames passing every hard *and* soft threshold are persisted, with a 20-embedding cap per student |
| Spoofing with photo/video | Active liveness challenges (blink, head turn, nod) + passive landmark variance check |
| QR code sharing between students | One-time-use nonce per QR token; rate limiting per student per session; GPS enforcement when configured |
| Camera quality / lighting issues | 5-frame capture with 400ms intervals; SCRFD handles varied conditions; face alignment before embedding |
| pgvector slow with many embeddings | Scope search to enrolled students only; HNSW index available for scaling |
| GPU not available on server | ONNX Runtime works on CPU (slower but functional); models are lightweight (~30MB each) |
