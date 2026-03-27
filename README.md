# Face Recognition System for Student Attendance Tracking

AI-powered attendance tracking system using face recognition. Built as a diploma project.

## Architecture

- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2.0 (async)
- **Frontend:** React 18 + TypeScript + Vite + Ant Design
- **Database:** PostgreSQL 16 + pgvector (face embeddings)
- **AI Models:** SCRFD (detection) + ArcFace (recognition) via ONNX Runtime
- **Auth:** JWT (access + refresh tokens) + RBAC (Admin / Professor / Student)
- **Deployment:** Docker Compose

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend development)
- Python 3.11+ (for backend development)

### 1. Clone and configure

```bash
git clone <repo-url>
cd Face-Recognition-System-For-Attendance-Tracking
cp .env.example .env
# Edit .env with your own secrets
```

### 2. Run with Docker Compose

```bash
docker compose up --build
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### 3. Local development (without Docker)

**Backend:**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate      # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python download_models.py    # Download AI models (~300 MB, one-time)
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### 4. Database migrations

```bash
cd backend
alembic upgrade head          # Apply all migrations
alembic revision --autogenerate -m "description"  # Create new migration
```

## Project Structure

```
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── ai/              # Face detection & recognition engine
│   │   ├── api/             # Route handlers
│   │   ├── core/            # Security, RBAC, exceptions
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic layer
│   │   └── utils/           # Helpers (file storage, geo, liveness)
│   ├── alembic/             # Database migrations
│   └── tests/               # Pytest test suite
│
├── frontend/                # React SPA
│   └── src/
│       ├── api/             # Axios API helpers
│       ├── components/      # Shared UI components
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Role-based page views
│       │   ├── admin/
│       │   ├── professor/
│       │   └── student/
│       ├── stores/          # Zustand state management
│       ├── types/           # TypeScript interfaces
│       └── utils/           # Constants & formatters
│
├── docker-compose.yml
└── PLAN.md                  # Full implementation roadmap
```

## Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system control. Manage users, courses, schedules, face registry. Everything a professor can do, plus more. |
| **Professor** | View own courses. Start/stop attendance sessions. Edit student statuses (Present/Late/Absent). View statistics. Review appeals. |
| **Student** | View enrolled courses. View own attendance history. View profile (read-only). Submit appeals. Receive absence notifications. |

## Default Admin Account

After first run, log in with the default credentials:
- Email: `admin@attendance.edu`
- Password: `admin123`

You can change these in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## License

This project is part of a diploma thesis and is intended for academic use.
