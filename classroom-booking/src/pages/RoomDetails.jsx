import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { formatFloor } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { format, parseISO, startOfWeek, endOfWeek, addDays, isToday } from 'date-fns';
import {
  Users,
  Building2,
  Clock,
  Monitor,
  Volume2,
  Wifi,
  Video,
  Accessibility as Wheelchair,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Download,
  Edit,
  Heart,
} from 'lucide-react';

export function RoomDetails() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const {
    allRooms,
    allBookings = [],
    buildings,
    timeSlots,
    isRoomBooked,
    getBooking,
    getAlternativeRooms,
    bookRoom,
    checkOverlap,
  } = useBooking();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    title: '',
    recurring: false,
    recurrencePattern: '',
  });
  const [weeklyAvailability, setWeeklyAvailability] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const room = allRooms.find(r => r.id === roomId);
  const building = buildings.find(b => b.id === room?.buildingId);

  // Generate weekly availability
  useEffect(() => {
    if (!room) return;
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const availability = weekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const bookedSlots = timeSlots.filter(slot => isRoomBooked(roomId, slot.id, dateStr));
      const availableCount = timeSlots.length - bookedSlots.length;

      return {
        date: day,
        dateStr: dateStr,
        bookedSlots: bookedSlots,
        availableCount: availableCount,
        isToday: isToday(day),
      };
    });

    setWeeklyAvailability(availability);
  }, [selectedDate, roomId, timeSlots, isRoomBooked, room]);

  const upcomingBookings = useMemo(() => {
    if (!room) return [];
    const today = new Date();
    const nextWeek = addDays(today, 7);

    return (allBookings || [])
      .filter(b =>
        b.roomId === roomId &&
        new Date(b.date) >= today &&
        new Date(b.date) <= nextWeek &&
        b.status === 'confirmed'
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [roomId, allBookings, room]);

  if (!room || !building) {
    return (
      <div className="not-found">
        <h2>Room Not Found</h2>
        <p>The room you're looking for doesn't exist.</p>
      </div>
    );
  }

  const handleBookNow = (timeSlotId) => {
    if (room?.bookable === false) return;
    setBookingForm(prev => ({
      ...prev,
      timeSlotId,
    }));
    setShowBookingForm(true);
  };

  const getTimeSlot = (slotId) => timeSlots.find(s => s.id === slotId);

  const getEquipmentIcon = (equipment) => {
    const icons = {
      'projector': <Monitor size={16} />,
      'sound-system': <Volume2 size={16} />,
      'greenboard': <div className="icon-placeholder">📋</div>,
      'video-conference': <Video size={16} />,
      'internet': <Wifi size={16} />,
    };
    return icons[equipment] || <div className="icon-placeholder">📦</div>;
  };

  const getFeatureIcon = (feature) => {
    const icons = {
      'wheelchair-accessible': <Wheelchair size={16} />,
      'recording-capable': <Video size={16} />,
    };
    return icons[feature] || <div className="icon-placeholder">✓</div>;
  };

  const toggleFavorite = () => {
    setFavorites(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const getRoomTypeColor = (type) => {
    const colors = {
      'lecture-hall': '#3B82F6',
      'classroom': '#10B981',
      'lab': '#F59E0B',
      'seminar': '#8B5CF6',
      'faculty': '#EC4899',
    };
    return colors[type] || '#6B7280';
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={`star ${i < Math.ceil(rating) ? 'filled' : ''}`}>★</span>
    ));
  };

  return (
    <div className="room-details-page">
      {/* Hero Section */}
      <div className="room-hero">
        <div className="room-hero-content">
          <div className="room-header">
            <h1>{room.name}</h1>
            <div className="room-meta">
              <span className="building">
                <Building2 size={18} /> {building.name}
              </span>
              <span className="floor">{formatFloor(room.floor)}</span>
              {room.bookable !== false && room.capacity ? (
                <span className="capacity">
                  <Users size={18} /> {room.capacity} capacity
                </span>
              ) : (
                <span className="capacity" style={{ color: '#ef4444', fontWeight: 700 }}>
                  🔒 Non-reservable Office
                </span>
              )}
              <span className="type">{room.type.replace('-', ' ')}</span>
            </div>
          </div>

          <div className="room-actions">
            <button
              className={`favorite-btn ${favorites.includes(roomId) ? 'active' : ''}`}
              onClick={toggleFavorite}
            >
              <Heart size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="room-details-container">
        {/* Left Column - Room Info */}
        <div className="room-info-section">
          <div className="info-card">
            <h3>About This Room</h3>
            <p>{building.fullName}</p>
            <p className="room-description">
              {room.bookable === false
                ? `${room.name} is an administrative space located on ${formatFloor(room.floor)} of ${building.name}. It is strictly non-reservable and not available for booking.`
                : `${room.name} is a ${room.type.replace('-', ' ')} located on ${formatFloor(room.floor)} of ${building.name}. It has a capacity of ${room.capacity} students.`}
            </p>

            <div className="room-features">
              <h4>Equipment Available</h4>
              <ul className="feature-list">
                {room.equipment.map(eq => (
                  <li key={eq} className="feature-item">
                    <span className="feature-icon">{getEquipmentIcon(eq)}</span>
                    <span>{eq.replace('-', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="room-features">
              <h4>Accessibility Features</h4>
              <ul className="feature-list">
                {room.features.map(feature => (
                  <li key={feature} className="feature-item accessibility">
                    <span className="feature-icon">{getFeatureIcon(feature)}</span>
                    <span>{feature.replace('-', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Weekly Calendar View */}
          {room.bookable === false ? (
            <div className="calendar-card" style={{ borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2', padding: '24px' }}>
              <h3 style={{ color: '#991b1b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔒</span> Administrative Office — Not Reservable
              </h3>
              <p style={{ color: '#7f1d1d', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                This space is reserved for university administration, faculty staff, or placement cell operations. It is strictly non-reservable and excluded from public room booking and student seating.
              </p>
            </div>
          ) : (
            <div className="calendar-card">
              <div className="calendar-header">
                <h3>Weekly Availability</h3>
                <div className="calendar-navigation">
                  <button
                    className="nav-btn"
                    onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                  >
                    ← Previous
                  </button>
                  <span className="current-week">
                    {format(startOfWeek(selectedDate), 'MMM d')} - {format(endOfWeek(selectedDate), 'MMM d, yyyy')}
                  </span>
                  <button
                    className="nav-btn"
                    onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="weekly-calendar">
                {weeklyAvailability.map(day => (
                  <div key={day.dateStr} className={`calendar-day ${day.isToday ? 'today' : ''}`}>
                    <div className="day-header">
                      <span className="day-name">{format(day.date, 'EEE')}</span>
                      <span className="day-number">{format(day.date, 'd')}</span>
                    </div>
                    <div className="slots-container">
                      {timeSlots.map(slot => {
                        const isBooked = isRoomBooked(roomId, slot.id, day.dateStr);
                        const booking = getBooking(roomId, slot.id, day.dateStr);
                        return (
                          <button
                            key={slot.id}
                            className={`time-slot ${isBooked ? 'booked' : 'available'} ${day.isToday ? 'today' : ''}`}
                            onClick={() => !isBooked && handleBookNow(slot.id)}
                            disabled={isBooked || day.date < new Date().toISOString().split('T')[0]}
                          >
                            <span className="slot-time">{slot.label.split(' ')[0]}</span>
                            {isBooked && (
                              <span className="slot-booking">
                                <span className="booking-dot" />
                                <span className="booking-title">{booking.title}</span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          <div className="reviews-card">
            <h3>User Reviews</h3>
            <div className="reviews-summary">
              <div className="average-rating">
                <span className="rating-number">4.2</span>
                <div className="stars">{renderStars(4.2)}</div>
              </div>
              <div className="review-stats">
                <span>24 reviews</span>
                <span>• 85% positive</span>
              </div>
            </div>

            <div className="review-form">
              <h4>Write a Review</h4>
              <textarea
                placeholder="Share your experience with this room..."
                rows="3"
                className="review-textarea"
              />
              <button className="btn btn-primary btn-sm">
                <MessageSquare size={16} /> Submit Review
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Booking and Info */}
        <div className="booking-sidebar">
          {/* Booking Form */}
          {showBookingForm && (
            <div className="booking-form-card">
              <h3>Quick Booking</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                // Handle booking logic
                console.log('Booking:', bookingForm);
                setShowBookingForm(false);
              }}>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={bookingForm.title}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Session title"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Recurring</label>
                  <select
                    value={bookingForm.recurring ? bookingForm.recurrencePattern : ''}
                    onChange={(e) => setBookingForm(prev => ({
                      ...prev,
                      recurring: !!e.target.value,
                      recurrencePattern: e.target.value,
                    }))}
                  >
                    <option value="">One-time</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-full">
                    Confirm Booking
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-full"
                    onClick={() => setShowBookingForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Room Stats */}
          <div className="stats-card">
            <h3>Room Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Usage This Week</span>
                <span className="stat-value">68%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Most Used Day</span>
                <span className="stat-value">Tuesday</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Duration</span>
                <span className="stat-value">2.5 hrs</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Setup Time</span>
                <span className="stat-value">15 min</span>
              </div>
            </div>
          </div>

          {/* Upcoming Bookings */}
          {upcomingBookings.length > 0 && (
            <div className="upcoming-bookings-card">
              <h3>Upcoming Bookings This Week</h3>
              <div className="bookings-list">
                {upcomingBookings.map(booking => {
                  const slot = getTimeSlot(booking.timeSlotId);
                  return (
                    <div key={booking.id} className="booking-item-mini">
                      <div className="booking-mini-info">
                        <strong>{booking.title}</strong>
                        <span className="booking-time-mini">
                          <Clock size={14} /> {slot?.label}
                        </span>
                        <span className="booking-date-mini">
                          {format(parseISO(booking.date), 'MMM d')}
                        </span>
                      </div>
                      <span className="booking-status-mini status-confirmed">Confirmed</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact & Help */}
          <div className="help-card">
            <h3>Need Help?</h3>
            <div className="help-options">
              <button className="help-option">
                <Video size={20} />
                <span>Virtual Tour</span>
              </button>
              <button className="help-option">
                <MessageSquare size={20} />
                <span>Chat Support</span>
              </button>
              <button className="help-option">
                <Download size={20} />
                <span>Room Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}