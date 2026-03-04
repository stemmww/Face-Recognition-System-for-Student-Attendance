# Face Recognition System for Student Attendance Tracking

## Implementation Plan

---

### Phase 0 — Project Setup & Infrastructure (Week 1)

**Goal:** Working dev environment with all services running locally.

| # | Task | Details |
|---|------|---------|
| 0.1 | Initialize repos & tooling | Git repo, `.gitignore`, `pre-commit`, linting (Ruff for Python, ESLint+Prettier for React) |
| 0.2 | Docker Compose | `docker-compose.yml` with PostgreSQL (pgvector), backend, frontend containers |
| 0.3 | Backend skeleton | FastAPI app with health-check route, pydantic-settings config, CORS setup |
| 0.4 | Database setup | SQLAlchemy 2.0 engine/session, Alembic init, pgvector extension enabled |
| 0.5 | Frontend skeleton | Vite + React + TypeScript, Tailwind CSS, Ant Design, router placeholder |
| 0.6 | CI basics | `.env.example`, README with setup instructions |

**Deliverable:** `docker compose up` boots all services; frontend shows a welcome page; backend returns `GET /health → 200`.

---

### Phase 1 — Authentication & User Management (Weeks 2–3)

**Goal:** Admin can create accounts; all roles can log in with JWT.

| # | Task | Details |
|---|------|---------|
| 1.1 | User model + migration | `users` table: id, email, hashed_password, first_name, last_name, role (enum: admin/professor/student), photo_url, is_active, created_at |
| 1.2 | Auth module | Password hashing (bcrypt), JWT access/refresh token creation & verification |
| 1.3 | Login API | `POST /api/auth/login` → returns token pair; `POST /api/auth/refresh` |
| 1.4 | RBAC dependency | `require_role()` FastAPI dependency that reads JWT and enforces allowed roles |
| 1.5 | User CRUD API | Admin-only endpoints: create, list, get, update, deactivate users |
| 1.6 | Seed admin user | Alembic data migration or startup script to create the first admin account |
| 1.7 | Frontend: Login page | Email/password form, store tokens in memory + httpOnly cookie for refresh |
| 1.8 | Frontend: Auth state | Zustand auth store, Axios interceptor for auto-attach token + refresh flow |
| 1.9 | Frontend: Protected routes | `<ProtectedRoute allowedRoles={[...]} />` wrapper component |
| 1.10 | Frontend: User management (Admin) | Table with create/edit/delete user modals |

**Deliverable:** Admin logs in, creates a student and professor account, those accounts can log in and see their (empty) dashboards.

---

### Phase 2 — Courses, Schedules & Enrollment (Weeks 3–4)

**Goal:** Admin configures academic structure; professors and students see their courses.

| # | Task | Details |
|---|------|---------|
| 2.1 | Course model + migration | `courses` table: id, code (unique), name, description, semester, academic_year |
| 2.2 | Course-Professor link | `course_professors` association table |
| 2.3 | Enrollment model | `enrollments` table: student_id, course_id, enrolled_at |
| 2.4 | Schedule model | `schedules` table: id, course_id, day_of_week, start_time, end_time, room, class_type |
| 2.5 | Course CRUD API | Admin endpoints for creating courses, assigning professors, enrolling students |
| 2.6 | Schedule CRUD API | Admin endpoints for schedule entries |
| 2.7 | Course listing API | Role-filtered: admin sees all, professor sees own, student sees enrolled |
| 2.8 | Frontend: Course management (Admin) | Create courses, assign professors, bulk-enroll students |
| 2.9 | Frontend: Schedule management (Admin) | Weekly timetable editor |
| 2.10 | Frontend: My Courses page | Professor and student views showing their courses and weekly schedule |

**Deliverable:** Full academic structure configured; each role sees relevant courses and schedules.

---

### Phase 3 — Face Registration & AI Pipeline (Weeks 5–7)

**Goal:** Admin can upload student photos; system can detect and recognize faces.

| # | Task | Details |
|---|------|---------|
| 3.1 | pgvector extension | Enable `CREATE EXTENSION vector;` migration |
| 3.2 | Face embedding model | `face_embeddings` table: id, user_id, embedding (vector(512)), photo_path, created_at |
| 3.3 | AI: YOLOv8-face detector | Wrapper class: load model, `detect(frame) → List[bbox]` |
| 3.4 | AI: InsightFace recognizer | Wrapper class: load model, `get_embedding(face_crop) → ndarray(512)` |
| 3.5 | AI: Full pipeline | `pipeline.process_frame(frame, enrolled_ids) → List[{student_id, confidence}]` |
| 3.6 | Face enrollment API | `POST /api/face/enroll` — upload photo, detect face, extract embedding, store |
| 3.7 | Face verification API | `POST /api/face/verify` — test photo against stored embeddings (admin tool) |
| 3.8 | Embedding management API | List/delete embeddings per student |
| 3.9 | Frontend: Face Registry (Admin) | Upload student photos, preview detected face, see stored embeddings |
| 3.10 | Model weight management | Download InsightFace buffalo_l + YOLOv8-face weights, mount via Docker volume |
| 3.11 | Matching optimization | Index face_embeddings with pgvector IVFFlat or HNSW index for fast cosine search |

**Deliverable:** Admin uploads photos for students; backend can take a test image and return the matched student identity with confidence score.

---

### Phase 4 — Attendance Sessions & Live Recognition (Weeks 7–9)

**Goal:** Professor starts a session, camera sends frames, system records attendance automatically.

| # | Task | Details |
|---|------|---------|
| 4.1 | Attendance session model | `attendance_sessions` table: id, schedule_id, date, started_at, ended_at, started_by, status |
| 4.2 | Attendance record model | `attendance_records` table: id, student_id, session_id, status (present/late/absent), recognized_at, marked_by (system/professor), updated_at |
| 4.3 | Session API | `POST /api/sessions` (start), `POST /api/sessions/{id}/stop` |
| 4.4 | Frame processing API | `POST /api/sessions/{id}/frame` — receives JPEG, runs pipeline, records attendance |
| 4.5 | Time-based status logic | Compare recognized_at vs schedule.start_time → present (≤5min) / late (5–15min) / absent (>15min) |
| 4.6 | Auto-mark absent | When session stops, all enrolled students not yet recognized get marked absent |
| 4.7 | Attendance listing API | By session, by course, by student — with role-based filtering |
| 4.8 | Manual status update API | `PATCH /api/attendance/{id}` — professor overrides status |
| 4.9 | Camera client | Python script: capture frames from webcam/IP camera, POST to session endpoint in a loop |
| 4.10 | Frontend: Live Session (Prof) | Start/stop button, live feed of recognized students appearing in real-time |
| 4.11 | Frontend: Attendance table (Prof) | Per-session student list with status badges, inline edit for manual override |

**Deliverable:** Professor clicks "Start Session," camera client sends frames, students are recognized and attendance is recorded with correct status; professor can manually fix statuses.

---

### Phase 5 — Student Dashboard & Notifications (Weeks 9–10)

**Goal:** Students can view their attendance; get notified when marked absent.

| # | Task | Details |
|---|------|---------|
| 5.1 | Student attendance API | `GET /api/attendance/student/me` — returns own attendance grouped by course |
| 5.2 | Notification model | `notifications` table: id, user_id, message, is_read, created_at |
| 5.3 | Notification triggers | Auto-create notification when student is marked absent; when appeal status changes |
| 5.4 | Notification API | `GET /api/notifications`, `PATCH /api/notifications/{id}/read` |
| 5.5 | Frontend: Student dashboard | Course list with attendance summary (% present, % late, % absent) |
| 5.6 | Frontend: Attendance history | Per-course detailed attendance table with date, status, time |
| 5.7 | Frontend: Student profile | View-only personal data + photo |
| 5.8 | Frontend: Notification bell | Header component with unread count badge, dropdown list |

**Deliverable:** Students log in, see their courses with attendance percentages, get flagged when absent.

---

### Phase 6 — Appeals & Statistics (Weeks 10–11)

**Goal:** Students can appeal; professors/admins see visual statistics.

| # | Task | Details |
|---|------|---------|
| 6.1 | Appeal model | `appeals` table: id, student_id, attendance_id, reason, status (pending/approved/rejected), reviewed_by, created_at |
| 6.2 | Appeal API | Student: submit appeal; Professor: list, approve/reject (auto-updates attendance record) |
| 6.3 | Statistics API | Per-course aggregation, per-student breakdown, system-wide overview |
| 6.4 | Frontend: Appeals (Student) | Form to submit appeal for a specific attendance record; list of own appeals |
| 6.5 | Frontend: Review Appeals (Prof) | Table of pending appeals with approve/reject buttons |
| 6.6 | Frontend: Statistics (Prof/Admin) | Bar charts (attendance by session), pie charts (present/late/absent distribution), per-student line charts |
| 6.7 | Frontend: Admin dashboard | System-wide overview cards: total users, courses, recognition accuracy, attendance rates |

**Deliverable:** Complete feature set — all roles fully functional.

---

### Phase 7 — Polish, Testing & Deployment (Weeks 11–13)

**Goal:** Production-ready system with tests and documentation.

| # | Task | Details |
|---|------|---------|
| 7.1 | Backend unit tests | Pytest: auth, RBAC, attendance logic, face pipeline (mocked) |
| 7.2 | Backend integration tests | Test API endpoints with test database |
| 7.3 | Frontend testing | React Testing Library for critical flows (login, attendance view) |
| 7.4 | Error handling | Global exception handlers, user-friendly error messages |
| 7.5 | Input validation | Strict Pydantic schemas, frontend form validation |
| 7.6 | Performance | Pagination on all list endpoints, lazy loading on frontend, image compression |
| 7.7 | Security hardening | Rate limiting, CORS tightening, SQL injection protection (ORM), XSS protection |
| 7.8 | Deployment | Docker Compose production config, Nginx reverse proxy, SSL (Let's Encrypt) |
| 7.9 | Seed data | Script to populate demo data (students, courses, attendance history) for thesis defense |
| 7.10 | Documentation | API docs (auto-generated Swagger), user guide, thesis technical chapter |

**Deliverable:** Deployable system with demo data, ready for thesis defense.

---

## Milestone Summary

| Milestone | Week | What Works |
|-----------|------|-----------|
| M0 | 1 | Dev environment boots, empty app shells |
| M1 | 3 | Login + user management |
| M2 | 4 | Courses, schedules, enrollment |
| M3 | 7 | Face registration + AI recognition |
| M4 | 9 | Live attendance sessions |
| M5 | 10 | Student dashboard + notifications |
| M6 | 11 | Appeals + statistics charts |
| M7 | 13 | Tested, polished, deployed |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Face recognition accuracy too low | Use multiple reference photos per student (3–5); tune cosine distance threshold; allow professor manual override |
| Camera quality / lighting issues | Recommend minimum camera specs; preprocessing (histogram equalization, face alignment) |
| pgvector slow with many embeddings | HNSW index; scope search to enrolled students only (not entire DB) |
| GPU not available on server | InsightFace and YOLOv8 work on CPU (slower but functional); use ONNX runtime for optimization |
| Students gaming the system | Log all recognition events with timestamps and confidence scores for audit |
