"""Pytest fixtures backed by a real PostgreSQL test database."""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

# Configure the environment before importing the application.
BACKEND_DIR = Path(__file__).resolve().parents[1]

import socket

def _is_pg_alive() -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    res = s.connect_ex(('127.0.0.1', 55432))
    s.close()
    return res == 0

DEFAULT_TEST_URL = (
    "postgresql+psycopg://postgres:postgres@127.0.0.1:55432/ddugu_test"
    if _is_pg_alive()
    else f"sqlite:///{BACKEND_DIR / 'test.db'}"
)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_URL)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, make_url, text  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.database.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.academic import Branch, Faculty, Student  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.campus_service import seed_branches, seed_campus  # noqa: E402

TEST_PASSWORD = "TestPass123!"
ADMIN_EMAIL = "admin@example.com"
FACULTY_EMAIL = "faculty@example.com"
STUDENT_EMAIL = "student@example.com"


def _ensure_database() -> None:
    if TEST_DATABASE_URL.startswith("sqlite"):
        return
    url = make_url(TEST_DATABASE_URL)
    database = url.database
    admin_engine = create_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    try:
        with admin_engine.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": database},
            ).scalar()
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{database}"'))
    finally:
        admin_engine.dispose()


@pytest.fixture(scope="session")
def test_engine():
    if TEST_DATABASE_URL.startswith("sqlite"):
        from app.database.base import Base
        import app.models  # noqa: F401
        sqlite_file = BACKEND_DIR / "test.db"
        if sqlite_file.exists():
            try:
                sqlite_file.unlink()
            except Exception:
                pass
        engine = create_engine(TEST_DATABASE_URL)
        Base.metadata.create_all(engine)
        yield engine
        engine.dispose()
        return

    _ensure_database()
    url = make_url(TEST_DATABASE_URL)
    admin_engine = create_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    with admin_engine.connect() as connection:
        connection.execute(
            text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = :name AND pid <> pg_backend_pid()"
            ),
            {"name": url.database},
        )
        connection.execute(text(f'DROP DATABASE IF EXISTS "{url.database}"'))
        connection.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin_engine.dispose()

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def prepare_database(test_engine):
    if not TEST_DATABASE_URL.startswith("sqlite"):
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
        config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
        command.upgrade(config, "head")

    TestingSession = sessionmaker(bind=test_engine, expire_on_commit=False)
    with TestingSession() as db:
        seed_campus(db)
        seed_branches(db)
    yield


@pytest.fixture(scope="session")
def testing_session_factory(test_engine, prepare_database):
    return sessionmaker(bind=test_engine, expire_on_commit=False)


@pytest.fixture()
def db(test_engine, testing_session_factory):
    with testing_session_factory() as session:
        yield session


@pytest.fixture(autouse=True)
def reset_state(test_engine, testing_session_factory, prepare_database):
    with test_engine.begin() as connection:
        if test_engine.dialect.name == "sqlite":
            for table in [
                "booking_history",
                "bookings",
                "timetables",
                "announcements",
                "students",
                "faculty",
                "users",
            ]:
                try:
                    connection.execute(text(f"DELETE FROM {table}"))
                except Exception:
                    pass
            try:
                connection.execute(text("DELETE FROM sqlite_sequence WHERE name IN ('booking_history', 'bookings', 'timetables', 'announcements', 'students', 'faculty', 'users')"))
            except Exception:
                pass
        else:
            connection.execute(
                text(
                    "TRUNCATE TABLE booking_history, bookings, timetables, "
                    "announcements, students, faculty, users "
                    "RESTART IDENTITY CASCADE"
                )
            )
        connection.execute(text("DELETE FROM rooms WHERE code LIKE 'TEST%'"))
        connection.execute(text("DELETE FROM floors WHERE name LIKE 'Test%'"))
        connection.execute(
            text("DELETE FROM buildings WHERE code LIKE 'TEST%'")
        )
        connection.execute(text("UPDATE rooms SET capacity = NULL"))

    with testing_session_factory() as session:
        admin = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            full_name="Test Admin",
            role=UserRole.admin,
        )
        faculty = User(
            email=FACULTY_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            full_name="Test Faculty",
            role=UserRole.faculty,
        )
        student_user = User(
            email=STUDENT_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            full_name="Test Student",
            role=UserRole.student,
        )
        session.add_all([admin, faculty, student_user])
        session.flush()

        branch = session.query(Branch).filter(Branch.code == "CSE").one()
        session.add(
            Faculty(
                mobile_number="1112223334",
                name="Prof. Faculty Member",
                department="CSE",
                designation="Professor",
                password_hash=hash_password("facultypassword123"),
                is_active=True,
            )
        )
        session.add(
            Student(
                enrollment_number="TEST-ENROLL-001",
                full_name="Test Student",
                email="test.student@example.com",
                branch_id=branch.id,
                academic_year=2,
                batch="2024-2028",
                section="A",
                user_id=student_user.id,
            )
        )
        session.commit()
    yield


@pytest.fixture()
def client(test_engine):
    TestingSession = sessionmaker(bind=test_engine, expire_on_commit=False)

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str = TEST_PASSWORD) -> dict:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def admin_headers(client):
    return login(client, ADMIN_EMAIL)


@pytest.fixture()
def faculty_headers(client):
    return login(client, FACULTY_EMAIL)


@pytest.fixture()
def student_headers(client):
    return login(client, STUDENT_EMAIL)


@pytest.fixture()
def room_ids(client, admin_headers):
    response = client.get("/api/v1/rooms", headers=admin_headers)
    assert response.status_code == 200, response.text
    return {room["code"]: room["id"] for room in response.json()}


def future_date(days: int = 7) -> date:
    return date.today() + timedelta(days=days)


def next_weekday(weekday: int, days: int = 7) -> date:
    """Return the first date at least `days` ahead matching weekday (Mon=0)."""
    candidate = date.today() + timedelta(days=days)
    while candidate.weekday() != weekday:
        candidate += timedelta(days=1)
    return candidate
