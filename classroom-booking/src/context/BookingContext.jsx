import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  rooms,
  bookings,
  timeSlots,
  buildings,
  announcements,
  conflicts,
  users,
  seatReservations,
  adminAuditLogs,
} from '../data/mockData';
import { format, parseISO, isSameDay, addDays, startOfWeek, endOfWeek } from 'date-fns';

const BookingContext = createContext(null);

const SEED_VERSION = '2026_11_06_seed_v3';
if (typeof window !== 'undefined' && localStorage.getItem('ddugu_seed_version') !== SEED_VERSION) {
  localStorage.setItem('ddugu_seed_version', SEED_VERSION);
  localStorage.removeItem('ddugu_bookings');
  localStorage.removeItem('ddugu_rooms');
  localStorage.removeItem('ddugu_seat_reservations');
  localStorage.removeItem('ddugu_faculty_cache');
  localStorage.removeItem('ddugu_conflicts');
}

export function BookingProvider({ children }) {
  const [allRooms, setAllRooms] = useState(() => {
    const cached = localStorage.getItem('ddugu_rooms');
    return cached ? JSON.parse(cached) : rooms;
  });

  const [allBookings, setAllBookings] = useState(() => {
    const cached = localStorage.getItem('ddugu_bookings');
    return cached ? JSON.parse(cached) : bookings;
  });

  const [allAnnouncements, setAllAnnouncements] = useState(() => {
    const cached = localStorage.getItem('ddugu_announcements');
    return cached ? JSON.parse(cached) : announcements;
  });

  const [allConflicts, setAllConflicts] = useState(() => {
    const cached = localStorage.getItem('ddugu_conflicts');
    return cached ? JSON.parse(cached) : conflicts;
  });

  const [allSeatReservations, setAllSeatReservations] = useState(() => {
    const cached = localStorage.getItem('ddugu_seat_reservations');
    return cached ? JSON.parse(cached) : seatReservations;
  });

  const [allAdminAuditLogs, setAllAdminAuditLogs] = useState(() => {
    const cached = localStorage.getItem('ddugu_admin_audit_logs');
    return cached ? JSON.parse(cached) : adminAuditLogs;
  });

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuilding, setSelectedBuilding] = useState('iet');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    capacity: null,
    type: null,
    equipment: [],
    features: [],
    floor: null,
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('ddugu_bookings', JSON.stringify(allBookings));
  }, [allBookings]);

  useEffect(() => {
    localStorage.setItem('ddugu_announcements', JSON.stringify(allAnnouncements));
  }, [allAnnouncements]);

  useEffect(() => {
    localStorage.setItem('ddugu_conflicts', JSON.stringify(allConflicts));
  }, [allConflicts]);

  useEffect(() => {
    localStorage.setItem('ddugu_seat_reservations', JSON.stringify(allSeatReservations));
  }, [allSeatReservations]);

  useEffect(() => {
    localStorage.setItem('ddugu_admin_audit_logs', JSON.stringify(allAdminAuditLogs));
  }, [allAdminAuditLogs]);

  // Get rooms for selected building
  const buildingRooms = allRooms.filter(r => r.buildingId === selectedBuilding);

  // Get bookings for selected date
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayBookings = allBookings.filter(b => b.date === dateStr);

  // Check if a room is booked at a specific time slot
  const isRoomBooked = useCallback((roomId, timeSlotId, date = dateStr) => {
    return allBookings.some(
      b => b.roomId === roomId && b.timeSlotId === timeSlotId && b.date === date && b.status !== 'cancelled'
    );
  }, [allBookings]);

  // Get booking for a room at a specific time slot
  const getBooking = useCallback((roomId, timeSlotId, date = dateStr) => {
    return allBookings.find(
      b => b.roomId === roomId && b.timeSlotId === timeSlotId && b.date === date && b.status !== 'cancelled'
    );
  }, [allBookings]);

  // Check for overlapping bookings
  const checkOverlap = useCallback((roomId, date, timeSlotId, excludeBookingId = null) => {
    const existingBooking = allBookings.find(
      b =>
        b.roomId === roomId &&
        b.date === date &&
        b.timeSlotId === timeSlotId &&
        b.status !== 'cancelled' &&
        b.id !== excludeBookingId
    );
    return existingBooking;
  }, [allBookings]);

  // Book a room
  const bookRoom = useCallback((bookingData) => {
    const {
      roomId,
      userId,
      title,
      date,
      timeSlotId,
      recurring,
      recurrencePattern,
      academicYear,
      branchCode,
      section,
      selectedSections,
      facultyMobile,
      facultyName,
      strength,
      audience,
    } = bookingData;

    // Check for room overlap
    const overlap = checkOverlap(roomId, date, timeSlotId);
    if (overlap) {
      return { success: false, error: 'Room is already booked for this time slot', overlap };
    }

    const newSlot = timeSlots.find(s => s.id === timeSlotId);
    const newStart = bookingData.startTime || (newSlot ? newSlot.start : null);
    const newEnd = bookingData.endTime || (newSlot ? newSlot.end : null);

    const normalizeCohort = (v) => (!v ? '' : String(v).replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

    // Rule 1: Prevent Double Booking by the Same Faculty Member in another room
    if (newStart && newEnd) {
      const facultyConflict = allBookings.find(b => {
        if (b.date !== date) return false;
        if (b.status === 'cancelled' || b.status === 'rejected') return false;
        if (b.roomId === roomId) return false;

        const isSameFaculty =
          (userId && b.userId === userId) ||
          (facultyMobile && (b.facultyMobileNumber === facultyMobile || b.facultyMobile === facultyMobile)) ||
          (facultyName && b.facultyName === facultyName);
        if (!isSameFaculty) return false;

        const bSlot = timeSlots.find(s => s.id === b.timeSlotId);
        const bStart = b.startTime || (bSlot ? bSlot.start : null);
        const bEnd = b.endTime || (bSlot ? bSlot.end : null);
        if (!bStart || !bEnd) return false;

        return bStart < newEnd && bEnd > newStart;
      });

      if (facultyConflict) {
        return {
          success: false,
          error: 'You have already booked another room during this time slot. Please choose a different time.',
          conflict: facultyConflict,
        };
      }
    }

    // Rule 2: Prevent Academic Cohort Scheduling Conflicts
    if (newStart && newEnd) {
      const targetCohorts = [];
      if (Array.isArray(selectedSections) && selectedSections.length > 0) {
        selectedSections.forEach(secId => {
          const parts = secId.split('-');
          targetCohorts.push({
            raw: secId,
            year: normalizeCohort(parts[0]),
            branch: normalizeCohort(parts[1]),
            section: normalizeCohort(parts[2] || 'A'),
          });
        });
      } else if (academicYear && branchCode && section) {
        targetCohorts.push({
          year: normalizeCohort(academicYear),
          branch: normalizeCohort(branchCode),
          section: normalizeCohort(section),
        });
      }

      if (targetCohorts.length > 0) {
        const cohortConflict = allBookings.find(b => {
          if (b.date !== date) return false;
          if (b.status === 'cancelled' || b.status === 'rejected') return false;
          if (b.roomId === roomId) return false;

          const bSlot = timeSlots.find(s => s.id === b.timeSlotId);
          const bStart = b.startTime || (bSlot ? bSlot.start : null);
          const bEnd = b.endTime || (bSlot ? bSlot.end : null);
          if (!bStart || !bEnd) return false;
          if (!(bStart < newEnd && bEnd > newStart)) return false;

          if (Array.isArray(b.selectedSections) && b.selectedSections.length > 0) {
            for (const bSec of b.selectedSections) {
              const parts = bSec.split('-');
              const bY = normalizeCohort(parts[0]);
              const bB = normalizeCohort(parts[1]);
              const bS = normalizeCohort(parts[2] || 'A');
              for (const tc of targetCohorts) {
                if (bSec === tc.raw || (bY === tc.year && bB === tc.branch && bS === tc.section)) {
                  return true;
                }
              }
            }
          }

          if (b.academicYear && b.branchCode && b.section) {
            const bY = normalizeCohort(b.academicYear);
            const bB = normalizeCohort(b.branchCode);
            const bS = normalizeCohort(b.section);
            for (const tc of targetCohorts) {
              if (bY === tc.year && bB === tc.branch && bS === tc.section) {
                return true;
              }
            }
          }

          return false;
        });

        if (cohortConflict) {
          return {
            success: false,
            error: 'This student section is already scheduled for another lecture during this time slot. Please choose a different time.',
            conflict: cohortConflict,
          };
        }
      }
    }

    const firstSecParts = (selectedSections && selectedSections[0] ? selectedSections[0].split('-') : []);
    const newBooking = {
      id: `booking-${Date.now()}`,
      roomId,
      userId,
      facultyName: facultyName || null,
      facultyMobileNumber: facultyMobile || null,
      title,
      audience: audience || null,
      strength: strength || null,
      date,
      timeSlotId,
      timeSlotIds: [timeSlotId],
      startTime: newStart,
      endTime: newEnd,
      academicYear: academicYear || (firstSecParts[0] ? parseInt(firstSecParts[0], 10) : 1),
      branchCode: branchCode || firstSecParts[1] || 'CSE',
      section: section || (firstSecParts[2] ? firstSecParts[2].toUpperCase() : 'A'),
      selectedSections: selectedSections || [],
      status: userId && String(userId).startsWith('student') ? 'pending' : 'confirmed',
      recurring: recurring || false,
      recurrencePattern: recurrencePattern || null,
      createdAt: new Date().toISOString(),
    };

    setAllBookings(prev => [...prev, newBooking]);
    return { success: true, booking: newBooking };
  }, [checkOverlap, allBookings, timeSlots]);

  // Cancel a booking
  const cancelBooking = useCallback((bookingId) => {
    setAllBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );
  }, []);

  // Delete a booking (admin permanent removal)
  const deleteBooking = useCallback((bookingId) => {
    setAllBookings(prev => prev.filter(b => b.id !== bookingId));
  }, []);

  // Update booking status (for admin/faculty)
  const updateBookingStatus = useCallback((bookingId, status) => {
    setAllBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status } : b))
    );
  }, []);

  // Get alternative room suggestions
  const getAlternativeRooms = useCallback((originalRoomId, date, timeSlotId, capacity) => {
    const originalRoom = allRooms.find(r => r.id === originalRoomId);
    if (!originalRoom) return [];

    const alternatives = allRooms
      .filter(r => {
        // Same building preferred, but not required
        // Must have enough capacity
        // Must not be booked at that time
        if (r.id === originalRoomId) return false;
        if (r.bookable === false) return false;
        if (capacity && r.capacity < capacity) return false;
        if (isRoomBooked(r.id, timeSlotId, date)) return false;
        return true;
      })
      .sort((a, b) => {
        // Prefer same building
        const aSameBuilding = a.buildingId === originalRoom.buildingId ? 0 : 1;
        const bSameBuilding = b.buildingId === originalRoom.buildingId ? 0 : 1;
        if (aSameBuilding !== bSameBuilding) return aSameBuilding - bSameBuilding;
        // Then prefer closer capacity
        return Math.abs(a.capacity - (capacity || originalRoom.capacity)) -
               Math.abs(b.capacity - (capacity || originalRoom.capacity));
      })
      .slice(0, 5);

    return alternatives;
  }, [allRooms, isRoomBooked]);

  // Report a conflict
  const reportConflict = useCallback((conflictData) => {
    const isFaculty = conflictData.reporterType === 'faculty';
    const newConflict = {
      id: `conflict-${Date.now()}`,
      status: 'pending',
      priority: isFaculty ? 'high' : (conflictData.priority || 'normal'),
      reportedAt: new Date().toISOString(),
      history: [
        {
          status: 'pending',
          actionBy: conflictData.reporterName || 'User',
          note: isFaculty ? 'Faculty high-priority conflict report submitted' : 'Conflict report submitted',
          timestamp: new Date().toISOString(),
        }
      ],
      ...conflictData,
    };
    setAllConflicts(prev => [newConflict, ...prev]);
    return newConflict;
  }, []);

  // Update conflict status & resolution notes (admin)
  const updateConflictStatus = useCallback((conflictId, newStatus, resolutionNote, actionBy = 'Admin') => {
    if (newStatus === 'resolved') {
      setAllConflicts(prev => prev.filter(c => c.id !== conflictId));
      return;
    }
    setAllConflicts(prev =>
      prev.map(c => {
        if (c.id !== conflictId) return c;
        const newHistory = [
          ...(c.history || []),
          {
            status: newStatus,
            actionBy,
            note: resolutionNote || `Status changed to ${newStatus}`,
            timestamp: new Date().toISOString(),
          }
        ];
        return {
          ...c,
          status: newStatus,
          resolutionNote: resolutionNote !== undefined ? resolutionNote : c.resolutionNote,
          history: newHistory,
          resolvedAt: newStatus === 'rejected' ? new Date().toISOString() : c.resolvedAt,
        };
      })
    );
  }, []);

  // Resolve conflict backward compatibility
  const resolveConflict = useCallback((conflictId, resolution, note = '') => {
    updateConflictStatus(conflictId, resolution, note, 'Admin');
  }, [updateConflictStatus]);

  // Reserve a seat (student only)
  const reserveSeat = useCallback((data) => {
    const { bookingId, roomId, studentUserId, studentName, academicYear, branchCode, section } = data;
    let { seatNumber } = data;
    
    // Check if student already reserved a seat for this booking
    const alreadyReserved = allSeatReservations.some(
      r => r.bookingId === bookingId && r.studentUserId === studentUserId && r.status === 'active'
    );
    if (alreadyReserved) {
      return { success: false, error: 'You have already reserved a seat for this lecture.' };
    }

    const room = allRooms.find(r => r.id === roomId);
    const capacity = room?.capacity || 75;
    const occupiedSeats = new Set(
      allSeatReservations
        .filter(r => r.bookingId === bookingId && r.status === 'active')
        .map(r => r.seatNumber)
    );

    if (occupiedSeats.size >= capacity) {
      return { success: false, error: 'Classroom is full. No seats available.' };
    }

    if (!seatNumber) {
      for (let i = 1; i <= capacity; i++) {
        const candidate = `S-${i}`;
        if (!occupiedSeats.has(candidate)) {
          seatNumber = candidate;
          break;
        }
      }
    }

    if (!seatNumber || occupiedSeats.has(seatNumber)) {
      return { success: false, error: 'Classroom is full or selected seat is occupied.' };
    }

    const newRes = {
      id: `seat-res-${Date.now()}`,
      bookingId,
      roomId,
      studentUserId,
      studentName,
      academicYear: Number(academicYear),
      branchCode,
      section,
      seatNumber,
      status: 'active',
      reservedAt: new Date().toISOString(),
    };

    setAllSeatReservations(prev => [newRes, ...prev]);
    return { success: true, reservation: newRes };
  }, [allSeatReservations, allRooms]);

  // Cancel seat reservation
  const cancelSeatReservation = useCallback((reservationId) => {
    setAllSeatReservations(prev =>
      prev.map(r => r.id === reservationId ? { ...r, status: 'cancelled' } : r)
    );
  }, []);

  // Create Announcement
  const createAnnouncement = useCallback((annData) => {
    const newAnn = {
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
      expiresAt: annData.expiryDate ? `${annData.expiryDate}T23:59:59Z` : new Date(Date.now() + 14 * 86400000).toISOString(),
      priority: annData.priority || 'medium',
      targetRoles: annData.targetRoles || ['student', 'faculty'],
      ...annData,
    };
    setAllAnnouncements(prev => [newAnn, ...prev]);
    return { success: true, announcement: newAnn };
  }, []);

  // Delete Announcement (Admin can delete all; Faculty creator only)
  const deleteAnnouncement = useCallback((annId, currentUser) => {
    const ann = allAnnouncements.find(a => a.id === annId);
    if (!ann) return { success: false, error: 'Announcement not found.' };

    const isCreator = ann.authorId === currentUser?.id ||
                      ann.authorId === currentUser?.mobile_number ||
                      ann.authorId === currentUser?.email;
    const isAdmin = currentUser?.role === 'admin';

    if (!isCreator && !isAdmin) {
      return { success: false, error: "Only Admin or the original creator can delete this announcement." };
    }

    setAllAnnouncements(prev => prev.filter(a => a.id !== annId));
    return { success: true };
  }, [allAnnouncements]);

  // Record Admin Audit Log
  const recordAuditLog = useCallback((logData) => {
    const newLog = {
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...logData,
    };
    setAllAdminAuditLogs(prev => [newLog, ...prev]);
  }, []);

  // Get user bookings
  const getUserBookings = useCallback((userId) => {
    return allBookings.filter(b => b.userId === userId && b.status !== 'cancelled');
  }, [allBookings]);

  // Get announcements for user role
  const getAnnouncementsForRole = useCallback((role) => {
    const now = new Date();
    return allAnnouncements.filter(a =>
      a.targetRoles.includes(role) && new Date(a.expiresAt) > now
    ).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [allAnnouncements]);

  // Search rooms with flexible aliases and smart tokens
  const searchRooms = useCallback((query) => {
    if (!query || !query.trim()) return allRooms;

    const normalize = (str) =>
      (str || '')
        .toLowerCase()
        .replace(/deeksha/g, 'diksha')
        .replace(/[\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedQuery = normalize(query);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);

    return allRooms.filter(room => {
      const building = buildings.find(b => b.id === room.buildingId);
      const aliases = [];
      if (room.buildingId === 'deeksha-bhawan') {
        aliases.push('diksha', 'diksha bhawan', 'deeksha', 'deeksha bhawan', 'db', 'lh', 'lecture hall');
      } else if (room.buildingId === 'iet') {
        aliases.push('iet', 'engineering', 'institute of engineering and technology', 'institute of engineering & technology');
      }
      if (building && Array.isArray(building.aliases)) {
        aliases.push(...building.aliases);
      }

      const condensedLabel = (room.id || '').replace(/[\s\-_]/g, '').toLowerCase();
      const condensedName = (room.name || '').replace(/[\s\-_]/g, '').toLowerCase();
      const numMatch = (room.name || room.id || '').match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        if (room.buildingId === 'deeksha-bhawan') {
          aliases.push(`lh${num}`, `lh ${num}`, `lecture hall ${num}`);
        } else {
          aliases.push(`iet${num}`, `iet ${num}`);
        }
      }

      const searchableText = normalize([
        room.id,
        room.name,
        room.type,
        condensedLabel,
        condensedName,
        building?.name,
        building?.fullName,
        ...aliases,
        ...room.equipment,
        ...room.features,
        `floor ${room.floor}`,
        `capacity ${room.capacity}`,
      ].join(' '));

      return queryTokens.every(token => searchableText.includes(token));
    });
  }, [allRooms, buildings]);

  // Natural language search for AI-like queries
  const naturalLanguageSearch = useCallback((query) => {
    const lowerQuery = query.toLowerCase();
    const results = {
      rooms: [],
      bookings: [],
      suggestions: [],
      intent: null,
    };

    // Parse intent from query
    if (lowerQuery.includes('available') || lowerQuery.includes('free') || lowerQuery.includes('empty')) {
      results.intent = 'availability';
    } else if (lowerQuery.includes('book') || lowerQuery.includes('reserve') || lowerQuery.includes('schedule')) {
      results.intent = 'booking';
    } else if (lowerQuery.includes('conflict') || lowerQuery.includes('clash') || lowerQuery.includes('double book')) {
      results.intent = 'conflict';
    } else if (lowerQuery.includes('alternative') || lowerQuery.includes('other') || lowerQuery.includes('instead')) {
      results.intent = 'alternatives';
    }

    // Extract time/date info
    const today = new Date();
    const tomorrow = addDays(today, 1);

    // Simple keyword matching for rooms
    results.rooms = searchRooms(query);

    // If looking for availability, check current/next day
    if (results.intent === 'availability') {
      const checkDate = lowerQuery.includes('tomorrow') ? format(tomorrow, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd');
      results.suggestions = timeSlots.map(slot => ({
        timeSlot: slot,
        availableRooms: allRooms.filter(r => !isRoomBooked(r.id, slot.id, checkDate)),
      })).filter(s => s.availableRooms.length > 0);
    }

    return results;
  }, [searchRooms, allRooms, timeSlots, isRoomBooked]);

  const value = {
    // State
    allRooms,
    allBookings,
    allAnnouncements,
    allConflicts,
    allSeatReservations,
    allAdminAuditLogs,
    selectedDate,
    selectedBuilding,
    searchQuery,
    filters,
    buildingRooms,
    dayBookings,
    timeSlots,
    buildings,

    // Actions
    setSelectedDate,
    setSelectedBuilding,
    setSearchQuery,
    setFilters,
    isRoomBooked,
    getBooking,
    checkOverlap,
    bookRoom,
    cancelBooking,
    deleteBooking,
    updateBookingStatus,
    getAlternativeRooms,
    reportConflict,
    resolveConflict,
    updateConflictStatus,
    reserveSeat,
    cancelSeatReservation,
    createAnnouncement,
    deleteAnnouncement,
    recordAuditLog,
    getUserBookings,
    getAnnouncementsForRole,
    searchRooms,
    naturalLanguageSearch,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}