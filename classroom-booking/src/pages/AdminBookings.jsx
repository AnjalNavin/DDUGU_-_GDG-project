import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  Calendar,
  Clock,
  Users,
  Building2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  X,
  Check,
  Armchair,
} from 'lucide-react';
import {
  formatFloor,
  academicStructure,
  getAllSections,
  calculateSelectedStrength,
  formatAudienceDescription,
} from '../data/mockData';
import { format } from 'date-fns';
import { formatYearLabel } from '../utils/formatYear';

export function AdminBookings() {
  const { user } = useAuth();
  const {
    allRooms,
    allBookings,
    buildings,
    timeSlots,
    bookRoom,
    deleteBooking,
    updateBookingStatus,
    allSeatReservations,
    cancelSeatReservation,
  } = useBooking();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeMainTab, setActiveMainTab] = useState('bookings'); // 'bookings' | 'seats'

  // Seat Reservation Filters
  const [seatSearch, setSeatSearch] = useState('');
  const [seatRoomFilter, setSeatRoomFilter] = useState('all');
  const [seatYearFilter, setSeatYearFilter] = useState('all');
  const [seatBranchFilter, setSeatBranchFilter] = useState('all');
  const [seatSectionFilter, setSeatSectionFilter] = useState('all');
  const [seatStatusFilter, setSeatStatusFilter] = useState('all');

  // Form State
  const [selectedBuildingId, setSelectedBuildingId] = useState('iet');
  const [selectedRoomId, setSelectedRoomId] = useState(allRooms.find(r => r.buildingId === 'iet')?.id || '');
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlotId, setSelectedSlotId] = useState(timeSlots[0]?.id || 'slot-1');
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookedFor, setBookedFor] = useState('');

  // Academic Audience State
  const [academicYear, setAcademicYear] = useState('1');
  const [academicBranch, setAcademicBranch] = useState('all');
  const [selectedSections, setSelectedSections] = useState(['1-CSE-A']);

  // Modal / Confirmations
  const [overflowModal, setOverflowModal] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const buildingRooms = useMemo(() => {
    return allRooms.filter(r => r.buildingId === selectedBuildingId);
  }, [allRooms, selectedBuildingId]);

  const selectedRoom = useMemo(() => {
    return allRooms.find(r => r.id === selectedRoomId) || buildingRooms[0];
  }, [allRooms, selectedRoomId, buildingRooms]);

  const allSectionsList = useMemo(() => getAllSections(), []);

  const visibleSections = useMemo(() => {
    return allSectionsList.filter(s => {
      const matchYear = s.yearId === academicYear;
      const matchBranch = academicBranch === 'all' || s.branchId === academicBranch;
      return matchYear && matchBranch;
    });
  }, [allSectionsList, academicYear, academicBranch]);

  const totalStrength = useMemo(() => {
    return calculateSelectedStrength(selectedSections);
  }, [selectedSections]);

  const roomCapacity = selectedRoom?.capacity || 75;
  const isOverflow = totalStrength > roomCapacity;
  const overflowCount = totalStrength - roomCapacity;

  // Toggle section selection
  const toggleSection = (secId) => {
    setSelectedSections(prev => {
      if (prev.includes(secId)) {
        return prev.filter(id => id !== secId);
      } else {
        return [...prev, secId];
      }
    });
  };

  // Select all sections in current branch
  const selectAllInBranch = (branchId) => {
    const branch = academicStructure.branches.find(b => b.id === branchId);
    if (!branch) return;
    const idsToAdd = branch.sections.map(sec => `${academicYear}-${branch.id}-${sec.id}`);
    setSelectedSections(prev => {
      const set = new Set([...prev, ...idsToAdd]);
      return Array.from(set);
    });
  };

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return allBookings
      .filter(b => {
        const room = allRooms.find(r => r.id === b.roomId);
        if (buildingFilter !== 'all' && room?.buildingId !== buildingFilter) return false;
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = b.title?.toLowerCase().includes(q);
          const matchRoom = room?.name?.toLowerCase().includes(q);
          const matchAudience = b.audience?.toLowerCase().includes(q);
          return matchTitle || matchRoom || matchAudience;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allBookings, allRooms, buildingFilter, statusFilter, searchQuery]);

  // Filtered Student Seat Reservations
  const filteredSeatReservations = useMemo(() => {
    return (allSeatReservations || []).filter(res => {
      if (seatStatusFilter !== 'all' && res.status !== seatStatusFilter) return false;
      if (seatYearFilter !== 'all' && String(res.academicYear) !== String(seatYearFilter)) return false;
      if (seatBranchFilter !== 'all' && res.branchCode?.toUpperCase() !== seatBranchFilter.toUpperCase()) return false;
      if (seatSectionFilter !== 'all' && res.section?.toUpperCase() !== seatSectionFilter.toUpperCase()) return false;
      if (seatRoomFilter !== 'all' && res.roomId !== seatRoomFilter) return false;

      if (seatSearch.trim()) {
        const q = seatSearch.toLowerCase();
        const booking = allBookings.find(b => b.id === res.bookingId);
        const room = allRooms.find(r => r.id === (res.roomId || booking?.roomId));
        const matchStudent = res.studentName?.toLowerCase().includes(q) || res.studentUserId?.toLowerCase().includes(q);
        const matchTitle = booking?.title?.toLowerCase().includes(q);
        const matchRoom = room?.name?.toLowerCase().includes(q);
        const matchSeat = res.seatNumber?.toLowerCase().includes(q);
        return matchStudent || matchTitle || matchRoom || matchSeat;
      }
      return true;
    }).sort((a, b) => new Date(b.reservedAt) - new Date(a.reservedAt));
  }, [allSeatReservations, allBookings, allRooms, seatStatusFilter, seatYearFilter, seatBranchFilter, seatSectionFilter, seatRoomFilter, seatSearch]);

  // Direct Booking Handler
  const executeBooking = (strength, audienceDesc) => {
    const firstSecParts = (selectedSections[0] || '').split('-');
    const res = bookRoom({
      roomId: selectedRoom.id,
      userId: user?.id || 'admin-1',
      title: bookedFor ? `${bookingTitle} (${bookedFor})` : bookingTitle,
      date: bookingDate,
      timeSlotId: selectedSlotId,
      academicYear: academicYear || firstSecParts[0] || '1',
      branchCode: academicBranch || firstSecParts[1] || 'CSE',
      section: firstSecParts[2] || 'A',
      selectedSections: selectedSections,
      strength,
      audience: audienceDesc,
    });

    if (res.success) {
      showNotification('success', `Booking for "${selectedRoom.name}" created and confirmed successfully!`);
      setBookingTitle('');
      setBookedFor('');
    } else {
      showNotification('error', res.error || 'Failed to create booking.');
    }
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (!selectedRoom) {
      showNotification('error', 'Please select a room.');
      return;
    }
    if (!bookingTitle.trim()) {
      showNotification('error', 'Please provide a booking purpose or title.');
      return;
    }
    if (selectedSections.length === 0) {
      showNotification('error', 'Please select at least one student section.');
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
          executeBooking(totalStrength, audienceDesc);
        },
      });
      return;
    }

    executeBooking(totalStrength, audienceDesc);
  };

  return (
    <div className="admin-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Bookings Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Full campus reservation directory. Add new bookings directly or delete existing bookings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            Campus Capacity: Classrooms 75 | Library 180 | Seminar Hall 200
          </span>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}


      {/* Main Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('bookings')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'bookings' ? '#2563eb' : 'transparent',
            color: activeMainTab === 'bookings' ? 'white' : '#64748b',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Calendar size={18} />
          Classroom Bookings ({allBookings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('seats')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeMainTab === 'seats' ? '#2563eb' : 'transparent',
            color: activeMainTab === 'seats' ? 'white' : '#64748b',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Armchair size={18} />
          Student Seat Reservations ({(allSeatReservations || []).length})
        </button>
      </div>

      {activeMainTab === 'bookings' ? (
        <>
      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Bookings</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0284c7', marginTop: '0.25rem' }}>
            {allBookings.filter(b => b.status !== 'cancelled').length}
          </div>
          <small style={{ color: '#94a3b8' }}>Across both buildings</small>
        </div>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Pending Approvals</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem' }}>
            {allBookings.filter(b => b.status === 'pending').length}
          </div>
          <small style={{ color: '#94a3b8' }}>Student requests</small>
        </div>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Today's Date</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981', marginTop: '0.5rem' }}>
            {format(new Date(), 'EEEE, dd MMM')}
          </div>
          <small style={{ color: '#94a3b8' }}>Live campus timetable</small>
        </div>
      </div>

      {/* Main Grid: Add Booking Form & Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Direct Admin Booking Form */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                ➕ Add New Booking (Admin)
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0' }}>
                Directly book and confirm any room for faculty lectures or events
              </p>
            </div>
            <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Direct Authority
            </span>
          </div>

          <form onSubmit={handleAdminSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Building *
                </label>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => {
                    setSelectedBuildingId(e.target.value);
                    const bRooms = allRooms.filter(r => r.buildingId === e.target.value);
                    if (bRooms.length) setSelectedRoomId(bRooms[0].id);
                  }}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Room * ({selectedRoom?.capacity || 75} seats)
                </label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  {buildingRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.capacity} seats ({formatFloor(r.floor)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setBookingDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Time Slot *
                </label>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  {timeSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>{slot.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Booking Purpose / Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Distributed Computing Lecture or Workshop"
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Booked For / Faculty Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Prof. Priya Sharma or Department Event"
                value={bookedFor}
                onChange={(e) => setBookedFor(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            {/* Academic Audience Selection Section */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  🎓 Select Audience (Branch & Year)
                </strong>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isOverflow ? '#fef2f2' : '#f0fdf4',
                  color: isOverflow ? '#dc2626' : '#16a34a',
                  border: `1px solid ${isOverflow ? '#fecaca' : '#bbf7d0'}`,
                }}>
                  {totalStrength} Students / {roomCapacity} Seats {isOverflow ? `(⚠️ Overflows by ${overflowCount})` : '✓ Fits'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Academic Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'white' }}
                  >
                    {academicStructure.years.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Branch</label>
                  <select
                    value={academicBranch}
                    onChange={(e) => setAcademicBranch(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'white' }}
                  >
                    <option value="all">All Branches</option>
                    {academicStructure.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {academicBranch !== 'all' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => selectAllInBranch(academicBranch)}
                    style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Select Entire {academicBranch} Branch
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '130px', overflowY: 'auto' }}>
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
            </div>

            {isOverflow && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '0.85rem', fontSize: '0.82rem', color: '#991b1b' }}>
                ⚠️ <strong>Capacity Warning:</strong> Selected audience ({totalStrength} students) exceeds room capacity ({roomCapacity} seats). Submitting will prompt an approval confirmation modal.
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <Check size={18} /> Confirm & Create Booking
            </button>
          </form>
        </div>

        {/* Room Standards and Info Panel */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            🏢 Campus Standards & Academic Roster
          </h2>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <strong style={{ color: '#166534', display: 'block', fontSize: '0.88rem', marginBottom: '4px' }}>
              📐 Official Room Capacities
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#15803d', lineHeight: '1.6' }}>
              <li><strong>All Classrooms (IET & Deeksha Bhawan):</strong> Approx 75 students capacity</li>
              <li><strong>Seminar Hall IET 32:</strong> Approx 200 students capacity</li>
              <li><strong>Library (IET Ground Floor):</strong> Approx 150–180 students capacity</li>
            </ul>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <strong style={{ color: '#1e40af', display: 'block', fontSize: '0.88rem', marginBottom: '4px' }}>
              🎓 IET Branch Strengths (75 Students Per Section)
            </strong>
            <div style={{ fontSize: '0.8rem', color: '#1d4ed8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', lineHeight: '1.5' }}>
              <span>• <strong>CSE:</strong> 150 (Sec A: 75, B: 75)</span>
              <span>• <strong>AI ML:</strong> 150 (Sec A: 75, B: 75)</span>
              <span>• <strong>AI DS:</strong> 75 students</span>
              <span>• <strong>ECE:</strong> 75 students</span>
              <span>• <strong>ME:</strong> 75 students</span>
              <span>• <strong>IT:</strong> 75 students</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '8px' }}>
            <strong style={{ color: '#334155', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
              🛡️ Admin Powers: Adding & Deleting Bookings
            </strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: '1.5' }}>
              • To <strong>delete</strong> any booking immediately, click the red <strong>Delete</strong> button in the table below. This instantly frees up the time slot on the live schedule.<br />
              • Direct bookings created here bypass approval queues and are marked <strong>confirmed</strong> instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Bookings Management Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              All Campus Bookings ({filteredBookings.length})
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0' }}>
              Manage, review, or delete active and upcoming room reservations
            </p>
          </div>

          {/* Table Filters */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.6rem' }}>
              <Search size={16} color="#64748b" style={{ marginRight: '6px' }} />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '160px' }}
              />
            </div>

            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Buildings</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Purpose & Audience</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Room & Building</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Date & Slot</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    No bookings found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => {
                  const room = allRooms.find(r => r.id === b.roomId);
                  const bldg = buildings.find(bg => bg.id === room?.buildingId);
                  const slot = timeSlots.find(s => s.id === b.timeSlotId);

                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <strong style={{ color: '#0f172a' }}>{b.title}</strong>
                        {b.audience && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            👥 {b.audience}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <strong>{room?.name || b.roomId}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {bldg?.name} · {formatFloor(room?.floor)} ({room?.capacity} seats)
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <strong>{b.date}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {slot?.label || b.timeSlotId}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {b.status === 'confirmed' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                              }}
                              title="Active student seat reservations"
                            >
                              <Armchair size={12} />
                              {allSeatReservations.filter((r) => r.bookingId === b.id && r.status === 'active').length}
                              /{room?.capacity || 75} Reserved
                            </span>
                          )}
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: b.status === 'confirmed' ? '#f0fdf4' : b.status === 'pending' ? '#fffbeb' : '#fef2f2',
                            color: b.status === 'confirmed' ? '#166534' : b.status === 'pending' ? '#b45309' : '#991b1b',
                          }}>
                            {b.status}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {b.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => {
                                updateBookingStatus(b.id, 'confirmed');
                                showNotification('success', `Booking "${b.title}" approved!`);
                              }}
                              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmModal({
                                booking: b,
                                onConfirm: () => {
                                  deleteBooking(b.id);
                                  setDeleteConfirmModal(null);
                                  showNotification('success', `Booking "${b.title}" deleted successfully! Room slot is now free.`);
                                },
                              });
                            }}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '5px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Delete this booking"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

        </>
      ) : (
        /* Student Seat Reservations View */
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Armchair size={22} color="#2563eb" />
                All Student Seat Reservations
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '2px 0 0' }}>
                Monitor individual student seat allocations, filter by batch or classroom, and manage reservations.
              </p>
            </div>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
              {filteredSeatReservations.length} reservation(s) listed
            </span>
          </div>

          {/* Seat Filters Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search student, lecture, seat..."
                value={seatSearch}
                onChange={(e) => setSeatSearch(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.65rem 0.5rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <select
              value={seatRoomFilter}
              onChange={(e) => setSeatRoomFilter(e.target.value)}
              style={{ padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Rooms</option>
              {allRooms.filter(r => r.bookable !== false).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <select
              value={seatYearFilter}
              onChange={(e) => setSeatYearFilter(e.target.value)}
              style={{ padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Years (1-4)</option>
              {academicStructure.years.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>

            <select
              value={seatBranchFilter}
              onChange={(e) => setSeatBranchFilter(e.target.value)}
              style={{ padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Branches</option>
              {academicStructure.branches.map(b => (
                <option key={b.id} value={b.id}>{b.id}</option>
              ))}
            </select>

            <select
              value={seatSectionFilter}
              onChange={(e) => setSeatSectionFilter(e.target.value)}
              style={{ padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>

            <select
              value={seatStatusFilter}
              onChange={(e) => setSeatStatusFilter(e.target.value)}
              style={{ padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Seat Reservations Data Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Student & Batch</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Lecture / Session</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Room & Floor</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Seat Number</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSeatReservations.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No student seat reservations found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredSeatReservations.map(res => {
                    const booking = allBookings.find(b => b.id === res.bookingId);
                    const room = allRooms.find(r => r.id === (res.roomId || booking?.roomId));
                    const slot = timeSlots.find(s => s.id === booking?.timeSlotId);

                    return (
                      <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <strong style={{ color: '#0f172a' }}>{res.studentName}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            🎓 {formatYearLabel(res.academicYear)} {res.branchCode}-{res.section} • {res.studentUserId}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <strong>{booking?.title || 'Classroom Lecture'}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {booking?.date} • {slot?.label || booking?.timeSlotId}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <strong>{room?.name || res.roomId}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Floor {room?.floor} ({room?.capacity} seats)
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #bfdbfe',
                          }}>
                            {res.seatNumber}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: res.status === 'active' ? '#dcfce7' : '#fee2e2',
                            color: res.status === 'active' ? '#15803d' : '#991b1b',
                          }}>
                            {res.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          {res.status === 'active' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Cancel reservation for seat ${res.seatNumber} (${res.studentName})?`)) {
                                  cancelSeatReservation(res.id);
                                  showNotification('success', `Reservation for seat ${res.seatNumber} cancelled.`);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel Seat
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
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
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '1rem' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Delete this Booking?</h3>
            </div>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              Are you sure you want to delete the booking "<strong>{deleteConfirmModal.booking.title}</strong>" on {deleteConfirmModal.booking.date}?
              <br /><br />
              This will permanently delete the reservation and immediately release the room slot for others.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={deleteConfirmModal.onConfirm}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminBookings;
