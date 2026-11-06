"""features_update

Revision ID: 0002_features_update
Revises: 0a99c7cdc0dd
Create Date: 2026-11-05 23:15:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0002_features_update'
down_revision: str | None = '0a99c7cdc0dd'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Admin Audit Logs
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_user_id', sa.Integer(), nullable=True),
        sa.Column('admin_name', sa.String(length=150), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', sa.String(length=100), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admin_audit_logs_action', 'admin_audit_logs', ['action'])
    op.create_index('ix_admin_audit_logs_target_type', 'admin_audit_logs', ['target_type'])

    # 2. Add columns to announcements
    op.add_column('announcements', sa.Column('audience_type', sa.String(length=30), server_default='all', nullable=False))
    op.add_column('announcements', sa.Column('created_by_faculty_mobile', sa.String(length=10), nullable=True))
    op.add_column('announcements', sa.Column('creator_name', sa.String(length=150), nullable=True))
    op.add_column('announcements', sa.Column('creator_role', sa.String(length=50), nullable=True))
    op.add_column('announcements', sa.Column('target_academic_year', sa.Integer(), nullable=True))
    op.add_column('announcements', sa.Column('target_branch_code', sa.String(length=20), nullable=True))
    op.add_column('announcements', sa.Column('target_section', sa.String(length=10), nullable=True))
    op.create_foreign_key(
        'fk_announcements_faculty_mobile',
        'announcements',
        'faculty',
        ['created_by_faculty_mobile'],
        ['mobile_number'],
        ondelete='SET NULL',
    )
    op.create_index('ix_announcements_audience_type', 'announcements', ['audience_type'])

    # 3. Announcement Target Faculty junction table
    op.create_table(
        'announcement_target_faculty',
        sa.Column('announcement_id', sa.Integer(), nullable=False),
        sa.Column('faculty_mobile', sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['faculty_mobile'], ['faculty.mobile_number'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('announcement_id', 'faculty_mobile'),
    )

    # 4. Add columns to bookings
    op.add_column('bookings', sa.Column('academic_year', sa.Integer(), nullable=True))
    op.add_column('bookings', sa.Column('branch_code', sa.String(length=20), nullable=True))
    op.add_column('bookings', sa.Column('section', sa.String(length=10), nullable=True))
    op.add_column('bookings', sa.Column('audience_desc', sa.String(length=200), nullable=True))
    op.create_index('ix_bookings_cohort', 'bookings', ['academic_year', 'branch_code', 'section'])

    # 5. Conflict Reports
    op.create_table(
        'conflict_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reporter_type', sa.String(length=20), nullable=False),
        sa.Column('reporter_user_id', sa.Integer(), nullable=True),
        sa.Column('reporter_faculty_mobile', sa.String(length=10), nullable=True),
        sa.Column('reporter_name', sa.String(length=150), nullable=False),
        sa.Column('priority', sa.String(length=20), server_default='normal', nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=True),
        sa.Column('booking_id', sa.Integer(), nullable=True),
        sa.Column('seat_id', sa.String(length=50), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='pending', nullable=False),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['reporter_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reporter_faculty_mobile'], ['faculty.mobile_number'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_conflict_reports_priority', 'conflict_reports', ['priority'])
    op.create_index('ix_conflict_reports_status', 'conflict_reports', ['status'])

    # 6. Conflict Resolution History
    op.create_table(
        'conflict_resolution_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conflict_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=True),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('action_by_id', sa.Integer(), nullable=True),
        sa.Column('action_by_name', sa.String(length=150), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conflict_id'], ['conflict_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['action_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_conflict_history_conflict_id', 'conflict_resolution_history', ['conflict_id'])

    # 7. Seat Reservations
    op.create_table(
        'seat_reservations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_id', sa.Integer(), nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=False),
        sa.Column('student_user_id', sa.Integer(), nullable=False),
        sa.Column('student_name', sa.String(length=150), nullable=False),
        sa.Column('academic_year', sa.Integer(), nullable=False),
        sa.Column('branch_code', sa.String(length=20), nullable=False),
        sa.Column('section', sa.String(length=10), nullable=False),
        sa.Column('seat_number', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_seat_reservations_booking', 'seat_reservations', ['booking_id'])
    op.create_index('ix_seat_reservations_student', 'seat_reservations', ['student_user_id'])


def downgrade() -> None:
    op.drop_table('seat_reservations')
    op.drop_table('conflict_resolution_history')
    op.drop_table('conflict_reports')
    op.drop_table('announcement_target_faculty')
    op.drop_column('bookings', 'audience_desc')
    op.drop_column('bookings', 'section')
    op.drop_column('bookings', 'branch_code')
    op.drop_column('bookings', 'academic_year')
    op.drop_column('announcements', 'target_section')
    op.drop_column('announcements', 'target_branch_code')
    op.drop_column('announcements', 'target_academic_year')
    op.drop_column('announcements', 'creator_role')
    op.drop_column('announcements', 'creator_name')
    op.drop_column('announcements', 'created_by_faculty_mobile')
    op.drop_column('announcements', 'audience_type')
    op.drop_table('admin_audit_logs')
