"""faculty_mobile_number_pk

Revision ID: 0a99c7cdc0dd
Revises: 0001_initial
Create Date: 2026-11-05 14:03:58.363305
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0a99c7cdc0dd'
down_revision: str | None = '0001_initial'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop foreign key constraints that reference faculty.id
    op.drop_constraint('fk_bookings_faculty_id_faculty', 'bookings', type_='foreignkey')
    op.drop_constraint('fk_timetables_faculty_id_faculty', 'timetables', type_='foreignkey')

    # Drop the old faculty table
    op.drop_table('faculty')

    # Create new faculty table with mobile_number as primary key
    op.create_table(
        'faculty',
        sa.Column('mobile_number', sa.String(length=10), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('mobile_number', name='pk_faculty'),
    )
    op.create_index('ix_faculty_department', 'faculty', ['department'])

    # Add faculty_mobile_number column to bookings (nullable for migration)
    op.add_column('bookings', sa.Column('faculty_mobile_number', sa.String(length=10), nullable=True))

    # Add faculty_mobile_number column to timetables (nullable for migration)
    op.add_column('timetables', sa.Column('faculty_mobile_number', sa.String(length=10), nullable=True))

    # Create foreign key constraints to new faculty table
    op.create_foreign_key(
        'fk_bookings_faculty_mobile_number_faculty',
        'bookings', 'faculty',
        ['faculty_mobile_number'], ['mobile_number'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_timetables_faculty_mobile_number_faculty',
        'timetables', 'faculty',
        ['faculty_mobile_number'], ['mobile_number'],
        ondelete='SET NULL'
    )

    # Drop old faculty_id columns
    op.drop_column('bookings', 'faculty_id')
    op.drop_column('timetables', 'faculty_id')


def downgrade() -> None:
    # Add back faculty_id columns
    op.add_column('timetables', sa.Column('faculty_id', sa.Integer(), nullable=True))
    op.add_column('bookings', sa.Column('faculty_id', sa.Integer(), nullable=True))

    # Drop foreign key constraints to mobile_number
    op.drop_constraint('fk_bookings_faculty_mobile_number_faculty', 'bookings', type_='foreignkey')
    op.drop_constraint('fk_timetables_faculty_mobile_number_faculty', 'timetables', type_='foreignkey')

    # Drop faculty_mobile_number columns
    op.drop_column('bookings', 'faculty_mobile_number')
    op.drop_column('timetables', 'faculty_mobile_number')

    # Drop new faculty table
    op.drop_table('faculty')

    # Recreate old faculty table
    op.create_table(
        'faculty',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('employee_id', sa.String(length=50), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('employee_id', name='uq_faculty_employee_id'),
        sa.UniqueConstraint('email', name='uq_faculty_email'),
        sa.UniqueConstraint('user_id', name='uq_faculty_user_id'),
    )
    op.create_index('ix_faculty_employee_id', 'faculty', ['employee_id'])
    op.create_index('ix_faculty_branch_id', 'faculty', ['branch_id'])

    # Recreate foreign key constraints
    op.create_foreign_key(
        'fk_bookings_faculty_id_faculty',
        'bookings', 'faculty',
        ['faculty_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_timetables_faculty_id_faculty',
        'timetables', 'faculty',
        ['faculty_id'], ['id'],
        ondelete='SET NULL'
    )