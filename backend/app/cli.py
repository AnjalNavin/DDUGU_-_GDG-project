"""Command-line utilities: seed, admin bootstrap and connectivity check."""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from app.config import settings
from app.database.session import SessionLocal, engine
from app.services.auth_service import bootstrap_admin
from app.services.campus_service import seed_branches, seed_campus


def command_seed(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        campus = seed_campus(db)
        branches = seed_branches(db)
        print("Campus seed complete:")
        for key, value in campus.items():
            print(f"  {key}: {value}")
        for key, value in branches.items():
            print(f"  {key}: {value}")

        if not args.skip_admin and settings.admin_email and settings.admin_password:
            admin = bootstrap_admin(
                db,
                settings.admin_email,
                settings.admin_password,
                settings.admin_full_name,
            )
            print(f"  bootstrap admin: {admin.email}")
        elif not args.skip_admin:
            print(
                "  bootstrap admin: skipped (set ADMIN_EMAIL and ADMIN_PASSWORD)"
            )
    return 0


def command_create_admin(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        admin = bootstrap_admin(
            db, args.email, args.password, args.name
        )
        print(f"Admin available: {admin.email}")
    return 0


def command_check(args: argparse.Namespace) -> int:
    with engine.connect() as connection:
        version = connection.execute(text("SHOW server_version")).scalar_one()
        database = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()
        user = connection.execute(text("SELECT current_user")).scalar_one()
    print(f"Connected to PostgreSQL {version} (db={database}, user={user})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed = subparsers.add_parser(
        "seed", help="Seed campus buildings/floors/rooms and branches"
    )
    seed.add_argument(
        "--skip-admin",
        action="store_true",
        help="Do not create the bootstrap admin from environment variables",
    )
    seed.set_defaults(func=command_seed)

    admin = subparsers.add_parser(
        "create-admin", help="Create or ensure an administrator account"
    )
    admin.add_argument("--email", required=True)
    admin.add_argument("--password", required=True)
    admin.add_argument("--name", default="System Administrator")
    admin.set_defaults(func=command_create_admin)

    check = subparsers.add_parser("check", help="Verify database connectivity")
    check.set_defaults(func=command_check)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
