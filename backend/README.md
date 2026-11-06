# Smart Campus Classroom Management — Backend

PostgreSQL + FastAPI backend for the DDUGU Smart Campus classroom booking
system. It provides the database, authentication, room/campus management,
availability search, bookings, timetables, announcements and student/faculty
records used by the existing frontends.

The two frontends in this repository (`ddugu-booking/` and
`classroom-booking/`) are untouched by this backend.

---

## Stack

| Layer | Choice |
| --- | --- |
| Language | Python 3.11+ |
| Web framework | FastAPI |
| ORM | SQLAlchemy 2.x (sync) |
| Driver | `psycopg` 3 |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Auth | JWT (PyJWT) + Argon2 password hashing (`pwdlib`) |
| Database | PostgreSQL 14+ (17 recommended) |

---

## Project layout

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, CORS, health
│   ├── config.py               # Environment-backed settings
│   ├── cli.py                  # seed / create-admin / check commands
│   ├── database/               # Engine, session, declarative base
│   ├── models/                 # SQLAlchemy models + enums
│   ├── schemas/                # Pydantic request/response models
│   ├── routes/                 # auth, academics, campus, availability,
│   │                           # bookings, timetables, announcements
│   ├── services/               # Business logic and validation
│   ├── middleware/             # Request ID + error translation
│   └── security.py             # Password hashing and JWT helpers
├── migrations/
│   └── versions/0001_initial_schema.py
├── tests/                      # pytest suite (real PostgreSQL)
├── alembic.ini
├── requirements.txt
└── .env.example
```

---

## 1. Prerequisites

- PostgreSQL running and reachable.
- Python 3.11 or newer.

Create a virtual environment and install dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 2. Configure environment variables

Copy `.env.example` to `.env` and edit the values:

```powershell
Copy-Item .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host:5432/ddugu` |
| `SECRET_KEY` | Long random value used to sign JWTs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime in minutes |
| `JWT_ALGORITHM` | Defaults to `HS256` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional bootstrap administrator |
| `FIRST_BOOKING_HOUR` / `LAST_BOOKING_HOUR` | Daily booking window (default 07:00–21:00) |
| `TEST_DATABASE_URL` | Database used only by the test suite |

Generate a secret key:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Environment variables take precedence over `.env`.

---

## 3. Database creation and migrations

Create an empty database (name it as configured in `DATABASE_URL`):

```sql
CREATE DATABASE ddugu;
```

Apply the schema:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

The initial migration creates the `btree_gist` extension (required for the
booking overlap constraint) and all enums, tables, indexes and constraints.
The role running the migration must be allowed to create extensions.

Verify connectivity:

```powershell
.\.venv\Scripts\python.exe -m app.cli check
```

---

## 4. Seed campus data and the first administrator

```powershell
.\.venv\Scripts\python.exe -m app.cli seed
```

This idempotently seeds:

- **Buildings:** IET and Deeksha Bhawan.
- **IET Ground:** Library.
- **IET First:** CSE Lab, ME Lab, ECE Lab, IT Lab, IET20, IET18, IET19, IET17.
- **IET Second:** IET32, IET24, IET25, IET29, IET30, IET28.
- **Deeksha Bhawan Ground:** LH01–LH07.
- **Deeksha Bhawan First:** LH08–LH12.
- **Branches:** CSE, AIML, AIDS, ECE, ME, IT.

Room capacities are **not** invented: every seeded room has `capacity = NULL`
until an administrator records the real capacity. Permitted uses are assigned
from configurable defaults based on room type (for example, labs allow `lab`
and `seminar`; the Library allows `library` and `study`) and can be changed
through the API.

Create an administrator explicitly if no bootstrap admin is configured:

```powershell
.\.venv\Scripts\python.exe -m app.cli create-admin `
  --email admin@example.edu --password "a-strong-password" --name "Administrator"
```

The `seed` command also creates the bootstrap admin when `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are both set (use `--skip-admin` to disable this).

---

## 5. Run the API

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- OpenAPI docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>
- API base path: `/api/v1`

---

## 6. Roles and access

| Capability | Student | Faculty | Admin |
| --- | --- | --- | --- |
| Log in, read own profile, change own password | ✅ | ✅ | ✅ |
| Browse buildings/floors/rooms/availability | ✅ | ✅ | ✅ |
| Create bookings | ✅ | ✅ | ✅ |
| View bookings | own only | all | all |
| Edit / cancel bookings | own pending/approved | own + manage | all |
| Approve / reject bookings | ❌ | ✅ | ✅ |
| Manage timetables and announcements | read only | create/update | full |
| Manage students, faculty, branches, campus | ❌ | read students/faculty | ✅ |

New bookings start as `pending`. Students may cancel their own bookings;
faculty and administrators can approve, reject and cancel. Students can only
see and manage their own bookings.

---

## 7. API overview

All routes are under `/api/v1` (except `/health` and `/`).

### Auth
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/login` | JSON email/password login |
| `POST` | `/auth/token` | OAuth2 password form (Swagger UI) |
| `GET` | `/auth/me` | Current user |
| `POST` | `/auth/change-password` | Change own password |
| `GET` / `POST` | `/auth/users` | List / create users (admin) |
| `PATCH` | `/auth/users/{id}` | Update role or activation (admin) |

### Campus
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/buildings` | List buildings with counts |
| `GET` | `/buildings/{id}` | Building with floors and rooms |
| `POST` / `PATCH` | `/buildings`, `/buildings/{id}` | Manage buildings (admin) |
| `GET` | `/floors`, `/floors/{id}` | Floors and their rooms |
| `POST` / `PATCH` | `/floors`, `/floors/{id}` | Manage floors (admin) |
| `GET` | `/rooms`, `/rooms/{id}` | Rooms with permitted uses |
| `POST` / `PATCH` | `/rooms`, `/rooms/{id}` | Manage rooms and capacities (admin) |
| `PUT` | `/rooms/{id}/permitted-uses` | Replace permitted uses (admin) |

### Availability
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/availability` | Filter by date, time, capacity, building, floor, type, use |
| `GET` | `/availability/rooms/{id}` | Busy slots and free windows for a day |

### Bookings
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/bookings` | Filter by room, building, floor, status, dates, search |
| `POST` | `/bookings` | Create booking; conflicts return alternatives |
| `GET` | `/bookings/{id}` | Booking with history |
| `PATCH` | `/bookings/{id}` | Edit a pending booking |
| `POST` | `/bookings/{id}/approve` | Approve (faculty/admin) |
| `POST` | `/bookings/{id}/reject` | Reject with reason (faculty/admin) |
| `POST` | `/bookings/{id}/cancel` | Cancel with reason |
| `GET` | `/bookings/{id}/history` | Audit trail |

### Academics
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/students` | Search/filter with pagination (staff) |
| `GET` | `/students/me` | Linked student profile |
| `POST` | `/students` | Create student (admin) |
| `POST` | `/students/import` | Bulk CSV/XLSX import (admin) |
| `GET` / `PATCH` / `DELETE` | `/students/{id}` | Read / update / deactivate |
| `GET` / `POST` | `/branches` | List / create branches |
| `GET` / `PATCH` | `/branches/{id}` | Read / update |
| `GET` / `POST` | `/student-groups` | List / create groups |
| `PATCH` | `/student-groups/{id}` | Update group |
| `GET` / `POST` | `/faculty` | List / create faculty |
| `GET` | `/faculty/me` | Linked faculty profile |
| `GET` / `PATCH` / `DELETE` | `/faculty/{id}` | Read / update / deactivate |

### Timetables and announcements
| Method | Path | Description |
| --- | --- | --- |
| `GET` / `POST` | `/timetables` | List / create (staff for writes) |
| `GET` / `PATCH` / `DELETE` | `/timetables/{id}` | Read / update / deactivate |
| `GET` / `POST` | `/announcements` | List (audience-filtered) / create |
| `GET` / `PATCH` | `/announcements/{id}` | Read / update |
| `DELETE` | `/announcements/{id}` | Delete (admin) |

### Student imports

`POST /api/v1/students/import` accepts `.csv`, `.xlsx` or `.xlsm` (max 10 MB).
Recognised columns (aliases are case-insensitive):

| Field | Required | Example |
| --- | --- | --- |
| `enrollment_number` | ✅ | `2024CSE001` |
| `full_name` | ✅ | `Student Name` |
| `branch_code` | ✅ | `CSE` |
| `academic_year` | ✅ | `1`–`4` |
| `batch` | ✅ | `2024-2028` |
| `section` | – | `A` or `B` |
| `email` | – | `student@example.edu` |
| `phone` | – | `9876543210` |
| `group_name` | – | Existing student group name |

Duplicates are prevented both within the uploaded file and against existing
enrollment numbers/emails. The response reports `created`, `skipped`,
`total_rows` and per-row errors.

---

## 8. Concurrency and overlap protection

Overlaps are prevented at two levels:

1. **Application checks** produce friendly `409 Conflict` responses that
   include the conflicting slots and alternative available rooms.
2. **PostgreSQL exclusion constraint** `ex_bookings_no_overlap` guarantees
   correctness under concurrent requests:

   ```sql
   EXCLUDE USING gist (
       room_id WITH =,
       tsrange(booking_date + start_time, booking_date + end_time) WITH &&
   )
   WHERE (status IN ('pending'::booking_status, 'approved'::booking_status))
   ```

   `cancelled` and `rejected` bookings no longer block a slot. Timetable
   entries are also treated as busy by availability and booking checks.

---

## 9. Tests

The test suite runs against a **real PostgreSQL database**, not SQLite, so the
exclusion constraint and PostgreSQL-specific features are exercised.

Set `TEST_DATABASE_URL` (or rely on the default in `tests/conftest.py`). The
suite drops and recreates the target test database, runs all migrations, seeds
the campus and branches, and resets data between tests.

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@127.0.0.1:55432/ddugu_test"
.\.venv\Scripts\python.exe -m pytest -v
```

Covered areas:

- Exact seeded campus structure and NULL capacities.
- Availability filtering (building, floor, room type, use, capacity).
- Booking creation, overlap rejection with alternatives, adjacency.
- Permitted-use and capacity validation; booking-window validation.
- Approval / rejection / cancellation and audit history.
- Role permissions and students-only-own-bookings visibility.
- Database exclusion constraint under two concurrent inserts.
- CSV/XLSX student imports and duplicate prevention.
- Timetable conflicts, timetable-blocked bookings and deactivation.
- Announcement audience filtering, building filter and expiry.

> The tests use clearly fake records such as `TEST-ENROLL-001`; no real
> student data is included in this repository.

---

## 10. Operational notes

- Passwords are hashed with Argon2; plain-text passwords are never stored.
- JWTs are signed with `SECRET_KEY`; rotate it to invalidate all tokens.
- Use HTTPS and a secrets manager in production; never commit `.env`.
- Capacities remain `NULL` until real values are recorded through
  `PATCH /api/v1/rooms/{id}` so the system never invents room data.
- The API logs a request ID (`X-Request-ID`) on every response for tracing.
