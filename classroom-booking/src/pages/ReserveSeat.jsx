import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  Armchair,
  Calendar,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Check,
  X,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { academicStructure, rooms } from '../data/mockData';
import { formatYearLabel } from '../utils/formatYear';

export function ReserveSeat() {
  const { user } = useAuth();
  const {
    allBookings,
    allRooms,
    timeSlots,
    allSeatReservations,
    reserveSeat,
    cancelSeatReservation,
  } = useBooking();

  // Student Cohort Details (Mandatory)
  const [academicYear, setAcademicYear] = useState(user?.academicYear ? String(user.academicYear) : '3');
  const [branchCode, setBranchCode] = useState(user?.branchCode ? user.branchCode : 'CSE');
  const [section, setSection] = useState(user?.section ? user.section : 'A');

  // Filter state for Reserve a Seat: Date & Faculty Member
  const [filterDate, setFilterDate] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  const showBanner = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const isCohortComplete = Boolean(academicYear && branchCode && section);

  // Available classes matching student cohort
  const eligibleClasses = useMemo(() => {
    if (!isCohortComplete) return [];

    return allBookings.filter((b) => {
      if (b.status === 'cancelled') return false;

      // Match cohort
      const matchYear = !b.academicYear || String(b.academicYear) === String(academicYear);
      const matchSection = !b.section || b.section.toUpperCase() === section.toUpperCase();
      const matchBranch = (function () {
        if (!b.branchCode || !branchCode) return true;
        const b1 = b.branchCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const b2 = branchCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (b1 === b2) return true;
        if ((b1.includes('AIML') || b1.includes('AI')) && (b2.includes('AIML') || b2.includes('AI'))) return true;
        if ((b1.includes('DS') || b1.includes('MLDS')) && (b2.includes('DS') || b2.includes('MLDS'))) return true;
        if (b1.includes('IOT') && b2.includes('IOT')) return true;
        return b1.includes(b2) || b2.includes(b1);
      })();

      // Or check audience description
      const audienceText = (b.audience || b.audienceDesc || '').toUpperCase();
      const inAudience =
        audienceText.includes(branchCode.toUpperCase()) &&
        (audienceText.includes(`${academicYear}ST`) ||
          audienceText.includes(`${academicYear}ND`) ||
          audienceText.includes(`${academicYear}RD`) ||
          audienceText.includes(`${academicYear}TH`) ||
          audienceText.includes(`YEAR ${academicYear}`));

      return (matchYear && matchBranch && matchSection) || inAudience;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [allBookings, isCohortComplete, academicYear, branchCode, section]);

  // Extract all faculty members for filter dropdown
  const facultyMembers = useMemo(() => {
    const map = new Map();
    eligibleClasses.forEach((b) => {
      const name = b.facultyName || b.userId;
      if (name) map.set(b.userId || name, name);
    });
    allBookings.forEach((b) => {
      if (b.facultyName) map.set(b.userId || b.facultyName, b.facultyName);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleClasses, allBookings]);

  // Apply filters by date and faculty member
  const filteredClasses = useMemo(() => {
    let list = eligibleClasses.slice();
    if (filterDate) {
      list = list.filter((b) => b.date === filterDate);
    }
    if (filterFaculty !== 'all') {
      list = list.filter(
        (b) =>
          b.userId === filterFaculty ||
          b.facultyName === filterFaculty ||
          b.facultyMobileNumber === filterFaculty
      );
    }
    return list;
  }, [eligibleClasses, filterDate, filterFaculty]);

  const hasActiveFilters = Boolean(filterDate || filterFaculty !== 'all');

  // My seat reservations
  const myReservations = useMemo(() => {
    const studentId = user?.id || 'student-1';
    return allSeatReservations
      .filter((r) => r.studentUserId === studentId)
      .sort((a, b) => new Date(b.reservedAt) - new Date(a.reservedAt));
  }, [allSeatReservations, user]);

  // One-click seat reservation
  const handleReserveSeat = (booking) => {
    if (!isCohortComplete) {
      showBanner('error', 'Please select Academic Year, Branch, and Section before reserving a seat.');
      return;
    }

    // Check duplicate reservation
    const existing = allSeatReservations.find(
      (r) =>
        r.bookingId === booking.id &&
        r.studentUserId === (user?.id || 'student-1') &&
        r.status === 'active'
    );
    if (existing) {
      showBanner('error', 'You already have a reserved seat for this lecture.');
      return;
    }

    setSubmittingId(booking.id);
    const res = reserveSeat({
      bookingId: booking.id,
      roomId: booking.roomId,
      studentUserId: user?.id || 'student-1',
      studentName: user?.name || 'Arjun Patel',
      academicYear: Number(academicYear),
      branchCode,
      section,
    });
    setSubmittingId(null);

    if (res.success) {
      showBanner('success', 'Seat reserved successfully!');
    } else {
      showBanner('error', res.error || 'Failed to reserve seat.');
    }
  };

  const handleCancelReservation = (resId) => {
    if (window.confirm('Are you sure you want to cancel this seat reservation?')) {
      cancelSeatReservation(resId);
      showBanner('success', 'Seat reservation cancelled.');
    }
  };

  return (
    <div className="reserve-seat-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Alert Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: feedback.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${feedback.type === 'error' ? '#fca5a5' : '#86efac'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: 'white',
          padding: '1.5rem 2rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Armchair size={26} color="#2563eb" />
          Reserve a Classroom Seat
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          Select your academic batch, pick a scheduled lecture, and reserve your seat in advance
        </p>
      </div>

      {/* Mandatory Student Academic Cohort Selector */}
      <div
        style={{
          background: 'white',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#1e293b' }}>
          <GraduationCap size={20} color="#2563eb" />
          <span>Your Academic Batch & Section (Required)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Academic Year *
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: 'white',
                fontWeight: 500,
              }}
            >
              <option value="">Choose Year</option>
              {academicStructure.years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Branch / Department *
            </label>
            <select
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: 'white',
                fontWeight: 500,
              }}
            >
              <option value="">Choose Branch</option>
              {academicStructure.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.id} - {b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Section *
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: 'white',
                fontWeight: 500,
              }}
            >
              <option value="">Choose Section</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>
        </div>

        {!isCohortComplete && (
          <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
            ⚠️ Please select Academic Year, Branch, and Section before reserving seats.
          </div>
        )}
      </div>

      {/* Filter Options: Date & Faculty Member */}
      {isCohortComplete && (
        <div
          style={{
            background: 'white',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#1e293b' }}>
              <Search size={18} color="#2563eb" />
              <span>Filter Lectures</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#64748b' }}>
                (Filter scheduled classes by Date or Faculty Member)
              </span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterDate('');
                  setFilterFaculty('all');
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={14} /> Clear All Filters
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '0.35rem',
                }}
              >
                🗓️ Filter by Date
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    backgroundColor: 'white',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFilterDate(format(new Date(), 'yyyy-MM-dd'))}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: filterDate === format(new Date(), 'yyyy-MM-dd') ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: filterDate === format(new Date(), 'yyyy-MM-dd') ? '#2563eb' : 'white',
                    color: filterDate === format(new Date(), 'yyyy-MM-dd') ? 'white' : '#1e293b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Today
                </button>
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    style={{
                      padding: '0.55rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                    title="Clear date filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '0.35rem',
                }}
              >
                👨‍🏫 Filter by Faculty Member
              </label>
              <select
                value={filterFaculty}
                onChange={(e) => setFilterFaculty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  backgroundColor: 'white',
                  fontWeight: 500,
                }}
              >
                <option value="all">-- All Faculty Members --</option>
                {facultyMembers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Available Lectures Feed */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Upcoming Lectures for {academicYear ? formatYearLabel(academicYear) : ''} {branchCode} (Section {section})
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {hasActiveFilters ? `Showing ${filteredClasses.length} of ${eligibleClasses.length} lecture(s)` : `${eligibleClasses.length} lecture(s) scheduled`}
          </span>
        </div>

        {eligibleClasses.length === 0 ? (
          <div
            style={{
              background: 'white',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <Clock size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem', display: 'block' }} />
            <h4 style={{ color: '#1e293b', margin: '0 0 0.25rem' }}>No lectures scheduled</h4>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              There are no upcoming classroom bookings for your batch.
            </p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div
            style={{
              background: 'white',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <Search size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem', display: 'block' }} />
            <h4 style={{ color: '#1e293b', margin: '0 0 0.25rem' }}>No lectures match your filters</h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
              No scheduled classes match your selected Date or Faculty Member filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterFaculty('all');
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#1e293b',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Clear Filters & Show All
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {filteredClasses.map((booking) => {
              const room = allRooms.find((r) => r.id === booking.roomId);
              const slot = timeSlots.find((s) => s.id === booking.timeSlotId);
              const occupiedCount = allSeatReservations.filter(
                (r) => r.bookingId === booking.id && r.status === 'active'
              ).length;
              const capacity = room?.capacity || 75;
              const remaining = Math.max(capacity - occupiedCount, 0);

              const isReservedByMe = allSeatReservations.some(
                (r) =>
                  r.bookingId === booking.id &&
                  r.studentUserId === (user?.id || 'student-1') &&
                  r.status === 'active'
              );

              return (
                <div
                  key={booking.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                        }}
                      >
                        {booking.audienceDesc || `${formatYearLabel(academicYear)} ${branchCode}-${section}`}
                      </span>

                      {isReservedByMe && (
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Check size={12} /> Seat Reserved
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0.25rem 0 0.5rem' }}>
                      {booking.title}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>
                      {booking.facultyName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span>👨‍🏫</span>
                          <span>Faculty: <strong>{booking.facultyName}</strong></span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Building2 size={15} color="#64748b" />
                        <span><strong>{room?.name}</strong> (Floor {room?.floor}, {room?.buildingId?.toUpperCase()})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Calendar size={15} color="#64748b" />
                        <span>{booking.date}</span>
                        <span>•</span>
                        <Clock size={15} color="#64748b" />
                        <span>{slot?.label || booking.timeSlotId}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Armchair size={15} color="#64748b" />
                        <span>
                          <strong>{remaining}</strong> of {capacity} seats free
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleReserveSeat(booking)}
                    disabled={isReservedByMe || remaining === 0 || submittingId === booking.id}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isReservedByMe ? '#dcfce7' : remaining === 0 ? '#f1f5f9' : '#2563eb',
                      color: isReservedByMe ? '#15803d' : remaining === 0 ? '#94a3b8' : 'white',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: isReservedByMe || remaining === 0 || submittingId === booking.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: (!isReservedByMe && remaining > 0) ? '0 2px 6px rgba(37,99,235,0.2)' : 'none',
                    }}
                  >
                    {isReservedByMe ? (
                      <>
                        <Check size={16} /> Reserved
                      </>
                    ) : remaining === 0 ? (
                      'Class Full'
                    ) : submittingId === booking.id ? (
                      'Reserving...'
                    ) : (
                      <>
                        <Armchair size={16} /> Reserve Seat
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Current and Previous Seat Reservations */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
          My Seat Reservations
        </h2>

        {myReservations.length === 0 ? (
          <div
            style={{
              background: 'white',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <Armchair size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              You have not reserved any seats yet. Select a class above to make your first reservation.
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <tr>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Lecture / Session</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Room & Floor</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Date & Time</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Seat Number</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myReservations.map((res) => {
                  const booking = allBookings.find((b) => b.id === res.bookingId);
                  const room = allRooms.find((r) => r.id === (res.roomId || booking?.roomId));
                  const slot = timeSlots.find((s) => s.id === booking?.timeSlotId);

                  return (
                    <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#0f172a' }}>
                        {booking?.title || 'Class Lecture'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#334155' }}>
                        {room?.name} (Floor {room?.floor})
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#475569' }}>
                        {booking?.date} • {slot?.label || booking?.timeSlotId}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {res.seatNumber}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: res.status === 'active' ? '#dcfce7' : '#fee2e2',
                            color: res.status === 'active' ? '#15803d' : '#991b1b',
                          }}
                        >
                          {res.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        {res.status === 'active' && (
                          <button
                            onClick={() => handleCancelReservation(res.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
