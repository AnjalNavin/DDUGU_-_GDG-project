import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  Clock,
  Users,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Loader2,
  MessageSquare,
  Save,
  Edit,
} from 'lucide-react';
import { useSearchParams, Navigate } from 'react-router-dom';
import {
  formatFloor,
  academicStructure,
  getAllSections,
  calculateSelectedStrength,
  formatAudienceDescription,
} from '../data/mockData';

export function Booking() {
  const { user } = useAuth();

  // Students must not have access to classroom booking
  if (user?.role === 'student') {
    return <Navigate to="/reserve-seat" replace />;
  }
  const {
    allRooms,
    buildings,
    timeSlots,
    bookRoom,
    cancelBooking,
    checkOverlap,
    getAlternativeRooms,
    reportConflict,
    searchRooms,
    selectedDate: bookingDate,
    selectedBuilding: selectedBuildingId,
    setSelectedDate,
    setSelectedBuilding,
    filters,
  } = useBooking();
  const [searchParams] = useSearchParams();
  const [bookingForm, setBookingForm] = useState({
    roomId: '',
    date: bookingDate.toISOString().split('T')[0],
    timeSlotId: '',
    title: '',
    recurring: false,
    recurrencePattern: '',
    description: '',
  });
  const [showConflicts, setShowConflicts] = useState(false);
  const [alternativeRooms, setAlternativeRooms] = useState([]);
  const [showAlternativeFinder, setShowAlternativeFinder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  // Initialize from URL params
  useEffect(() => {
    const roomParam = searchParams.get('room');
    const dateParam = searchParams.get('date');
    const slotParam = searchParams.get('slot');

    if (roomParam) setBookingForm(prev => ({ ...prev, roomId: roomParam }));
    if (dateParam) setBookingForm(prev => ({ ...prev, date: dateParam }));
    if (slotParam) setBookingForm(prev => ({ ...prev, timeSlotId: slotParam }));
  }, [searchParams]);

  // Find room and building
  const selectedRoom = allRooms.find(r => r.id === bookingForm.roomId);
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const selectedTimeSlot = timeSlots.find(s => s.id === bookingForm.timeSlotId);

  // Academic audience state
  const [academicYear, setAcademicYear] = useState('');
  const [academicBranch, setAcademicBranch] = useState('');
  const [selectedSections, setSelectedSections] = useState([]);
  const [overflowModal, setOverflowModal] = useState(null);

  const allSectionsList = useMemo(() => getAllSections(), []);

  const visibleSections = useMemo(() => {
    const effectiveYear = academicYear || '1';
    return allSectionsList.filter(s => {
      const matchYear = s.yearId === effectiveYear;
      const matchBranch = !academicBranch || academicBranch === 'all' || s.branchId === academicBranch;
      return matchYear && matchBranch;
    });
  }, [allSectionsList, academicYear, academicBranch]);

  const totalStrength = useMemo(() => {
    return calculateSelectedStrength(selectedSections);
  }, [selectedSections]);

  const roomCapacity = selectedRoom?.capacity || 75;
  const isOverflow = totalStrength > roomCapacity;
  const overflowCount = totalStrength - roomCapacity;

  const toggleSection = (secId) => {
    setSelectedSections(prev => {
      if (prev.includes(secId)) {
        return prev.filter(id => id !== secId);
      } else {
        const parts = secId.split('-');
        if (!academicYear && parts[0]) {
          setAcademicYear(parts[0]);
        }
        return [...prev, secId];
      }
    });
  };

  const selectAllInBranch = (branchId) => {
    const branch = academicStructure.branches.find(b => b.id === branchId);
    if (!branch) return;
    const effectiveYear = academicYear || '1';
    if (!academicYear) {
      setAcademicYear('1');
    }
    const idsToAdd = branch.sections.map(sec => `${effectiveYear}-${branch.id}-${sec.id}`);
    setSelectedSections(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  // Check for conflicts
  useEffect(() => {
    if (bookingForm.roomId && bookingForm.date && bookingForm.timeSlotId) {
      const conflict = checkOverlap(bookingForm.roomId, bookingForm.date, bookingForm.timeSlotId);
      setConflicts(conflict ? [conflict] : []);
    }
  }, [bookingForm.roomId, bookingForm.date, bookingForm.timeSlotId, checkOverlap]);

  // Find alternative rooms
  useEffect(() => {
    if (bookingForm.roomId && bookingForm.date && bookingForm.timeSlotId) {
      const capacity = selectedRoom?.capacity;
      const alternatives = getAlternativeRooms(bookingForm.roomId, bookingForm.date, bookingForm.timeSlotId, capacity);
      setAlternativeRooms(alternatives);
    }
  }, [bookingForm.roomId, bookingForm.date, bookingForm.timeSlotId, getAlternativeRooms, selectedRoom]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBookingForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const doBook = async (audienceDesc, strength) => {
    setIsSubmitting(true);
    try {
      const firstSecParts = (selectedSections[0] || '').split('-');
      const result = await bookRoom({
        roomId: bookingForm.roomId,
        userId: user?.id,
        facultyName: user?.name,
        facultyMobile: user?.phone,
        title: bookingForm.title,
        audience: audienceDesc,
        strength: strength,
        date: bookingForm.date,
        timeSlotId: bookingForm.timeSlotId,
        academicYear: academicYear || firstSecParts[0] || '1',
        branchCode: academicBranch || firstSecParts[1] || 'CSE',
        section: firstSecParts[2] || 'A',
        selectedSections: selectedSections,
        recurring: bookingForm.recurring,
        recurrencePattern: bookingForm.recurring ? bookingForm.recurrencePattern : null,
      });

      if (result.success) {
        setBookingResult({
          type: 'success',
          message: `Room booked successfully! Booking ID: ${result.booking.id}`,
          booking: result.booking,
        });
        if (!bookingForm.recurring) {
          setBookingForm(prev => ({
            ...prev,
            title: '',
            description: '',
          }));
        }
        setAlternativeRooms([]);
        setShowAlternativeFinder(false);
      } else {
        setBookingResult({
          type: 'error',
          message: result.error || 'Failed to book room',
        });
      }
    } catch {
      setBookingResult({
        type: 'error',
        message: 'An error occurred while booking the room',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bookingForm.roomId || !bookingForm.date || !bookingForm.timeSlotId) {
      return;
    }
    if (selectedSections.length === 0) {
      setBookingResult({
        type: 'error',
        message: 'Please select at least one student section attending this session.',
      });
      return;
    }

    const audienceDesc = formatAudienceDescription(selectedSections);

    if (isOverflow) {
      setOverflowModal({
        strength: totalStrength,
        capacity: roomCapacity,
        overflow: overflowCount,
        roomName: selectedRoom.name,
        audience: audienceDesc,
        onConfirm: () => {
          setOverflowModal(null);
          doBook(audienceDesc, totalStrength);
        },
      });
      return;
    }

    doBook(audienceDesc, totalStrength);
  };

  // Report conflict
  const handleConflictReport = () => {
    if (conflicts.length === 0) return;

    reportConflict({
      roomId: bookingForm.roomId,
      date: bookingForm.date,
      timeSlotId: bookingForm.timeSlotId,
      title: 'Overlapping Booking',
      description: `Conflict detected with existing booking: ${conflicts[0].title}`,
      reporterId: user?.id,
      existingBookingId: conflicts[0].id,
    });

    setBookingResult({
      type: 'warning',
      message: 'Conflict reported successfully. Administrator will review your report.',
    });
  };

  // Room card component
  const RoomCard = ({ room, available = true, selected = false, onSelect }) => (
    <div
      className={`room-card ${available ? 'available' : 'booked'} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect && onSelect(room.id)}
    >
      <div className="room-card-header">
        <div className="room-icon" style={{ backgroundColor: getRoomTypeColor(room.type) }}>
          {getRoomTypeIcon(room.type)}
        </div>
        <div className="room-info">
          <h3>{room.name}</h3>
          <div className="room-meta">
            <span>{room.buildingId}</span>
            <span>{formatFloor(room.floor)}</span>
          </div>
        </div>
      </div>

      <div className="room-details">
        {room.bookable !== false ? (
          <div className="detail-item">
            <Users size={14} />
            <span>{room.capacity} seats</span>
          </div>
        ) : (
          <div className="detail-item">
            <span style={{ color: '#d97706', fontWeight: 600 }}>🔒 Non-reservable</span>
          </div>
        )}
        <div className="detail-item">
          <Building2 size={14} />
          <span>{room.type.replace('-', ' ')}</span>
        </div>
        <div className="detail-item">
          <Clock size={14} />
          <span>{room.bookable !== false ? 'Available for booking' : 'Office Use Only'}</span>
        </div>
      </div>

      {room.bookable === false ? (
        <button className="btn btn-outline btn-sm" disabled style={{ opacity: 0.7 }}>Non-reservable Office</button>
      ) : available ? (
        <button className="btn btn-primary btn-sm">Select This Room</button>
      ) : (
        <button className="btn btn-outline btn-sm" disabled>Already Booked</button>
      )}
    </div>
  );

  return (
    <div className="booking-page">
      {bookingResult && (
        <div className={`alert alert-${bookingResult.type} alert-dismissible`}>
          {bookingResult.type === 'success' && <CheckCircle size={20} />}
          {bookingResult.type === 'error' && <XCircle size={20} />}
          {bookingResult.type === 'warning' && <AlertTriangle size={20} />}
          <span>{bookingResult.message}</span>
          <button
            className="alert-close"
            onClick={() => setBookingResult(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="booking-container">
        {/* Left panel - Room selection */}
        <div className="booking-panel room-selection">
          <div className="panel-header">
            <h2>Select a Room</h2>
            <p>Choose from available rooms for {format(parseISO(bookingForm.date), 'EEEE, MMMM d, yyyy')}</p>
          </div>

          <div className="room-filters">
            <div className="filter-group">
              <label>Building</label>
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuilding(e.target.value)}
              >
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.image} {b.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Floor</label>
              <select>
                <option value="">Any Floor</option>
                <option value="0">Ground Floor</option>
                <option value="1">1st Floor</option>
                <option value="2">2nd Floor</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Capacity</label>
              <select>
                <option value="">Any</option>
                <option value="20">20+</option>
                <option value="50">50+</option>
                <option value="100">100+</option>
              </select>
            </div>
          </div>

          <div className="rooms-grid">
            {[...allRooms]
              .filter(r => r.buildingId === selectedBuildingId && r.bookable !== false)
              .map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  available={!checkOverlap(room.id, bookingForm.date, bookingForm.timeSlotId, null)}
                  selected={bookingForm.roomId === room.id}
                  onSelect={(roomId) => setBookingForm(prev => ({ ...prev, roomId }))}
                />
              ))}
          </div>

          {/* Alternative Rooms Finder */}
          {bookingForm.roomId && bookingForm.date && bookingForm.timeSlotId && alternativeRooms.length > 0 && (
            <div className="alternative-rooms-section">
              <div className="section-header">
                <h3>Alternative Room Options</h3>
                <span className="count">({alternativeRooms.length} rooms found)</span>
              </div>
              <div className="alternative-rooms">
                {alternativeRooms.map(room => (
                  <div key={room.id} className="alternative-room-card">
                    <div className="room-info">
                      <h4>{room.name}</h4>
                      <div className="room-details-mini">
                        <span><Users size={14} /> {room.capacity} seats</span>
                        <span>{formatFloor(room.floor)}</span>
                        <span>{room.type.replace('-', ' ')}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setBookingForm(prev => ({ ...prev, roomId: room.id }))}
                    >
                      Select This
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Booking form */}
        <div className="booking-panel booking-form">
          <div className="panel-header">
            <h2>Booking Details</h2>
            <p>Fill in the details for your room booking</p>
          </div>

          <form onSubmit={handleSubmit} className="booking-form">
            {/* Date and Time Selection */}
            <div className="form-section">
              <h3>Date & Time</h3>
              <div className="date-time-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={bookingForm.date}
                    onChange={handleInputChange}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Time Slot</label>
                  <select
                    name="timeSlotId"
                    value={bookingForm.timeSlotId}
                    onChange={handleInputChange}
                    required
                    disabled={!bookingForm.date}
                  >
                    <option value="">Select time slot</option>
                    {timeSlots.map(slot => (
                      <option key={slot.id} value={slot.id} disabled={checkOverlap(bookingForm.roomId, bookingForm.date, slot.id, null)}>
                        {slot.label} {checkOverlap(bookingForm.roomId, bookingForm.date, slot.id, null) ? '(Booked)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Room Details Display */}
            {selectedRoom && (
              <div className="form-section room-display">
                <h3>Selected Room</h3>
                <div className="room-display-card">
                  <div className="room-icon-large" style={{ backgroundColor: getRoomTypeColor(selectedRoom.type) }}>
                    {getRoomTypeIcon(selectedRoom.type)}
                  </div>
                  <div className="room-info">
                    <h4>{selectedRoom.name}</h4>
                    <p>{selectedBuilding?.name} - {formatFloor(selectedRoom.floor)}</p>
                    <div className="room-features">
                      {selectedRoom.equipment.slice(0, 4).map(eq => (
                        <span key={eq} className="feature-tag-mini">{eq.replace('-', ' ')}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Details */}
            <div className="form-section">
              <h3>Booking Details</h3>
              <div className="form-group">
                <label>Booking Title</label>
                <input
                  type="text"
                  name="title"
                  value={bookingForm.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Data Structures Class, Group Study Session..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  name="description"
                  value={bookingForm.description}
                  onChange={handleInputChange}
                  placeholder="Any additional notes or requirements..."
                  rows="3"
                />
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="recurring"
                    checked={bookingForm.recurring}
                    onChange={handleInputChange}
                  />
                  <span>Make this a recurring booking</span>
                </label>
              </div>

              {bookingForm.recurring && (
                <div className="form-group">
                  <label>Recurrence Pattern</label>
                  <select
                    name="recurrencePattern"
                    value={bookingForm.recurrencePattern}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select pattern</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
            </div>

            {/* Student Audience & Strength Section */}
            <div className="form-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                  🎓 Student Audience & Strength (IET)
                </h3>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isOverflow ? '#fef2f2' : '#f0fdf4',
                  color: isOverflow ? '#dc2626' : '#16a34a',
                  border: `1px solid ${isOverflow ? '#fecaca' : '#bbf7d0'}`,
                }}>
                  {totalStrength} Students / {roomCapacity} Seats {isOverflow ? `(⚠️ Exceeds by ${overflowCount})` : '✓ Fits'}
                </span>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                Select Year and Branch. You can choose multiple sections for a single class or seminar.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Academic Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: 'white' }}
                  >
                    <option value="">Choose</option>
                    {academicStructure.years.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Filter by Branch</label>
                  <select
                    value={academicBranch}
                    onChange={(e) => setAcademicBranch(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: 'white' }}
                  >
                    <option value="">Choose</option>
                    <option value="all">All Branches (6 Branches)</option>
                    {academicStructure.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.totalStrength} students)</option>
                    ))}
                  </select>
                </div>
              </div>

              {academicBranch && academicBranch !== 'all' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => selectAllInBranch(academicBranch)}
                    style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Select Entire {academicBranch} Branch
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                {visibleSections.map(s => {
                  const isSelected = selectedSections.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSection(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                        background: isSelected ? '#eff6ff' : 'white',
                        color: isSelected ? '#1e40af' : '#334155',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{isSelected ? '☑' : '☐'} {s.branchName} {s.sectionName}</span>
                      <span style={{
                        background: isSelected ? '#2563eb' : '#f1f5f9',
                        color: isSelected ? 'white' : '#64748b',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}>
                        {s.strength}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isOverflow && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.6rem', fontSize: '0.8rem', color: '#991b1b' }}>
                  ⚠️ <strong>Overflow Alert:</strong> {totalStrength} students exceed room capacity ({roomCapacity}). Submitting will show a confirmation window before booking.
                </div>
              )}
            </div>

            {/* Conflict Warnings */}
            {conflicts.length > 0 && (
              <div className="form-section warning-section">
                <h3>⚠️ Conflict Detected</h3>
                <div className="conflict-warning">
                  <AlertTriangle size={20} />
                  <div>
                    <p><strong>Room is already booked for this time slot.</strong></p>
                    <p>This room is currently reserved for: {conflicts[0].title}</p>
                  </div>
                </div>

                <div className="conflict-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowAlternativeFinder(!showAlternativeFinder)}
                  >
                    Find Alternative Rooms
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleConflictReport}
                  >
                    Report Conflict
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSubmitting || conflicts.length > 0 || !bookingForm.roomId || !bookingForm.timeSlotId}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spin" /> Booking...
                  </>
                ) : (
                  <>
                    <Save size={18} /> Book Room
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={() => {
                  setBookingForm({
                    roomId: '',
                    date: bookingDate.toISOString().split('T')[0],
                    timeSlotId: '',
                    title: '',
                    recurring: false,
                    recurrencePattern: '',
                    description: '',
                  });
                  setBookingResult(null);
                }}
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Overflow Warning Modal */}
      {overflowModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '480px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '1rem' }}>
              <AlertTriangle size={26} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>⚠️ Room Capacity Warning</h3>
            </div>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1rem' }}>
              The selected audience student strength (<strong>{overflowModal.strength} students</strong>) exceeds the capacity of <strong>{overflowModal.roomName}</strong> (<strong>{overflowModal.capacity} seats</strong>) by <strong>{overflowModal.overflow} students</strong>.
            </p>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem', color: '#475569', marginBottom: '1.25rem' }}>
              <strong>Audience:</strong> {overflowModal.audience}
              <br /><br />
              <em>Suggested alternatives for larger gatherings:</em>
              <br />• <strong>Seminar Hall IET 32</strong> (200 seats)
              <br />• <strong>Library</strong> (180 seats)
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setOverflowModal(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Change Room / Cancel
              </button>
              <button
                type="button"
                onClick={overflowModal.onConfirm}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                Proceed & Approve Booking
              </button>
            </div>
          </div>
        </div>
      )}
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
  };
  return icons[type] || '🏠';
}