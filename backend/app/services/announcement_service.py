"""Announcement service with role, creator, and student/faculty audience filtering."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.academic import Student
from app.models.announcement import Announcement, AnnouncementTargetFaculty
from app.models.enums import AnnouncementAudience, UserRole
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from app.services.campus_service import get_building
from app.services.exceptions import ForbiddenError, NotFoundError


def _query():
    return select(Announcement).options(
        selectinload(Announcement.building),
        selectinload(Announcement.created_by),
        selectinload(Announcement.created_by_faculty),
        selectinload(Announcement.target_faculty),
    )


def get_announcement(db: Session, announcement_id: int) -> Announcement:
    announcement = db.scalar(
        _query().where(Announcement.id == announcement_id)
    )
    if announcement is None:
        raise NotFoundError("Announcement not found")
    return announcement


def list_announcements(
    db: Session,
    principal,
    *,
    include_expired: bool = False,
    building_id: int | None = None,
) -> list[Announcement]:
    role = principal.role

    stmt = _query()
    if not include_expired:
        now = datetime.now(timezone.utc)
        stmt = stmt.where(
            or_(
                Announcement.expires_at.is_(None),
                Announcement.expires_at > now,
            )
        )
    if building_id is not None:
        stmt = stmt.where(Announcement.building_id == building_id)

    stmt = stmt.order_by(
        Announcement.is_pinned.desc(), Announcement.published_at.desc()
    )
    all_items = list(db.scalars(stmt))

    from app.services.personal_visibility_service import get_hidden_ids
    hidden_ann_ids = get_hidden_ids(db, str(principal.id), record_type="announcement")
    if hidden_ann_ids:
        all_items = [ann for ann in all_items if str(ann.id) not in hidden_ann_ids]

    # Admins see all announcements
    if role == UserRole.admin:
        return all_items

    # Faculty see:
    # 1. Announcements they created
    # 2. Audience 'all' or 'faculty'
    # 3. Audience 'selected_faculty' where their mobile number is in target_faculty
    if role == UserRole.faculty:
        my_mobile = str(principal.id)
        filtered = []
        for ann in all_items:
            if ann.created_by_faculty_mobile == my_mobile:
                filtered.append(ann)
            elif ann.audience_type == "selected_faculty":
                target_mobiles = [tf.faculty_mobile_number for tf in ann.target_faculty]
                if my_mobile in target_mobiles:
                    filtered.append(ann)
            elif ann.audience in (AnnouncementAudience.all, AnnouncementAudience.faculty) and ann.audience_type != "selected_students":
                filtered.append(ann)
        return filtered

    # Students see only announcements targeted at them
    if role == UserRole.student:
        student_profile = None
        if principal.is_user and principal.user:
            student_profile = principal.user.student_profile
            if not student_profile and principal.user.id:
                student_profile = db.scalar(
                    select(Student).where(Student.user_id == principal.user.id)
                )

        filtered = []
        for ann in all_items:
            # Must be addressed to all or students
            if ann.audience not in (AnnouncementAudience.all, AnnouncementAudience.students):
                continue

            if ann.audience_type == "selected_students":
                if not student_profile:
                    continue
                # Year check
                if ann.target_academic_year and ann.target_academic_year != student_profile.academic_year:
                    continue
                # Branch check
                if ann.target_branch_code:
                    student_bcode = student_profile.branch_code if student_profile.branch else None
                    if student_bcode and ann.target_branch_code.upper() != student_bcode.upper():
                        continue
                # Section check
                if ann.target_section and ann.target_section.lower() != "all":
                    if student_profile.section and ann.target_section.upper() != student_profile.section.upper():
                        continue
                filtered.append(ann)
            elif ann.audience_type != "selected_faculty":
                # General broadcast to all or students
                filtered.append(ann)
        return filtered

    return []


def create_announcement(
    db: Session, principal, data: AnnouncementCreate
) -> Announcement:
    if data.building_id is not None:
        get_building(db, data.building_id)

    created_by_id = None
    created_by_faculty_mobile = None
    creator_role = "faculty" if principal.is_faculty else "admin"
    creator_name = principal.full_name

    if principal.is_faculty:
        created_by_faculty_mobile = str(principal.id)
    else:
        created_by_id = principal.user.id

    raw_data = data.model_dump(exclude={"target_faculty_mobiles"})
    announcement = Announcement(
        created_by_id=created_by_id,
        created_by_faculty_mobile=created_by_faculty_mobile,
        creator_role=creator_role,
        creator_name=creator_name,
        **raw_data,
    )
    db.add(announcement)
    db.flush()

    if data.audience_type == "selected_faculty" and data.target_faculty_mobiles:
        for mobile in data.target_faculty_mobiles:
            tf = AnnouncementTargetFaculty(
                announcement_id=announcement.id,
                faculty_mobile_number=mobile.strip(),
            )
            db.add(tf)

    db.commit()
    return get_announcement(db, announcement.id)


def update_announcement(
    db: Session, announcement: Announcement, principal, data: AnnouncementUpdate
) -> Announcement:
    # Check edit permissions: only creator can edit
    _assert_can_manage(announcement, principal)

    values = data.model_dump(exclude_unset=True, exclude={"target_faculty_mobiles"})
    if values.get("building_id") is not None:
        get_building(db, values["building_id"])
    for key, value in values.items():
        setattr(announcement, key, value)

    if data.target_faculty_mobiles is not None:
        # Replace target faculty
        db.query(AnnouncementTargetFaculty).filter(
            AnnouncementTargetFaculty.announcement_id == announcement.id
        ).delete()
        for mobile in data.target_faculty_mobiles:
            db.add(
                AnnouncementTargetFaculty(
                    announcement_id=announcement.id,
                    faculty_mobile_number=mobile.strip(),
                )
            )

    db.commit()
    return get_announcement(db, announcement.id)


def delete_announcement(db: Session, announcement: Announcement, principal) -> None:
    # Check delete permissions: only creator can delete
    _assert_can_manage(announcement, principal)
    db.delete(announcement)
    db.commit()


def _assert_can_manage(announcement: Announcement, principal) -> None:
    """Ensure that Admin can manage/delete any announcement, while faculty can only manage their own."""
    # Admins have full administrative authority to update/delete ANY announcement
    if principal.role == UserRole.admin:
        return

    # Faculty can only manage announcements that they created
    if principal.is_faculty:
        if announcement.created_by_faculty_mobile != str(principal.id):
            raise ForbiddenError("You can only manage announcements that you created")
        return

    raise ForbiddenError("You do not have permission to manage this announcement")
