# DDUGU Smart Campus Classroom Management System
> Intelligent, Conflict-Free Campus Room Booking & Resource Scheduling Platform for Deen Dayal Upadhyaya Gorakhpur University (DDUGU).

---

## 1. Project Overview & Problem Statement

### Problem Statement
University campus facilities (lecture halls, classrooms, laboratories, seminar halls, and libraries) face severe scheduling bottlenecks:
- Multiple faculty members inadvertently booking the same classroom or overlapping time slots.
- Simultaneous lectures scheduled for the same academic cohort (e.g. Year 1 BCA Section A), forcing students to choose between concurrent required classes.
- Manual paper/spreadsheet scheduling that lacks real-time visibility, campus mapping, and instant conflict alerts.
- Inflexible student seating and lack of library study seat reservation systems.

### Objectives
1. **Interactive Campus Mapping**: Multi-floor visual map of Institute of Engineering & Technology (IET) and Deeksha Bhawan with live occupancy status.
2. **Double-Booking & Cohort Conflict Engine**: Real-time prevention of overlapping bookings by the same instructor, room collision, or concurrent lectures for the same student cohort.
3. **Role-Based Access Control**: Tailored workflows for Administrators, Faculty Members, and Students.
4. **Targeted Announcements & Conflict Reporting**: Priority-based issue reporting (Faculty High, Student Normal) and granular announcement targeting.
5. **Demonstration & Hackathon Readiness**: Hybrid architecture that functions both connected to a FastAPI + PostgreSQL/SQLite backend and standalone with local state persistence.

---

## 2. Main Features

- **Interactive Campus Visualizer**:
  - Full floor plans for IET (Ground, 1st, 2nd Floor) and Deeksha Bhawan (Ground, 1st Floor).
  - Room color-coding: Reservable (Green), In Use (Red), Pending (Yellow), Non-reservable Administrative Offices (Grey/Red).
- **Intelligent Room Directory**:
  - Filter rooms by Building, Floor, Room Type, Capacity, and Time Slot Availability.
  - Search by room name, code, or keywords (`iet`, `diksha bhawan`, `lh`, `seminar`).
- **Conflict Prevention Engine**:
  - *Rule 1 (Same Faculty Double Booking)*: Prevents an instructor from booking multiple rooms at the same time.
  - *Rule 2 (Cohort Scheduling Collision)*: Prevents overlapping lectures for the same academic year, branch, and section across the campus.
  - *Rule 3 (Time Window Boundary)*: Enforces operating hours (7:00 AM – 9:00 PM) and checks half-hour overlaps.
  - *Rule 4 (Role Permissions)*: Enforces that students cannot book classrooms; faculty cannot access admin tools.
- **Seat Reservations**:
  - Seat-by-seat reservation for study spaces and designated lectures.
  - Live seat availability map and duplicate reservation prevention.
- **Faculty Management & Excel Import**:
  - Admin tools to add, edit, activate, deactivate, and remove faculty accounts.
  - Excel `.xlsx` / `.xlsm` bulk import with intelligent column alias mapping.
  - Primary key updates (mobile number) with atomic cascade across bookings, announcements, and timetables.
- **Granular Announcements**:
  - Audience targeting: Broadcast to All, Selected Faculty, or Students filtered by Year, Branch, and Section.
  - Personal visibility service: Users can dismiss announcements from their personal view without deleting database records.
- **Conflict Resolution Workflow**:
  - Issue tickets with automated priority tagging (Faculty = High, Student = Normal).
  - Admin audit history and resolution note tracking.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend (Vanilla Web App)** | HTML5, CSS3 (Modern Glassmorphic UI), Vanilla JavaScript (ES6+), SVG Map Vectors |
| **Frontend (React App)** | React 18, Vite, Lucide React Icons, React Router |
| **Backend API** | Python 3.11+, FastAPI, Pydantic v2, Starlette |
| **Database & ORM** | SQLAlchemy 2.0, Alembic, SQLite (Zero-config/Demo) & PostgreSQL 15+ (Production) |
| **Security & Auth** | JWT (JSON Web Tokens), Passlib (Argon2 / bcrypt password hashing), OAuth2 Bearer |
| **Excel & File Processing** | OpenPyXL |
| **Testing** | Pytest, HTTPX, AnyIO (45 automated tests) |

---

## 4. Project Folder Structure

```
DDUGU project/
├── backend/                        # FastAPI Backend Application
│   ├── app/
│   │   ├── database/               # Database engine, session, Base model
│   │   ├── middleware/             # Error handling, request context
│   │   ├── models/                 # SQLAlchemy models (User, Faculty, Booking, Room, etc.)
│   │   ├── routes/                 # FastAPI routers (auth, admin, bookings, campus, etc.)
│   │   ├── schemas/                # Pydantic v2 schemas
│   │   ├── services/               # Core business logic & conflict engines
│   │   ├── config.py               # Application settings
│   │   ├── dependencies.py         # Unified CurrentPrincipal & RBAC dependencies
│   │   ├── main.py                 # FastAPI application factory & CORS setup
│   │   └── security.py             # Password hashing & JWT generation
│   ├── migrations/                 # Alembic migrations
│   ├── tests/                      # Automated test suite (45 tests)
│   ├── .env.example                # Example environment configuration
│   ├── requirements.txt            # Python dependencies
│   └── test.db                     # Seeded SQLite database for zero-config demo
├── classroom-booking/              # React + Vite Alternative Frontend
│   ├── src/
│   │   ├── components/             # Modals, Layout, Navbars
│   │   ├── context/                # AuthContext, BookingContext
│   │   ├── data/                   # Mock and fallback dataset
│   │   └── pages/                  # Dashboard, Map, Bookings, Admin, etc.
│   └── package.json
└── ddugu-booking/                  # Flagship Single-Page Application (HTML/CSS/JS)
    ├── css/                        # Responsive styles & themes
    ├── js/
    │   ├── data.js                 # Seeded university dataset & rooms
    │   └── app.js                  # Complete SPA application logic
    └── index.html                  # Main application entry point
```

---

## 5. Quick Start Instructions

### Option A: Flagship Single-Page App (Instant Zero-Config Demo)
The flagship application in `ddugu-booking/` runs immediately in any modern web browser without requiring node or python servers:
1. Open `ddugu-booking/index.html` in your browser (or use VS Code Live Server).
2. Use the Demo Role selector to sign in as **Student**, **Faculty**, or **Administrator**.

---

### Option B: Running the Backend & React Application

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env (defaults use SQLite test.db for instant setup):
cp .env.example .env

# Run database migrations (or start server to use test.db)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

#### 2. React Frontend Setup
```bash
# In a new terminal, navigate to classroom-booking
cd classroom-booking

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend will be live at: `http://localhost:5173`

---

## 6. Demo Accounts & Credentials

| Role | Username / Identifier | Password | Access Capabilities |
|---|---|---|---|
| **Administrator** | `admin@ddgu.edu` | `demo123` *(or `adminpassword123`)* | Full administrative control: Manage faculty, oversee & delete all bookings, resolve conflict tickets, bulk Excel import, campus audit logs. |
| **Faculty Member** *(Default)* | `1112223334` | `facultypassword123` *(or `demo123`)* | Book classrooms, labs, & seminar halls; publish targeted announcements; view cohort schedule; report high-priority conflicts; change credentials. |
| **Faculty Member** *(Alternative)* | `9506889898` | `demo123` | Additional faculty profile across university departments. |
| **Student** | `arjun.patel@ddgu.edu` | `studentpassword123` *(or `demo123`)* | View campus maps & room schedules; reserve Library study seats; submit normal-priority conflict reports; dismiss viewed announcements. |

---

## 7. Security Architecture

1. **Backend Role-Based Access Control (RBAC)**:
   - Server-level enforcement using `require_admin`, `require_staff`, and `get_current_principal`.
   - Direct requests by students to booking creation endpoints return `403 Forbidden`.
   - Unauthenticated requests return `401 Unauthorized`.
2. **Password Cryptography**:
   - Modern password hashing via Argon2 and bcrypt. Passwords are never stored in plain text.
3. **Database Concurrency & Integrity**:
   - Atomic multi-table updates on Faculty primary key alterations.
   - Non-reservable room enforcement: Offices (Director's Office, Teachers' Office, Placement Cell) are locked against room bookings.
   - Strict audience filtering ensuring student/faculty privacy on sensitive notices.

---

## 8. Test Suite Verification

Run the comprehensive automated test suite:
```bash
# From the project root
$env:PYTHONPATH="backend"
backend\.venv\Scripts\python -m pytest backend/tests -v
```
**Results: 45 Passed, 1 Skipped (Postgres exclusion test on SQLite), 0 Failed.**

---

## 9. Live Demonstration Checklist

Use this 15-step sequence during the hackathon presentation:

1. [ ] **Admin Login**: Sign in as Administrator (`admin@ddgu.edu`).
2. [ ] **Faculty Management**: Go to **Admin Panel** → View list of 51+ university faculty members.
3. [ ] **Add/Edit Faculty**: Edit a faculty mobile number and observe atomic cascade.
4. [ ] **Bulk Import**: Demonstrate Excel faculty import (`.xlsx`).
5. [ ] **Faculty Login**: Sign in with faculty mobile `1112223334` and password `facultypassword123`.
6. [ ] **Campus Map Exploration**: Open **Campus Map**; switch between IET (Ground, 1st, 2nd) and Deeksha Bhawan floors.
7. [ ] **Room Directory Filter**: Filter by building and time slot to find instantly available rooms.
8. [ ] **Room Booking**: Book Classroom IET 14 for 10:00 AM – 11:00 AM for Year 1 CSE Section A.
9. [ ] **Double-Booking Prevention**: Attempt to book another room at the same time; verify system blocks the conflict with clear error feedback.
10. [ ] **Cohort Conflict Prevention**: Log in as another faculty member and try scheduling a lecture for Year 1 CSE Section A at the same time; verify collision detection.
11. [ ] **Publish Announcement**: Publish a targeted announcement for Year 1 students.
12. [ ] **Student Login**: Sign in as Student (`arjun.patel@ddgu.edu`).
13. [ ] **Targeted Feed**: Confirm student sees the announcement; test personal "Dismiss" feature.
14. [ ] **Library Seat Reservation**: Navigate to Library, choose an open seat, and reserve it. Confirm duplicate reservation block.
15. [ ] **Conflict Resolution**: Student reports an issue → Admin logs in to **Conflict Resolution**, resolves ticket with action notes, and audits history.
