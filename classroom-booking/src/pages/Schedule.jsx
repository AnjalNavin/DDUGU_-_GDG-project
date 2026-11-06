import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { format, parseISO, isToday, startOfWeek, endOfWeek, isSameDay, addDays } from 'date-fns';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Users,
  Video,
  Phone,
  MapPin,
  Download,
  ExternalLink,
  Armchair,
  X,
  Trash2,
  Filter,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { formatYearLabel } from '../utils/formatYear';

export function Schedule() {
  const { user } = useAuth();
  const { getUserBookings, buildings, allRooms, getBooking, timeSlots, allSeatReservations, allBookings = [], deleteBooking } = useBooking();

  const [selectedView, setSelectedView] = useState('week'); // 'week' or 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showConflicts, setShowConflicts] = useState(false);
  const [viewingSeatsBooking, setViewingSeatsBooking] = useState(null);

  // Admin filter states for "See Schedule"
  const [adminDateFilter, setAdminDateFilter] = useState('');
  const [adminFacultyFilter, setAdminFacultyFilter] = useState('all');
  const [adminBranchFilter, setAdminBranchFilter] = useState('all');

  const handleAdminDateChange = (dateVal) => {
    setAdminDateFilter(dateVal);
    if (dateVal) {
      const parsed = new Date(dateVal + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }
  };

  const [hiddenBookings, setHiddenBookings] = useState(() => {
    try {
      const raw = localStorage.getItem(`ddugu_hidden_bookings_${user?.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleHideCancelledBooking = (id) => {
    const next = [...hiddenBookings, id];
    setHiddenBookings(next);
    localStorage.setItem(`ddugu_hidden_bookings_${user?.id}`, JSON.stringify(next));
  };

  const userBookings = getUserBookings(user?.id || '').filter(b => !hiddenBookings.includes(b.id));

  // Extract all faculty members and branches from bookings for admin filters
  const facultyMembers = useMemo(() => {
    const map = new Map();
    allBookings.forEach((b) => {
      if (b.facultyName) map.set(b.facultyName, b.facultyName);
      if (b.userId && !map.has(b.userId)) map.set(b.userId, b.facultyName || b.userId);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBookings]);

  const branches = useMemo(() => {
    const set = new Set();
    allBookings.forEach((b) => {
      if (b.branchCode) set.add(b.branchCode);
    });
    return Array.from(set).sort();
  }, [allBookings]);

  // Display bookings: if admin, show all faculty bookings with filters; otherwise user's bookings
  const displayBookings = useMemo(() => {
    if (user?.role !== 'admin') {
      return userBookings;
    }
    let list = allBookings.slice();
    if (adminDateFilter) {
      list = list.filter(b => b.date === adminDateFilter);
    }
    if (adminFacultyFilter !== 'all') {
      list = list.filter(b => b.userId === adminFacultyFilter || b.facultyName === adminFacultyFilter || b.facultyMobileNumber === adminFacultyFilter);
    }
    if (adminBranchFilter !== 'all') {
      const target = adminBranchFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
      list = list.filter(b => {
        const br = String(b.branchCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const aud = String(b.audienceDesc || b.audience || b.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return br.includes(target) || aud.includes(target) || target.includes(br);
      });
    }
    return list;
  }, [user, userBookings, allBookings, adminDateFilter, adminFacultyFilter, adminBranchFilter]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart))
    .map((date, i) => addDays(date, i));

  const bookingsByDay = useMemo(() => {
    return weekDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayBookings = displayBookings.filter(b => b.date === dayStr && b.status !== 'cancelled');

      return {
        date: day,
        dateStr: dayStr,
        bookings: dayBookings.sort((a, b) => {
          const slotA = timeSlots.find(s => s.id === a.timeSlotId);
          const slotB = timeSlots.find(s => s.id === b.timeSlotId);
          return (slotA?.start || '').localeCompare(slotB?.start || '');
        }),
      };
    });
  }, [displayBookings, weekDays, timeSlots]);

  const upcomingBookings = useMemo(() => {
    return userBookings
      .filter(b => b.status === 'confirmed' && new Date(b.date + 'T00:00:00') > new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [userBookings]);

  const pastBookings = useMemo(() => {
    return userBookings
      .filter(b => new Date(b.date + 'T00:00:00') <= new Date() && b.status !== 'cancelled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [userBookings]);

  const getBuilding = (roomId) => {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return null;
    return buildings.find(b => b.id === room.buildingId);
  };

  const getRoom = (roomId) => {
    return allRooms.find(r => r.id === roomId);
  };

  const getTimeSlot = (slotId) => {
    return timeSlots.find(s => s.id === slotId);
  };

  const hasConflict = (booking) => {
    return userBookings.some(b =>
      b.id !== booking.id &&
      b.date === booking.date &&
      b.timeSlotId === booking.timeSlotId &&
      b.status !== 'cancelled'
    );
  };

  const exportCalendar = () => {
    const csvContent = [
      ['Date', 'Room', 'Time', 'Title', 'Status'],
      ...userBookings.map(booking => {
        const room = getRoom(booking.roomId);
        const slot = getTimeSlot(booking.timeSlotId);
        const building = getBuilding(booking.roomId);
        return [
          booking.date,
          `${building?.name || ''} ${room?.name || ''}`.trim(),
          slot?.label || '',
          booking.title,
          booking.status,
        ];
      }),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="schedule-page">
      <div className="page-header">
        <div>
          <h1>{user?.role === 'admin' ? 'See Schedule' : 'My Schedule'}</h1>
          <p className="subtitle">
            {user?.role === 'admin'
              ? 'All scheduled classes and bookings by faculty members across campus'
              : 'View and manage your bookings across all rooms'}
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${selectedView === 'week' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedView('week')}
          >
            <Calendar size={18} /> Week View
          </button>
          <button
            className={`btn ${selectedView === 'day' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedView('day')}
          >
            <Clock size={18} /> Day View
          </button>
          <button className="btn btn-outline" onClick={exportCalendar}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} color="#2563eb" />
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Filter Faculty Schedule</strong>
              <span style={{ fontSize: '12px', color: '#64748b' }}>({displayBookings.length} classes found)</span>
            </div>
            {(adminDateFilter || adminFacultyFilter !== 'all' || adminBranchFilter !== 'all') && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setAdminDateFilter('');
                  setAdminFacultyFilter('all');
                  setAdminBranchFilter('all');
                }}
                style={{ fontSize: '12px', padding: '3px 10px', color: '#ef4444', borderColor: '#fca5a5' }}
              >
                ✕ Clear All Filters
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                🗓️ Filter by Date
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="date"
                  value={adminDateFilter}
                  onChange={(e) => handleAdminDateChange(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <button
                  type="button"
                  className={`btn btn-sm ${adminDateFilter === format(new Date(), 'yyyy-MM-dd') ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleAdminDateChange(format(new Date(), 'yyyy-MM-dd'))}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  Today
                </button>
                {adminDateFilter && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => handleAdminDateChange('')}
                    style={{ fontSize: '12px', padding: '6px 8px', color: '#64748b' }}
                    title="Clear date filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                👨‍🏫 Filter by Faculty Member
              </label>
              <select
                value={adminFacultyFilter}
                onChange={(e) => setAdminFacultyFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
              >
                <option value="all">All Faculty Members ({facultyMembers.length})</option>
                {facultyMembers.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                🎓 Filter by Branch
              </label>
              <select
                value={adminBranchFilter}
                onChange={(e) => setAdminBranchFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
              >
                <option value="all">All Branches ({branches.length})</option>
                {branches.map(br => (
                  <option key={br} value={br}>{br}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'week' ? (
        <div className="week-view">
          <div className="week-header">
            {weekDays.map(day => (
              <div key={day.toISOString()} className={`week-day-header ${isToday(day) ? 'today' : ''}`}>
                <span className="weekday">{format(day, 'EEE')}</span>
                <span className="day-number">{format(day, 'd')}</span>
              </div>
            ))}
          </div>

          <div className="week-grid">
            {timeSlots.map(slot => (
              <div key={slot.id} className="time-slot-header">
                <span className="time-label">{slot.label}</span>
              </div>
            ))}

            {weekDays.map((day, dayIndex) => (
              <div key={day.toISOString()} className="week-cell-row">
                {timeSlots.map(slot => {
                  const bookings = bookingsByDay[dayIndex].bookings;
                  const slotBookings = bookings.filter(b => b.timeSlotId === slot.id);
                  return (
                    <div key={slot.id} className="week-cell">
                      {slotBookings.map(booking => {
                        const room = getRoom(booking.roomId);
                        const isConflict = hasConflict(booking);
                        return (
                          <NavLink
                            key={booking.id}
                            to={`/booking?room=${booking.roomId}&date=${day.toISOString().split('T')[0]}`}
                            className={`booking-cell ${booking.status} ${isConflict ? 'conflict' : ''}`}
                            title={`${booking.title} - ${room?.name || ''}${isConflict ? ' (CONFLICT)' : ''}`}
                          >
                            <div className="booking-content">
                              <strong>{room?.name || 'Room'}</strong>
                              {isConflict && <AlertTriangle size={12} className="conflict-icon" />}
                              {booking.status === 'confirmed' && <CheckCircle size={12} />}
                            </div>
                          </NavLink>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="day-view">
          <div className="day-header">
            <h2>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(parseISO(e.target.value))}
              className="date-input"
            />
          </div>

          <div className="day-bookings">
            {bookingsByDay[0]?.bookings.length === 0 ? (
              <div className="empty-state">
                <Calendar size={48} />
                <h3>No bookings for this day</h3>
                <NavLink to="/booking" className="btn btn-primary">Book a Room</NavLink>
              </div>
            ) : (
              bookingsByDay[0].bookings.map(booking => {
                const room = getRoom(booking.roomId);
                const building = getBuilding(booking.roomId);
                const slot = getTimeSlot(booking.timeSlotId);
                const isConflict = hasConflict(booking);

                return (
                  <div key={booking.id} className={`booking-card ${isConflict ? 'conflict' : ''}`}>
                    <div className="booking-time">
                      <Clock size={16} />
                      <span>{slot?.label}</span>
                    </div>

                    <div className="booking-info">
                      <h3>{booking.title}</h3>
                      <div className="booking-location">
                        <MapPin size={14} />
                        <span>{building?.name} {room?.name}</span>
                        {booking.facultyName && (
                          <span style={{ marginLeft: '8px', color: '#475569' }}>• 👨‍🏫 {booking.facultyName}</span>
                        )}
                        {booking.branchCode && (
                          <span style={{ marginLeft: '8px', color: '#2563eb', fontWeight: 600 }}>• 🎓 {booking.branchCode} {booking.section ? `Sec ${booking.section}` : ''}</span>
                        )}
                      </div>

                      {isConflict && (
                        <div className="conflict-warning">
                          <AlertTriangle size={16} />
                          <span>Conflict with other booking</span>
                        </div>
                      )}
                    </div>

                    <div className="booking-meta">
                      {(user?.role === 'admin' || user?.role === 'faculty') && booking.status === 'confirmed' && (
                        <button
                          type="button"
                          className="status"
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                          }}
                          onClick={() => setViewingSeatsBooking(booking)}
                          title="Click to view students who reserved seats"
                        >
                          <Armchair size={13} />
                          {allSeatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active').length}
                          /{room?.capacity || 75} Reserved
                        </button>
                      )}

                      <span className={`status ${booking.status}`}>
                        {booking.status === 'confirmed' && <CheckCircle size={14} />}
                        {booking.status === 'pending' && <Loader2 size={14} />}
                        {booking.status}
                      </span>

                      {booking.recurring && (
                        <span className="recurring">
                          <span className="recurring-icon">🔄</span> Recurring
                        </span>
                      )}
                    </div>

                    <div className="booking-actions">
                      {(user?.role === 'faculty' || user?.role === 'admin') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setViewingSeatsBooking(booking)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Armchair size={13} />
                          Seats ({allSeatReservations.filter(r => r.bookingId === booking.id && r.status === 'active').length})
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            if (window.confirm(`Delete booking "${booking.title}"? This will release the room slot immediately.`)) {
                              deleteBooking(booking.id);
                            }
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: 'white', border: 'none' }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                      <NavLink
                        to={`/booking?room=${booking.roomId}&date=${booking.date}&slot=${booking.timeSlotId}`}
                        className="btn btn-sm btn-outline"
                      >
                        Edit
                      </NavLink>
                      {user?.role === 'student' && booking.status === 'pending' && (
                        <button className="btn btn-sm btn-danger">Cancel</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="schedule-sidebar">
        <div className="card">
          <div className="card-header">
            <h2>Upcoming</h2>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="empty-state-mini">
              <p>No upcoming bookings</p>
            </div>
          ) : (
            <div className="upcoming-list">
              {upcomingBookings.map(booking => {
                const room = getRoom(booking.roomId);
                const building = getBuilding(booking.roomId);
                const slot = getTimeSlot(booking.timeSlotId);

                return (
                  <NavLink
                    key={booking.id}
                    to={`/booking?room=${booking.roomId}&date=${booking.date}`}
                    className="upcoming-item"
                  >
                    <div className="upcoming-room">
                      <strong>{building?.name} {room?.name}</strong>
                    </div>
                    <div className="upcoming-time">
                      <Clock size={14} /> {slot?.label}
                    </div>
                    <div className="upcoming-date">
                      {format(parseISO(booking.date), 'MMM d')}
                    </div>
                    <div className="upcoming-status">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status ${booking.status}`}> {booking.status}</span>
                      {booking.status === 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleHideCancelledBooking(booking.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            color: '#64748b',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                          title="Remove this cancelled booking from your history"
                        >
                          Remove from History
                        </button>
                      )}
                    </div>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          )}
          <NavLink to="/schedule" className="card-footer">View Full Schedule →</NavLink>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Recent Past</h2>
          </div>
          {pastBookings.length === 0 ? (
            <div className="empty-state-mini">
              <p>No past bookings</p>
            </div>
          ) : (
            <div className="past-list">
              {pastBookings.map(booking => {
                const room = getRoom(booking.roomId);
                const building = getBuilding(booking.roomId);
                const slot = getTimeSlot(booking.timeSlotId);

                return (
                  <div key={booking.id} className="past-item">
                    <div className="past-info">
                      <strong>{building?.name} {room?.name}</strong>
                      <span className="past-time">{slot?.label}</span>
                    </div>
                    <div className="past-date">
                      {format(parseISO(booking.date), 'MMM d, yyyy')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status ${booking.status}`}> {booking.status}</span>
                      {booking.status === 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleHideCancelledBooking(booking.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            color: '#64748b',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                          title="Remove this cancelled booking from your history"
                        >
                          Remove from History
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Contact & Support</h2>
          </div>
          <div className="contact-info">
            <div className="contact-item">
              <Video size={16} />
              <span>Virtual Help Desk: Available 9 AM - 5 PM</span>
            </div>
            <div className="contact-item">
              <Phone size={16} />
              <span>IT Support: +1-800-XXX-XXXX</span>
            </div>
            <div className="contact-item">
              <ExternalLink size={16} />
              <a href="#">Help Documentation</a>
            </div>
          </div>
        </div>
      </div>

      {/* Faculty Student Seats Modal */}
      {viewingSeatsBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setViewingSeatsBooking(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Armchair size={20} color="#2563eb" />
                  Student Seat Allocations
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {viewingSeatsBooking.title} • {viewingSeatsBooking.date} • {getRoom(viewingSeatsBooking.roomId)?.name}
                </p>
              </div>
              <button
                onClick={() => setViewingSeatsBooking(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {allSeatReservations.filter((r) => r.bookingId === viewingSeatsBooking.id && r.status === 'active').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <Armchair size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem', display: 'block' }} />
                  <p style={{ margin: 0 }}>No students have reserved seats for this lecture yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '0.65rem 1rem' }}>Student Name</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Academic Cohort</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Seat Number</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSeatReservations
                        .filter((r) => r.bookingId === viewingSeatsBooking.id && r.status === 'active')
                        .map((res) => (
                          <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{res.studentName}</td>
                            <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>
                              {formatYearLabel(res.academicYear)} {res.branchCode}-{res.section}
                            </td>
                            <td style={{ padding: '0.65rem 1rem' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>
                                {res.seatNumber}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 1rem' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setViewingSeatsBooking(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}