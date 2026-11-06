import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { format, parseISO, addDays, startOfDay, isToday, isTomorrow } from 'date-fns';
import {
  Calendar,
  Building2,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  ArrowRight,
  Plus,
  Search,
  Filter,
  User,
  KeyRound,
  Armchair,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { formatFloor } from '../data/mockData';
import { ProfileModal } from '../components/ProfileModal';
import { CredentialsModal } from '../components/CredentialsModal';
import { formatYearLabel } from '../utils/formatYear';

export function Dashboard() {
  const { user, hasRole } = useAuth();
  const {
    buildingRooms,
    dayBookings,
    selectedDate,
    setSelectedDate,
    timeSlots,
    getBooking,
    isRoomBooked,
    searchRooms,
    naturalLanguageSearch,
    getAnnouncementsForRole,
    buildings,
    selectedBuilding,
    allSeatReservations = [],
  } = useBooking();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNaturalSearch, setShowNaturalSearch] = useState(false);
  const [naturalResults, setNaturalResults] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  // Stats
  const totalRooms = buildingRooms.length;
  const bookedSlots = dayBookings.length;
  const totalSlots = buildingRooms.length * timeSlots.length;
  const availableSlots = totalSlots - bookedSlots;
  const occupancyRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

  // Upcoming bookings for user
  const userBookings = useMemo(() => {
    if (!user) return [];
    return dayBookings.filter(b => b.userId === user.id);
  }, [dayBookings, user]);

  // Announcements
  const announcements = getAnnouncementsForRole(user?.role || 'student');

  // Room availability for today
  const roomAvailability = useMemo(() => {
    return buildingRooms.map(room => {
      const bookedCount = timeSlots.filter(slot => isRoomBooked(room.id, slot.id)).length;
      return {
        ...room,
        bookedCount,
        totalSlots: timeSlots.length,
        availableCount: timeSlots.length - bookedCount,
        occupancyPercent: Math.round((bookedCount / timeSlots.length) * 100),
      };
    });
  }, [buildingRooms, timeSlots, isRoomBooked]);

  const building = buildings.find(b => b.id === selectedBuilding);

  const handleNaturalSearch = (query) => {
    const results = naturalLanguageSearch(query);
    setNaturalResults(results);
    setShowNaturalSearch(true);
  };

  return (
    <div className="dashboard-page">
      {/* Header with date picker and search */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard</h1>
          <p className="subtitle">
            {building?.image} {building?.name} • {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <div className="header-right">
          {/* Natural language search */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search rooms or try: 'free rooms tomorrow 2pm'..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) {
                    handleNaturalSearch(e.target.value);
                  } else {
                    setShowNaturalSearch(false);
                  }
                }}
                onFocus={() => searchQuery.length > 2 && setShowNaturalSearch(true)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => { setSearchQuery(''); setShowNaturalSearch(false); }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Natural search results dropdown */}
            {showNaturalSearch && naturalResults && (
              <div className="natural-search-results">
                {naturalResults.intent && (
                  <div className="search-intent">Detected: {naturalResults.intent}</div>
                )}
                {naturalResults.suggestions.length > 0 && (
                  <div className="suggestions">
                    {naturalResults.suggestions.slice(0, 3).map((s, i) => (
                      <div key={i} className="suggestion-item">
                        <Clock size={16} /> {s.timeSlot.label} — {s.availableRooms.length} rooms available
                      </div>
                    ))}
                  </div>
                )}
                {naturalResults.rooms.length > 0 && (
                  <div className="room-results">
                    {naturalResults.rooms.slice(0, 3).map(room => (
                      <NavLink key={room.id} to={`/booking?room=${room.id}`} className="room-result-item" onClick={() => setShowNaturalSearch(false)}>
                        {room.name} ({room.capacity} seats)
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="date-picker">
            <Calendar size={20} />
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(parseISO(e.target.value))}
              className="date-input"
            />
          </div>

          {user?.role === 'student' ? (
            <NavLink to="/reserve-seat" className="btn btn-primary">
              <Armchair size={18} /> Reserve Seat
            </NavLink>
          ) : (
            <NavLink to="/booking" className="btn btn-primary">
              <Plus size={18} /> Book Room
            </NavLink>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon rooms">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalRooms}</div>
            <div className="stat-label">Total Rooms</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon available">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{availableSlots}</div>
            <div className="stat-label">Available Slots</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon booked">
            <XCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{bookedSlots}</div>
            <div className="stat-label">Booked Slots</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon occupancy">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{occupancyRate}%</div>
            <div className="stat-label">Occupancy Rate</div>
          </div>
        </div>
      </div>

      {/* Student Profile & Credentials Section */}
      {user?.role === 'student' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Profile Card */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '1px solid #bfdbfe',
                }}
              >
                {user.avatar || '👨‍🎓'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                    }}
                  >
                    Student Profile
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Academic & Personal Details</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{user.name}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                  <span>🎓 Branch: <strong>{user.branchCode || 'CSE'}</strong></span>
                  <span>•</span>
                  <span>🗓️ Year: <strong>{formatYearLabel(user.academicYear || user.year || 1)}</strong></span>
                  <span>•</span>
                  <span>🏷️ Section: <strong>Section {user.section || 'A'}</strong></span>
                  {user.rollNumber && (
                    <>
                      <span>•</span>
                      <span>🆔 Roll: <strong>{user.rollNumber}</strong></span>
                    </>
                  )}
                  {user.phone && (
                    <>
                      <span>•</span>
                      <span>📞 <strong>{user.phone}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowProfileModal(true)}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <User size={16} /> Edit Profile
            </button>
          </div>

          {/* Change Credentials Card */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                  }}
                >
                  Student Profile Security
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Login & Account Credentials</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Change Login Credentials</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                Registered Student Email: <strong style={{ color: '#0f172a' }}>{user.email}</strong>
              </p>
            </div>
            <button
              onClick={() => setShowCredentialsModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <KeyRound size={16} /> Change Credentials
            </button>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="dashboard-grid">
        {/* Left column - Room Availability */}
        <div className="dashboard-main">
          <div className="card">
            <div className="card-header">
              <h2>Room Availability Today</h2>
              <NavLink to="/search" className="view-all">View All</NavLink>
            </div>

            <div className="availability-table-container">
              <table className="availability-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th className="time-slots-header">Time Slots</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roomAvailability.map(room => (
                    <tr key={room.id}>
                      <td>
                        <div className="room-info">
                          <strong>{room.name}</strong>
                          <span className="room-floor">{formatFloor(room.floor)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`room-type-badge ${room.type}`}>{room.type.replace('-', ' ')}</span>
                      </td>
                      <td>{room.capacity} seats</td>
                      <td>
                        <div className="time-slots-mini">
                          {timeSlots.map(slot => {
                            const booking = getBooking(room.id, slot.id);
                            const isBooked = !!booking;
                            return (
                              <div
                                key={slot.id}
                                className={`time-slot-mini ${isBooked ? 'booked' : 'free'}`}
                                title={isBooked ? booking.title : 'Available'}
                              >
                                {slot.label.split(' ')[0]}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <div className="occupancy-bar">
                          <div
                            className="occupancy-fill"
                            style={{ width: `${room.occupancyPercent}%` }}
                          />
                        </div>
                        <span className="occupancy-text">{room.occupancyPercent}% full</span>
                      </td>
                      <td>
                        <NavLink
                          to={`/booking?room=${room.id}&date=${format(selectedDate, 'yyyy-MM-dd')}`}
                          className="btn btn-sm btn-outline"
                        >
                          Book
                        </NavLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column - Upcoming & Announcements */}
        <div className="dashboard-sidebar">
          {/* My Upcoming Bookings */}
          <div className="card">
            <div className="card-header">
              <h2>My Bookings Today</h2>
            </div>

            {userBookings.length === 0 ? (
              <div className="empty-state">
                <Calendar size={32} />
                <p>No bookings for today</p>
                <NavLink to="/booking" className="btn btn-sm btn-primary">
                  Book a Room
                </NavLink>
              </div>
            ) : (
              <div className="booking-list">
                {userBookings.map(booking => {
                  const room = buildingRooms.find(r => r.id === booking.roomId);
                  const slot = timeSlots.find(s => s.id === booking.timeSlotId);
                  return (
                    <div key={booking.id} className="booking-item">
                      <div className="booking-time">
                        <Clock size={16} />
                        <span>{slot?.label}</span>
                      </div>
                      <div className="booking-details">
                        <strong>{booking.title}</strong>
                        <span className="booking-room">{room?.name}</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {(user?.role === 'admin' || user?.role === 'faculty') && booking.status === 'confirmed' && (
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                            }}
                            title="Student seat reservations"
                          >
                            <Armchair size={12} />
                            {allSeatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active').length}
                            /{room?.capacity || 75} Reserved
                          </span>
                        )}
                        <span className={`booking-status ${booking.status}`}>
                          {booking.status === 'confirmed' && <CheckCircle size={14} />}
                          {booking.status === 'pending' && <Loader2 size={14} />}
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <NavLink to="/schedule" className="card-footer">View Full Schedule →</NavLink>
          </div>

          {/* Announcements */}
          <div className="card">
            <div className="card-header">
              <h2>Announcements</h2>
            </div>

            {announcements.length === 0 ? (
              <div className="empty-state">
                <Megaphone size={32} />
                <p>No announcements</p>
              </div>
            ) : (
              <div className="announcement-list">
                {announcements.slice(0, 5).map(ann => (
                  <div key={ann.id} className={`announcement-item priority-${ann.priority}`}>
                    <div className="announcement-content">
                      <h4>{ann.title}</h4>
                      <p>{ann.content.substring(0, 100)}...</p>
                      <small>{format(parseISO(ann.createdAt), 'MMM d')}</small>
                    </div>
                    <span className={`priority-badge ${ann.priority}`}>{ann.priority}</span>
                  </div>
                ))}
              </div>
            )}

            <NavLink to="/announcements" className="card-footer">View All →</NavLink>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2>Quick Actions</h2>
            </div>
            <div className="quick-actions">
              <NavLink to="/search" className="action-btn">
                <Search size={20} />
                <span>Search Rooms</span>
              </NavLink>
              <NavLink to="/floor-plan" className="action-btn">
                <Building2 size={20} />
                <span>Floor Plan</span>
              </NavLink>
              <NavLink to="/conflicts" className="action-btn">
                <AlertTriangle size={20} />
                <span>Report Conflict</span>
              </NavLink>
              <NavLink to="/history" className="action-btn">
                <History size={20} />
                <span>Booking History</span>
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* Student Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Student Credentials Modal */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
      />
    </div>
  );
}