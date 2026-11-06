import { useState, useMemo } from 'react';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { Building2, Users, Monitor, Volume2, Wifi, Video, Accessibility as Wheelchair, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

const NON_RESERVABLE_IDS = ['iet-teachers-office', 'iet-placement-cell', 'iet-director-office'];

export function FloorPlan() {
  const {
    buildings,
    buildingRooms,
    selectedBuilding,
    setSelectedBuilding,
    isRoomBooked,
    getBooking,
    timeSlots,
  } = useBooking();
  const { hasRole } = useAuth();

  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [showEquipmentLegend, setShowEquipmentLegend] = useState(false);

  const selectedBuildingData = buildings.find(b => b.id === selectedBuilding);
  const mapBuildingRooms = useMemo(() => {
    return buildingRooms.filter(r => !r.id.includes('lab-p') && !r.name?.toLowerCase().includes('practical lab'));
  }, [buildingRooms]);
  const filteredRooms = selectedFloor === 'all'
    ? mapBuildingRooms
    : mapBuildingRooms.filter(r => r.floor === parseInt(selectedFloor));

  const getRoomTypeColor = (type) => {
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
  };

  const getRoomTypeIcon = (type) => {
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
  };

  const getEquipmentIcon = (equipment) => {
    const icons = {
      'projector': <Monitor size={12} />,
      'sound-system': <Volume2 size={12} />,
      'greenboard': <div className="icon-placeholder">📋</div>,
      'video-conference': <Video size={12} />,
      'internet': <Wifi size={12} />,
    };
    return icons[equipment] || <div className="icon-placeholder">📦</div>;
  };

  const getFeatureIcon = (feature) => {
    const icons = {
      'wheelchair-accessible': <Wheelchair size={12} />,
      'recording-capable': <Video size={12} />,
    };
    return icons[feature] || <div className="icon-placeholder">✓</div>;
  };

  const FloorSelector = () => {
    const floors = [...new Set(mapBuildingRooms.map(r => r.floor))].sort((a, b) => a - b);

    return (
      <div className="floor-selector">
        <button
          className={`floor-btn ${selectedFloor === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFloor('all')}
        >
          All Floors
        </button>
        {floors.map(floor => (
          <button
            key={floor}
            className={`floor-btn ${selectedFloor === floor.toString() ? 'active' : ''}`}
            onClick={() => setSelectedFloor(floor.toString())}
          >
            {floor === 0 ? 'Ground Floor' : floor === 1 ? '1st Floor' : floor === 2 ? '2nd Floor' : `Floor ${floor}`}
          </button>
        ))}
      </div>
    );
  };

  const RoomInfoPanel = ({ room }) => {
    const bookedSlots = useMemo(() => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      return timeSlots.filter(slot =>
        isRoomBooked(room.id, slot.id, dateStr)
      );
    }, [room.id, timeSlots, isRoomBooked]);

    return (
      <div className="room-info-panel">
        <div className="room-header">
          <div className="room-icon-large" style={{ backgroundColor: getRoomTypeColor(room.type) }}>
            {getRoomTypeIcon(room.type)}
          </div>
          <div className="room-title">
            <h3>{room.name}</h3>
            <span className="room-type">{room.type.replace('-', ' ')}</span>
          </div>
        </div>

        <div className="room-details">
          {NON_RESERVABLE_IDS.includes(room.id) || room.bookable === false ? (
            <div className="detail-row" style={{ backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                🔒 Non-reservable (NO RESERVATION)
              </span>
            </div>
          ) : room.capacity ? (
            <div className="detail-row">
              <Users size={16} />
              <span>{room.capacity} capacity</span>
            </div>
          ) : null}
          <div className="detail-row">
            <Building2 size={16} />
            <span>{room.buildingId.toUpperCase()}</span>
          </div>
          <div className="detail-row">
            <span className="floor-indicator">Floor {room.floor}</span>
          </div>
        </div>

        <div className="room-equipment">
          <h4>Equipment</h4>
          <div className="equipment-list">
            {room.equipment.map(eq => (
              <span key={eq} className="equipment-tag">
                {getEquipmentIcon(eq)}
                <span>{eq.replace('-', ' ')}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="room-features">
          <h4>Features</h4>
          <div className="features-list">
            {room.features.map(feature => (
              <span key={feature} className="feature-tag">
                {getFeatureIcon(feature)}
                <span>{feature.replace('-', ' ')}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="room-availability">
          <h4>Today's Status</h4>
          <div className="availability-stats">
            <div className="stat">
              <span className="stat-value">{timeSlots.length - bookedSlots.length}</span>
              <span className="stat-label">Available</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bookedSlots.length}</span>
              <span className="stat-label">Booked</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(((timeSlots.length - bookedSlots.length) / timeSlots.length) * 100)}%</span>
              <span className="stat-label">Free Rate</span>
            </div>
          </div>
        </div>

        <div className="room-bookings">
          <h4>Today's Bookings</h4>
          {bookedSlots.length === 0 ? (
            <div className="no-bookings">No bookings today</div>
          ) : (
            <div className="bookings-list">
              {bookedSlots.map(slot => {
                const booking = getBooking(room.id, slot.id, new Date().toISOString().split('T')[0]);
                return (
                  <div key={slot.id} className="booking-item-mini">
                    <Clock size={14} />
                    <div className="booking-info">
                      <span className="booking-time">{slot.label}</span>
                      <span className="booking-title">{booking.title}</span>
                    </div>
                    <span className="booking-status status-confirmed">Confirmed</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="floor-plan-page">
      <div className="page-header">
        <h1>Interactive Floor Plan</h1>
        <p>Explore building layout and room availability</p>
      </div>

      <div className="floor-plan-container">
        <div className="building-selector">
          <h3>Select Building</h3>
          <div className="building-options">
            {buildings.map(building => (
              <button
                key={building.id}
                className={`building-option ${selectedBuilding === building.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedBuilding(building.id);
                  setSelectedFloor('all');
                }}
              >
                <span className="building-emoji">{building.image}</span>
                <span className="building-name">{building.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="floor-plan-content">
          <div className="controls-panel">
            <FloorSelector />

            <button
              className="legend-toggle"
              onClick={() => setShowEquipmentLegend(!showEquipmentLegend)}
            >
              <ChevronDown size={16} /> Equipment Legend
            </button>

            {showEquipmentLegend && (
              <div className="equipment-legend">
                <h4>Equipment Icons</h4>
                <div className="legend-items">
                  <div className="legend-item">
                    <Monitor size={14} /> <span>Projector</span>
                  </div>
                  <div className="legend-item">
                    <Volume2 size={14} /> <span>Sound System</span>
                  </div>
                  <div className="legend-item">
                    <Wifi size={14} /> <span>AC/WiFi</span>
                  </div>
                  <div className="legend-item">
                    <Video size={14} /> <span>Video Conference</span>
                  </div>
                </div>

                <h4>Accessibility Features</h4>
                <div className="legend-items">
                  <div className="legend-item">
                    <Wheelchair size={14} /> <span>Wheelchair Accessible</span>
                  </div>
                  <div className="legend-item">
                    <Video size={14} /> <span>Recording Capable</span>
                  </div>
                </div>
              </div>
            )}

            {hasRole(['admin']) && (
              <div className="admin-tools">
                <h4>Quick Actions</h4>
                <button className="btn btn-outline btn-sm">
                  Add Room
                </button>
                <button className="btn btn-outline btn-sm">
                  Edit Floor Plan
                </button>
              </div>
            )}
          </div>

          <div className="floor-plan-map">
            {filteredRooms.map(room => {
              const isNonReservable = NON_RESERVABLE_IDS.includes(room.id) || room.bookable === false;
              const isBooked = isRoomBooked(room.id, timeSlots[0].id, new Date().toISOString().split('T')[0]);

              return (
                <div
                  key={room.id}
                  className={`room-node ${isBooked ? 'booked' : ''} ${hoveredRoom?.id === room.id ? 'hovered' : ''}`}
                  style={{
                    ...room.coordinates,
                    ...(isNonReservable ? {
                      backgroundColor: '#fee2e2',
                      borderColor: '#ef4444',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      boxShadow: '0 0 0 1px #ef4444',
                    } : {})
                  }}
                  onMouseEnter={() => setHoveredRoom(room)}
                  onMouseLeave={() => setHoveredRoom(null)}
                  title={room.name}
                >
                  <div className="room-node-inner">
                    <span className="room-icon">{isNonReservable ? '🔒' : getRoomTypeIcon(room.type)}</span>
                    <span className="room-name" style={isNonReservable ? { color: '#991b1b', fontWeight: 700 } : {}}>
                      {room.name}
                    </span>
                    {isNonReservable ? (
                      <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 800, letterSpacing: '0.5px' }}>
                        NO RESERVATION
                      </span>
                    ) : room.capacity ? (
                      <span className="room-capacity">
                        <Users size={12} /> {room.capacity}
                      </span>
                    ) : null}
                  </div>

                  {!isNonReservable && isBooked && (
                    <div className="booking-indicator">
                      <AlertTriangle size={12} />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="floor-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#fee2e2', border: '1.5px solid #ef4444' }}></div>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>Non-reservable (NO RESERVATION)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#3B82F6' }}></div>
                <span>Lecture Hall</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#10B981' }}></div>
                <span>Classroom</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#F59E0B' }}></div>
                <span>Laboratory</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#8B5CF6' }}></div>
                <span>Seminar Room</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#EC4899' }}></div>
                <span>Faculty Room</span>
              </div>
            </div>
          </div>

          <div className="room-info-sidebar">
            {hoveredRoom ? (
              <RoomInfoPanel room={hoveredRoom} />
            ) : (
              <div className="room-info-placeholder">
                <Building2 size={48} />
                <p>Hover over a room to see details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}