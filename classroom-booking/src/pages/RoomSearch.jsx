import { useState, useMemo } from 'react';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, addDays, startOfWeek, startOfDay, isToday } from 'date-fns';
import {
  Search,
  Filter,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Wifi,
  Monitor,
  Volume2,
  Accessibility as Wheelchair,
  Video,
  LayoutGrid,
  List,
  Loader2,
  Clock,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { formatFloor } from '../data/mockData';

export function RoomSearch() {
  const {
    allRooms,
    buildingRooms,
    selectedBuilding,
    setSelectedBuilding,
    selectedDate,
    setSelectedDate,
    timeSlots,
    isRoomBooked,
    getBooking,
    searchRooms,
    filters,
    setFilters,
    buildings,
  } = useBooking();
  const { hasRole } = useAuth();

  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('all');

  // Calculate week dates
  const weekStart = useMemo(() => {
    const base = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [selectedDate, weekOffset]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Filter rooms based on search and filters
  const filteredRooms = useMemo(() => {
    let rooms = searchQuery ? searchRooms(searchQuery) : buildingRooms;

    if (selectedTimeSlot && selectedTimeSlot !== 'all') {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      rooms = rooms.filter(r => {
        if (r.bookable === false) return false;
        return !isRoomBooked(r.id, selectedTimeSlot, dateStr);
      });
    }

    if (filters.capacity) {
      rooms = rooms.filter(r => r.capacity >= filters.capacity);
    }
    if (filters.type) {
      rooms = rooms.filter(r => r.type === filters.type);
    }
    if (filters.floor) {
      rooms = rooms.filter(r => r.floor === filters.floor);
    }
    if (filters.equipment.length > 0) {
      rooms = rooms.filter(r => filters.equipment.every(e => r.equipment.includes(e)));
    }
    if (filters.features.length > 0) {
      rooms = rooms.filter(r => filters.features.every(f => r.features.includes(f)));
    }

    return rooms;
  }, [buildingRooms, searchQuery, filters, searchRooms, selectedTimeSlot, selectedDate, isRoomBooked]);

  // Get availability for a room across the week
  const getRoomWeekAvailability = (roomId) => {
    return weekDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const bookedSlots = timeSlots.filter(slot => isRoomBooked(roomId, slot.id, dateStr));
      return {
        date: dateStr,
        bookedCount: bookedSlots.length,
        totalSlots: timeSlots.length,
        availableCount: timeSlots.length - bookedSlots.length,
        isToday: isToday(date),
        isPast: date < startOfDay(new Date()),
      };
    });
  };

  const navigateWeek = (direction) => {
    setWeekOffset(prev => prev + direction);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    setWeekOffset(0);
  };

  const clearFilters = () => {
    setFilters({
      capacity: null,
      type: null,
      equipment: [],
      features: [],
      floor: null,
    });
    setSelectedTimeSlot('all');
  };

  const hasActiveFilters = Object.values(filters).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== null
  ) || selectedTimeSlot !== 'all';

  const equipmentIcons = {
    projector: <Monitor size={14} />,
    'sound-system': <Volume2 size={14} />,
    'greenboard': <LayoutGrid size={14} />,
    'video-conference': <Video size={14} />,
    'recording-capable': <Video size={14} />,
    internet: <Wifi size={14} />,
    computers: <Monitor size={14} />,
  };

  const featureIcons = {
    'wheelchair-accessible': <Wheelchair size={14} />,
    'recording-capable': <Video size={14} />,
  };

  return (
    <div className="search-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Room Search</h1>
          <p className="subtitle">Find and book the perfect room for your needs</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by name, type, equipment, capacity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-actions">
          <button
            className={`btn ${hasActiveFilters ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filters</span>
            {hasActiveFilters && <span className="filter-badge">{Object.values(filters).flat().filter(Boolean).length}</span>}
          </button>

          <div className="building-selector-inline">
            <Building2 size={18} />
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="building-select"
            >
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.image} {b.name}</option>
              ))}
            </select>
          </div>

          <div className="slot-selector-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={18} />
            <select
              value={selectedTimeSlot}
              onChange={(e) => setSelectedTimeSlot(e.target.value)}
              aria-label="Filter by time slot"
              style={{
                padding: '0.45rem 0.65rem',
                border: selectedTimeSlot !== 'all' ? '1.5px solid #3b82f6' : '1px solid #d1d5db',
                borderRadius: '6px',
                background: selectedTimeSlot !== 'all' ? '#eff6ff' : '#fff',
                color: '#111827',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">⏰ All time slots</option>
              {timeSlots.map(s => (
                <option key={s.id} value={s.id}>⏰ {s.start} – {s.end}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-outline" onClick={goToToday}>
            <Calendar size={18} /> Today
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Time Slot</label>
              <select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
              >
                <option value="all">All time slots</option>
                {timeSlots.map(s => (
                  <option key={s.id} value={s.id}>{s.start} – {s.end}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Min Capacity</label>
              <select
                value={filters.capacity || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, capacity: e.target.value ? parseInt(e.target.value) : null }))}
              >
                <option value="">Any</option>
                <option value="20">20+</option>
                <option value="30">30+</option>
                <option value="50">50+</option>
                <option value="70">70+</option>
                <option value="100">100+</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Room Type</label>
              <select
                value={filters.type || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value || null }))}
              >
                <option value="">All Types</option>
                <option value="lecture-hall">Lecture Hall</option>
                <option value="classroom">Classroom</option>
                <option value="lab">Laboratory</option>
                <option value="seminar">Seminar Room</option>
                <option value="faculty">Faculty Room</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Floor</label>
              <select
                value={filters.floor !== null && filters.floor !== undefined ? filters.floor : ''}
                onChange={(e) => setFilters(prev => ({ ...prev, floor: e.target.value !== '' ? parseInt(e.target.value) : null }))}
              >
                <option value="">Any Floor</option>
                <option value="0">Ground Floor</option>
                <option value="1">1st Floor</option>
                <option value="2">2nd Floor</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Equipment</label>
              <div className="checkbox-group">
                {['projector', 'sound-system', 'greenboard', 'video-conference', 'computers', 'internet'].map(eq => (
                  <label key={eq} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={filters.equipment.includes(eq)}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        equipment: e.target.checked
                          ? [...prev.equipment, eq]
                          : prev.equipment.filter(x => x !== eq)
                      }))}
                    />
                    <span>{eq.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Features</label>
              <div className="checkbox-group">
                {['wheelchair-accessible', 'recording-capable'].map(feat => (
                  <label key={feat} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={filters.features.includes(feat)}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        features: e.target.checked
                          ? [...prev.features, feat]
                          : prev.features.filter(x => x !== feat)
                      }))}
                    />
                    <span>{feat.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group filter-actions">
              <button className="btn btn-outline" onClick={clearFilters}>
                <X size={16} /> Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week Navigator */}
      <div className="week-navigator">
        <button className="btn btn-ghost" onClick={() => navigateWeek(-1)}>
          <ChevronLeft size={20} />
        </button>

        <div className="week-dates">
          {weekDates.map(date => (
            <div
              key={format(date, 'yyyy-MM-dd')}
              className={`week-day ${isToday(date) ? 'today' : ''} ${date < startOfDay(new Date()) ? 'past' : ''}`}
            >
              <span className="day-name">{format(date, 'EEE')}</span>
              <span className="day-number">{format(date, 'd')}</span>
              <span className="day-month">{format(date, 'MMM')}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={() => navigateWeek(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Results */}
      <div className="search-results">
        <div className="results-header">
          <span>
            {filteredRooms.length} {selectedTimeSlot !== 'all' ? 'free ' : ''}room{filteredRooms.length !== 1 ? 's' : ''} found
            {selectedTimeSlot !== 'all' && ` (free at ${timeSlots.find(s => s.id === selectedTimeSlot)?.start} – ${timeSlots.find(s => s.id === selectedTimeSlot)?.end})`}
          </span>
          {searchQuery && (
            <span className="search-tag">Filtered by: "{searchQuery}"</span>
          )}
        </div>

        {filteredRooms.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} />
            <h3>{selectedTimeSlot !== 'all' ? 'No rooms free at this time slot' : 'No rooms found'}</h3>
            <p>
              {selectedTimeSlot !== 'all'
                ? `All matching rooms are booked or unavailable during ${timeSlots.find(s => s.id === selectedTimeSlot)?.start || 'this time slot'}. Try a different time slot or date.`
                : 'Try adjusting your search or filters'}
            </p>
            <button className="btn btn-primary" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : (
          viewMode === 'grid' ? (
            <div className="rooms-grid">
              {filteredRooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  weekAvailability={getRoomWeekAvailability(room.id)}
                  weekDates={weekDates}
                  timeSlots={timeSlots}
                  isRoomBooked={isRoomBooked}
                  getBooking={getBooking}
                  hasRole={hasRole}
                  selectedTimeSlot={selectedTimeSlot}
                  selectedDateStr={format(selectedDate, 'yyyy-MM-dd')}
                />
              ))}
            </div>
          ) : (
            <div className="rooms-list">
              {filteredRooms.map(room => (
                <RoomListItem
                  key={room.id}
                  room={room}
                  weekAvailability={getRoomWeekAvailability(room.id)}
                  weekDates={weekDates}
                  timeSlots={timeSlots}
                  isRoomBooked={isRoomBooked}
                  getBooking={getBooking}
                  hasRole={hasRole}
                  selectedTimeSlot={selectedTimeSlot}
                  selectedDateStr={format(selectedDate, 'yyyy-MM-dd')}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Room Card Component
function RoomCard({ room, weekAvailability, weekDates, timeSlots, isRoomBooked, getBooking, hasRole, selectedTimeSlot, selectedDateStr }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const todayAvailability = weekAvailability.find(a => a.isToday) || weekAvailability[0];
  const availableToday = todayAvailability.availableCount;
  const totalToday = todayAvailability.totalSlots;

  return (
    <div className="room-card">
      <div className="room-card-header">
        <div className="room-icon" style={{ backgroundColor: getRoomTypeColor(room.type) }}>
          {getRoomTypeIcon(room.type)}
        </div>
        <div className="room-info">
          <h3>{room.name}</h3>
          <div className="room-meta">
            <span className="room-type">{room.type.replace('-', ' ')}</span>
            <span className="room-floor">{formatFloor(room.floor)}</span>
            {selectedTimeSlot && selectedTimeSlot !== 'all' && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                Free · {timeSlots.find(s => s.id === selectedTimeSlot)?.start}
              </span>
            )}
            {room.bookable !== false && room.capacity ? (
              <span className="room-capacity">
                <Users size={14} /> {room.capacity}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                🔒 Non-reservable
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="room-features">
        {room.equipment.slice(0, 4).map(eq => (
          <span key={eq} className="feature-tag" title={eq.replace('-', ' ')}>
            {equipmentIcons[eq] || <Monitor size={12} />}
          </span>
        ))}
        {room.equipment.length > 4 && (
          <span className="feature-tag more">+{room.equipment.length - 4}</span>
        )}
        {room.features.map(feat => (
          <span key={feat} className="feature-tag feature" title={feat.replace('-', ' ')}>
            {featureIcons[feat] || <Wheelchair size={12} />}
          </span>
        ))}
      </div>

      {/* Week Availability Heatmap */}
      <div className="week-heatmap">
        {weekAvailability.map((day, i) => (
          <button
            key={day.date}
            className={`heatmap-cell ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''} ${expandedDay === i ? 'expanded' : ''}`}
            onClick={() => setExpandedDay(expandedDay === i ? null : i)}
            disabled={day.isPast}
            title={`${format(parseISO(day.date), 'EEE, MMM d')}: ${day.availableCount}/${day.totalSlots} free`}
          >
            <div className="heatmap-fill" style={{ width: `${(day.availableCount / day.totalSlots) * 100}%` }} />
            <span className="heatmap-text">
              {day.availableCount > 0 ? day.availableCount : '—'}
            </span>
          </button>
        ))}
      </div>

      {/* Expanded Time Slots */}
      {expandedDay !== null && (
        <div className="expanded-slots">
          <div className="expanded-header">
            <strong>{format(parseISO(weekAvailability[expandedDay].date), 'EEE, MMM d')}</strong>
            <span>{weekAvailability[expandedDay].availableCount} of {weekAvailability[expandedDay].totalSlots} slots available</span>
          </div>
          <div className="time-slots-grid">
            {timeSlots.map(slot => {
              const booking = getBooking(room.id, slot.id, weekAvailability[expandedDay].date);
              const isBooked = !!booking;
              return (
                <NavLink
                  key={slot.id}
                  to={`/booking?room=${room.id}&date=${weekAvailability[expandedDay].date}&slot=${slot.id}`}
                  className={`time-slot-btn ${isBooked ? 'booked' : 'available'}`}
                  disabled={isBooked || weekAvailability[expandedDay].isPast}
                >
                  {slot.label.split(' ')[0]}
                  {isBooked && <span className="slot-title">{booking.title}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <div className="room-card-actions">
        {room.bookable !== false ? (
          hasRole && hasRole('student') ? (
            room.type === 'library' || room.id === 'iet-library' ? (
              <NavLink to="/reserve-seat" className="btn btn-primary btn-sm">
                Reserve Seat
              </NavLink>
            ) : null
          ) : (
            <NavLink
              to={`/booking?room=${room.id}&date=${selectedDateStr || format(new Date(), 'yyyy-MM-dd')}${selectedTimeSlot && selectedTimeSlot !== 'all' ? `&slot=${selectedTimeSlot}` : ''}`}
              className="btn btn-primary btn-sm"
            >
              Book Now
            </NavLink>
          )
        ) : (
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, padding: '4px 8px' }}>
            🔒 Non-reservable
          </span>
        )}
        <NavLink to={`/room/${room.id}`} className="btn btn-outline btn-sm">
          Details
        </NavLink>
      </div>
    </div>
  );
}

// Room List Item Component
function RoomListItem({ room, weekAvailability, weekDates, timeSlots, isRoomBooked, getBooking, hasRole, selectedTimeSlot, selectedDateStr }) {
  const todayAvailability = weekAvailability.find(a => a.isToday) || weekAvailability[0];

  return (
    <div className="room-list-item">
      <div className="room-list-icon" style={{ backgroundColor: getRoomTypeColor(room.type) }}>
        {getRoomTypeIcon(room.type)}
      </div>

      <div className="room-list-info">
        <h3>{room.name}</h3>
        <div className="room-list-meta">
          <span className="room-type">{room.type.replace('-', ' ')}</span>
          <span>{formatFloor(room.floor)}</span>
          {selectedTimeSlot && selectedTimeSlot !== 'all' && (
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
              Free · {timeSlots.find(s => s.id === selectedTimeSlot)?.start}
            </span>
          )}
          {room.bookable !== false && room.capacity ? (
            <span><Users size={14} /> {room.capacity} seats</span>
          ) : (
            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>🔒 Non-reservable</span>
          )}
        </div>
        <div className="room-list-features">
          {room.equipment.slice(0, 3).map(eq => (
            <span key={eq} className="feature-tag" title={eq.replace('-', ' ')}>
              {equipmentIcons[eq] || <Monitor size={12} />}
            </span>
          ))}
          {room.features.map(feat => (
            <span key={feat} className="feature-tag feature" title={feat.replace('-', ' ')}>
              {featureIcons[feat] || <Wheelchair size={12} />}
            </span>
          ))}
        </div>
      </div>

      <div className="room-list-availability">
        <div className="availability-summary">
          <span className={`availability-status ${todayAvailability.availableCount > 0 ? 'available' : 'full'}`}>
            {todayAvailability.availableCount > 0 ? `${todayAvailability.availableCount} slots free today` : 'Fully booked today'}
          </span>
          <div className="availability-bar">
            <div className="availability-fill" style={{ width: `${(todayAvailability.availableCount / todayAvailability.totalSlots) * 100}%` }} />
          </div>
        </div>

        <div className="week-mini-heatmap">
          {weekAvailability.map((day, i) => (
            <div
              key={day.date}
              className={`mini-heatmap-cell ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''}`}
              style={{ backgroundColor: day.isPast ? '#f3f4f6' : getAvailabilityColor(day.availableCount, day.totalSlots) }}
              title={`${format(parseISO(day.date), 'EEE')}: ${day.availableCount}/${day.totalSlots}`}
            />
          ))}
        </div>
      </div>

      <div className="room-list-actions">
        {room.bookable !== false ? (
          hasRole && hasRole('student') ? (
            room.type === 'library' || room.id === 'iet-library' ? (
              <NavLink to="/reserve-seat" className="btn btn-primary btn-sm">
                Reserve Seat
              </NavLink>
            ) : (
              <NavLink to={`/room/${room.id}`} className="btn btn-outline btn-sm">
                View Schedule
              </NavLink>
            )
          ) : (
            <NavLink
              to={`/booking?room=${room.id}&date=${selectedDateStr || format(new Date(), 'yyyy-MM-dd')}${selectedTimeSlot && selectedTimeSlot !== 'all' ? `&slot=${selectedTimeSlot}` : ''}`}
              className="btn btn-primary btn-sm"
            >
              Book
            </NavLink>
          )
        ) : (
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, padding: '4px 8px' }}>
            🔒 Non-reservable
          </span>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getRoomTypeColor(type) {
  const colors = {
    'lecture-hall': '#3B82F6',
    'classroom': '#10B981',
    'lab': '#F59E0B',
    'seminar': '#8B5CF6',
    'faculty': '#EC4899',
    'library': '#0284C7',
    'office': '#D97706',
  };
  return colors[type] || '#6B7280';
}

function getRoomTypeIcon(type) {
  const icons = {
    'lecture-hall': '🎓',
    'classroom': '🏫',
    'lab': '🔬',
    'seminar': '💬',
    'faculty': '👨‍🏫',
    'library': '📖',
    'office': '💼',
  };
  return icons[type] || '🏠';
}

function getAvailabilityColor(available, total) {
  const ratio = available / total;
  if (ratio > 0.6) return '#10B981';
  if (ratio > 0.3) return '#F59E0B';
  if (ratio > 0) return '#EF4444';
  return '#EF4444';
}