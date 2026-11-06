/* ==========================================================================
   DDUGU Classroom Booking — application
   Vanilla JS single-page app. No build step, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  const DATA = window.DDUGU_DATA;
  if (!DATA) {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif">Data failed to load. Please make sure <code>js/data.js</code> exists.</p>';
    return;
  }

  const {
    buildings,
    rooms,
    users,
    timeSlots,
    announcements,
    roomTypes,
    equipmentLabels,
    featureLabels,
  } = DATA;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (char) => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return map[char];
    });

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function parseDate(iso) {
    if (!iso) return new Date();
    if (iso instanceof Date) return iso;
    const str = String(iso).trim();
    if (str.includes('T') || str.includes(' ')) return new Date(str);
    return new Date(`${str}T00:00:00`);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return parseDate(iso).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatLongDate(iso) {
    if (!iso) return '—';
    return parseDate(iso).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function formatShortDate(iso) {
    if (!iso) return '—';
    return parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function formatRelative(iso) {
    if (!iso) return '—';
    const diff = Math.round((parseDate(iso) - parseDate(todayStr())) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return parseDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function timeAgo(stamp) {
    if (!stamp) return '';
    const seconds = Math.floor((Date.now() - new Date(stamp).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    const days = Math.floor(seconds / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return formatShortDate(new Date(stamp).toISOString().slice(0, 10));
  }

  function formatFloor(floor) {
    const f = Number(floor);
    if (f === 0) return 'Ground Floor';
    if (f === 1) return '1st Floor';
    if (f === 2) return '2nd Floor';
    return `Floor ${floor}`;
  }

  const getRoom = (id) => {
    if (!id) return null;
    const direct = rooms.find((room) => room.id === id);
    if (direct) return direct;
    const normalized = String(id).trim().toLowerCase().replace(/[\s\-_]/g, '');
    return (
      rooms.find((r) => {
        const rId = String(r.id).toLowerCase().replace(/[\s\-_]/g, '');
        const rName = String(r.name).toLowerCase().replace(/[\s\-_]/g, '');
        const rLabel = String(r.label || '').toLowerCase().replace(/[\s\-_]/g, '');
        return rId === normalized || rLabel === normalized || rName.includes(normalized) || normalized.includes(rLabel);
      }) || null
    );
  };
  const getBuilding = (id) => buildings.find((building) => building.id === id) || null;
  const getUser = (id) => {
    if (!id) return null;
    const direct = users.find((user) => user.id === id);
    if (direct) return direct;
    const cleanId = String(id).trim().toLowerCase();
    return (
      users.find((u) => {
        return (
          u.mobileNumber === id ||
          u.email.toLowerCase() === cleanId ||
          u.name.toLowerCase() === cleanId ||
          u.name.toLowerCase().replace(/^(dr|mr|mrs|ms)\.?\s+/i, '') === cleanId.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '')
        );
      }) || null
    );
  };
  const getSlot = (id) => timeSlots.find((slot) => slot.id === id) || null;
  const slotIndex = (id) => timeSlots.findIndex((slot) => slot.id === id);
  const roomTypeOf = (room) => roomTypes[room.type] || roomTypes.classroom;
  const displayName = (user) => (user ? user.name : 'Unknown user');

  function currentSlotId() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const slot = timeSlots.find((item) => {
      const [sh, sm] = item.start.split(':').map(Number);
      const [eh, em] = item.end.split(':').map(Number);
      return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
    });
    return slot ? slot.id : null;
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  const firstName = (name) => String(name || '').split(' ').slice(-1)[0];

  function sanitizeAcademicYear(year) {
    if (!year) return 1;
    const str = String(year).trim();
    const match = str.match(/\b([1-4])(?:st|nd|rd|th)?\b/i) || str.match(/([1-4])/);
    return match ? parseInt(match[1], 10) : 1;
  }

  function formatYearLabel(year) {
    const num = sanitizeAcademicYear(year);
    if (num === 1) return '1st Year';
    if (num === 2) return '2nd Year';
    if (num === 3) return '3rd Year';
    if (num === 4) return '4th Year';
    return '1st Year';
  }

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */
  const KEYS = {
    session: 'ddugu_session_v1',
    bookings: 'ddugu_bookings_v1',
    conflicts: 'ddugu_conflicts_v1',
    read: 'ddugu_read_announcements_v1',
    seatReservations: 'ddugu_seat_reservations_v1',
    adminAuditLogs: 'ddugu_admin_audit_logs_v1',
    announcements: 'ddugu_announcements_v1',
    users: 'ddugu_users_v1',
    hiddenAnnouncementsPrefix: 'ddugu_hidden_announcements_',
    hiddenBookingsPrefix: 'ddugu_hidden_bookings_',
    hiddenSeatResPrefix: 'ddugu_hidden_seat_res_',
  };

  function getHiddenAnnouncements(userId) {
    const uid = userId || (state.user ? state.user.id : null);
    if (!uid) return [];
    return storage.get(KEYS.hiddenAnnouncementsPrefix + uid, []);
  }

  function hideAnnouncementForUser(annId) {
    if (!state.user) return;
    const list = getHiddenAnnouncements(state.user.id);
    if (!list.includes(annId)) {
      list.push(annId);
      storage.set(KEYS.hiddenAnnouncementsPrefix + state.user.id, list);
    }
  }

  function getHiddenBookings(userId) {
    const uid = userId || (state.user ? state.user.id : null);
    if (!uid) return [];
    return storage.get(KEYS.hiddenBookingsPrefix + uid, []);
  }

  function hideBookingForUser(bookingId) {
    if (!state.user) return;
    const list = getHiddenBookings(state.user.id);
    if (!list.includes(bookingId)) {
      list.push(bookingId);
      storage.set(KEYS.hiddenBookingsPrefix + state.user.id, list);
    }
  }

  function getHiddenSeatRes(userId) {
    const uid = userId || (state.user ? state.user.id : null);
    if (!uid) return [];
    return storage.get(KEYS.hiddenSeatResPrefix + uid, []);
  }

  function hideSeatResForUser(resId) {
    if (!state.user) return;
    const list = getHiddenSeatRes(state.user.id);
    if (!list.includes(resId)) {
      list.push(resId);
      storage.set(KEYS.hiddenSeatResPrefix + state.user.id, list);
    }
  }

  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* storage unavailable — app still works for this session */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        /* ignore */
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* Application state                                                   */
  /* ------------------------------------------------------------------ */
  const state = {
    user: null,
    page: 'dashboard',
    mapView: 'campus',
    selectedFloor: 0,
    selectedRoomId: null,
    roomDate: todayStr(),
    mapZoom: { iet: 1, 'deeksha-bhawan': 1 },
    booking: {
      buildingId: 'iet',
      roomId: 'iet-cr-14',
      date: todayStr(),
      slotId: '',
      title: '',
      academicYear: '',
      branchFilter: '',
      selectedSections: [],
    },
    adminBookingsFilter: {
      q: '',
      buildingId: 'all',
      status: 'all',
    },
    adminScheduleFilter: {
      date: '',
      facultyId: 'all',
      branch: 'all',
    },
    studentReserveFilter: {
      date: '',
      facultyId: 'all',
    },
    seatResFilter: {
      q: '',
      lectureId: 'all',
      branch: 'all',
      year: 'all',
      section: 'all',
      status: 'all',
    },
    filters: { q: '', buildingId: 'all', type: 'all', capacity: 'any', slotId: 'all', date: todayStr() },
    readAnnouncements: [],
  };
  window.state = state;

  let bookings = [];
  let conflicts = [];
  let seatReservations = [];
  let adminAuditLogs = [];
  let selectedRole = 'student';
  let confirmHandler = null;

  function loadStoredData() {
    const SEED_VERSION_KEY = 'ddugu_seed_version_v3';
    if (storage.get(SEED_VERSION_KEY, null) !== '2026_11_06_seed_v3') {
      storage.set(SEED_VERSION_KEY, '2026_11_06_seed_v3');
      storage.remove(KEYS.bookings);
      storage.remove(KEYS.users);
      storage.remove(KEYS.seatReservations);
      storage.remove(KEYS.conflicts);
    }

    const savedUsers = storage.get(KEYS.users, null);
    if (Array.isArray(savedUsers) && savedUsers.length >= DATA.users.length) {
      savedUsers.forEach((u) => {
        if (u.role === 'student') {
          u.academicYear = sanitizeAcademicYear(u.academicYear || u.year);
          u.year = u.academicYear;
          if (u.branchCode) u.branchCode = String(u.branchCode).replace(/\(B\.Tech\)/gi, '').trim();
          if (u.department) u.department = String(u.department).replace(/\(B\.Tech\)/gi, '').trim();
        }
      });
      users.splice(0, users.length, ...savedUsers);
    } else {
      users.splice(0, users.length, ...clone(DATA.users));
      storage.set(KEYS.users, users);
    }
    if (!users.some((u) => u.mobileNumber === '1112223334')) {
      const defFac = DATA.users.find((u) => u.mobileNumber === '1112223334');
      if (defFac) {
        users.unshift(clone(defFac));
        storage.set(KEYS.users, users);
      }
    }

    const savedAnnouncements = storage.get(KEYS.announcements, null);
    if (Array.isArray(savedAnnouncements) && savedAnnouncements.length) {
      announcements.splice(0, announcements.length, ...savedAnnouncements);
    }

    const savedBookings = storage.get(KEYS.bookings, null);
    if (Array.isArray(savedBookings) && savedBookings.some((b) => b.roomId === 'iet-cr-29' || b.roomId === 'iet-lab-p1')) {
      bookings = savedBookings;
    } else {
      bookings = clone(DATA.seedBookings);
      storage.set(KEYS.bookings, bookings);
    }

    const savedConflicts = storage.get(KEYS.conflicts, null);
    conflicts = Array.isArray(savedConflicts) ? savedConflicts.filter((c) => c.status !== 'resolved') : clone(DATA.seedConflicts || []).filter((c) => c.status !== 'resolved');

    const savedSeatRes = storage.get(KEYS.seatReservations, null);
    seatReservations = Array.isArray(savedSeatRes) ? savedSeatRes : clone(DATA.seedSeatReservations || []);

    const savedAudit = storage.get(KEYS.adminAuditLogs, null);
    adminAuditLogs = Array.isArray(savedAudit) ? savedAudit : clone(DATA.seedAdminAuditLogs || []);

    const savedRead = storage.get(KEYS.read, null);
    state.readAnnouncements = Array.isArray(savedRead) ? savedRead : [];
  }

  const saveUsers = () => storage.set(KEYS.users, users);
  const saveAnnouncements = () => storage.set(KEYS.announcements, announcements);
  const saveBookings = () => storage.set(KEYS.bookings, bookings);
  const saveConflicts = () => storage.set(KEYS.conflicts, conflicts);
  const saveSeatReservations = () => storage.set(KEYS.seatReservations, seatReservations);
  const saveAdminAuditLogs = () => storage.set(KEYS.adminAuditLogs, adminAuditLogs);

  /* ------------------------------------------------------------------ */
  /* Booking helpers                                                     */
  /* ------------------------------------------------------------------ */
  function findBooking(roomId, date, slotId) {
    const targetRoom = getRoom(roomId);
    const targetId = targetRoom ? targetRoom.id : roomId;
    return (
      bookings.find(
        (booking) =>
          (booking.roomId === targetId || booking.roomId === roomId || booking.roomCode === roomId || (targetRoom && (booking.roomCode === targetRoom.label || booking.roomCode === targetRoom.name))) &&
          booking.date === date &&
          (booking.timeSlotId === slotId || (Array.isArray(booking.timeSlotIds) && booking.timeSlotIds.includes(slotId))) &&
          booking.status !== 'cancelled'
      ) || null
    );
  }

  function roomStatus(roomId, date = todayStr(), slotId = currentSlotId()) {
    if (!slotId) return 'free';
    const booking = findBooking(roomId, date, slotId);
    if (!booking) return 'free';
    return booking.status === 'pending' ? 'pending' : 'busy';
  }

  function occupancyFor(buildingId) {
    const buildingRooms = rooms.filter((room) => room.buildingId === buildingId && Boolean(room.coordinates) && !room.id.includes('lab-p') && !room.name.toLowerCase().includes('practical lab'));
    const slot = currentSlotId();
    const busy = slot
      ? buildingRooms.filter((room) => findBooking(room.id, todayStr(), slot)).length
      : 0;
    return { total: buildingRooms.length, free: buildingRooms.length - busy, busy };
  }

  function statusBadge(status) {
    const map = {
      confirmed: ['badge-green', 'Confirmed'],
      pending: ['badge-amber', 'Pending'],
      cancelled: ['badge-slate', 'Cancelled'],
      reported: ['badge-red', 'Reported'],
      resolved: ['badge-green', 'Resolved'],
    };
    const [cls, label] = map[status] || ['badge-slate', status || 'Unknown'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  const STATUS_CLASS = { free: 'free', busy: 'busy', pending: 'pending' };
  const STATUS_LABEL = { free: 'Available now', busy: 'In use now', pending: 'Pending now' };
  const MAP_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

  /* ------------------------------------------------------------------ */
  /* Icons                                                               */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    map:
      '<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    calendar:
      '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    megaphone:
      '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M14 8a4 4 0 0 1 0 8"/>',
    alert:
      '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    bell:
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    logout:
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    users:
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    arrowRight: '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    building:
      '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    chair: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M5 18v3M19 18v3"/><path d="M3 13h18v5H3z"/>',
    key: '<path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1-1-4 4a5 5 0 1 0 7 7l4-4 1.5 1.5 1.5-1.5 1.5 1.5L21 2z"/>',
  };

  function icon(name, size = 20, extraClass = '') {
    return `<svg class="${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Toast & confirm modal                                               */
  /* ------------------------------------------------------------------ */
  function toast(message, type = 'success') {
    const root = $('#toastRoot');
    if (!root) return;
    const symbols = { success: '✓', error: '!', info: 'i', warning: '⚠' };
    root.replaceChildren();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${symbols[type] || '✓'}</span><span>${escapeHtml(message)}</span>`;
    root.appendChild(el);
    window.setTimeout(() => {
      el.classList.add('leaving');
      window.setTimeout(() => el.remove(), 260);
    }, 3400);
  }

  function openConfirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, onConfirm }) {
    confirmHandler = onConfirm;
    const modalRoot = $('#modalRoot');
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop="1">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="modal-head">
            <div>
              <h3 id="modalTitle">${escapeHtml(title)}</h3>
              <p style="white-space:pre-line;line-height:1.6;margin-top:0.5rem;color:#334155;">${escapeHtml(message)}</p>
            </div>
            <button type="button" class="modal-close" data-modal-close="1" aria-label="Close">${icon('x', 18)}</button>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-modal-close="1">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-modal-confirm="1">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modalRoot = $('#modalRoot');
    if (modalRoot) modalRoot.innerHTML = '';
    confirmHandler = null;
    document.body.style.overflow = '';
  }

  function openCustomModal({ title, content, maxWidth = '540px' }) {
    const modalRoot = $('#modalRoot');
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop="1">
        <div class="modal" style="max-width:${maxWidth};max-height:92vh;overflow-y:auto;" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid #e2e8f0;">
            <div>
              <h3 id="modalTitle" style="margin:0;font-size:1.15rem;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h3>
            </div>
            <button type="button" class="modal-close" data-modal-close="1" aria-label="Close" style="background:none;border:none;cursor:pointer;color:#64748b;padding:4px;border-radius:6px;">${icon('x', 18)}</button>
          </div>
          <div class="modal-body" style="padding:1.25rem;">
            ${content}
          </div>
        </div>
      </div>`;
    document.body.style.overflow = 'hidden';
  }

  /* ------------------------------------------------------------------ */
  /* Academic Structure (IET Branches, Years, and Sections)             */
  /* ------------------------------------------------------------------ */
  const academic = DATA.academicStructure || {
    years: [
      { id: '1', name: '1st Year' },
      { id: '2', name: '2nd Year' },
      { id: '3', name: '3rd Year' },
      { id: '4', name: '4th Year' },
    ],
    branches: [
      { id: 'CSE', name: 'CSE', fullName: 'Computer Science & Engineering', totalStrength: 150, sections: [{ id: 'A', name: 'Section A', strength: 75 }, { id: 'B', name: 'Section B', strength: 75 }] },
      { id: 'AI ML', name: 'AI ML', fullName: 'Artificial Intelligence & Machine Learning', totalStrength: 150, sections: [{ id: 'A', name: 'Section A', strength: 75 }, { id: 'B', name: 'Section B', strength: 75 }] },
      { id: 'AI DS', name: 'AI DS', fullName: 'Artificial Intelligence & Data Science', totalStrength: 75, sections: [{ id: 'A', name: 'Single Section', strength: 75 }] },
      { id: 'ECE', name: 'ECE', fullName: 'Electronics & Communication Engineering', totalStrength: 75, sections: [{ id: 'A', name: 'Single Section', strength: 75 }] },
      { id: 'ME', name: 'ME', fullName: 'Mechanical Engineering', totalStrength: 75, sections: [{ id: 'A', name: 'Single Section', strength: 75 }] },
      { id: 'IT', name: 'IT', fullName: 'Information Technology', totalStrength: 75, sections: [{ id: 'A', name: 'Single Section', strength: 75 }] },
    ],
  };

  function getAllSections() {
    const list = [];
    academic.years.forEach((y) => {
      academic.branches.forEach((b) => {
        b.sections.forEach((s) => {
          list.push({
            id: `${y.id}-${b.id}-${s.id}`,
            yearId: y.id,
            yearName: y.name,
            branchId: b.id,
            branchName: b.name,
            sectionId: s.id,
            sectionName: s.name,
            strength: s.strength || 75,
            label: `${y.name} ${b.name} (${s.id === 'A' && b.sections.length === 1 ? '75 students' : `Sec ${s.id} • 75 students`})`,
            shortLabel: `${y.name} ${b.name}${b.sections.length > 1 ? `-${s.id}` : ''}`,
          });
        });
      });
    });
    return list;
  }

  function calculateSelectedStrength(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length === 0) return 75;
    const allSecs = getAllSections();
    return sectionIds.reduce((sum, id) => {
      const match = allSecs.find((s) => s.id === id);
      return sum + (match ? match.strength : 75);
    }, 0);
  }

  function formatAudienceDescription(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length === 0) return 'Standard Class (75 students)';
    const allSecs = getAllSections();
    const names = sectionIds.map((id) => {
      const match = allSecs.find((s) => s.id === id);
      return match ? match.shortLabel : id;
    });
    return names.join(', ');
  }

  /* ------------------------------------------------------------------ */
  /* Pages & navigation config                                           */
  /* ------------------------------------------------------------------ */
  const PAGES = {
    dashboard: { label: 'Dashboard', icon: 'dashboard', render: renderDashboard },
    map: { label: 'Campus Map', icon: 'map', render: renderMapPage },
    rooms: { label: 'Room Directory', icon: 'search', render: renderRoomsPage },
    book: { label: 'Book a Room', icon: 'calendar', render: renderBookPage, roles: ['faculty'] },
    'reserve-seat': { label: 'Reserve a Seat', icon: 'chair', render: renderReserveSeatPage, roles: ['student'] },
    bookings: { label: 'Bookings', icon: 'calendar', render: renderAdminBookingsPage, roles: ['admin'] },
    schedule: {
      get label() {
        return state.user && state.user.role === 'admin' ? 'See Schedule' : 'My Schedule';
      },
      icon: 'clock',
      render: renderSchedulePage,
      roles: ['admin', 'faculty', 'student'],
    },
    announcements: { label: 'Announcements', icon: 'megaphone', render: renderAnnouncementsPage },
    conflicts: {
      get label() {
        return state.user && state.user.role === 'admin' ? 'Conflict Resolution' : 'Report a Conflict';
      },
      icon: 'alert',
      render: renderConflictsPage,
      roles: ['admin', 'faculty', 'student'],
    },
    admin: { label: 'Admin Panel', icon: 'settings', render: renderAdminPage, roles: ['admin'] },
  };

  const NAV_SECTIONS = [
    { label: 'Workspace', pages: ['dashboard', 'map', 'rooms'] },
    { label: 'Bookings', pages: ['book', 'reserve-seat', 'bookings', 'schedule'] },
    { label: 'Campus', pages: ['announcements', 'conflicts'] },
    { label: 'Management', pages: ['admin'] },
  ];

  const roleIdentifiers = {
    student: 'arjun.patel@ddgu.edu',
    faculty: '1112223334',
    admin: 'admin@ddgu.edu',
  };

  const roleLabels = {
    admin: 'Administrator',
    faculty: 'Faculty',
    student: 'Student',
  };

  function canAccess(page) {
    const config = PAGES[page];
    if (!config) return false;
    if (!config.roles) return true;
    return Boolean(state.user && config.roles.includes(state.user.role));
  }

  /* ------------------------------------------------------------------ */
  /* Shell / routing                                                     */
  /* ------------------------------------------------------------------ */
  function wireEvents() {
    $('#loginForm').addEventListener('submit', handleLoginSubmit);

    $$('.role-option').forEach((button) => {
      button.addEventListener('click', () => {
        selectedRole = button.dataset.role;
        $$('.role-option').forEach((item) => item.classList.toggle('active', item === button));
        const isFaculty = selectedRole === 'faculty';
        const labelEl = $('#identifierLabel');
        const inputEl = $('#email');
        if (labelEl) labelEl.textContent = isFaculty ? 'Mobile Number (Primary Key)' : 'Email';
        if (inputEl) {
          inputEl.placeholder = isFaculty ? 'Enter 10-digit mobile number' : 'Enter your email';
          inputEl.value = roleIdentifiers[selectedRole] || '';
        }
        const userForRole = users.find((u) => {
          if (selectedRole === 'faculty') {
            return u.role === 'faculty' && (u.mobileNumber === roleIdentifiers.faculty || u.mobileNumber === '1112223334');
          }
          return u.role === selectedRole;
        }) || users.find((u) => u.role === selectedRole);
        $('#password').value = (userForRole && userForRole.password) ? userForRole.password : (selectedRole === 'faculty' ? 'facultypassword123' : 'demo123');
        $('#loginError').style.display = 'none';
      });
    });

    $('#togglePassword').addEventListener('click', () => {
      const input = $('#password');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      $('#togglePassword').textContent = showing ? '👁' : '🙈';
    });

    $('#profileBtn').addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = $('#profileDropdown').classList.contains('hidden');
      closeDropdowns();
      if (willOpen) {
        $('#profileDropdown').classList.remove('hidden');
        $('#profileBtn').classList.add('active');
      }
    });

    $('#notificationsBtn').addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = $('#notifMenu').classList.contains('hidden');
      closeDropdowns();
      refreshNotifications();
      if (willOpen) {
        $('#notifMenu').classList.remove('hidden');
        $('#notificationsBtn').classList.add('active');
      }
    });

    $('#logoutBtn').addEventListener('click', logout);
    $('#mobileMenuBtn').addEventListener('click', openSidebar);
    $('#closeSidebar').addEventListener('click', closeSidebar);
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    $('#buildingSelect').addEventListener('change', (event) => {
      const building = getBuilding(event.target.value);
      if (!building || !state.user) return;
      state.booking.buildingId = building.id;
      state.mapView = building.id;
      state.selectedFloor = 0;
      state.selectedRoomId = null;
      navigate('map');
      toast(`Showing ${building.name}`, 'info');
    });

    $('#navMenu').addEventListener('click', closeSidebar);

    $('#pageContent').addEventListener('click', onPageClick);
    $('#pageContent').addEventListener('change', onPageChange);
    $('#pageContent').addEventListener('input', onPageInput);
    document.addEventListener('submit', onFormSubmit);

    $('#modalRoot').addEventListener('click', onModalClick);
    $('#notifMenu').addEventListener('click', onNotifClick);

    document.addEventListener('click', (event) => {
      const profBtn = event.target.closest('[data-action="open-profile-modal"]');
      if (profBtn) {
        event.preventDefault();
        event.stopPropagation();
        closeDropdowns();
        openProfileModal();
        return;
      }

      const credBtn = event.target.closest('[data-action="open-change-credentials"]');
      if (credBtn) {
        event.preventDefault();
        event.stopPropagation();
        closeDropdowns();
        openChangeCredentialsModal();
        return;
      }

      if (!event.target.closest('.profile-dropdown') && !event.target.closest('.notif-wrap')) {
        closeDropdowns();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdowns();
        closeSidebar();
        if ($('#modalRoot').innerHTML) closeModal();
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.room-shape, .campus-building, .agenda-item')) {
        event.preventDefault();
        event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('resize', () => {
      if (state.page === 'map') buildings.forEach((building) => applyMapZoom(building.id));
    });
  }

  function onHashChange() {
    if (!state.user) return;
    const target = location.hash.replace('#', '') || 'dashboard';
    if (!PAGES[target] || !canAccess(target)) {
      navigate('dashboard', { replace: true });
      return;
    }
    if (target === state.page) return;
    state.page = target;
    renderPage();
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const identifier = $('#email').value.trim();
    const password = $('#password').value;
    const errorEl = $('#loginError');

    const fail = (message) => {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    };

    if (!identifier || !password) return fail('Please enter both your identifier and password.');

    const user = users.find((item) => {
      if (item.email && item.email.toLowerCase() === identifier.toLowerCase()) return true;
      if (item.mobileNumber && item.mobileNumber === identifier) return true;
      return false;
    });
    if (!user) return fail('No account found with that email address or mobile number.');

    // Check password against updated user record or role defaults (with fallback to demo123)
    const validPassword = user.password || (user.role === 'admin' ? 'adminpassword123' : user.role === 'faculty' ? 'facultypassword123' : 'studentpassword123');
    if (password !== validPassword && password !== 'demo123') {
      return fail('Incorrect password.');
    }
    if (user.role !== selectedRole) {
      return fail(`This account is registered as ${user.role}. Please choose the matching role.`);
    }

    errorEl.style.display = 'none';
    storage.set(KEYS.session, user.id);
    enterApp(user);
    toast(`Welcome back, ${firstName(user.name)}!`);
  }

  function enterApp(user) {
    if (user && user.role === 'student') {
      user.academicYear = sanitizeAcademicYear(user.academicYear || user.year);
      user.year = user.academicYear;
      if (user.branchCode) user.branchCode = String(user.branchCode).replace(/\(B\.Tech\)/gi, '').trim();
      if (user.department) user.department = String(user.department).replace(/\(B\.Tech\)/gi, '').trim();
    }
    state.user = user;
    state.mapView = 'campus';
    state.selectedRoomId = null;
    state.roomDate = todayStr();
    $('#loginPage').classList.add('hidden');
    $('#app').classList.remove('hidden');
    updateProfile();
    refreshBuildingSelect();
    refreshNotifications();

    const fromHash = location.hash.replace('#', '');
    const page = PAGES[fromHash] && canAccess(fromHash) ? fromHash : 'dashboard';
    navigate(page, { replace: true });
  }

  function logout() {
    state.user = null;
    storage.remove(KEYS.session);
    closeModal();
    closeDropdowns();
    closeSidebar();
    $('#app').classList.add('hidden');
    $('#loginPage').classList.remove('hidden');
    $('#loginError').style.display = 'none';
    $('#password').value = '';
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function navigate(page, options = {}) {
    if (page === 'book' && state.user && state.user.role === 'admin') {
      page = 'bookings';
    }
    const fallback = state.user && state.user.role === 'admin' ? 'bookings' : 'dashboard';
    const safe = PAGES[page] && canAccess(page) ? page : fallback;
    state.page = safe;
    const targetHash = `#${safe}`;
    if (location.hash !== targetHash) {
      if (options.replace) {
        history.replaceState(null, '', targetHash);
      } else {
        location.hash = targetHash;
      }
    }
    renderPage();
  }

  function renderPage() {
    const config = PAGES[state.page] || PAGES.dashboard;
    buildNav();
    $('#pageTitle').textContent = config.label;
    $('#pageContent').innerHTML = `<div class="fade-in">${config.render()}</div>`;
    updateNavActive();
    refreshBuildingSelect();
    if (state.page === 'map') initMapViewers();
    closeDropdowns();
  }
  window.renderPage = renderPage;

  function buildNav() {
    const pending = state.user && state.user.role === 'admin'
      ? bookings.filter((booking) => booking.status === 'pending').length
      : 0;
    const openConflicts = conflicts.filter((conflict) => conflict.status === 'reported').length;

    $('#navMenu').innerHTML = NAV_SECTIONS.map((section) => {
      const pages = section.pages.filter((page) => PAGES[page] && canAccess(page));
      if (!pages.length) return '';
      const links = pages.map((page) => {
        let badge = '';
        if (page === 'admin' && pending) badge = `<span class="nav-badge">${pending}</span>`;
        if (page === 'bookings' && pending) badge = `<span class="nav-badge">${pending}</span>`;
        if (page === 'conflicts' && openConflicts) badge = `<span class="nav-badge">${openConflicts}</span>`;
        return `<a class="nav-item" href="#${page}" data-page="${page}">${icon(PAGES[page].icon, 19)}<span>${PAGES[page].label}</span>${badge}</a>`;
      }).join('');
      return `<div class="nav-section-label">${section.label}</div>${links}`;
    }).join('');
    updateNavActive();
  }

  function updateNavActive() {
    $$('#navMenu .nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === state.page);
    });
  }

  function refreshBuildingSelect() {
    const select = $('#buildingSelect');
    if (!select) return;
    select.innerHTML = buildings
      .map((building) => `<option value="${building.id}">${building.icon} ${building.name}</option>`)
      .join('');
    const current = state.mapView !== 'campus' && getBuilding(state.mapView)
      ? state.mapView
      : state.booking.buildingId;
    select.value = current;
  }

  function updateProfile() {
    if (!state.user) return;
    const roleMap = {
      admin: 'Administrator',
      faculty: 'Faculty',
      student: 'Student',
    };
    const roleText = (typeof roleLabels !== 'undefined' && roleLabels[state.user.role])
      ? roleLabels[state.user.role]
      : (roleMap[state.user.role] || state.user.role || '');

    const profileName = $('#profileName');
    if (profileName) profileName.textContent = state.user.name;

    const profileRole = $('#profileRole');
    if (profileRole) profileRole.textContent = roleText;

    const profileAvatar = $('#profileAvatar');
    if (profileAvatar) profileAvatar.textContent = state.user.avatar || '👤';

    const ddName = $('#ddName');
    if (ddName) ddName.textContent = state.user.name;

    const ddEmail = $('#ddEmail');
    if (ddEmail) ddEmail.textContent = state.user.email || state.user.mobileNumber || '';

    const ddAvatar = $('#ddAvatar');
    if (ddAvatar) ddAvatar.textContent = state.user.avatar || '👤';

    const profWrap = $('#profileActionWrap');
    if (profWrap) {
      profWrap.innerHTML = `
        <button type="button" class="dropdown-item" id="editProfileDropdownBtn" onclick="event.preventDefault(); event.stopPropagation(); window.DDUGU_APP.openProfileModal();" data-action="open-profile-modal" style="display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:13px;width:100%;border:none;background:none;cursor:pointer;color:#334155;">
          ${icon('user', 15)} Profile
        </button>`;
    }

    const credWrap = $('#credentialsActionWrap');
    if (credWrap) {
      credWrap.innerHTML = `
        <button type="button" class="dropdown-item" id="changeCredentialsDropdownBtn" onclick="event.preventDefault(); event.stopPropagation(); window.DDUGU_APP.openChangeCredentialsModal();" data-action="open-change-credentials" style="display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:13px;width:100%;border:none;background:none;cursor:pointer;color:#334155;">
          ${icon('key', 15)} Change Credentials
        </button>`;
    }
  }

  function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#sidebarOverlay').classList.add('show');
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('show');
  }

  function closeDropdowns() {
    const profile = $('#profileDropdown');
    const notif = $('#notifMenu');
    if (profile) profile.classList.add('hidden');
    if (notif) notif.classList.add('hidden');
    if ($('#profileBtn')) $('#profileBtn').classList.remove('active');
    if ($('#notificationsBtn')) $('#notificationsBtn').classList.remove('active');
  }

  /* ------------------------------------------------------------------ */
  /* Notifications                                                       */
  /* ------------------------------------------------------------------ */
  function getRelevantAnnouncements() {
    if (!state.user) return [];
    let list = [];
    if (state.user.role === 'admin') {
      // Admin sees all announcements created by Admin and Faculty members
      list = announcements.slice();
    } else if (state.user.role === 'faculty') {
      // Faculty sees: their own announcements + those targeted to All or Faculty
      list = announcements.filter((item) => {
        if (item.authorId === state.user.id) return true;
        if (!item.audienceType || item.audienceType === 'all') return true;
        if (item.targetRoles && item.targetRoles.includes('faculty')) return true;
        if (item.audienceType === 'selected_faculty') {
          return Array.isArray(item.targetFacultyIds) && item.targetFacultyIds.includes(state.user.id);
        }
        return false;
      });
    } else if (state.user.role === 'student') {
      // Students only see announcements targeted at them
      const studentYear = Number(state.user.academicYear || state.user.year || 1);
      const studentBranch = String(state.user.branchCode || state.user.department || '').toUpperCase();
      const studentSection = String(state.user.section || 'A').toUpperCase();

      list = announcements.filter((item) => {
        if (!item.audienceType || item.audienceType === 'all') {
          return !item.targetRoles || item.targetRoles.includes('student');
        }
        if (item.audienceType === 'selected_students') {
          const matchYear = !item.targetAcademicYear || Number(item.targetAcademicYear) === studentYear;
          const matchBranch = !item.targetBranchCode || String(item.targetBranchCode).toUpperCase() === studentBranch;
          const matchSection = !item.targetSection || String(item.targetSection).toUpperCase() === studentSection;
          return matchYear && matchBranch && matchSection;
        }
        return false;
      });
    }
    const hidden = getHiddenAnnouncements(state.user.id);
    list = list.filter((item) => !hidden.includes(item.id));

    const rank = { high: 0, medium: 1, low: 2 };
    return list.sort(
      (a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  function unreadCount() {
    return getRelevantAnnouncements().filter(
      (item) => !state.readAnnouncements.includes(item.id)
    ).length;
  }

  function refreshNotifications() {
    if (!state.user) return;
    const relevant = getRelevantAnnouncements();
    const unread = unreadCount();
    const count = $('#notifCount');
    if (count) {
      count.textContent = String(unread);
      count.classList.toggle('hidden', unread === 0);
    }

    const menu = $('#notifMenu');
    if (!menu) return;
    const items = relevant.slice(0, 4).map((item) => {
      const isRead = state.readAnnouncements.includes(item.id);
      const emoji = item.priority === 'high' ? '📢' : item.priority === 'medium' ? '📌' : '🎉';
      return `
        <button type="button" class="notif-item ${isRead ? 'read' : ''}" data-announcement-id="${item.id}">
          <span class="notif-icon">${emoji}</span>
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.content)}</p>
          </span>
        </button>`;
    }).join('');

    menu.innerHTML = `
      <div class="notif-menu-head">
        <strong>Notifications</strong>
        <button type="button" id="markAllNotifs">Mark all read</button>
      </div>
      <div class="notif-list">
        ${items || '<div class="empty-state"><p>No notifications right now.</p></div>'}
      </div>`;
  }

  function markAnnouncementRead(id) {
    if (!state.readAnnouncements.includes(id)) {
      state.readAnnouncements.push(id);
      storage.set(KEYS.read, state.readAnnouncements);
      refreshNotifications();
    }
  }

  function markAllAnnouncementsRead() {
    getRelevantAnnouncements().forEach((item) => {
      if (!state.readAnnouncements.includes(item.id)) state.readAnnouncements.push(item.id);
    });
    storage.set(KEYS.read, state.readAnnouncements);
    refreshNotifications();
  }

  function onNotifClick(event) {
    const item = event.target.closest('[data-announcement-id]');
    if (item) {
      markAnnouncementRead(item.dataset.announcementId);
      closeDropdowns();
      navigate('announcements');
      return;
    }
    if (event.target.closest('#markAllNotifs')) {
      markAllAnnouncementsRead();
      closeDropdowns();
      navigate('announcements');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Page event delegation                                               */
  /* ------------------------------------------------------------------ */
  function onPageClick(event) {
    const element = event.target.closest('[data-action]');
    if (!element) return;
    const action = element.dataset.action;

    switch (action) {
      case 'go':
        event.preventDefault();
        navigate(element.dataset.page);
        break;
      case 'open-building':
        openBuilding(element.dataset.building);
        break;
      case 'select-room':
        selectRoom(element.dataset.roomId);
        break;
      case 'book-room':
        startBooking(element.dataset.roomId, {
          slotId: element.dataset.slotId || '',
          date: element.dataset.date || '',
        });
        break;
      case 'quick-book':
        startBooking(element.dataset.roomId, {
          date: element.dataset.date,
          slotId: element.dataset.slotId,
        });
        break;
      case 'map-back':
        state.mapView = 'campus';
        state.selectedRoomId = null;
        state.page = 'map';
        renderPage();
        break;
      case 'map-zoom':
        changeMapZoom(element.dataset.mapId, element.dataset.zoom);
        break;
      case 'set-floor':
        state.selectedFloor = element.dataset.floor !== undefined ? Number(element.dataset.floor) : 0;
        state.selectedRoomId = null;
        renderPage();
        break;
      case 'select-slot':
        state.booking.slotId = element.dataset.slotId;
        refreshAvailability();
        break;
      case 'cancel-booking':
        confirmCancelBooking(element.dataset.bookingId);
        break;
      case 'approve-booking':
        approveBooking(element.dataset.bookingId);
        break;
      case 'reject-booking':
        rejectBooking(element.dataset.bookingId);
        break;
      case 'resolve-conflict':
        resolveConflict(element.dataset.conflictId);
        break;
      case 'read-announcement':
        markAnnouncementRead(element.dataset.announcementId);
        navigate('announcements');
        break;
      case 'mark-all-read':
        markAllAnnouncementsRead();
        renderPage();
        toast('All announcements marked as read.', 'info');
        break;
      case 'reset-filters':
        state.filters = { q: '', buildingId: 'all', type: 'all', capacity: 'any', slotId: 'all', date: todayStr() };
        renderPage();
        break;
      case 'remove-faculty':
        removeFaculty(element.dataset.mobile);
        break;
      case 'toggle-section':
        const secId = element.dataset.sectionId;
        if (!Array.isArray(state.booking.selectedSections)) state.booking.selectedSections = [];
        const sIndex = state.booking.selectedSections.indexOf(secId);
        if (sIndex > -1) {
          state.booking.selectedSections.splice(sIndex, 1);
        } else {
          state.booking.selectedSections.push(secId);
          const parts = secId.split('-');
          if (!state.booking.academicYear && parts[0]) {
            state.booking.academicYear = parts[0];
          }
        }
        renderPage();
        break;
      case 'select-all-branch-sections':
        const branchKey = element.dataset.branch;
        const yearKey = state.booking.academicYear || '1';
        const branchObj = academic.branches.find((b) => b.id === branchKey);
        if (branchObj) {
          if (!Array.isArray(state.booking.selectedSections)) state.booking.selectedSections = [];
          branchObj.sections.forEach((sec) => {
            const fullId = `${yearKey}-${branchObj.id}-${sec.id}`;
            if (!state.booking.selectedSections.includes(fullId)) {
              state.booking.selectedSections.push(fullId);
            }
          });
          renderPage();
        }
        break;
      case 'clear-all-sections':
        state.booking.selectedSections = [];
        renderPage();
        break;
      case 'admin-delete-booking':
        adminDeleteBooking(element.dataset.bookingId);
        break;
      case 'open-create-announcement':
        openCreateAnnouncementModal();
        break;
      case 'delete-announcement':
        deleteAnnouncement(element.dataset.announcementId);
        break;
      case 'hide-announcement':
        hideAnnouncement(element.dataset.announcementId);
        break;
      case 'hide-cancelled-booking':
        hideCancelledBooking(element.dataset.bookingId);
        break;
      case 'hide-cancelled-seat-res':
        hideCancelledSeatRes(element.dataset.reservationId);
        break;
      case 'view-booked-seats':
        openBookedSeatsModal(element.dataset.bookingId);
        break;
      case 'quick-reserve-library-seat':
        handleQuickReserveLibrarySeat(
          element.dataset.roomId,
          element.dataset.slotId,
          element.dataset.date,
          element.dataset.bookingId || null
        );
        break;
      case 'open-profile-modal':
        openProfileModal();
        break;
      case 'open-change-credentials':
        openChangeCredentialsModal();
        break;
      case 'edit-faculty':
        openEditFacultyModal(element.dataset.mobile);
        break;
      case 'quick-reserve-seat':
        quickReserveSeat(element.dataset.bookingId);
        break;
      case 'cancel-seat-reservation':
        cancelSeatReservation(element.dataset.reservationId);
        break;
      case 'set-admin-bookings-tab':
        state.adminBookingsTab = element.dataset.tab;
        renderPage();
        break;
      case 'clear-admin-schedule-filters':
        state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
        renderPage();
        break;
      case 'set-admin-schedule-today':
        if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
        state.adminScheduleFilter.date = todayStr();
        renderPage();
        break;
      case 'clear-admin-schedule-date':
        if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
        state.adminScheduleFilter.date = '';
        renderPage();
        break;
      default:
        break;
    }
  }

  function onPageChange(event) {
    const id = event.target.id;
    if (id === 'filterBuilding') {
      state.filters.buildingId = event.target.value;
      refreshRoomResults();
    } else if (id === 'filterType') {
      state.filters.type = event.target.value;
      refreshRoomResults();
    } else if (id === 'filterCapacity') {
      state.filters.capacity = event.target.value;
      refreshRoomResults();
    } else if (id === 'filterSlot') {
      state.filters.slotId = event.target.value;
      refreshRoomResults();
    } else if (id === 'filterDate') {
      state.filters.date = event.target.value;
      refreshRoomResults();
    } else if (id === 'bookBuilding') {
      state.booking.buildingId = event.target.value;
      const first = rooms.find((room) => room.buildingId === state.booking.buildingId && room.bookable !== false);
      state.booking.roomId = first ? first.id : '';
      state.booking.slotId = '';
      renderPage();
    } else if (id === 'bookRoom') {
      state.booking.roomId = event.target.value;
      state.booking.slotId = '';
      renderPage();
    } else if (id === 'bookDate') {
      state.booking.date = event.target.value || todayStr();
      state.booking.slotId = '';
      renderPage();
    } else if (id === 'roomScheduleDate') {
      state.roomDate = event.target.value || todayStr();
      renderPage();
    } else if (id === 'bookAcademicYear') {
      state.booking.academicYear = event.target.value;
      renderPage();
    } else if (id === 'bookAcademicBranchFilter') {
      state.booking.branchFilter = event.target.value;
      renderPage();
    } else if (id === 'adminBookingsFilterBuilding') {
      if (!state.adminBookingsFilter) state.adminBookingsFilter = { q: '', buildingId: 'all', status: 'all' };
      state.adminBookingsFilter.buildingId = event.target.value;
      renderPage();
    } else if (id === 'adminBookingsFilterStatus') {
      if (!state.adminBookingsFilter) state.adminBookingsFilter = { q: '', buildingId: 'all', status: 'all' };
      state.adminBookingsFilter.status = event.target.value;
      renderPage();
    } else if (id === 'adminBookBuilding') {
      state.booking.buildingId = event.target.value;
      const bRooms = rooms.filter((r) => r.buildingId === event.target.value && r.bookable !== false);
      state.booking.roomId = bRooms[0] ? bRooms[0].id : '';
      renderPage();
    } else if (id === 'adminBookRoom') {
      state.booking.roomId = event.target.value;
      renderPage();
    } else if (id === 'adminScheduleDate') {
      if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      state.adminScheduleFilter.date = event.target.value;
      renderPage();
    } else if (id === 'adminScheduleFaculty') {
      if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      state.adminScheduleFilter.facultyId = event.target.value;
      renderPage();
    } else if (id === 'adminScheduleBranch') {
      if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      state.adminScheduleFilter.branch = event.target.value;
      renderPage();
    }
  }

  function onPageInput(event) {
    if (event.target.id === 'roomSearch') {
      state.filters.q = event.target.value;
      refreshRoomResults();
    }
    if (event.target.id === 'filterDate') {
      state.filters.date = event.target.value;
      refreshRoomResults();
    }
    if (event.target.id === 'adminScheduleDate') {
      if (!state.adminScheduleFilter) state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      state.adminScheduleFilter.date = event.target.value;
      renderPage();
    }
    if (event.target.id === 'bookTitle') {
      state.booking.title = event.target.value;
    }
    if (event.target.id === 'adminBookingsSearch') {
      if (!state.adminBookingsFilter) state.adminBookingsFilter = { q: '', buildingId: 'all', status: 'all' };
      state.adminBookingsFilter.q = event.target.value;
      renderPage();
    }
  }

  function onFormSubmit(event) {
    if (event.target.id === 'bookingForm') handleBookingSubmit(event);
    if (event.target.id === 'conflictForm') handleConflictSubmit(event);
    if (event.target.id === 'adminFacultyForm') handleAdminFacultySubmit(event);
    if (event.target.id === 'adminDirectBookingForm') handleAdminDirectBookingSubmit(event);
  }

  function removeFaculty(mobileNumber) {
    const faculty = users.find((u) => u.mobileNumber === mobileNumber);
    if (!faculty) return;
    if (!confirm(`Are you sure you want to remove faculty member "${faculty.name}" (${mobileNumber})?`)) return;
    const index = users.findIndex((u) => u.mobileNumber === mobileNumber);
    if (index !== -1) {
      users.splice(index, 1);
      toast(`Faculty member "${faculty.name}" removed successfully.`);
      renderPage();
    }
  }

  function handleAdminFacultySubmit(event) {
    event.preventDefault();
    const mobile = $('#adminFacultyMobile').value.trim();
    const name = $('#adminFacultyName').value.trim();
    const dept = $('#adminFacultyDept').value.trim();
    const desig = $('#adminFacultyDesig').value.trim();

    if (!mobile || !/^\d{10}$/.test(mobile)) {
      alert('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!name || !dept) {
      alert('Name and Department are required.');
      return;
    }
    if (users.some((u) => u.mobileNumber === mobile)) {
      alert(`Faculty member with mobile number ${mobile} already exists.`);
      return;
    }

    const newFaculty = {
      id: `faculty-${Date.now()}`,
      name: name,
      email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@ddgu.edu`,
      mobileNumber: mobile,
      role: 'faculty',
      avatar: '👨‍🏫',
      department: dept,
      designation: desig || 'Asst. Prof.',
    };

    users.push(newFaculty);
    toast(`Faculty member "${name}" added successfully!`);
    renderPage();
  }

  function onModalClick(event) {
    if (event.target.closest('[data-modal-confirm]')) {
      const handler = confirmHandler;
      closeModal();
      if (handler) handler();
      return;
    }
    if (event.target.closest('[data-modal-close]') || event.target.dataset.modalBackdrop) {
      closeModal();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */
  function selectRoom(roomId) {
    const room = getRoom(roomId);
    if (!room) return;
    state.selectedRoomId = roomId;
    state.mapView = room.buildingId;
    state.selectedFloor = room.floor;
    state.roomDate = todayStr();
    if (state.page !== 'map') {
      navigate('map');
    } else {
      renderPage();
    }
  }

  function openBuilding(buildingId) {
    if (!getBuilding(buildingId)) return;
    state.mapView = buildingId;
    state.selectedFloor = 0;
    state.selectedRoomId = null;
    state.booking.buildingId = buildingId;
    state.page = 'map';
    navigate('map');
  }

  function ensureBookingDraft() {
    const draft = state.booking;
    if (!getBuilding(draft.buildingId)) draft.buildingId = buildings[0].id;
    const room = getRoom(draft.roomId);
    if (!room || room.buildingId !== draft.buildingId || room.bookable === false) {
      const first = rooms.find((item) => item.buildingId === draft.buildingId && item.bookable !== false) || rooms[0];
      draft.roomId = first.id;
      draft.buildingId = first.buildingId;
    }
    if (!draft.date || draft.date < todayStr()) draft.date = todayStr();
    if (!getSlot(draft.slotId)) draft.slotId = '';
    if (typeof draft.title !== 'string') draft.title = '';
  }

  function startBooking(roomId, options = {}) {
    if (state.user && state.user.role === 'student') {
      toast('Students are not permitted to book campus rooms. Please use Reserve a Seat.', 'warning');
      navigate('reserve-seat');
      return;
    }
    const room = getRoom(roomId) || getRoom(state.booking.roomId) || rooms[0];
    if (room && room.bookable === false) {
      toast(`${room.name} is an administrative / non-reservable space.`, 'warning');
      return;
    }
    if (state.user && state.user.role === 'admin') {
      state.booking.roomId = room.id;
      state.booking.buildingId = room.buildingId;
      navigate('bookings');
      toast(`Manage bookings for ${room.name} from the Admin Bookings section.`, 'info');
      return;
    }
    state.booking = {
      ...state.booking,
      buildingId: room.buildingId,
      roomId: room.id,
      date: options.date && options.date >= todayStr() ? options.date : todayStr(),
      slotId: options.slotId || '',
      title: state.booking.title || '',
      academicYear: state.booking.academicYear || '',
      branchFilter: state.booking.branchFilter || '',
      selectedSections: Array.isArray(state.booking.selectedSections) ? state.booking.selectedSections : [],
    };
    state.page = 'book';
    navigate('book');
  }

  function normalizeCohortStr(val) {
    if (!val) return '';
    return String(val).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  function checkBookingConflicts({ roomId, date, slotId, userId, selectedSections = [] }) {
    const slot = getSlot(slotId);
    if (!slot) return null;
    const newStart = slot.start;
    const newEnd = slot.end;

    // 1. Prevent Double Booking by the Same Faculty Member in another room
    const facultyConflict = bookings.find((b) => {
      if (b.date !== date) return false;
      if (b.status === 'cancelled' || b.status === 'rejected') return false;
      if (b.roomId === roomId) return false;

      const isSameFaculty =
        (userId && b.userId === userId) ||
        (state.user && state.user.id && b.userId === state.user.id) ||
        (state.user && state.user.phone && (b.facultyMobileNumber === state.user.phone || b.facultyMobile === state.user.phone)) ||
        (state.user && state.user.name && b.facultyName === state.user.name);

      if (!isSameFaculty) return false;

      let bStart = b.startTime;
      let bEnd = b.endTime;
      if (!bStart || !bEnd) {
        const bSlotId = b.timeSlotId || (Array.isArray(b.timeSlotIds) && b.timeSlotIds[0]);
        const bSlot = getSlot(bSlotId);
        if (bSlot) {
          bStart = bSlot.start;
          bEnd = bSlot.end;
        }
      }
      if (!bStart || !bEnd) return false;

      return bStart < newEnd && bEnd > newStart;
    });

    if (facultyConflict) {
      return {
        type: 'faculty',
        message: 'You have already booked another room during this time slot. Please choose a different time.',
      };
    }

    // 2. Prevent Academic Cohort Scheduling Conflicts
    const targetCohorts = selectedSections.map((secId) => {
      const parts = secId.split('-');
      return {
        rawId: secId,
        year: normalizeCohortStr(parts[0]),
        branch: normalizeCohortStr(parts[1]),
        section: normalizeCohortStr(parts[2] || 'A'),
      };
    });

    if (targetCohorts.length > 0) {
      const cohortConflict = bookings.find((b) => {
        if (b.date !== date) return false;
        if (b.status === 'cancelled' || b.status === 'rejected') return false;
        if (b.roomId === roomId) return false;

        let bStart = b.startTime;
        let bEnd = b.endTime;
        if (!bStart || !bEnd) {
          const bSlotId = b.timeSlotId || (Array.isArray(b.timeSlotIds) && b.timeSlotIds[0]);
          const bSlot = getSlot(bSlotId);
          if (bSlot) {
            bStart = bSlot.start;
            bEnd = bSlot.end;
          }
        }
        if (!bStart || !bEnd) return false;
        if (!(bStart < newEnd && bEnd > newStart)) return false;

        if (Array.isArray(b.selectedSections) && b.selectedSections.length > 0) {
          for (const bSec of b.selectedSections) {
            const bParts = bSec.split('-');
            const bY = normalizeCohortStr(bParts[0]);
            const bB = normalizeCohortStr(bParts[1]);
            const bS = normalizeCohortStr(bParts[2] || 'A');
            for (const tc of targetCohorts) {
              if (bSec === tc.rawId || (bY === tc.year && bB === tc.branch && bS === tc.section)) {
                return true;
              }
            }
          }
        }

        if (b.academicYear && b.branchCode && b.section) {
          const bY = normalizeCohortStr(b.academicYear);
          const bB = normalizeCohortStr(b.branchCode);
          const bS = normalizeCohortStr(b.section);
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
          type: 'cohort',
          message: 'This student section is already scheduled for another lecture during this time slot. Please choose a different time.',
        };
      }
    }

    return null;
  }

  function completeBooking(roomId, date, slotId, title, strength, audienceDesc, selectedSecs = []) {
    if (state.user && state.user.role === 'student') {
      toast('Students are not permitted to book campus rooms.', 'error');
      return;
    }
    const room = getRoom(roomId);
    const slot = getSlot(slotId);
    const status = state.user.role === 'student' ? 'pending' : 'confirmed';
    const firstSec = selectedSecs[0] ? selectedSecs[0].split('-') : [];
    bookings.push({
      id: `booking-${Date.now()}`,
      roomId,
      roomCode: room ? room.code : roomId,
      userId: state.user.id,
      facultyName: state.user.name,
      facultyMobileNumber: state.user.phone || null,
      title,
      audience: audienceDesc,
      strength,
      date,
      timeSlotId: slotId,
      timeSlotIds: [slotId],
      startTime: slot ? slot.start : null,
      endTime: slot ? slot.end : null,
      academicYear: firstSec[0] ? parseInt(firstSec[0], 10) : (state.booking.academicYear ? parseInt(state.booking.academicYear, 10) : 1),
      branchCode: firstSec[1] || 'CSE',
      section: firstSec[2] ? firstSec[2].toUpperCase() : 'A',
      selectedSections: selectedSecs.length > 0 ? selectedSecs : (state.booking.selectedSections || []),
      status,
      recurring: false,
      createdAt: new Date().toISOString(),
    });
    saveBookings();
    state.booking.title = '';
    state.booking.slotId = '';

    if (status === 'pending') {
      toast('Request sent — an administrator will approve it shortly.', 'info');
    } else {
      toast(`Booked ${room.name} for ${audienceDesc} (${strength} students).`, 'success');
    }
    navigate('schedule');
  }

  function handleBookingSubmit(event) {
    event.preventDefault();
    const roomId = $('#bookRoom') ? $('#bookRoom').value : state.booking.roomId;
    const date = $('#bookDate') ? $('#bookDate').value : state.booking.date;
    const title = ($('#bookTitle') ? $('#bookTitle').value : state.booking.title).trim();
    const slotId = state.booking.slotId;
    const room = getRoom(roomId);

    if (!room) return toast('Please choose a room first.', 'error');
    if (!slotId) return toast('Pick an available time slot from the availability panel.', 'error');
    if (!date || date < todayStr()) return toast('Please pick today or a future date.', 'error');
    if (title.length < 3) return toast('Add a short purpose for the booking.', 'error');

    const existing = findBooking(roomId, date, slotId);
    if (existing) {
      return toast(
        `That slot is already ${existing.status === 'pending' ? 'requested' : 'booked'} — ${existing.title}.`,
        'error'
      );
    }

    const selectedSecs = state.booking.selectedSections || [];
    if (selectedSecs.length === 0) {
      return toast('Please select at least one student section attending this session.', 'error');
    }

    const conflictErr = checkBookingConflicts({
      roomId,
      date,
      slotId,
      userId: state.user.id,
      selectedSections: selectedSecs,
    });
    if (conflictErr) {
      return toast(conflictErr.message, 'error');
    }

    const strength = calculateSelectedStrength(selectedSecs);
    const audienceDesc = formatAudienceDescription(selectedSecs);

    if (strength > room.capacity) {
      openConfirm({
        title: '⚠️ Room Capacity Overflow Warning',
        message: `The selected student strength (${strength} students) exceeds the room capacity of ${room.name} (${room.capacity} seats) by ${strength - room.capacity} students.\n\n` +
                 `Audience: ${audienceDesc}\n\n` +
                 `Recommended larger spaces:\n` +
                 `• Seminar Hall IET 32 (Approx. 200 seats)\n` +
                 `• Library (Approx. 150–180 seats)\n\n` +
                 `Do you want to proceed and approve this booking anyway?`,
        confirmLabel: 'Proceed & Approve Booking',
        cancelLabel: 'Change Room / Cancel',
        danger: true,
        onConfirm: () => {
          completeBooking(roomId, date, slotId, title, strength, audienceDesc, selectedSecs);
        },
      });
      return;
    }

    completeBooking(roomId, date, slotId, title, strength, audienceDesc, selectedSecs);
  }

  function adminDeleteBooking(id) {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const room = getRoom(booking.roomId);
    openConfirm({
      title: 'Delete this booking?',
      message: `Are you sure you want to delete the booking "${booking.title}" in ${room ? room.name : 'the room'} on ${formatDate(booking.date)}?\n\nThis will release the room slot immediately.`,
      confirmLabel: 'Delete Booking',
      cancelLabel: 'Keep Booking',
      danger: true,
      onConfirm: () => {
        const index = bookings.findIndex((b) => b.id === id);
        if (index !== -1) {
          bookings.splice(index, 1);
          saveBookings();
          seatReservations.forEach((r) => {
            if (r.bookingId === id) r.status = 'cancelled';
          });
          saveSeatReservations();
          toast(`Booking "${booking.title}" deleted successfully. Slot is now free.`, 'success');
          renderPage();
        }
      },
    });
  }

  function handleAdminDirectBookingSubmit(event) {
    event.preventDefault();
    const roomId = $('#adminBookRoom').value;
    const date = $('#adminBookDate').value;
    const slotId = $('#adminBookSlot').value;
    const title = $('#adminBookTitle').value.trim();
    const requester = ($('#adminBookRequester').value || 'Admin Direct Booking').trim();
    const room = getRoom(roomId);

    if (!room) return toast('Please select a room.', 'error');
    if (!slotId) return toast('Please pick a time slot.', 'error');
    if (!date || date < todayStr()) return toast('Please select today or a future date.', 'error');
    if (title.length < 3) return toast('Please enter a booking purpose.', 'error');

    const existing = findBooking(roomId, date, slotId);
    if (existing) {
      return toast(`That slot is already ${existing.status === 'pending' ? 'requested' : 'booked'} — "${existing.title}".`, 'error');
    }

    const selectedSecs = state.booking.selectedSections || [];
    if (selectedSecs.length === 0) {
      return toast('Please select at least one student section attending this session.', 'error');
    }

    const conflictErr = checkBookingConflicts({
      roomId,
      date,
      slotId,
      userId: state.user.id,
      selectedSections: selectedSecs,
    });
    if (conflictErr) {
      return toast(conflictErr.message, 'error');
    }

    const strength = calculateSelectedStrength(selectedSecs);
    const audienceDesc = formatAudienceDescription(selectedSecs);
    const slot = getSlot(slotId);
    const firstSec = selectedSecs[0] ? selectedSecs[0].split('-') : [];

    if (strength > room.capacity) {
      openConfirm({
        title: '⚠️ Room Capacity Warning',
        message: `The selected student strength (${strength} students) exceeds the room capacity of ${room.name} (${room.capacity} seats) by ${strength - room.capacity} students.\n\nAudience: ${audienceDesc}\n\nDo you want to proceed and approve this booking anyway?`,
        confirmLabel: 'Proceed & Create Booking',
        cancelLabel: 'Change Room / Cancel',
        danger: true,
        onConfirm: () => {
          bookings.push({
            id: `booking-${Date.now()}`,
            roomId,
            roomCode: room ? room.code : roomId,
            userId: state.user.id,
            facultyName: requester,
            facultyMobileNumber: null,
            title: `${title} (${requester})`,
            audience: audienceDesc,
            strength,
            date,
            timeSlotId: slotId,
            timeSlotIds: [slotId],
            startTime: slot ? slot.start : null,
            endTime: slot ? slot.end : null,
            academicYear: firstSec[0] ? parseInt(firstSec[0], 10) : 1,
            branchCode: firstSec[1] || 'CSE',
            section: firstSec[2] ? firstSec[2].toUpperCase() : 'A',
            selectedSections: selectedSecs,
            status: 'confirmed',
            recurring: false,
            createdAt: new Date().toISOString(),
          });
          saveBookings();
          toast(`Booking for "${room.name}" created successfully!`, 'success');
          renderPage();
        },
      });
      return;
    }

    bookings.push({
      id: `booking-${Date.now()}`,
      roomId,
      roomCode: room ? room.code : roomId,
      userId: state.user.id,
      facultyName: requester,
      facultyMobileNumber: null,
      title: `${title} (${requester})`,
      audience: audienceDesc,
      strength,
      date,
      timeSlotId: slotId,
      timeSlotIds: [slotId],
      startTime: slot ? slot.start : null,
      endTime: slot ? slot.end : null,
      academicYear: firstSec[0] ? parseInt(firstSec[0], 10) : 1,
      branchCode: firstSec[1] || 'CSE',
      section: firstSec[2] ? firstSec[2].toUpperCase() : 'A',
      selectedSections: selectedSecs,
      status: 'confirmed',
      recurring: false,
      createdAt: new Date().toISOString(),
    });
    saveBookings();
    toast(`Booking for "${room.name}" created successfully!`, 'success');
    renderPage();
  }

  function confirmCancelBooking(id) {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const room = getRoom(booking.roomId);
    openConfirm({
      title: 'Cancel this booking?',
      message: `“${booking.title}” in ${room ? room.name : 'the room'} on ${formatDate(booking.date)} will be released for others to book.`,
      confirmLabel: 'Cancel booking',
      danger: true,
      onConfirm: () => {
        booking.status = 'cancelled';
        saveBookings();
        renderPage();
        toast('Booking cancelled.', 'info');
      },
    });
  }

  function approveBooking(id) {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const clash = bookings.find(
      (item) =>
        item.id !== id &&
        item.roomId === booking.roomId &&
        item.date === booking.date &&
        item.timeSlotId === booking.timeSlotId &&
        item.status === 'confirmed'
    );
    if (clash) {
      return toast('Cannot approve — another confirmed booking already uses that slot.', 'error');
    }
    booking.status = 'confirmed';
    saveBookings();
    renderPage();
    toast('Booking approved.', 'success');
  }

  function rejectBooking(id) {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    booking.status = 'cancelled';
    saveBookings();
    renderPage();
    toast('Booking request rejected.', 'info');
  }

  function resolveConflict(id) {
    const conflict = conflicts.find((item) => item.id === id);
    if (!conflict) return;
    conflict.status = 'resolved';
    saveConflicts();
    renderPage();
    toast('Conflict marked as resolved.', 'success');
  }

  function handleConflictSubmit(event) {
    event.preventDefault();
    const roomId = $('#conflictRoom').value;
    const date = $('#conflictDate').value;
    const slotId = $('#conflictSlot').value;
    const description = $('#conflictDescription').value.trim();

    if (!roomId || !date || !slotId) return toast('Fill in the room, date and time slot.', 'error');
    if (description.length < 5) return toast('Please describe what happened.', 'error');

    const existing = findBooking(roomId, date, slotId);
    conflicts.unshift({
      id: `conflict-${Date.now()}`,
      roomId,
      date,
      timeSlotId: slotId,
      existingBookingId: existing ? existing.id : null,
      requestedById: state.user.id,
      description,
      status: 'reported',
      reportedAt: new Date().toISOString(),
    });
    saveConflicts();
    renderPage();
    toast('Conflict reported. The admin team has been notified.', 'info');
  }

  function refreshAvailability() {
    const card = $('#availabilityCard');
    if (card) card.outerHTML = renderAvailabilityCard();
    const chosen = getSlot(state.booking.slotId);
    const chosenEl = $('#chosenSlot');
    if (chosenEl) chosenEl.textContent = chosen ? chosen.label : 'Choose a slot →';
  }

  function refreshRoomResults() {
    const list = getFilteredRooms();
    const results = $('#roomResults');
    const count = $('#filterCount');
    const hasSlot = Boolean(state.filters.slotId && state.filters.slotId !== 'all');
    const slot = hasSlot ? getSlot(state.filters.slotId) : null;
    if (results) {
      results.innerHTML = list.length
        ? `<div class="room-grid">${list.map(renderRoomCard).join('')}</div>`
        : emptyState(
            hasSlot ? '⏰' : '🔍',
            hasSlot ? 'No rooms free at this time slot' : 'No rooms match your filters',
            hasSlot
              ? `All matching rooms are booked or unavailable during ${slot ? slot.label : 'this time slot'}. Try a different time slot or date.`
              : 'Try a different building, room type or search term.',
            hasSlot
              ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.DDUGU_APP.onRoomFilterChange('slotId', 'all'); const el = document.getElementById('filterSlot'); if (el) el.value = 'all';" style="margin-top:8px;">Clear Time Slot Filter</button>`
              : ''
          );
    }
    if (count) count.textContent = `${list.length} ${hasSlot ? 'free ' : ''}room${list.length === 1 ? '' : 's'}`;
  }

  function emptyState(iconText, title, message, action = '') {
    return `
      <div class="empty-state">
        <div class="empty-icon">${iconText}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${action}
      </div>`;
  }

  function normalizeSearchText(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/deeksha/g, 'diksha')
      .replace(/[\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getFilteredRooms() {
    const rawQuery = (state.filters.q || '').trim();
    const normalizedQuery = normalizeSearchText(rawQuery);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const { buildingId, type, capacity, slotId } = state.filters;
    const filterDate = state.filters.date || todayStr();

    const queryMentionsDiksha = normalizedQuery.includes('diksha') ||
      normalizedQuery.includes('db') ||
      /\blh\b/.test(normalizedQuery) ||
      /\blh\d+/.test(normalizedQuery) ||
      normalizedQuery.includes('lecture hall');

    const queryMentionsIet = /\biet\b/.test(normalizedQuery) || /\biet\d+/.test(normalizedQuery);

    return rooms.filter((room) => {
      const building = getBuilding(room.buildingId);
      const roomType = roomTypes[room.type];

      // Building filter: relax if query explicitly targets another campus building
      if (buildingId !== 'all') {
        if (queryMentionsDiksha && room.buildingId === 'deeksha-bhawan') {
          // Allow Diksha Bhawan room
        } else if (queryMentionsIet && room.buildingId === 'iet') {
          // Allow IET room
        } else if (room.buildingId !== buildingId) {
          return false;
        }
      }

      // Room type filter: relax if query explicitly searches for 'lh' / 'lecture hall'
      if (type !== 'all') {
        if (queryMentionsDiksha && (room.type === 'lecture-hall' || room.buildingId === 'deeksha-bhawan')) {
          // Allow
        } else if (room.type !== type) {
          return false;
        }
      }

      if (capacity !== 'any' && room.capacity < Number(capacity)) return false;

      // Time slot filter: only show rooms that are free at the selected time slot
      if (slotId && slotId !== 'all') {
        if (room.bookable === false) return false;
        const booking = findBooking(room.id, filterDate, slotId);
        if (booking && booking.status !== 'cancelled') return false;
      }

      if (!queryTokens.length) return true;

      const aliases = [];
      if (room.buildingId === 'deeksha-bhawan') {
        aliases.push('diksha', 'diksha bhawan', 'deeksha', 'deeksha bhawan', 'db', 'lh', 'lecture hall');
      } else if (room.buildingId === 'iet') {
        aliases.push('iet', 'engineering', 'institute of engineering and technology', 'institute of engineering & technology');
      }
      if (building && Array.isArray(building.aliases)) {
        aliases.push(...building.aliases);
      }

      const condensedLabel = (room.label || '').replace(/[\s\-_]/g, '').toLowerCase();
      const condensedName = (room.name || '').replace(/[\s\-_]/g, '').toLowerCase();
      const numMatch = (room.label || '').match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        if (room.buildingId === 'deeksha-bhawan') {
          aliases.push(`lh${num}`, `lh ${num}`, `lecture hall ${num}`);
        } else {
          aliases.push(`iet${num}`, `iet ${num}`);
        }
      }

      const haystack = normalizeSearchText([
        room.id,
        room.name,
        room.label,
        condensedLabel,
        condensedName,
        building ? building.name : '',
        building ? building.fullName : '',
        roomType ? roomType.name : '',
        ...aliases,
        ...room.equipment.map((item) => equipmentLabels[item] || item),
      ].join(' '));

      return queryTokens.every((token) => haystack.includes(token));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */
  function sortBookingsList(list) {
    return list
      .slice()
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          slotIndex(a.timeSlotId) - slotIndex(b.timeSlotId)
      );
  }

  function statCard(iconName, tone, value, label, hint) {
    return `
      <div class="stat-card ${tone}">
        <div class="stat-top">
          <div class="stat-icon">${icon(iconName, 20)}</div>
          <span class="stat-trend">${escapeHtml(hint)}</span>
        </div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${escapeHtml(label)}</div>
      </div>`;
  }

  function renderDashboard() {
    const user = state.user;
    const availableNow = rooms.filter((room) => roomStatus(room.id) === 'free').length;
    const myUpcoming = sortBookingsList(
      bookings.filter(
        (booking) =>
          booking.userId === user.id &&
          booking.status !== 'cancelled' &&
          booking.date >= todayStr()
      )
    );
    const myPending = bookings.filter(
      (booking) => booking.userId === user.id && booking.status === 'pending'
    ).length;
    const todayBookings = sortBookingsList(
      bookings.filter((booking) => booking.date === todayStr() && booking.status !== 'cancelled')
    );
    const openConflicts = conflicts.filter((conflict) => conflict.status === 'reported').length;
    const next = myUpcoming[0];
    const nextRoom = next ? getRoom(next.roomId) : null;
    const nextBuilding = nextRoom ? getBuilding(nextRoom.buildingId) : null;
    const nextSlot = next ? getSlot(next.timeSlotId) : null;
    const relevantAnnouncements = getRelevantAnnouncements().slice(0, 3);

    const hero = next
      ? `<h2>Up next: ${escapeHtml(next.title)}</h2>
         <p>${escapeHtml(nextRoom ? nextRoom.name : 'Room')} · ${escapeHtml(nextBuilding ? nextBuilding.name : '')} · ${escapeHtml(nextSlot ? nextSlot.label : '')} · ${formatRelative(next.date)}</p>`
      : user.role === 'student'
        ? `<h2>Your schedule is clear today</h2>
           <p>Explore the campus map, check room schedules, or reserve a seat for your upcoming classes and library sessions.</p>`
        : `<h2>Your schedule is clear today</h2>
           <p>Find a room on the interactive campus map or book a space for your next class, lab or study session.</p>`;

    const agenda = todayBookings.length
      ? todayBookings.slice(0, 6).map((booking) => {
          const room = getRoom(booking.roomId);
          const building = room ? getBuilding(room.buildingId) : null;
          const slot = getSlot(booking.timeSlotId);
          const booker = getUser(booking.userId);
          const bldgName = building ? building.name : '';
          const facultyLastName = booker ? firstName(booker.name) : (booking.facultyName ? firstName(booking.facultyName) : '');
          const activeResCount = seatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active').length;
          const capacity = room ? (room.capacity || 75) : 75;
          const showSeatCount = (state.user && (state.user.role === 'admin' || state.user.role === 'faculty')) && booking.status === 'confirmed';
          return `
            <div class="agenda-item" data-action="select-room" data-room-id="${booking.roomId}" role="button" tabindex="0">
              <span class="agenda-time">${slot ? `${slot.start}<br>${slot.end}` : '—'}</span>
              <span class="agenda-body">
                <strong>${escapeHtml(booking.title)}</strong>
                <small>${escapeHtml(room ? room.name : 'Room')} · ${escapeHtml(bldgName)} · ${escapeHtml(facultyLastName)}</small>
              </span>
              <div class="agenda-badges">
                ${showSeatCount ? `
                  <button type="button" class="badge badge-blue" data-action="view-booked-seats" data-booking-id="${booking.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:11px;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;" title="Click to view student reservations (${activeResCount}/${capacity} seats taken)">
                    🪑 ${activeResCount}/${capacity} Reserved
                  </button>
                ` : ''}
                ${statusBadge(booking.status)}
              </div>
            </div>`;
        }).join('')
      : emptyState('🌤️', 'A quiet day on campus', 'No rooms are booked today. Be the first to reserve one.');

    const announcementsPreview = relevantAnnouncements.length
      ? relevantAnnouncements.map((item) => `
          <button type="button" class="announcement-item" data-action="read-announcement" data-announcement-id="${item.id}">
            <span class="priority-dot ${item.priority}"></span>
            <span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.content)}</p>
              <time>${timeAgo(item.createdAt)}</time>
            </span>
          </button>`).join('')
      : emptyState('📭', 'No announcements', 'Campus updates will appear here.');

    return `
      <div class="page-head">
        <div>
          <h2>${greeting()}, ${escapeHtml(firstName(user.name))} 👋</h2>
          <p>${formatLongDate(todayStr())} · Here is what is happening across campus.</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="map">${icon('map', 16)} Campus map</button>
          ${user.role === 'student'
            ? `<button type="button" class="btn btn-primary" data-action="go" data-page="reserve-seat">${icon('chair', 16)} Reserve a Seat</button>`
            : `<button type="button" class="btn btn-primary" data-action="go" data-page="book">${icon('plus', 16)} New booking</button>`}
        </div>
      </div>

      <div class="stats-grid">
        ${statCard('building', '', availableNow, 'Rooms available now', `of ${rooms.length} rooms`)}
        ${statCard('clock', 'teal', myUpcoming.length, 'My upcoming bookings', myPending ? `${myPending} pending` : 'All confirmed')}
        ${statCard('calendar', 'amber', todayBookings.length, "Today's campus bookings", 'Live schedule')}
        ${statCard('alert', 'red', openConflicts, 'Open conflicts', openConflicts ? 'Needs attention' : 'All clear')}
      </div>

      ${user.role === 'student' ? `
        <!-- Student Profile Section -->
        <div class="card" style="margin-bottom:1rem;border-radius:14px;border:1px solid #e2e8f0;padding:22px 26px;background:#ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="width:52px;height:52px;border-radius:12px;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #c7d2fe;flex-shrink:0;">
                ${escapeHtml(user.avatar || '👨‍🎓')}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span class="badge badge-blue" style="font-weight:700;font-size:11px;">Student Profile</span>
                  <span style="font-size:12px;color:#64748b;">Academic Cohort & Personal Info</span>
                </div>
                <h3 style="margin:0 0 4px;font-size:1.15rem;font-weight:700;color:#0f172a;">${escapeHtml(user.name)}</h3>
                <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#475569;align-items:center;">
                  <span>🎓 Branch: <strong style="color:#0f172a;">${escapeHtml(user.branchCode || 'CSE')}</strong></span>
                  <span style="color:#cbd5e1;">•</span>
                  <span>🗓️ Year: <strong style="color:#0f172a;">${escapeHtml(formatYearLabel(user.academicYear || user.year || 3))}</strong></span>
                  <span style="color:#cbd5e1;">•</span>
                  <span>🏷️ Section: <strong style="color:#0f172a;">Section ${escapeHtml(user.section || 'A')}</strong></span>
                  ${user.rollNumber ? `<span style="color:#cbd5e1;">•</span><span>🆔 Roll: <strong>${escapeHtml(user.rollNumber)}</strong></span>` : ''}
                  ${user.phone ? `<span style="color:#cbd5e1;">•</span><span>📞 <strong>${escapeHtml(user.phone)}</strong></span>` : ''}
                </div>
              </div>
            </div>
            <div>
              <button type="button" class="btn btn-outline" onclick="event.preventDefault(); window.DDUGU_APP.openProfileModal();" data-action="open-profile-modal" style="display:inline-flex;align-items:center;gap:8px;padding:9px 18px;font-size:13.5px;font-weight:600;border-radius:8px;border:1.5px solid #cbd5e1;">
                ${icon('user', 15)} Edit Profile
              </button>
            </div>
          </div>
        </div>

        <!-- Student Change Login Credentials Section -->
        <div class="card" style="margin-bottom:1.75rem;border-radius:14px;border:1px solid #e2e8f0;padding:20px 24px;background:#ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span class="badge badge-green" style="font-weight:700;font-size:11px;">Student Profile Security</span>
                <span style="font-size:12px;color:#64748b;">Login & Account Credentials</span>
              </div>
              <h3 style="margin:0 0 4px;font-size:1.1rem;font-weight:700;color:#0f172a;">Change Login Credentials</h3>
              <p style="margin:0;font-size:13px;color:#475569;">
                Registered Student Email: <strong style="color:#0f172a;">${escapeHtml(user.email)}</strong>
              </p>
            </div>
            <div>
              <button type="button" class="btn btn-primary" onclick="event.preventDefault(); window.DDUGU_APP.openChangeCredentialsModal();" data-action="open-change-credentials" style="display:inline-flex;align-items:center;gap:8px;padding:9px 18px;font-size:13.5px;font-weight:600;border-radius:8px;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
                ${icon('key', 15)} Change Credentials
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="hero-card">
            <span class="hero-date">${icon('calendar', 14)} ${formatLongDate(todayStr())}</span>
            ${hero}
            <div class="hero-actions">
              <button type="button" class="btn btn-primary" data-action="go" data-page="map">${icon('pin', 15)} Explore the map</button>
              <button type="button" class="btn btn-outline" data-action="go" data-page="schedule">${icon('clock', 15)} ${user.role === 'admin' ? 'See schedule' : 'My schedule'}</button>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div>
                <h3>Today on campus</h3>
                <p>${todayBookings.length} active booking${todayBookings.length === 1 ? '' : 's'} today</p>
              </div>
              <button type="button" class="card-link" data-action="go" data-page="schedule">${user.role === 'admin' ? 'See schedule' : 'My schedule'} ${icon('arrowRight', 13)}</button>
            </div>
            <div class="agenda-list">${agenda}</div>
          </div>
        </div>

        <div class="dashboard-col">
          <div class="card">
            <div class="card-head">
              <div>
                <h3>Campus at a glance</h3>
                <p>Live room availability in both buildings</p>
              </div>
              <button type="button" class="card-link" data-action="go" data-page="map">Open map ${icon('arrowRight', 13)}</button>
            </div>
            ${buildings.map((building) => {
              const occ = occupancyFor(building.id);
              const pct = occ.total ? Math.round((occ.free / occ.total) * 100) : 100;
              return `
                <div class="building-highlight">
                  <div class="bh-head">
                    <div class="bh-title"><span>${building.icon}</span>${escapeHtml(building.name)}</div>
                    <span class="bh-count">${occ.free}/${occ.total} free now</span>
                  </div>
                  <div class="meter ${occ.busy > occ.total / 2 ? 'busy' : ''}"><span style="width:${pct}%"></span></div>
                  <div class="flex-between">
                    <span class="helper-text">${building.floors} floors · ${occ.total} rooms</span>
                    <button type="button" class="card-link" data-action="open-building" data-building="${building.id}">Explore ${icon('arrowRight', 13)}</button>
                  </div>
                </div>`;
            }).join('')}
            <div class="mini-map-wrap">
              <div class="mini-map">${renderMiniMap()}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div>
                <h3>Announcements</h3>
                <p>Latest campus updates</p>
              </div>
              <button type="button" class="card-link" data-action="go" data-page="announcements">View all</button>
            </div>
            <div class="announcement-list">${announcementsPreview}</div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Campus map page                                                     */
  /* ------------------------------------------------------------------ */
  function renderMapPage() {
    const isCampus = state.mapView === 'campus';
    const building = isCampus ? null : getBuilding(state.mapView);
    const legend = isCampus
      ? `<span class="map-image-note">${icon('search', 14)} Use + / − to zoom</span>`
      : `
      <div class="map-legend">
        <span class="legend-item"><i class="legend-swatch free"></i>Reservable</span>
        <span class="legend-item"><i class="legend-swatch busy"></i>In use</span>
        <span class="legend-item"><i class="legend-swatch pending"></i>Pending</span>
        <span class="legend-item"><i class="legend-swatch" style="background:#ef4444;border:1px solid #b91c1c;"></i>Non-reservable (NO RESERVATION)</span>
        <span class="legend-item"><i class="legend-swatch selected"></i>Selected</span>
      </div>`;

    const toggle = `
      <div class="map-view-toggle">
        <button type="button" data-action="map-back" class="${isCampus ? 'active' : ''}">Campus</button>
        ${buildings.map((item) => `
          <button type="button" data-action="open-building" data-building="${item.id}" class="${state.mapView === item.id ? 'active' : ''}">
            ${item.icon} ${item.name}
          </button>`).join('')}
      </div>`;

    const title = isCampus
      ? 'IET and Deeksha Bhawan maps'
      : `${building.name} · ${formatFloor(state.selectedFloor)}`;
    const subtitle = isCampus
      ? 'Both building map images, shown at their original aspect ratio'
      : 'Click any room to open its live schedule and book it';

    return `
      <div class="page-head">
        <div>
          <h2>Campus map</h2>
          <p>View both building maps, zoom in for detail, or open a building to find and book rooms.</p>
        </div>
        <div class="head-actions">${toggle}</div>
      </div>

      <div class="map-layout">
        <section class="map-card">
          <div class="map-card-head">
            <div>
              <h3>${isCampus ? icon('map', 17) : icon('building', 17)} ${escapeHtml(title)}</h3>
              <p>${escapeHtml(subtitle)}</p>
            </div>
            ${legend}
          </div>
          ${isCampus
            ? renderCampusMapImages()
            : renderFloorPlan(building)}
          <div class="map-hint">
            ${icon('pin', 15)}
            ${isCampus
              ? '<span><strong>Zoom and scroll</strong> to read each map, or open a building tab to browse its rooms and live availability.</span>'
              : '<span><strong>Click a room</strong> — it will glow and its schedule will open in the side panel.</span>'}
          </div>
        </section>

        <aside class="map-side" id="mapSidePanel">${renderSidePanel()}</aside>
      </div>`;
  }

  function campusTree(x, y, scale = 1) {
    return `
      <g transform="translate(${x} ${y}) scale(${scale})" aria-hidden="true">
        <ellipse cx="0" cy="13" rx="13" ry="5" fill="rgba(15,23,42,0.08)"/>
        <circle cx="-6" cy="-3" r="10" fill="#a7d8b7"/>
        <circle cx="6" cy="-4" r="9" fill="#b7e2c5"/>
        <circle cx="0" cy="-10" r="9" fill="#c3e9cf"/>
      </g>`;
  }

  function mapImageSrc(src) {
    return location.protocol === 'file:' ? src.replace(/^\/+/, '') : src;
  }

  function currentMapZoom(mapId) {
    const zoom = state.mapZoom && state.mapZoom[mapId];
    return MAP_ZOOM_STEPS.includes(zoom) ? zoom : 1;
  }

  function renderMapImageCard(building) {
    const image = building.mapImage;
    if (!image) return '';
    const zoom = currentMapZoom(building.id);
    const src = mapImageSrc(image.src);
    const name = escapeHtml(building.name);

    return `
      <article class="map-image-card" data-map-card="${building.id}">
        <div class="map-image-head">
          <div class="map-image-title">
            <span class="map-image-icon" aria-hidden="true">${building.icon}</span>
            <div>
              <h4>${name}</h4>
              <p>${escapeHtml(building.fullName !== building.name ? building.fullName : 'Campus map')}</p>
            </div>
          </div>
          <div class="map-zoom" role="group" aria-label="Zoom ${name} map">
            <button type="button" class="map-zoom-btn" data-action="map-zoom" data-map-id="${building.id}" data-zoom="out" aria-label="Zoom out ${name} map" title="Zoom out">${icon('minus', 16)}</button>
            <span class="map-zoom-level" data-map-zoom-level="${building.id}" aria-live="polite">${Math.round(zoom * 100)}%</span>
            <button type="button" class="map-zoom-btn" data-action="map-zoom" data-map-id="${building.id}" data-zoom="in" aria-label="Zoom in ${name} map" title="Zoom in">${icon('plus', 16)}</button>
            <button type="button" class="map-zoom-reset" data-action="map-zoom" data-map-id="${building.id}" data-zoom="reset" aria-label="Reset ${name} map zoom" title="Reset zoom" ${zoom === 1 ? 'disabled' : ''}>Reset</button>
          </div>
        </div>
        <div class="map-image-viewport" data-map-viewport="${building.id}" tabindex="0" role="group" aria-label="${name} map. Use the zoom controls, then scroll to explore.">
          <div class="map-image-canvas">
            <img class="map-image" data-map-img="${building.id}" src="${escapeHtml(src)}" width="${image.width}" height="${image.height}" alt="${name} map" loading="eager" decoding="async" draggable="false">
          </div>
        </div>
        <div class="map-image-foot">
          <span>Source image: ${image.width} × ${image.height} px</span>
          <a href="${escapeHtml(src)}" target="_blank" rel="noopener">Open full image ${icon('arrowRight', 13)}</a>
        </div>
      </article>`;
  }

  function renderCampusMapImages() {
    return `<div class="map-image-gallery">${buildings.map(renderMapImageCard).join('')}</div>`;
  }

  function applyMapZoom(mapId) {
    const building = getBuilding(mapId);
    const viewport = $(`[data-map-viewport="${mapId}"]`);
    const img = $(`[data-map-img="${mapId}"]`);
    if (!building || !building.mapImage || !viewport || !img) return;

    const zoom = currentMapZoom(mapId);
    const gutter = 24;
    const availableWidth = Math.max(80, viewport.clientWidth - gutter);
    const availableHeight = Math.max(80, viewport.clientHeight - gutter);
    const fit = Math.min(availableWidth / building.mapImage.width, availableHeight / building.mapImage.height);

    img.style.width = `${Math.max(1, Math.round(building.mapImage.width * fit * zoom))}px`;
    img.style.height = `${Math.max(1, Math.round(building.mapImage.height * fit * zoom))}px`;

    const level = $(`[data-map-zoom-level="${mapId}"]`);
    if (level) level.textContent = `${Math.round(zoom * 100)}%`;

    const out = $(`[data-action="map-zoom"][data-map-id="${mapId}"][data-zoom="out"]`);
    const reset = $(`[data-action="map-zoom"][data-map-id="${mapId}"][data-zoom="reset"]`);
    const zoomIn = $(`[data-action="map-zoom"][data-map-id="${mapId}"][data-zoom="in"]`);
    const index = MAP_ZOOM_STEPS.indexOf(zoom);
    if (out) out.disabled = index <= 0;
    if (zoomIn) zoomIn.disabled = index >= MAP_ZOOM_STEPS.length - 1;
    if (reset) reset.disabled = zoom === 1;
  }

  function changeMapZoom(mapId, direction) {
    if (!getBuilding(mapId)) return;
    const current = currentMapZoom(mapId);
    const index = MAP_ZOOM_STEPS.indexOf(current);
    let next = current;

    if (direction === 'reset') next = 1;
    else if (direction === 'in') next = MAP_ZOOM_STEPS[Math.min(MAP_ZOOM_STEPS.length - 1, index + 1)];
    else if (direction === 'out') next = MAP_ZOOM_STEPS[Math.max(0, index - 1)];

    state.mapZoom[mapId] = next;
    applyMapZoom(mapId);
  }

  function initMapViewers() {
    buildings.forEach((building) => {
      const img = $(`[data-map-img="${building.id}"]`);
      if (!img) return;
      applyMapZoom(building.id);
      if (!img.complete) {
        img.addEventListener('load', () => applyMapZoom(building.id), { once: true });
      }
    });
  }


  function renderMiniMap() {
    const ietOcc = occupancyFor('iet');
    const dbOcc = occupancyFor('deeksha-bhawan');
    return `
      <svg class="campus-map" viewBox="0 0 1000 470" role="img" aria-label="Mini campus map. Click IET or Deeksha Bhawan to open the full map.">
        <rect width="1000" height="470" rx="18" fill="#e9f5ec"/>
        <rect x="0" y="382" width="1000" height="52" fill="#f8fafc"/>
        <line x1="0" y1="408" x2="1000" y2="408" stroke="#dbe2ea" stroke-width="2" stroke-dasharray="16 14"/>
        <path d="M275 330 C275 370 340 392 430 410" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
        <path d="M730 330 C730 370 670 394 580 410" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
        ${campusTree(62, 80, 0.9)}
        ${campusTree(940, 90, 0.9)}

        <g class="campus-building" data-action="open-building" data-building="iet" tabindex="0" role="button" aria-label="Open IET floor plan">
          <rect class="b-body" x="95" y="105" width="345" height="210" rx="18"/>
          <rect class="b-roof" x="118" y="126" width="299" height="40" rx="9" fill="#bfdbfe"/>
          <text class="b-title" x="122" y="218" style="font-size:34px">IET</text>
          <text class="b-sub" x="122" y="242" style="font-size:15px">3 floors · ${ietOcc.total} rooms</text>
          <rect class="b-pill" x="122" y="258" width="190" height="26" rx="13"/>
          <text class="b-pill-text" x="217" y="275" text-anchor="middle" style="font-size:11px">${ietOcc.free} of ${ietOcc.total} free now</text>
        </g>

        <g class="campus-building" data-action="open-building" data-building="deeksha-bhawan" tabindex="0" role="button" aria-label="Open Deeksha Bhawan floor plan">
          <rect class="b-body" x="560" y="105" width="345" height="210" rx="18"/>
          <rect class="b-roof" x="583" y="126" width="299" height="40" rx="9" fill="#99f6e4"/>
          <text class="b-title" x="587" y="218" style="font-size:28px">Deeksha Bhawan</text>
          <text class="b-sub" x="587" y="242" style="font-size:15px">2 floors · ${dbOcc.total} rooms</text>
          <rect class="b-pill" x="587" y="258" width="190" height="26" rx="13"/>
          <text class="b-pill-text" x="682" y="275" text-anchor="middle" style="font-size:11px">${dbOcc.free} of ${dbOcc.total} free now</text>
        </g>

        <text x="500" y="452" text-anchor="middle" class="campus-caption" style="letter-spacing:.12em">TAP A BUILDING TO EXPLORE</text>
      </svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Floor plan                                                          */
  /* ------------------------------------------------------------------ */
  function roomShape(room) {
    if (!room || !room.coordinates) return '';
    const status = roomStatus(room.id);
    const selected = state.selectedRoomId === room.id;
    const coords = room.coordinates;
    const centerX = coords.x + coords.width / 2;
    const centerY = coords.y + coords.height / 2;
    const roomType = roomTypeOf(room);
    const statusText = status === 'free' ? 'free now' : status === 'pending' ? 'pending' : 'in use';
    const isNonBookable = room.bookable === false || ['iet-teachers-office', 'iet-placement-cell', 'iet-director-office'].includes(room.id);
    const roomSub = isNonBookable ? 'NO RESERVATION' : `${room.capacity} seats · ${statusText}`;

    let content = '';
    if (coords.height <= 56) {
      // Very wide compact horizontal rooms (LH 01, LH 02, LH 08, LH 09)
      content = `
        <text class="room-name" x="${centerX}" y="${centerY - 3}" text-anchor="middle" style="font-size:13.5px;font-weight:800;">
          ${roomType.icon} ${escapeHtml(room.name || room.label)}
        </text>
        <text class="room-sub ${isNonBookable ? 'non-reservable-label' : ''}" x="${centerX}" y="${centerY + 14}" text-anchor="middle" style="font-size:11px;font-weight:${isNonBookable ? '800' : '600'};fill:${isNonBookable ? '#dc2626' : '#64748b'};">
          ${roomSub}
        </text>`;
    } else if (coords.height <= 90) {
      // Medium rooms (LH 03, LH 04, LH 05, LH 06, LH 07, LH 10, LH 11, LH 12, LH 13, LH 14)
      content = `
        <text class="room-name" x="${centerX}" y="${centerY - 6}" text-anchor="middle" style="font-size:15px;font-weight:800;">
          ${roomType.icon} ${escapeHtml(room.name || room.label)}
        </text>
        <text class="room-sub ${isNonBookable ? 'non-reservable-label' : ''}" x="${centerX}" y="${centerY + 16}" text-anchor="middle" style="font-size:11.5px;font-weight:${isNonBookable ? '800' : '600'};fill:${isNonBookable ? '#dc2626' : '#64748b'};">
          ${roomSub}
        </text>`;
    } else {
      // Spacious / tall rooms (IET classrooms, Library, Offices, Seminar Hall)
      content = `
        <text class="room-icon" x="${centerX}" y="${centerY - 22}" text-anchor="middle" style="font-size:22px;">
          ${roomType.icon}
        </text>
        <text class="room-name" x="${centerX}" y="${centerY + 8}" text-anchor="middle" style="font-size:15px;font-weight:800;fill:${isNonBookable ? '#991b1b' : '#0f172a'};">
          ${escapeHtml(room.name || room.label)}
        </text>
        <text class="room-sub ${isNonBookable ? 'non-reservable-label' : ''}" x="${centerX}" y="${centerY + 28}" text-anchor="middle" style="font-size:11.5px;font-weight:${isNonBookable ? '800' : '600'};fill:${isNonBookable ? '#dc2626' : '#64748b'};">
          ${roomSub}
        </text>`;
    }

    return `
      <g class="room-shape ${isNonBookable ? 'non-reservable' : status} ${selected ? 'selected' : ''}"
         data-action="select-room" data-room-id="${room.id}" tabindex="0" role="button"
         aria-label="${escapeHtml(room.name)}${isNonBookable ? ', NO RESERVATION' : `, ${statusText}, ${room.capacity} seats`}">
        <title>${escapeHtml(room.name)}${isNonBookable ? ' — NO RESERVATION' : ` — ${statusText} — ${room.capacity} seats`}</title>
        <rect class="room-bg" x="${coords.x}" y="${coords.y}" width="${coords.width}" height="${coords.height}" rx="10"/>
        ${selected ? `<rect class="room-pulse" x="${coords.x + 2}" y="${coords.y + 2}" width="${coords.width - 4}" height="${coords.height - 4}" rx="9"/>` : ''}
        ${content}
      </g>`;
  }

  function renderFloorPlan(building) {
    const buildingFloors = Array.from(new Set(rooms.filter((room) => room.buildingId === building.id && !room.id.includes('lab-p') && !room.name.toLowerCase().includes('practical lab')).map((room) => room.floor))).sort((a, b) => a - b);
    if (!buildingFloors.includes(state.selectedFloor)) {
      state.selectedFloor = buildingFloors[0] !== undefined ? buildingFloors[0] : 0;
    }
    const floorRooms = rooms
      .filter((room) => room.buildingId === building.id && room.floor === state.selectedFloor && Boolean(room.coordinates) && !room.id.includes('lab-p') && !room.name.toLowerCase().includes('practical lab'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const tabs = buildingFloors.map((floor) => {
      return `<button type="button" class="floor-tab ${state.selectedFloor === floor ? 'active' : ''}" data-action="set-floor" data-floor="${floor}">${formatFloor(floor)}</button>`;
    }).join('');

    let architecturalMarkup = '';

    if (building.id === 'iet') {
      architecturalMarkup = `
        <!-- Central corridor -->
        <rect class="corridor" x="60" y="228" width="780" height="32" rx="6"/>
        <text class="corridor-label" x="80" y="249">CORRIDOR</text>
        <text class="corridor-label" x="760" y="249">CORRIDOR</text>

        <!-- Central stairs & entry/lobby column -->
        <g aria-hidden="true">
          <rect class="plan-amenity" x="408" y="90" width="84" height="125" rx="8"/>
          <text class="plan-amenity-text" x="450" y="145" text-anchor="middle">STAIRS</text>
          <text class="plan-amenity-text" x="450" y="162" text-anchor="middle">${state.selectedFloor === 0 ? 'UP' : 'DN / UP'}</text>

          <rect class="plan-amenity" x="408" y="270" width="84" height="125" rx="8"/>
          ${state.selectedFloor === 0 ? `
            <text class="plan-amenity-text" x="450" y="325" text-anchor="middle">ENTRY</text>
            <text class="plan-amenity-text" x="450" y="342" text-anchor="middle">GATE ⬆</text>
          ` : `
            <text class="plan-amenity-text" x="450" y="325" text-anchor="middle">LOBBY</text>
            <text class="plan-amenity-text" x="450" y="342" text-anchor="middle">HALL</text>
          `}
        </g>`;
    } else if (building.id === 'deeksha-bhawan') {
      architecturalMarkup = `
        <!-- Deeksha Bhawan Blueprint Amenities -->
        <g aria-hidden="true">
          <!-- Washrooms on the left -->
          <rect class="plan-amenity" x="70" y="144" width="115" height="110" rx="8"/>
          <text class="plan-amenity-text" x="127" y="195" text-anchor="middle">🚻 WASHROOM</text>

          <!-- Drinking Water near LH 04 & LH 05 -->
          <rect class="plan-amenity" x="590" y="218" width="60" height="50" rx="6"/>
          <text class="plan-amenity-text" x="620" y="247" text-anchor="middle">🚰 WATER</text>

          <!-- Central Stairs -->
          <rect class="plan-amenity" x="390" y="305" width="130" height="85" rx="6"/>
          <text class="plan-amenity-text" x="455" y="342" text-anchor="middle">STAIRS</text>
          <text class="plan-amenity-text" x="455" y="360" text-anchor="middle">${state.selectedFloor === 0 ? 'UP' : 'DN / UP'}</text>

          ${state.selectedFloor === 0 ? `
            <!-- Entry Gate -->
            <text class="plan-amenity-text" x="250" y="425" text-anchor="middle" style="font-size:12px;font-weight:800;fill:#2563eb;">⬆ ENTRY GATE</text>
          ` : ''}

          <!-- Walking Corridors -->
          <text class="corridor-label" x="85" y="300">CORRIDOR</text>
          <text class="corridor-label" x="750" y="300">CORRIDOR</text>
        </g>`;
    }

    return `
      <div class="floor-head">
        <div class="floor-title">${building.icon} ${escapeHtml(building.name)} <span class="floor-tag">${floorRooms.length} room${floorRooms.length === 1 ? '' : 's'}</span></div>
        <div class="floor-tabs">${tabs}</div>
      </div>
      <div class="floor-stage">
        <svg class="floor-map" viewBox="0 0 900 520" role="img" aria-label="${escapeHtml(building.name)} ${formatFloor(state.selectedFloor)} plan">
          <rect x="18" y="18" width="864" height="484" rx="22" fill="#eef4fb"/>
          <rect class="building-slab" x="45" y="55" width="810" height="410" rx="14"/>
          <rect class="floor-accent" x="60" y="70" width="780" height="380" rx="10"/>
          <text class="plan-amenity-text" x="68" y="98">${escapeHtml(building.name.toUpperCase())} · ${formatFloor(state.selectedFloor).toUpperCase()}</text>
          ${architecturalMarkup}
          ${floorRooms.map(roomShape).join('')}
        </svg>
      </div>
      <div class="map-hint">
        ${icon('pin', 15)}
        <span><strong>Click a room</strong> to make it glow and open its live schedule.</span>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Map side panel                                                      */
  /* ------------------------------------------------------------------ */
  function renderSidePanel() {
    const room = state.selectedRoomId ? getRoom(state.selectedRoomId) : null;
    if (room) return renderRoomPanel(room);
    const building = state.mapView !== 'campus' ? getBuilding(state.mapView) : null;
    if (building) return renderBuildingPanel(building);
    return renderCampusPanel();
  }

  function renderCampusPanel() {
    return `
      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-eyebrow">${icon('map', 14)} Campus map</div>
          <h2 class="panel-title">Two buildings, one click away</h2>
          <p class="text-muted">IET and Deeksha Bhawan share this interactive campus view. Pick a building to see every floor and room.</p>
        </div>
        <div class="panel-body">
          <div class="room-list-mini">
            ${buildings.map((building) => {
              const occ = occupancyFor(building.id);
              return `
                <button type="button" class="mini-room" data-action="open-building" data-building="${building.id}">
                  <span style="font-size:1.25rem;line-height:1">${building.icon}</span>
                  <span class="mini-room-main">
                    <strong>${escapeHtml(building.name)}</strong>
                    <small>${occ.total} rooms · ${building.floors} floors · ${occ.free} free now</small>
                  </span>
                  ${icon('arrowRight', 16)}
                </button>`;
            }).join('')}
          </div>
          <div class="panel-divider"></div>
          <div class="panel-note">
            <span>💡</span>
            <div><strong>Reading the maps:</strong> use the zoom controls on each image, then scroll to explore the detail. Open a building tab to browse its rooms and schedule a booking.</div>
          </div>
        </div>
      </div>`;
  }

  function renderBuildingPanel(building) {
    const occupancy = occupancyFor(building.id);
    const buildingRooms = rooms
      .filter((room) => room.buildingId === building.id && Boolean(room.coordinates) && !room.id.includes('lab-p') && !room.name.toLowerCase().includes('practical lab'))
      .sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));

    return `
      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-eyebrow">${building.icon} Building overview</div>
          <h2 class="panel-title">${escapeHtml(building.fullName)}</h2>
          <p class="text-muted">${escapeHtml(building.description)}</p>
          <div class="room-meta" style="margin-top:13px">
            <span class="meta-pill">${building.floors} floors</span>
            <span class="meta-pill">${occupancy.total} rooms</span>
            <span class="meta-pill">${occupancy.free} free now</span>
          </div>
        </div>
        <div class="panel-body">
          <div class="schedule-head">
            <h3>Rooms in this building</h3>
            <span class="badge ${occupancy.free ? 'badge-green' : 'badge-red'}">${occupancy.free} available</span>
          </div>
          <div class="room-list-mini">
            ${buildingRooms.map((room) => {
              const status = roomStatus(room.id);
              const roomSub = room.bookable === false
                ? `${formatFloor(room.floor)} · Non-reservable Office`
                : `${formatFloor(room.floor)} · ${room.capacity} seats · ${STATUS_LABEL[status]}`;
              return `
                <button type="button" class="mini-room" data-action="select-room" data-room-id="${room.id}">
                  <span class="mini-room-dot ${room.bookable === false ? 'office' : status}"></span>
                  <span class="mini-room-main">
                    <strong>${escapeHtml(room.name)}</strong>
                    <small>${roomSub}</small>
                  </span>
                  ${icon('arrowRight', 16)}
                </button>`;
            }).join('')}
          </div>
          <div class="panel-divider"></div>
          <div class="panel-note">
            <span>🗺️</span>
            <div>Use the floor tabs above the plan to move between floors, or click a room on the plan to see its schedule.</div>
          </div>
        </div>
      </div>`;
  }

  function renderRoomPanel(room) {
    const building = getBuilding(room.buildingId);
    const roomType = roomTypeOf(room);
    const liveStatus = roomStatus(room.id);
    const date = state.roomDate || todayStr();
    const nowSlot = currentSlotId();
    const canBook = date >= todayStr();
    const isStudent = state.user && state.user.role === 'student';
    const isLibrary = room.type === 'library' || room.id === 'iet-library';

    const dayBookings = bookings.filter(
      (booking) =>
        (booking.roomId === room.id || booking.roomCode === room.label || booking.roomCode === room.name) &&
        booking.date === date &&
        booking.status !== 'cancelled'
    );

    const rows = timeSlots.map((slot) => {
      const booking = dayBookings.find((item) => item.timeSlotId === slot.id || (Array.isArray(item.timeSlotIds) && item.timeSlotIds.includes(slot.id)));
      const isNow = date === todayStr() && slot.id === nowSlot;

      if (isStudent) {
        if (isLibrary) {
          const capacity = room.capacity || 180;
          const slotRes = seatReservations.filter((r) =>
            r.status === 'active' &&
            (r.roomId === room.id || (booking && r.bookingId === booking.id)) &&
            (r.date === date || (booking && booking.date === date)) &&
            (r.timeSlotId === slot.id || (booking && booking.timeSlotId === slot.id))
          );
          const reservedCount = slotRes.length;
          const availableCount = Math.max(0, capacity - reservedCount);
          const myRes = slotRes.find((r) => r.studentUserId === state.user.id);

          return `
            <div class="slot-row ${isNow ? 'now' : ''}">
              <span class="slot-time">${slot.start}<br>${slot.end}</span>
              <div class="slot-info">
                <strong>${booking ? escapeHtml(booking.title) : 'Library Reading & Study Space'}</strong>
                <small style="color:${availableCount > 0 ? '#059669' : '#dc2626'};font-weight:600;">
                  ${availableCount} of ${capacity} seats free (${reservedCount} reserved)
                </small>
                ${myRes ? `<small style="color:#2563eb;font-weight:700;">✓ Your Reserved Seat: ${escapeHtml(myRes.seatNumber)}</small>` : ''}
              </div>
              <div class="slot-action">
                ${myRes ? `
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="badge badge-green" style="font-size:11px;">Reserved</span>
                    <button type="button" class="btn btn-sm btn-outline btn-danger" data-action="cancel-seat-reservation" data-reservation-id="${myRes.id}" style="padding:2px 7px;font-size:11px;">Cancel</button>
                  </div>
                ` : availableCount > 0 && canBook ? `
                  <button type="button" class="btn btn-sm btn-primary" data-action="quick-reserve-library-seat" data-room-id="${room.id}" data-slot-id="${slot.id}" data-date="${date}" ${booking ? `data-booking-id="${booking.id}"` : ''}>
                    ${icon('chair', 13)} Reserve Seat
                  </button>
                ` : `
                  <span class="badge badge-grey" style="font-size:11px;">${availableCount === 0 ? 'Full' : 'Past'}</span>
                `}
              </div>
            </div>`;
        }

        // Student viewing ANY other room: Read-Only!
        if (booking) {
          const faculty = getUser(booking.userId);
          const facultyName = faculty ? faculty.name : 'Faculty Member';
          return `
            <div class="slot-row ${isNow ? 'now' : ''}">
              <span class="slot-time">${slot.start}<br>${slot.end}</span>
              <div class="slot-info">
                <strong>${escapeHtml(booking.title)}</strong>
                <small style="color:#334155;">👨‍🏫 Faculty: <strong>${escapeHtml(facultyName)}</strong></small>
                <small style="color:#64748b;">🗓️ ${formatDate(date)} · ${slot.start} – ${slot.end}</small>
              </div>
              <div class="slot-action" style="display:flex;align-items:center;gap:6px;">
                ${((state.user && (state.user.role === 'admin' || state.user.role === 'faculty')) && booking.status === 'confirmed') ? `
                  <button type="button" class="badge badge-blue" data-action="view-booked-seats" data-booking-id="${booking.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:11px;padding:3px 7px;border-radius:5px;" title="Click to view student reservations">
                    🪑 ${seatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active').length}/${room.capacity || 75} Reserved
                  </button>
                ` : ''}
                ${statusBadge(booking.status)}
              </div>
            </div>`;
        }

        if (room.bookable === false) {
          return `
            <div class="slot-row ${isNow ? 'now' : ''}">
              <span class="slot-time">${slot.start}<br>${slot.end}</span>
              <div class="slot-info">
                <strong style="color:#64748b">Office / Staff Use</strong>
                <small>Administrative space — non-reservable</small>
              </div>
              <div class="slot-action">
                <span class="badge badge-grey" style="font-size:11px;">Restricted</span>
              </div>
            </div>`;
        }

        return `
          <div class="slot-row ${isNow ? 'now' : ''}">
            <span class="slot-time">${slot.start}<br>${slot.end}</span>
            <div class="slot-info">
              <strong style="color:#059669">Free</strong>
              <small>No scheduled classes or faculty bookings</small>
            </div>
            <div class="slot-action">
              <span class="badge badge-slate" style="font-size:11px;padding:3px 8px;">Available</span>
            </div>
          </div>`;
      }

      if (booking) {
        const booker = getUser(booking.userId);
        const bookerName = booking.userId === state.user.id ? 'You' : booker ? firstName(booker.name) : 'Someone';
        return `
          <div class="slot-row ${isNow ? 'now' : ''}">
            <span class="slot-time">${slot.start}<br>${slot.end}</span>
            <div class="slot-info">
              <strong>${escapeHtml(booking.title)}</strong>
              <small>${escapeHtml(bookerName)}${booking.status === 'pending' ? ' · awaiting approval' : ''}</small>
            </div>
            <div class="slot-action" style="display:flex;align-items:center;gap:6px;">
              ${((state.user && (state.user.role === 'admin' || state.user.role === 'faculty')) && booking.status === 'confirmed') ? `
                <button type="button" class="badge badge-blue" data-action="view-booked-seats" data-booking-id="${booking.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:11px;padding:3px 7px;border-radius:5px;" title="Click to view student reservations">
                  🪑 ${seatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active').length}/${room.capacity || 75} Reserved
                </button>
              ` : ''}
              ${statusBadge(booking.status)}
            </div>
          </div>`;
      }

      if (room.bookable === false) {
        return `
          <div class="slot-row ${isNow ? 'now' : ''}">
            <span class="slot-time">${slot.start}<br>${slot.end}</span>
            <div class="slot-info">
              <strong style="color:#64748b">Office / Staff Use</strong>
              <small>Administrative space — non-reservable</small>
            </div>
            <div class="slot-action">
              <span class="slot-free" style="color:#94a3b8;font-size:11px;">Restricted</span>
            </div>
          </div>`;
      }

      return `
        <div class="slot-row ${isNow ? 'now' : ''}">
          <span class="slot-time">${slot.start}<br>${slot.end}</span>
          <div class="slot-info">
            <strong style="color:#059669">Free</strong>
            <small>${isNow ? 'Available right now' : canBook ? 'Open for booking' : 'Past slot'}</small>
          </div>
          <div class="slot-action">
            ${canBook
              ? `<button type="button" class="btn btn-outline" data-action="quick-book" data-room-id="${room.id}" data-slot-id="${slot.id}" data-date="${date}">Book</button>`
              : '<span class="slot-free">Past</span>'}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-eyebrow">${building ? building.icon : ''} ${escapeHtml(building ? building.name : '')} · ${formatFloor(room.floor)}</div>
          <div class="panel-title-row">
            <h2 class="panel-title">${escapeHtml(room.name)}</h2>
            <span class="status-pill ${room.bookable === false ? 'office' : liveStatus}">${room.bookable === false ? 'Office' : STATUS_LABEL[liveStatus]}</span>
          </div>
          <div class="room-meta">
            ${room.bookable !== false ? `<span class="meta-pill">${icon('users', 13)} ${room.capacity} seats</span>` : '<span class="meta-pill" style="background:#fef3c7;color:#92400e;font-weight:700;">🔒 Non-reservable</span>'}
            <span class="meta-pill">${roomType.icon} ${roomType.name}</span>
            <span class="meta-pill">${escapeHtml(room.label)}</span>
          </div>
          <div class="equipment-chips">
            ${room.equipment.map((item) => `<span class="equipment-chip">${escapeHtml(equipmentLabels[item] || item)}</span>`).join('')}
            ${room.features.map((item) => `<span class="equipment-chip">${escapeHtml(featureLabels[item] || item)}</span>`).join('')}
          </div>
        </div>
        <div class="panel-body">
          <div class="schedule-head">
            <h3>${icon('calendar', 16)} Schedule</h3>
            <input type="date" id="roomScheduleDate" class="schedule-date" value="${date}" aria-label="Choose schedule date">
          </div>
          <div class="slot-list">${rows}</div>
        </div>
        <div class="panel-sticky">
          ${isStudent ? (
            isLibrary ? `
              <button type="button" class="btn btn-primary" data-action="go" data-page="reserve-seat" style="width:100%;">
                ${icon('chair', 16)} Browse Scheduled Lectures & Seats
              </button>
            ` : `
              <div style="background:#f8fafc;color:#64748b;padding:0.7rem;border-radius:8px;font-size:0.83rem;font-weight:600;text-align:center;border:1px dashed #cbd5e1;">
                ℹ️ Classroom Schedule (Read-Only) · Room booking restricted to Faculty & Admin
              </div>
            `
          ) : room.bookable !== false ? `
            <button type="button" class="btn btn-primary" data-action="book-room" data-room-id="${room.id}">
              ${icon('calendar', 16)} Book this room
            </button>
          ` : `
            <div style="background:#f8fafc;color:#64748b;padding:0.65rem;border-radius:8px;font-size:0.83rem;font-weight:600;text-align:center;border:1px dashed #cbd5e1;">
              🔒 Administrative space — not available for general reservation
            </div>
          `}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Room directory                                                      */
  /* ------------------------------------------------------------------ */
  function renderRoomsPage() {
    const list = getFilteredRooms();
    const typeOptions = Object.entries(roomTypes)
      .map(([id, type]) => `<option value="${id}" ${state.filters.type === id ? 'selected' : ''}>${type.icon} ${type.name}</option>`)
      .join('');

    return `
      <div class="page-head">
        <div>
          <h2>Room directory</h2>
          <p>Browse every bookable space across IET and Deeksha Bhawan.</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="map">${icon('map', 16)} Map view</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search', 18)}
          <input type="search" id="roomSearch" class="search-input" placeholder="Search rooms, buildings or equipment…" value="${escapeHtml(state.filters.q)}">
        </div>
        <select id="filterBuilding" aria-label="Filter by building">
          <option value="all">All buildings</option>
          ${buildings.map((building) => `<option value="${building.id}" ${state.filters.buildingId === building.id ? 'selected' : ''}>${building.icon} ${building.name}</option>`).join('')}
        </select>
        <select id="filterType" aria-label="Filter by room type">
          <option value="all">All room types</option>
          ${typeOptions}
        </select>
        <select id="filterCapacity" aria-label="Filter by capacity">
          <option value="any" ${state.filters.capacity === 'any' ? 'selected' : ''}>Any capacity</option>
          <option value="30" ${state.filters.capacity === '30' ? 'selected' : ''}>30+ seats</option>
          <option value="50" ${state.filters.capacity === '50' ? 'selected' : ''}>50+ seats</option>
          <option value="100" ${state.filters.capacity === '100' ? 'selected' : ''}>100+ seats</option>
        </select>
        <select id="filterSlot" aria-label="Filter by time slot" onchange="window.DDUGU_APP.onRoomFilterChange('slotId', this.value);">
          <option value="all" ${(!state.filters.slotId || state.filters.slotId === 'all') ? 'selected' : ''}>⏰ All time slots</option>
          ${timeSlots.map((slot) => `<option value="${slot.id}" ${state.filters.slotId === slot.id ? 'selected' : ''}>⏰ ${slot.start} – ${slot.end}</option>`).join('')}
        </select>
        <input type="date" id="filterDate" class="filter-date-input" value="${state.filters.date || todayStr()}" aria-label="Date for time slot availability" title="Date for time slot availability" onchange="window.DDUGU_APP.onRoomFilterChange('date', this.value);" style="padding:9px 10px;border:1.5px solid var(--line);border-radius:var(--radius-sm);background:#fff;font-size:0.82rem;color:var(--ink-2);min-width:130px;${state.filters.slotId && state.filters.slotId !== 'all' ? 'border-color:var(--brand);box-shadow:0 0 0 1px var(--brand);' : ''}">
        <span class="filter-count" id="filterCount">${list.length} ${state.filters.slotId && state.filters.slotId !== 'all' ? 'free ' : ''}room${list.length === 1 ? '' : 's'}</span>
      </div>

      <div id="roomResults">
        ${list.length
          ? `<div class="room-grid">${list.map(renderRoomCard).join('')}</div>`
          : emptyState(
              state.filters.slotId && state.filters.slotId !== 'all' ? '⏰' : '🔍',
              state.filters.slotId && state.filters.slotId !== 'all' ? 'No rooms free at this time slot' : 'No rooms match your filters',
              state.filters.slotId && state.filters.slotId !== 'all'
                ? `All matching rooms are booked or unavailable during ${getSlot(state.filters.slotId)?.label || 'this time slot'}. Try a different time slot or date.`
                : 'Try a different building, room type or search term.',
              state.filters.slotId && state.filters.slotId !== 'all'
                ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.DDUGU_APP.onRoomFilterChange('slotId', 'all'); const el = document.getElementById('filterSlot'); if (el) el.value = 'all';" style="margin-top:8px;">Clear Time Slot Filter</button>`
                : ''
            )}
      </div>`;
  }

  function renderRoomCard(room) {
    const building = getBuilding(room.buildingId);
    const roomType = roomTypeOf(room);
    const hasSlotFilter = Boolean(state.filters.slotId && state.filters.slotId !== 'all');
    const filterDate = state.filters.date || todayStr();
    const filterSlot = hasSlotFilter ? getSlot(state.filters.slotId) : null;
    const status = hasSlotFilter
      ? roomStatus(room.id, filterDate, state.filters.slotId)
      : roomStatus(room.id);
    const statusInfo = status === 'free'
      ? ['badge-green', hasSlotFilter ? `Free · ${filterSlot ? filterSlot.start : 'Slot'}` : 'Available now']
      : status === 'pending'
        ? ['badge-amber', 'Pending']
        : ['badge-red', 'In use'];

    const equipmentChips = room.equipment.slice(0, 4)
      .map((item) => `<span class="equipment-chip">${escapeHtml(equipmentLabels[item] || item)}</span>`)
      .join('');
    const extra = room.equipment.length > 4
      ? `<span class="equipment-chip">+${room.equipment.length - 4}</span>`
      : '';

    const bookSlotId = hasSlotFilter ? state.filters.slotId : '';
    const bookDate = hasSlotFilter ? filterDate : '';

    return `
      <article class="room-card">
        <div class="room-card-head">
          <div class="room-type-icon ${room.type}">${roomType.icon}</div>
          <div>
            <h3>${escapeHtml(room.name)}</h3>
            <p>${escapeHtml(building ? building.name : '')} · ${formatFloor(room.floor)}</p>
          </div>
          <span class="badge ${statusInfo[0]}">${statusInfo[1]}</span>
        </div>
        <div class="room-card-body">
          <div class="room-facts">
            ${room.bookable !== false ? `<span class="fact">${icon('users', 12)} ${room.capacity} seats</span>` : '<span class="fact" style="color:#b45309;font-weight:700;">🔒 Non-reservable</span>'}
            <span class="fact">${roomType.icon} ${roomType.name}</span>
            <span class="fact">${escapeHtml(room.label)}</span>
          </div>
          <div class="equipment-chips">${equipmentChips}${extra}</div>
        </div>
        <div class="room-card-foot">
          <button type="button" class="btn btn-outline" data-action="select-room" data-room-id="${room.id}">View schedule</button>
          ${state.user && state.user.role === 'student' ? (
            (room.type === 'library' || room.id === 'iet-library')
              ? `<button type="button" class="btn btn-primary" data-action="select-room" data-room-id="${room.id}">${icon('chair', 14)} Reserve Seat</button>`
              : (room.bookable === false ? '<span class="badge badge-slate" style="align-self:center;">Non-reservable</span>' : '')
          ) : (
            room.bookable !== false
              ? `<button type="button" class="btn btn-primary" data-action="book-room" data-room-id="${room.id}" data-slot-id="${bookSlotId}" data-date="${bookDate}">Book</button>`
              : '<span class="badge badge-slate" style="align-self:center;">Non-reservable</span>'
          )}
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Booking page                                                        */
  /* ------------------------------------------------------------------ */
  function renderBookPage() {
    ensureBookingDraft();
    const draft = state.booking;
    const building = getBuilding(draft.buildingId) || buildings[0];
    const buildingRooms = rooms.filter((room) => room.buildingId === building.id && room.bookable !== false);
    const room = (getRoom(draft.roomId) && getRoom(draft.roomId).bookable !== false) ? getRoom(draft.roomId) : buildingRooms[0];
    const chosenSlot = getSlot(draft.slotId);
    const approvalNote = state.user.role === 'student'
      ? 'Student bookings are sent to an administrator for approval. You will see them under My Schedule as Pending.'
      : 'Faculty and administrator bookings are confirmed instantly, as long as the slot is free.';

    const currentYear = draft.academicYear || '';
    const currentBranchFilter = draft.branchFilter || '';
    const selectedSections = Array.isArray(draft.selectedSections) ? draft.selectedSections : [];
    const totalStrength = calculateSelectedStrength(selectedSections);
    const roomCapacity = room ? room.capacity : 75;
    const isOverflow = totalStrength > roomCapacity;
    const overflowCount = totalStrength - roomCapacity;

    const effectiveYear = currentYear || '1';
    const allSections = getAllSections();
    const visibleSections = allSections.filter((s) => {
      const matchYear = s.yearId === effectiveYear;
      const matchBranch = !currentBranchFilter || currentBranchFilter === 'all' || s.branchId === currentBranchFilter;
      return matchYear && matchBranch;
    });

    const sectionCards = visibleSections.map((s) => {
      const isSelected = selectedSections.includes(s.id);
      return `
        <button type="button" class="section-pill ${isSelected ? 'active' : ''}" data-action="toggle-section" data-section-id="${s.id}"
          style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.75rem;border-radius:8px;border:1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#eff6ff' : '#ffffff'};cursor:pointer;font-size:0.83rem;font-weight:${isSelected ? '700' : '500'};color:${isSelected ? '#1e40af' : '#334155'};min-width:140px;text-align:left;transition:all 0.15s ease;">
          <span>${isSelected ? '☑ ' : '☐ '} ${escapeHtml(s.branchName)} ${s.sectionName ? `(${s.sectionName})` : ''}</span>
          <span style="background:${isSelected ? '#2563eb' : '#f1f5f9'};color:${isSelected ? '#ffffff' : '#64748b'};padding:2px 7px;border-radius:12px;font-size:0.75rem;font-weight:700;">${s.strength}</span>
        </button>`;
    }).join('');

    const selectedBadges = selectedSections.map((id) => {
      const match = allSections.find((s) => s.id === id);
      const name = match ? match.shortLabel : id;
      const str = match ? match.strength : 75;
      return `<span style="background:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:6px;font-size:0.78rem;font-weight:600;display:inline-flex;align-items:center;gap:5px;">
        ${escapeHtml(name)} (${str})
        <span data-action="toggle-section" data-section-id="${id}" style="cursor:pointer;font-weight:800;color:#4f46e5;" title="Remove">×</span>
      </span>`;
    }).join(' ');

    return `
      <div class="page-head">
        <div>
          <h2>Book a room</h2>
          <p>Reserve a space — it will appear on your schedule immediately.</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="map">${icon('map', 16)} Pick on the map</button>
        </div>
      </div>

      <div class="booking-layout">
        <form id="bookingForm" class="card form-card">
          <div class="card-head">
            <div>
              <h3>Reservation details</h3>
              <p>All fields marked * are required</p>
            </div>
            <span class="badge badge-blue">${escapeHtml(state.user.role)}</span>
          </div>
          <div class="card-body">
            <div class="field">
              <label for="bookBuilding">Building <span class="req">*</span></label>
              <select id="bookBuilding" name="buildingId">
                ${buildings.map((item) => `<option value="${item.id}" ${draft.buildingId === item.id ? 'selected' : ''}>${item.icon} ${escapeHtml(item.name)}</option>`).join('')}
              </select>
            </div>

            <div class="field">
              <label for="bookRoom">Room <span class="req">*</span></label>
              <select id="bookRoom" name="roomId">
                ${buildingRooms.map((r) => `<option value="${r.id}" ${draft.roomId === r.id ? 'selected' : ''}>${escapeHtml(r.name)} — ${r.capacity} seats, ${formatFloor(r.floor)}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="field">
                <label for="bookDate">Date <span class="req">*</span></label>
                <input type="date" id="bookDate" name="date" min="${todayStr()}" value="${draft.date}">
              </div>
              <div class="field">
                <label>Selected time slot</label>
                <div class="meta-pill" id="chosenSlot" style="min-height:42px">${chosenSlot ? escapeHtml(chosenSlot.label) : 'Choose a slot →'}</div>
              </div>
            </div>

            <!-- Academic Audience & Student Strength Section (IET) -->
            <div class="field" style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:1rem;margin:0.5rem 0;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
                <div>
                  <label style="font-weight:700;color:#1e293b;font-size:0.95rem;display:flex;align-items:center;gap:6px;margin-bottom:0.15rem;">
                    🎓 Student Audience & Strength (IET) <span class="req">*</span>
                  </label>
                  <span class="helper-text" style="font-size:0.8rem;color:#64748b;">
                    Select Year, Branch, and Section(s) attending this class or event.
                  </span>
                </div>
                <div style="text-align:right;">
                  <span class="badge ${isOverflow ? 'badge-red' : 'badge-green'}" style="font-size:0.82rem;padding:4px 10px;font-weight:700;">
                    ${totalStrength} Students / ${roomCapacity} Seats
                  </span>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
                <div>
                  <label for="bookAcademicYear" style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:0.25rem;">Academic Year</label>
                  <select id="bookAcademicYear" style="width:100%;padding:0.45rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;background:white;">
                    <option value="" ${!currentYear ? 'selected' : ''}>Choose</option>
                    ${academic.years.map((y) => `<option value="${y.id}" ${currentYear === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label for="bookAcademicBranchFilter" style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:0.25rem;">Filter by Branch</label>
                  <select id="bookAcademicBranchFilter" style="width:100%;padding:0.45rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;background:white;">
                    <option value="" ${!currentBranchFilter ? 'selected' : ''}>Choose</option>
                    <option value="all" ${currentBranchFilter === 'all' ? 'selected' : ''}>All Branches (6 Branches)</option>
                    ${academic.branches.map((b) => `<option value="${b.id}" ${currentBranchFilter === b.id ? 'selected' : ''}>${b.name} (${b.totalStrength} students)</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="margin-bottom:0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
                  <span style="font-size:0.78rem;font-weight:600;color:#475569;">Available Sections for Selection (Multiple Allowed):</span>
                  <div style="display:flex;gap:0.4rem;">
                    ${currentBranchFilter && currentBranchFilter !== 'all' ? `
                      <button type="button" class="btn btn-sm btn-outline" data-action="select-all-branch-sections" data-branch="${currentBranchFilter}" style="padding:2px 8px;font-size:11px;">Select Whole ${currentBranchFilter}</button>
                    ` : ''}
                    <button type="button" class="btn btn-sm btn-outline" data-action="clear-all-sections" style="padding:2px 8px;font-size:11px;">Clear All</button>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                  ${sectionCards}
                </div>
              </div>

              <!-- Selected Audience Summary & Capacity Comparison Bar -->
              <div style="background:${isOverflow ? '#fff1f2' : '#f0fdf4'};border:1.5px solid ${isOverflow ? '#fecdd3' : '#bbf7d0'};border-radius:8px;padding:0.75rem;margin-top:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">
                  <div>
                    <strong style="color:${isOverflow ? '#9f1239' : '#166534'};font-size:0.85rem;display:flex;align-items:center;gap:5px;">
                      ${isOverflow ? '⚠️ Capacity Overflow Alert' : '✅ Room Capacity Fits Comfortably'}
                    </strong>
                    <div style="font-size:0.8rem;color:${isOverflow ? '#be123c' : '#15803d'};margin-top:3px;">
                      Total Student Strength: <strong>${totalStrength} students</strong> · Room: <strong>${escapeHtml(room.name)} (${roomCapacity} seats)</strong>
                    </div>
                    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
                      ${selectedBadges || '<span style="color:#64748b;font-size:0.8rem;">No sections selected. Click pills above to add.</span>'}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge ${isOverflow ? 'badge-red' : 'badge-green'}" style="font-size:0.85rem;padding:3px 9px;">
                      ${isOverflow ? `+${overflowCount} Overflow` : `${roomCapacity - totalStrength} seats free`}
                    </span>
                  </div>
                </div>
                ${isOverflow ? `
                  <div style="font-size:0.78rem;color:#b91c1c;margin-top:8px;padding-top:6px;border-top:1px dashed #fecdd3;display:flex;align-items:flex-start;gap:6px;">
                    <span>⚠️</span>
                    <span><strong>Warning:</strong> The selected audience size (${totalStrength} students) exceeds room capacity (${roomCapacity} seats). If you confirm, an overflow warning window will appear to approve this reservation. For 150+ students, consider booking <strong>Seminar Hall IET 32 (200 seats)</strong> or the <strong>Library (180 seats)</strong>.</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="field">
              <label for="bookTitle">Purpose <span class="req">*</span></label>
              <input type="text" id="bookTitle" name="title" maxlength="80" placeholder="e.g. Data Structures lecture" value="${escapeHtml(draft.title)}">
              <span class="helper-text">A short title helps others identify the booking.</span>
            </div>

            <div class="info-banner">
              <span>${state.user.role === 'student' ? '⏳' : '✅'}</span>
              <div>${escapeHtml(approvalNote)}</div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                ${icon('calendar', 16)} ${state.user.role === 'student' ? 'Submit request' : 'Confirm booking'}
              </button>
              <button type="button" class="btn" data-action="go" data-page="schedule">My schedule</button>
            </div>
          </div>
        </form>

        ${renderAvailabilityCard()}
      </div>`;
  }

  function renderAvailabilityCard() {
    const draft = state.booking;
    const room = getRoom(draft.roomId);
    const date = draft.date || todayStr();

    if (!room) {
      return `
        <div class="card availability-card" id="availabilityCard">
          <div class="card-head"><div><h3>Availability</h3><p>Choose a room to see open slots</p></div></div>
          <div class="card-body">${emptyState('📅', 'No room selected', 'Pick a building and room to view its availability.')}</div>
        </div>`;
    }

    const building = getBuilding(room.buildingId);
    const dayBookings = bookings.filter(
      (booking) =>
        booking.roomId === room.id &&
        booking.date === date &&
        booking.status !== 'cancelled'
    );
    const freeCount = timeSlots.length - dayBookings.length;

    const chips = timeSlots.map((slot) => {
      const booking = dayBookings.find((item) => item.timeSlotId === slot.id);
      if (booking) {
        const booker = getUser(booking.userId);
        const label = booking.status === 'pending' ? 'Pending' : 'Booked';
        return `
          <button type="button" class="slot-chip busy" disabled
            title="${escapeHtml(booking.title)}${booker ? ` — ${escapeHtml(firstName(booker.name))}` : ''}">
            <span class="chip-time">${slot.start} – ${slot.end}</span>
            <span class="chip-state">${label}</span>
          </button>`;
      }
      const isSelected = draft.slotId === slot.id;
      return `
        <button type="button" class="slot-chip free ${isSelected ? 'selected' : ''}" data-action="select-slot" data-slot-id="${slot.id}">
          <span class="chip-time">${slot.start} – ${slot.end}</span>
          <span class="chip-state">${isSelected ? 'Selected' : 'Available'}</span>
        </button>`;
    }).join('');

    return `
      <div class="card availability-card" id="availabilityCard">
        <div class="card-head">
          <div>
            <h3>Availability</h3>
            <p>${formatLongDate(date)}</p>
          </div>
          <span class="badge ${freeCount ? 'badge-green' : 'badge-red'}">${freeCount} of ${timeSlots.length} free</span>
        </div>
        <div class="card-body">
          <div class="selected-room-summary">
            <div class="room-type-icon ${room.type}">${roomTypeOf(room).icon}</div>
            <div>
              <strong>${escapeHtml(room.name)}</strong>
              <small>${escapeHtml(building ? building.name : '')} · ${formatFloor(room.floor)} · ${room.capacity} seats</small>
            </div>
            <span class="badge badge-blue" style="margin-left:auto">${escapeHtml(room.label)}</span>
          </div>

          <div class="legend-inline">
            <span><i class="free"></i>Available</span>
            <span><i class="busy"></i>Booked / pending</span>
          </div>

          <div class="slot-grid">${chips}</div>

          <p class="helper-text">
            ${draft.slotId
              ? `Selected slot: <strong>${escapeHtml((getSlot(draft.slotId) || {}).label || '')}</strong>`
              : 'Select a free time slot to continue.'}
          </p>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* My schedule                                                         */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Booked Seats Modal (Admin & Faculty)                                */
  /* ------------------------------------------------------------------ */
  function openBookedSeatsModal(bookingId) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const room = getRoom(booking.roomId);
    const bldg = room ? getBuilding(room.buildingId) : null;
    const slot = getSlot(booking.timeSlotId);
    const capacity = room ? room.capacity : 75;
    const activeRes = seatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active');

    const rows = activeRes.length
      ? activeRes.map((r, idx) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0f172a;">
            ${idx + 1}. ${escapeHtml(r.studentName)}
            <br><small style="color:#64748b;font-size:11px;">ID: ${escapeHtml(r.studentUserId)}</small>
          </td>
          <td style="padding:10px 12px;font-size:13px;color:#334155;">
            <span class="badge badge-blue" style="font-size:11px;">${formatYearLabel(r.academicYear)} · ${escapeHtml(r.branchCode)} · Sec ${escapeHtml(r.section)}</span>
          </td>
          <td style="padding:10px 12px;font-size:13px;">
            <span class="badge badge-green" style="font-weight:700;font-size:12px;padding:3px 8px;">🪑 ${escapeHtml(r.seatNumber)}</span>
          </td>
          <td style="padding:10px 12px;font-size:12px;color:#64748b;">
            ${timeAgo(r.reservedAt)}
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="padding:28px;text-align:center;color:#64748b;font-size:13px;">No student reservations yet (0 of ${capacity} seats taken).</td></tr>`;

    const modalContent = `
      <div style="margin-bottom:16px;">
        <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:14px;">
          <h4 style="margin:0 0 6px;color:#0f172a;font-size:15px;font-weight:700;">${escapeHtml(booking.title)}</h4>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:#475569;">
            <span>🏢 <strong>${escapeHtml(room ? room.name : 'Room')}</strong> ${bldg ? `(${escapeHtml(bldg.name)})` : ''}</span>
            <span>📅 <strong>${formatDate(booking.date)}</strong></span>
            <span>⏰ <strong>${slot ? `${slot.start} – ${slot.end}` : ''}</strong></span>
            <span>🪑 <strong>${activeRes.length} of ${capacity}</strong> Seats Reserved</span>
          </div>
        </div>

        <div style="max-height:360px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:700;">
                <th style="padding:10px 12px;">Student</th>
                <th style="padding:10px 12px;">Cohort</th>
                <th style="padding:10px 12px;">Seat</th>
                <th style="padding:10px 12px;">Reserved</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-outline" data-modal-close>Close</button>
        </div>
      </div>
    `;

    openCustomModal({
      title: 'Student Seat Reservations',
      content: modalContent,
      maxWidth: '620px',
    });
  }

  function renderSchedulePage() {
    const user = state.user;
    const isAdmin = user && user.role === 'admin';
    const isStudent = user && user.role === 'student';

    if (isAdmin) {
      state.adminScheduleFilter = state.adminScheduleFilter || { date: '', facultyId: 'all', branch: 'all' };
      const filter = state.adminScheduleFilter;

      // Extract all faculty members
      const facultyMap = new Map();
      users.filter((u) => u.role === 'faculty').forEach((f) => facultyMap.set(f.id, f.name));
      bookings.forEach((b) => {
        if (b.userId && !facultyMap.has(b.userId)) {
          facultyMap.set(b.userId, b.facultyName || b.userId);
        } else if (!b.userId && b.facultyName && !facultyMap.has(b.facultyName)) {
          facultyMap.set(b.facultyName, b.facultyName);
        }
      });
      const sortedFaculty = Array.from(facultyMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

      // Extract all branches
      const branchSet = new Set();
      academic.branches.forEach((b) => branchSet.add(b.name));
      bookings.forEach((b) => {
        if (b.branchCode) branchSet.add(b.branchCode);
      });
      const sortedBranches = Array.from(branchSet).sort();

      // Filter all faculty bookings
      let allFacultyBookings = bookings.slice();
      if (filter.date) {
        allFacultyBookings = allFacultyBookings.filter((b) => b.date === filter.date);
      }
      if (filter.facultyId && filter.facultyId !== 'all') {
        allFacultyBookings = allFacultyBookings.filter((b) =>
          b.userId === filter.facultyId ||
          b.facultyName === filter.facultyId ||
          (getUser(b.userId) && (getUser(b.userId).id === filter.facultyId || getUser(b.userId).name === filter.facultyId))
        );
      }
      if (filter.branch && filter.branch !== 'all') {
        const target = filter.branch.toLowerCase().replace(/[^a-z0-9]/g, '');
        allFacultyBookings = allFacultyBookings.filter((b) => {
          const bCode = String(b.branchCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const bAud = String(b.audienceDesc || b.audience || b.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return bCode.includes(target) || bAud.includes(target) || target.includes(bCode);
        });
      }

      const sortedBookings = sortBookingsList(allFacultyBookings);
      const activeCount = sortedBookings.filter((b) => b.status !== 'cancelled').length;
      const todayCount = sortedBookings.filter((b) => b.date === todayStr() && b.status !== 'cancelled').length;
      const pendingCount = sortedBookings.filter((b) => b.status === 'pending').length;

      const dates = Array.from(new Set(sortedBookings.map((b) => b.date)));
      const upcomingDates = dates.filter((d) => d >= todayStr()).sort();
      const pastDates = dates.filter((d) => d < todayStr()).sort().reverse();
      const orderedDates = [...upcomingDates, ...pastDates];

      const groups = orderedDates.map((date) => {
        const dayBookings = sortedBookings.filter((b) => b.date === date);
        const rows = dayBookings.map((b) => {
          const room = getRoom(b.roomId);
          const bldg = room ? getBuilding(room.buildingId) : null;
          const slot = getSlot(b.timeSlotId);
          const faculty = getUser(b.userId);
          const facultyName = faculty ? faculty.name : (b.facultyName || 'Faculty Member');
          const activeSeats = seatReservations.filter((r) => r.bookingId === b.id && r.status === 'active');
          const cap = room ? room.capacity : 75;

          return `
            <div class="booking-row ${b.status}" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f1f5f9;background:#fff;gap:14px;flex-wrap:wrap;">
              <div class="booking-time" style="width:115px;flex-shrink:0;">
                <strong style="display:block;font-size:13px;color:#0f172a;">${slot ? `${slot.start} – ${slot.end}` : (b.startTime && b.endTime ? `${b.startTime} – ${b.endTime}` : '—')}</strong>
                <small style="color:#64748b;font-size:11.5px;">${formatDate(b.date)}</small>
              </div>
              <div class="booking-main" style="flex:1;min-width:220px;">
                <strong style="display:block;font-size:14.5px;color:#0f172a;margin-bottom:4px;">${escapeHtml(b.title)}</strong>
                <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#475569;align-items:center;">
                  <span>👨‍🏫 Faculty: <strong style="color:#1e293b;">${escapeHtml(facultyName)}</strong></span>
                  <span style="color:#cbd5e1;">•</span>
                  <span>🏢 ${escapeHtml(room ? room.name : 'Room')} (${escapeHtml(bldg ? bldg.name : '')} · ${room ? formatFloor(room.floor) : ''})</span>
                  <span style="color:#cbd5e1;">•</span>
                  <span class="badge badge-blue" style="font-size:11px;">🎓 ${formatYearLabel(b.academicYear)} · ${escapeHtml(b.branchCode || 'All')} · Sec ${escapeHtml(b.section || 'All')}</span>
                  ${b.batch || b.audienceDesc ? `<span style="color:#94a3b8;font-size:11.5px;">(${escapeHtml(b.batch || b.audienceDesc)})</span>` : ''}
                </div>
              </div>
              <div class="booking-side" style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                ${b.status === 'confirmed' ? `
                  <button type="button" class="badge" data-action="view-booked-seats" data-booking-id="${b.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:12px;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;" title="Click to view student reservations (${activeSeats.length}/${cap} seats taken)">
                    🪑 ${activeSeats.length}/${cap} Reserved
                  </button>
                ` : ''}
                ${statusBadge(b.status)}
                ${b.status === 'pending' ? `
                  <button type="button" class="btn btn-sm btn-primary" data-action="approve-booking" data-booking-id="${b.id}" style="padding:4px 9px;font-size:12px;">Approve</button>
                  <button type="button" class="btn btn-sm btn-outline" data-action="reject-booking" data-booking-id="${b.id}" style="padding:4px 9px;font-size:12px;">Reject</button>
                ` : ''}
                <button type="button" class="btn btn-sm btn-danger" data-action="admin-delete-booking" data-booking-id="${b.id}" style="background:#ef4444;color:white;border:none;padding:4px 10px;font-size:12px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;" title="Delete this booking permanently">
                  ${icon('trash', 12)} Delete
                </button>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="day-group" style="margin-bottom:1.25rem;">
            <div class="day-heading" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px 10px 0 0;">
              <h3 style="margin:0;font-size:14px;color:#1e293b;display:flex;align-items:center;gap:8px;">
                ${icon('calendar', 15)} ${formatRelative(date)} <span style="font-weight:400;color:#64748b;font-size:13px;">(${formatDate(date)})</span>
              </h3>
              <span class="badge ${date === todayStr() ? 'badge-blue' : 'badge-slate'}">${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}</span>
            </div>
            <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">
              ${rows}
            </div>
          </div>`;
      }).join('');

      const hasActiveFilters = filter.date || filter.facultyId !== 'all' || filter.branch !== 'all';

      return `
        <div class="page-head">
          <div>
            <h2>See Schedule</h2>
            <p>All scheduled classes and bookings by faculty members across campus</p>
          </div>
          <div class="head-actions">
            <button type="button" class="btn btn-outline" data-action="go" data-page="bookings">${icon('calendar', 16)} Oversee Bookings</button>
            <button type="button" class="btn btn-outline" data-action="go" data-page="map">${icon('map', 16)} Campus Map</button>
            <button type="button" class="btn btn-primary" data-action="go" data-page="book">${icon('plus', 16)} New Booking</button>
          </div>
        </div>

        <div class="stats-grid" style="margin-bottom:1.25rem;">
          ${statCard('calendar', 'blue', activeCount, 'Matching Classes', 'Faculty schedule')}
          ${statCard('check', 'teal', todayCount, "Today's Classes", todayStr())}
          ${statCard('clock', pendingCount ? 'amber' : 'green', pendingCount, 'Pending Requests', pendingCount ? 'Needs review' : 'All approved')}
          ${statCard('users', 'violet', sortedFaculty.length, 'Faculty Members', 'Teaching cohorts')}
        </div>

        <!-- Filter Card: Date, Faculty Member, Branch -->
        <div class="card" style="margin-bottom:1.5rem;padding:18px 20px;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;box-shadow:0 2px 8px rgba(15,23,42,0.03);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;">🔍</span>
              <strong style="font-size:14px;color:#0f172a;">Filter Faculty Schedule</strong>
              <span style="font-size:12px;color:#64748b;">(Filter by Date, Faculty Member, or Branch)</span>
            </div>
            ${hasActiveFilters ? `
              <button type="button" class="btn btn-sm btn-outline" data-action="clear-admin-schedule-filters" onclick="window.DDUGU_APP.clearAdminScheduleFilters();" style="padding:4px 10px;font-size:12px;color:#ef4444;border-color:#fca5a5;cursor:pointer;">
                ✕ Clear All Filters
              </button>
            ` : ''}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;align-items:flex-end;">
            <!-- Date Filter -->
            <div>
              <label for="adminScheduleDate" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">
                🗓️ Filter by Date
              </label>
              <div style="display:flex;gap:6px;align-items:center;">
                <input type="date" id="adminScheduleDate" value="${filter.date || ''}" onchange="window.DDUGU_APP.onAdminScheduleFilterChange('date', this.value);" style="flex:1;padding:7px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <button type="button" class="btn btn-sm ${filter.date === todayStr() ? 'btn-primary' : 'btn-outline'}" data-action="set-admin-schedule-today" onclick="window.DDUGU_APP.onAdminScheduleFilterChange('date', '${todayStr()}');" style="padding:7px 10px;font-size:12px;white-space:nowrap;cursor:pointer;">Today</button>
                ${filter.date ? `<button type="button" class="btn btn-sm btn-outline" data-action="clear-admin-schedule-date" onclick="window.DDUGU_APP.onAdminScheduleFilterChange('date', '');" style="padding:7px 8px;font-size:12px;color:#64748b;cursor:pointer;" title="Clear date filter">✕</button>` : ''}
              </div>
            </div>

            <!-- Faculty Member Filter -->
            <div>
              <label for="adminScheduleFaculty" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">
                👨‍🏫 Filter by Faculty Member
              </label>
              <select id="adminScheduleFaculty" onchange="window.DDUGU_APP.onAdminScheduleFilterChange('facultyId', this.value);" style="width:100%;padding:7.5px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="all" ${filter.facultyId === 'all' ? 'selected' : ''}>All Faculty Members (${sortedFaculty.length})</option>
                ${sortedFaculty.map(([id, name]) => `<option value="${escapeHtml(id)}" ${filter.facultyId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
              </select>
            </div>

            <!-- Branch Filter -->
            <div>
              <label for="adminScheduleBranch" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">
                🎓 Filter by Branch
              </label>
              <select id="adminScheduleBranch" onchange="window.DDUGU_APP.onAdminScheduleFilterChange('branch', this.value);" style="width:100%;padding:7.5px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="all" ${filter.branch === 'all' ? 'selected' : ''}>All Branches (${sortedBranches.length})</option>
                ${sortedBranches.map((br) => `<option value="${escapeHtml(br)}" ${filter.branch === br ? 'selected' : ''}>${escapeHtml(br)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        ${sortedBookings.length
          ? `<div class="schedule-groups">${groups}</div>`
          : `<div class="card" style="padding:32px 20px;border-radius:12px;text-align:center;">
              ${emptyState(
                '📅',
                'No faculty bookings match your filters',
                hasActiveFilters ? 'Try clearing or modifying your Date, Faculty Member, or Branch filters.' : 'No faculty bookings found in the schedule.',
                hasActiveFilters ? `<button type="button" class="btn btn-outline" data-action="clear-admin-schedule-filters" onclick="window.DDUGU_APP.clearAdminScheduleFilters();">Reset Filters</button>` : ''
              )}
            </div>`}
      `;
    }

    const hiddenBookings = getHiddenBookings(user.id);
    const mine = sortBookingsList(bookings.filter((booking) => booking.userId === user.id && !hiddenBookings.includes(booking.id)));
    const active = mine.filter((booking) => booking.status !== 'cancelled');
    const pending = active.filter((booking) => booking.status === 'pending').length;
    const upcoming = active.filter((booking) => booking.date >= todayStr()).length;

    const dates = Array.from(new Set(mine.map((booking) => booking.date)));
    const upcomingDates = dates.filter((date) => date >= todayStr()).sort();
    const pastDates = dates.filter((date) => date < todayStr()).sort().reverse();
    const orderedDates = [...upcomingDates, ...pastDates];

    const groups = orderedDates.map((date) => {
      const dayBookings = mine.filter((booking) => booking.date === date);
      const rows = dayBookings.map((booking) => {
        const room = getRoom(booking.roomId);
        const building = room ? getBuilding(room.buildingId) : null;
        const slot = getSlot(booking.timeSlotId);
        const canCancel = booking.status !== 'cancelled' && booking.date >= todayStr();
        const activeSeats = seatReservations.filter((r) => r.bookingId === booking.id && r.status === 'active');
        const capacity = room ? room.capacity : 75;
        const reservedCount = activeSeats.length;
        const isAdminOrFaculty = state.user && (state.user.role === 'admin' || state.user.role === 'faculty');
        const reservationBadge = (isAdminOrFaculty && booking.status === 'confirmed') ? `
          <button type="button" class="badge" data-action="view-booked-seats" data-booking-id="${booking.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:12px;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s;" title="Click to view student reservations (${reservedCount}/${capacity} seats reserved)">
            🪑 ${reservedCount}/${capacity} Reserved
          </button>
        ` : '';
        return `
          <div class="booking-row ${booking.status}">
            <div class="booking-time">
              <strong>${slot ? `${slot.start} – ${slot.end}` : '—'}</strong>
              <small>${formatDate(booking.date)}</small>
            </div>
            <div class="booking-main">
              <strong>${escapeHtml(booking.title)}</strong>
              <small>${escapeHtml(room ? room.name : 'Room')} · ${escapeHtml(building ? building.name : '')} · ${room ? formatFloor(room.floor) : '—'}</small>
            </div>
            <div class="booking-side" style="display:flex;align-items:center;gap:8px;">
              ${reservationBadge}
              ${statusBadge(booking.status)}
              ${canCancel ? `<button type="button" class="btn btn-sm btn-danger" data-action="cancel-booking" data-booking-id="${booking.id}">Cancel</button>` : ''}
              ${booking.status === 'cancelled' ? `
                <button type="button" class="btn btn-sm btn-outline" data-action="hide-cancelled-booking" data-booking-id="${booking.id}" style="font-size:11px;padding:3px 8px;color:#64748b;border-color:#cbd5e1;" title="Remove this cancelled booking from your history">
                  ${icon('trash', 12)} Remove from History
                </button>
              ` : ''}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="day-group">
          <div class="day-heading">
            <h3>${icon('calendar', 15)} ${formatRelative(date)} <span class="day-date">${formatDate(date)}</span></h3>
            <span class="badge ${date === todayStr() ? 'badge-blue' : 'badge-slate'}">${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');

    return `
      <div class="page-head">
        <div>
          <h2>My schedule</h2>
          <p>${upcoming} upcoming · ${pending} awaiting approval · ${active.length} active booking${active.length === 1 ? '' : 's'}</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="map">${icon('map', 16)} Find a room</button>
          ${isStudent ? `
            <button type="button" class="btn btn-primary" data-action="go" data-page="reserve-seat">${icon('chair', 16)} Reserve a Seat</button>
          ` : `
            <button type="button" class="btn btn-primary" data-action="go" data-page="book">${icon('plus', 16)} New booking</button>
          `}
        </div>
      </div>

      ${mine.length
        ? `<div class="schedule-groups">${groups}</div>`
        : `<div class="card">${emptyState(
            '📅',
            'No bookings yet',
            isStudent ? 'Check eligible lectures or browse the library schedule to reserve seats.' : 'Reserve a room from the map or directory and it will show up here.',
            isStudent
              ? `<button type="button" class="btn btn-primary" data-action="go" data-page="reserve-seat">${icon('chair', 16)} Reserve a Seat</button>`
              : `<button type="button" class="btn btn-primary" data-action="go" data-page="book">${icon('plus', 16)} Book your first room</button>`
          )}</div>`}`;
  }

  /* ------------------------------------------------------------------ */
  /* Announcements                                                       */
  /* ------------------------------------------------------------------ */
  function renderAnnouncementsPage() {
    const list = getRelevantAnnouncements();
    const priorityLabels = { high: 'High priority', medium: 'Update', low: 'Info' };
    const canCreate = state.user && (state.user.role === 'admin' || state.user.role === 'faculty');

    const cards = list.map((item) => {
      const author = getUser(item.authorId);
      const isCreator = item.authorId === state.user.id;

      // Audience badge formatting
      let audienceBadge = '';
      if (!item.audienceType || item.audienceType === 'all') {
        audienceBadge = `<span class="audience-chip" style="background:#dbeafe;color:#1e40af;font-weight:700;">👥 All Faculty & Students</span>`;
      } else if (item.audienceType === 'selected_faculty') {
        audienceBadge = `<span class="audience-chip" style="background:#f3e8ff;color:#6b21a8;font-weight:700;">👨‍🏫 Selected Faculty</span>`;
      } else if (item.audienceType === 'selected_students') {
        const yrText = item.targetAcademicYear ? `${formatYearLabel(item.targetAcademicYear)} ` : '';
        const brText = item.targetBranchCode || 'All Branches';
        const secText = item.targetSection ? ` Sec ${item.targetSection}` : '';
        audienceBadge = `<span class="audience-chip" style="background:#dcfce7;color:#166534;font-weight:700;">🎓 ${escapeHtml(yrText + brText + secText)}</span>`;
      }

      return `
        <article class="announcement-card ${item.priority}">
          <div class="announcement-head">
            <span class="priority-tag ${item.priority}">${priorityLabels[item.priority] || item.priority}</span>
            <div class="audience-chips">
              ${audienceBadge}
            </div>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.content)}</p>
          <div class="announcement-meta" style="flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;">
            <div>
              <span>📢 By <strong>${escapeHtml(item.creatorName || (author ? author.name : 'Administration'))}</strong> (${escapeHtml(item.authorRole || (author ? author.role : 'Staff'))})</span>
              <span> · ${timeAgo(item.createdAt)}</span>
              ${item.expiryDate ? `<span style="margin-left:8px;color:#d97706;font-size:11.5px;font-weight:600;">⏳ Expires: ${formatShortDate(item.expiryDate)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              ${state.readAnnouncements.includes(item.id) ? `
                <button type="button" class="btn btn-sm btn-outline" data-action="hide-announcement" data-announcement-id="${item.id}" style="padding:3px 8px;font-size:11px;color:#64748b;border-color:#cbd5e1;" title="Remove this announcement from your personal view">
                  ${icon('trash', 12)} Remove from My View
                </button>
              ` : ''}
              ${(isCreator || state.user.role === 'admin') ? `
                <button type="button" class="btn btn-sm btn-danger" data-action="delete-announcement" data-announcement-id="${item.id}" style="padding:3px 8px;font-size:11px;" title="${state.user.role === 'admin' && !isCreator ? 'Delete announcement (Admin privilege)' : 'Delete this announcement'}">
                  ${icon('ban', 12)} Delete
                </button>
              ` : ''}
            </div>
          </div>
        </article>`;
    }).join('');

    return `
      <div class="page-head">
        <div>
          <h2>Announcements</h2>
          <p>${state.user.role === 'student' ? 'Official announcements targeted to your cohort.' : 'Campus notices and departmental broadcasts.'}</p>
        </div>
        <div class="head-actions" style="display:flex;gap:8px;">
          ${canCreate ? `
            <button type="button" class="btn btn-primary" data-action="open-create-announcement">
              ${icon('plus', 16)} New Announcement
            </button>
          ` : ''}
          <button type="button" class="btn btn-outline" data-action="mark-all-read">${icon('check', 16)} Mark all as read</button>
        </div>
      </div>
      ${list.length
        ? `<div class="announcement-grid">${cards}</div>`
        : `<div class="card">${emptyState('📭', 'No announcements', 'There are no announcements for you right now.')}</div>`}`;
  }

  function openCreateAnnouncementModal() {
    const facultyList = users.filter((u) => u.role === 'faculty');
    const facultyCheckboxes = facultyList.map((f) => `
      <label class="faculty-select-item" data-faculty-item="${escapeHtml(f.name.toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:12.5px;">
        <input type="checkbox" name="targetFaculty" value="${escapeHtml(f.id)}" style="cursor:pointer;">
        <span><strong>${escapeHtml(f.name)}</strong> (${escapeHtml(f.department || 'Faculty')})</span>
      </label>
    `).join('');

    const content = `
      <form id="createAnnouncementForm" onsubmit="event.preventDefault(); window.DDUGU_APP.handleAnnouncementSubmit(event);">
        <div class="field" style="margin-bottom:12px;">
          <label for="annTitle" style="font-weight:600;display:block;margin-bottom:4px;">Title <span class="req" style="color:#ef4444;">*</span></label>
          <input type="text" id="annTitle" required maxlength="150" placeholder="e.g. Schedule Revision for CSE 2nd Year" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label for="annMessage" style="font-weight:600;display:block;margin-bottom:4px;">Message / Description <span class="req" style="color:#ef4444;">*</span></label>
          <textarea id="annMessage" required rows="4" placeholder="Write announcement details..." style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;"></textarea>
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label for="annAudienceType" style="font-weight:600;display:block;margin-bottom:4px;">Target Audience <span class="req" style="color:#ef4444;">*</span></label>
          <select id="annAudienceType" onchange="window.DDUGU_APP.onAudienceTypeChange(this.value);" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
            <option value="all">1. All Faculty and Students</option>
            <option value="selected_faculty">2. Selected Faculty</option>
            <option value="selected_students">3. Selected Students (by Year, Branch, Section)</option>
          </select>
        </div>

        <!-- Selected Faculty Target Box -->
        <div id="targetFacultyBox" style="display:none;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px;">
          <label style="font-weight:600;font-size:12.5px;display:block;margin-bottom:6px;">Select Faculty Members</label>
          <input type="text" id="facultySearchInput" placeholder="Search faculty by name..." oninput="window.DDUGU_APP.filterFacultyCheckboxes(this.value);" style="width:100%;padding:6px 8px;border-radius:4px;border:1px solid #cbd5e1;font-size:12px;margin-bottom:8px;">
          <div id="facultyListContainer" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;">
            ${facultyCheckboxes}
          </div>
        </div>

        <!-- Selected Students Target Box -->
        <div id="targetStudentsBox" style="display:none;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px;">
          <label style="font-weight:600;font-size:12.5px;display:block;margin-bottom:6px;">Target Student Cohort</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div>
              <label style="font-size:11px;color:#64748b;">Academic Year</label>
              <select id="targetYear" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:#64748b;">Branch</label>
              <select id="targetBranch" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="AI ML">AI ML</option>
                <option value="AI DS">AI DS</option>
                <option value="ECE">ECE</option>
                <option value="ME">ME</option>
                <option value="IT">IT</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:#64748b;">Section</label>
              <select id="targetSection" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
          <div class="field">
            <label for="annPriority" style="font-weight:600;display:block;margin-bottom:4px;">Priority</label>
            <select id="annPriority" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
              <option value="high">High priority</option>
              <option value="medium" selected>Normal / Update</option>
              <option value="low">Info</option>
            </select>
          </div>
          <div class="field">
            <label for="annExpiry" style="font-weight:600;display:block;margin-bottom:4px;">Expiry Date (Optional)</label>
            <input type="date" id="annExpiry" min="${todayStr()}" style="width:100%;padding:7px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:10px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">${icon('check', 16)} Publish Announcement</button>
        </div>
      </form>
    `;

    openCustomModal({
      title: 'Create Announcement',
      content,
      maxWidth: '560px',
    });
  }

  function deleteAnnouncement(id) {
    const ann = announcements.find((a) => a.id === id);
    if (!ann) return;
    const canDelete = state.user.role === 'admin' || ann.authorId === state.user.id;
    if (!canDelete) {
      toast('Permission denied: Only Admin or the original creator can delete this announcement.', 'error');
      return;
    }
    openConfirm({
      title: 'Delete Announcement?',
      message: `Are you sure you want to delete "${ann.title}"?\n\nThis will remove it for all users immediately.`,
      confirmLabel: 'Delete Announcement',
      danger: true,
      onConfirm: () => {
        const idx = announcements.findIndex((a) => a.id === id);
        if (idx !== -1) {
          announcements.splice(idx, 1);
          saveAnnouncements();
          toast('Announcement deleted.', 'info');
          renderPage();
        }
      },
    });
  }

  function hideAnnouncement(id) {
    const ann = announcements.find((a) => a.id === id);
    if (!ann) return;
    if (!state.readAnnouncements.includes(id)) {
      toast('Only announcements you have already seen can be removed from your view.', 'warning');
      return;
    }
    openConfirm({
      title: 'Remove from My View?',
      message: `Remove "${ann.title}" from your personal announcement list?\n\nThis will not delete the announcement for other campus users.`,
      confirmLabel: 'Remove from My View',
      danger: false,
      onConfirm: () => {
        hideAnnouncementForUser(id);
        toast('Announcement removed from your view.', 'info');
        renderPage();
      },
    });
  }

  function hideCancelledBooking(bookingId) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    if (booking.status !== 'cancelled') {
      toast('Only cancelled bookings can be removed from history.', 'warning');
      return;
    }
    openConfirm({
      title: 'Remove from History?',
      message: `Remove this cancelled booking (${booking.title}) from your schedule history?\n\nThe official booking record remains intact.`,
      confirmLabel: 'Remove from History',
      danger: false,
      onConfirm: () => {
        hideBookingForUser(bookingId);
        toast('Cancelled booking removed from your history.', 'info');
        renderPage();
      },
    });
  }

  function hideCancelledSeatRes(resId) {
    const res = seatReservations.find((r) => r.id === resId);
    if (!res) return;
    if (res.status !== 'cancelled') {
      toast('Only cancelled seat reservations can be removed from history.', 'warning');
      return;
    }
    hideSeatResForUser(resId);
    toast('Cancelled seat reservation removed from history.', 'info');
    renderPage();
  }

  function handleQuickReserveLibrarySeat(roomId, slotId, date, bookingId) {
    if (!state.user || state.user.role !== 'student') {
      toast('Library seat reservations are available for students.', 'warning');
      return;
    }
    const room = getRoom(roomId);
    const capacity = (room && room.capacity) ? room.capacity : 180;

    // Check duplicate reservation by same student in this slot
    const alreadyMine = seatReservations.find(
      (r) =>
        r.studentUserId === state.user.id &&
        r.roomId === roomId &&
        r.timeSlotId === slotId &&
        r.date === date &&
        r.status === 'active'
    );
    if (alreadyMine) {
      toast('You already have an active seat reservation for this library slot.', 'warning');
      return;
    }

    // Check capacity
    const activeSeats = seatReservations.filter(
      (r) =>
        r.status === 'active' &&
        r.roomId === roomId &&
        r.timeSlotId === slotId &&
        r.date === date
    );

    if (activeSeats.length >= capacity) {
      toast('The library is currently full for this time slot.', 'error');
      return;
    }

    const takenSeats = new Set(activeSeats.map((r) => r.seatNumber));
    let assignedSeat = null;
    for (let i = 1; i <= capacity; i++) {
      const candidate = `L-${i}`;
      if (!takenSeats.has(candidate)) {
        assignedSeat = candidate;
        break;
      }
    }
    if (!assignedSeat) {
      toast('The library is full. No seats available.', 'error');
      return;
    }

    const studentYear = Number(state.user.academicYear || state.user.year || 1);
    const studentBranch = state.user.branchCode || state.user.department || 'CSE';
    const studentSection = state.user.section || 'A';

    const newRes = {
      id: 'lib-res-' + Date.now(),
      bookingId: bookingId || null,
      roomId: roomId,
      timeSlotId: slotId,
      date: date,
      studentUserId: state.user.id,
      studentName: state.user.name,
      academicYear: studentYear,
      branchCode: studentBranch,
      section: studentSection,
      seatNumber: assignedSeat,
      status: 'active',
      reservedAt: new Date().toISOString(),
    };

    seatReservations.unshift(newRes);
    saveSeatReservations();
    toast(`Seat ${assignedSeat} reserved successfully!`, 'success');
    renderPage();
  }

  /* ------------------------------------------------------------------ */
  /* Conflicts Reporting & Resolution                                    */
  /* ------------------------------------------------------------------ */
  function renderConflictsPage() {
    const isAdmin = state.user.role === 'admin';
    const isFaculty = state.user.role === 'faculty';

    if (isAdmin) {
      // ADMIN CONFLICT RESOLUTION
      const list = conflicts.filter((c) => c.status !== 'resolved').slice().sort((a, b) => {
        // Faculty high priority first, then latest
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      });

      const totalOpen = list.filter((c) => c.status !== 'resolved' && c.status !== 'rejected').length;
      const facultyHighCount = list.filter((c) => c.priority === 'high' && c.status !== 'resolved').length;
      const studentCount = list.filter((c) => c.reporterType === 'student' && c.status !== 'resolved').length;

      const conflictCards = list.map((c) => {
        const room = getRoom(c.roomId);
        const bldg = room ? getBuilding(room.buildingId) : null;
        const isFacultyReporter = c.reporterType === 'faculty' || c.priority === 'high';
        const existing = c.bookingId ? bookings.find((b) => b.id === c.bookingId) : null;
        const hist = Array.isArray(c.history) ? c.history : [];

        const historyMarkup = hist.map((h) => `
          <div style="font-size:12.5px;color:#475569;display:flex;align-items:center;gap:10px;padding:4px 0;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;flex-shrink:0;"></span>
            <span><strong>${escapeHtml(h.actionBy || 'User')}</strong> changed status to <span style="font-weight:700;text-transform:uppercase;font-size:11px;padding:2px 8px;border-radius:4px;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;">${escapeHtml(h.status || '')}</span>: ${escapeHtml(h.note || 'No notes provided')}</span>
            <span style="color:#94a3b8;font-size:12px;margin-left:auto;flex-shrink:0;">(${timeAgo(h.timestamp)})</span>
          </div>
        `).join('');

        return `
          <div class="card" style="margin-bottom:1.75rem;border-radius:14px;border:1px solid #e2e8f0;border-left:6px solid ${isFacultyReporter ? '#ef4444' : '#3b82f6'};box-shadow:0 4px 16px rgba(15,23,42,0.04);background:#ffffff;padding:24px 28px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span class="badge ${isFacultyReporter ? 'badge-blue' : 'badge-green'}" style="font-size:12.5px;font-weight:700;padding:5px 12px;border-radius:9999px;">
                  ${isFacultyReporter ? '👨‍🏫 Faculty Member' : '👨‍🎓 Student'}
                </span>
                ${isFacultyReporter ? `
                  <span class="badge" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:800;font-size:11.5px;padding:5px 12px;border-radius:9999px;letter-spacing:0.3px;">
                    🔥 HIGH PRIORITY (FACULTY)
                  </span>
                ` : `
                  <span class="badge badge-slate" style="font-size:11.5px;padding:5px 12px;border-radius:9999px;">Normal Priority</span>
                `}
                <span class="badge ${c.status === 'resolved' ? 'badge-green' : c.status === 'rejected' ? 'badge-slate' : 'badge-amber'}" style="font-size:12.5px;font-weight:700;padding:5px 12px;border-radius:9999px;text-transform:uppercase;">
                  ${c.status.replace('_', ' ')}
                </span>
              </div>
              <div style="text-align:right;background:#f8fafc;padding:8px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                <div style="font-size:11.5px;color:#64748b;font-weight:600;">Reported by</div>
                <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:1px;">${escapeHtml(c.reporterName || 'User')}</div>
                <div style="font-size:11.5px;color:#94a3b8;margin-top:2px;">${formatDate(c.reportedAt)} · ${timeAgo(c.reportedAt)}</div>
              </div>
            </div>

            <div style="margin-bottom:18px;">
              <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${escapeHtml(c.title || 'Room / Reservation Conflict')}
              </h3>
              <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13.5px;color:#475569;">
                <span style="display:inline-flex;align-items:center;gap:5px;">
                  🏢 Affected Room: <strong style="color:#0f172a;">${escapeHtml(room ? room.name : (c.roomId || '—'))}</strong> ${bldg ? `(${escapeHtml(bldg.name)})` : ''}
                </span>
                ${c.seatId ? `
                  <span style="color:#cbd5e1;">•</span>
                  <span style="display:inline-flex;align-items:center;gap:5px;">
                    🪑 Seat: <strong style="color:#0f172a;">${escapeHtml(c.seatId)}</strong>
                  </span>
                ` : ''}
                ${existing ? `
                  <span style="color:#cbd5e1;">•</span>
                  <span style="display:inline-flex;align-items:center;gap:5px;">
                    📚 Lecture: <em style="color:#0f172a;">${escapeHtml(existing.title)}</em>
                  </span>
                ` : ''}
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:18px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#64748b;margin-bottom:8px;">
                Conflict Description / Issue Reported
              </div>
              <div style="font-size:14.5px;line-height:1.6;color:#1e293b;">
                ${escapeHtml(c.description)}
              </div>
            </div>

            ${c.resolutionNote ? `
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 20px;margin-bottom:18px;">
                <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#1d4ed8;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                  <span>📝</span> Current Admin Resolution Note
                </div>
                <div style="font-size:14px;line-height:1.55;color:#1e40af;font-weight:500;">
                  ${escapeHtml(c.resolutionNote)}
                </div>
              </div>
            ` : ''}

            <!-- Status Changer form -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;margin-top:20px;">
              <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#e0e7ff;color:#4338ca;font-size:12px;">⚙️</span>
                Update Conflict Status & Resolution Notes
              </div>
              <form onsubmit="event.preventDefault(); window.DDUGU_APP.handleConflictResolutionSubmit('${c.id}', this);" style="display:grid;grid-template-columns:200px 1fr auto;gap:14px;align-items:flex-end;">
                <div>
                  <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">New Status</label>
                  <select name="status" style="width:100%;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;color:#0f172a;font-weight:600;">
                    <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                    <option value="under_review" ${c.status === 'under_review' ? 'selected' : ''}>🔍 Under Review</option>
                    <option value="resolved">✅ Resolved (Closes & Deletes from System)</option>
                    <option value="rejected" ${c.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Resolution Note</label>
                  <input type="text" name="note" placeholder="Add resolution comment, action taken, technician dispatch..." value="${escapeHtml(c.resolutionNote || '')}" style="width:100%;height:42px;padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
                </div>
                <div>
                  <button type="submit" class="btn btn-primary" style="height:42px;padding:0 22px;font-size:13.5px;font-weight:600;border-radius:8px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;box-shadow:0 2px 4px rgba(37,99,235,0.2);">
                    ${icon('check', 16)} Save Status
                  </button>
                </div>
              </form>
            </div>

            ${historyMarkup ? `
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;">
                <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                  <span>📜</span> Audit History & Resolution Log:
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${historyMarkup}
                </div>
              </div>
            ` : ''}
          </div>`;
      }).join('');

      return `
        <div class="page-head">
          <div>
            <h2>Conflict Resolution</h2>
            <p>Review and resolve room, seat, and schedule conflicts. Faculty-reported issues carry higher priority.</p>
          </div>
          <div class="head-actions" style="display:flex;gap:8px;">
            <span class="badge ${facultyHighCount ? 'badge-red' : 'badge-slate'}" style="font-weight:700;">
              ${facultyHighCount} Faculty High Priority
            </span>
            <span class="badge badge-amber" style="font-weight:700;">
              ${totalOpen} Open Conflicts
            </span>
          </div>
        </div>

        <div>
          ${list.length ? conflictCards : `<div class="card">${emptyState('✅', 'No conflicts reported', 'All campus rooms and schedules are conflict-free.')}</div>`}
        </div>`;
    }

    // FACULTY & STUDENT: REPORT A CONFLICT
    const reservableRooms = rooms.filter((r) => r.bookable !== false);
    const roomOptions = buildings.map((b) => `
      <optgroup label="${escapeHtml(b.name)}">
        ${reservableRooms
          .filter((r) => r.buildingId === b.id)
          .map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${r.capacity} seats)</option>`)
          .join('')}
      </optgroup>
    `).join('');

    const recentBookings = bookings
      .filter((b) => b.status === 'confirmed' && b.date >= todayStr())
      .slice(0, 10);
    const bookingOptions = `
      <option value="">-- None / General Room Clash --</option>
      ${recentBookings.map((b) => `<option value="${b.id}">${formatShortDate(b.date)} · ${escapeHtml(b.title)} (${getRoom(b.roomId)?.name || 'Room'})</option>`).join('')}
    `;

    // User's own reported conflicts
    const myConflicts = conflicts
      .filter((c) => c.status !== 'resolved' && (c.reporterUserId === state.user.id || c.requestedById === state.user.id || (isFaculty && c.reporterFacultyMobile === state.user.mobileNumber)))
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

    const myConflictCards = myConflicts.map((c) => {
      const room = getRoom(c.roomId);
      return `
        <div class="card" style="margin-bottom:0.75rem;padding:0.9rem;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong style="font-size:14px;">${escapeHtml(c.title || 'Reported Conflict')}</strong>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                Room: <strong>${escapeHtml(room ? room.name : (c.roomId || '—'))}</strong>
                ${c.seatId ? ` · Seat: ${escapeHtml(c.seatId)}` : ''}
              </div>
            </div>
            <span class="badge ${c.status === 'resolved' ? 'badge-green' : c.status === 'rejected' ? 'badge-slate' : 'badge-amber'}" style="font-size:11px;">
              ${c.status.toUpperCase().replace('_', ' ')}
            </span>
          </div>
          <p style="font-size:13px;color:#334155;margin:6px 0;">${escapeHtml(c.description)}</p>
          ${c.resolutionNote ? `
            <div style="background:#eff6ff;padding:6px 8px;border-radius:4px;font-size:12px;color:#1e40af;margin-top:4px;">
              <strong>Admin Note:</strong> ${escapeHtml(c.resolutionNote)}
            </div>
          ` : ''}
          <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
            Submitted on ${formatDate(c.reportedAt)} · Priority: <strong>${c.priority.toUpperCase()}</strong>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="page-head">
        <div>
          <h2>Report a Conflict</h2>
          <p>${isFaculty ? 'Faculty priority conflict submission. Your report receives highest resolution priority.' : 'Report an issue with a room, seat, or schedule overlap.'}</p>
        </div>
      </div>

      ${isFaculty ? `
        <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;color:#1e40af;font-size:13px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🛡️</span>
          <div>
            <strong>Faculty Priority Resolution:</strong> As a faculty member, your reports are automatically assigned <strong>High Priority</strong> and surfaced first to administrators.
          </div>
        </div>
      ` : ''}

      <div class="conflicts-layout">
        <form id="reportConflictForm" class="card form-card" onsubmit="event.preventDefault(); window.DDUGU_APP.handleConflictSubmit(event);">
          <div class="card-head">
            <div>
              <h3>Submit Conflict Report</h3>
              <p>Details will be sent directly to Campus Administration</p>
            </div>
            <span class="stat-icon" style="width:38px;height:38px">${icon('alert', 18)}</span>
          </div>
          <div class="card-body">
            <div class="field">
              <label for="confTitle">Issue Summary <span class="req">*</span></label>
              <input type="text" id="confTitle" required placeholder="e.g. Room locked / Double booked seat" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
            </div>

            <div class="field">
              <label for="confRoom">Affected Room <span class="req">*</span></label>
              <select id="confRoom" required style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                ${roomOptions}
              </select>
            </div>

            <div class="form-row">
              <div class="field">
                <label for="confBooking">Related Lecture / Booking</label>
                <select id="confBooking" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                  ${bookingOptions}
                </select>
              </div>
              <div class="field">
                <label for="confSeat">Seat Number (If Applicable)</label>
                <input type="text" id="confSeat" placeholder="e.g. S-14 or Row 3" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
              </div>
            </div>

            <div class="field">
              <label for="confDescription">Description of Conflict <span class="req">*</span></label>
              <textarea id="confDescription" required rows="3" placeholder="Explain what happened, what room or seat was affected..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;"></textarea>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${icon('alert', 15)} Submit Conflict Report</button>
            </div>
          </div>
        </form>

        <div class="conflict-list">
          <h3 style="font-size:16px;margin:0 0 10px;color:#1e293b;">My Submitted Reports</h3>
          ${myConflicts.length ? myConflictCards : `<div class="card">${emptyState('📝', 'No reports submitted', 'You have not submitted any conflict reports yet.')}</div>`}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Student Profile: Reserve a Seat                                    */
  /* ------------------------------------------------------------------ */
  function renderReserveSeatPage() {
    if (state.user.role !== 'student') {
      return `<div class="card">${emptyState('🔒', 'Students only', 'The Reserve a Seat section is designed exclusively for students.')}</div>`;
    }

    // Default or chosen cohort
    const studentYear = state.booking.academicYear || state.user.academicYear || state.user.year || '';
    const studentBranch = state.booking.branchFilter || state.user.branchCode || state.user.department || '';
    const studentSection = state.booking.section || state.user.section || 'A';

    // Eligible lectures matching academic year, branch, section
    const matchingBookings = bookings.filter((b) => {
      if (b.status !== 'confirmed') return false;
      if (b.date < todayStr()) return false;
      const matchYear = !b.academicYear || !studentYear || String(b.academicYear) === String(studentYear);
      const matchSection = !b.section || !studentSection || String(b.section).toUpperCase() === String(studentSection).toUpperCase();
      const matchBranch = (function () {
        if (!b.branchCode || !studentBranch) return true;
        const b1 = String(b.branchCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const b2 = String(studentBranch).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (b1 === b2) return true;
        if ((b1.includes('AIML') || b1.includes('AI')) && (b2.includes('AIML') || b2.includes('AI'))) return true;
        if ((b1.includes('DS') || b1.includes('MLDS')) && (b2.includes('DS') || b2.includes('MLDS'))) return true;
        if (b1.includes('IOT') && b2.includes('IOT')) return true;
        return b1.includes(b2) || b2.includes(b1);
      })();
      return matchYear && matchBranch && matchSection;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Student's existing seat reservations
    const hiddenSeatRes = getHiddenSeatRes(state.user.id);
    const myReservations = seatReservations.filter((r) => r.studentUserId === state.user.id && !hiddenSeatRes.includes(r.id));

    // Extract faculty members for the filter dropdown
    const facultyMap = new Map();
    // Faculty with scheduled lectures for this cohort
    matchingBookings.forEach((b) => {
      const f = getUser(b.userId);
      const name = (f && f.name) || b.facultyName || b.userId;
      if (name) facultyMap.set(b.userId || name, name);
    });
    // Also include all registered faculty members
    users.filter((u) => u.role === 'faculty').forEach((f) => {
      if (!facultyMap.has(f.id)) {
        facultyMap.set(f.id, f.name);
      }
    });
    const sortedFaculty = Array.from(facultyMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    state.studentReserveFilter = state.studentReserveFilter || { date: '', facultyId: 'all' };
    const reserveFilter = state.studentReserveFilter;

    // Apply filters by date and faculty member
    let filteredBookings = matchingBookings.slice();
    if (reserveFilter.date) {
      filteredBookings = filteredBookings.filter((b) => b.date === reserveFilter.date);
    }
    if (reserveFilter.facultyId && reserveFilter.facultyId !== 'all') {
      filteredBookings = filteredBookings.filter((b) => {
        const u = getUser(b.userId);
        return (
          b.userId === reserveFilter.facultyId ||
          b.facultyName === reserveFilter.facultyId ||
          (u && (u.id === reserveFilter.facultyId || u.name === reserveFilter.facultyId))
        );
      });
    }

    const hasActiveFilters = Boolean(reserveFilter.date || (reserveFilter.facultyId && reserveFilter.facultyId !== 'all'));

    const lectureCards = filteredBookings.map((b) => {
      const room = getRoom(b.roomId);
      const bldg = room ? getBuilding(room.buildingId) : null;
      const slot = getSlot(b.timeSlotId);
      const faculty = getUser(b.userId);

      const activeSeatsForBooking = seatReservations.filter((r) => r.bookingId === b.id && r.status === 'active');
      const capacity = room ? room.capacity : 75;
      const seatsAvailable = Math.max(0, capacity - activeSeatsForBooking.length);
      const mySeat = activeSeatsForBooking.find((r) => r.studentUserId === state.user.id);

      return `
        <div class="card" style="margin-bottom:1.5rem;border-radius:14px;border:1px solid #e2e8f0;border-left:6px solid ${mySeat ? '#10b981' : '#3b82f6'};background:#ffffff;padding:24px 28px;box-shadow:0 4px 14px rgba(15,23,42,0.04);transition:all 0.2s;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;">
            <div style="flex:1;min-width:280px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                <span class="badge" style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;font-size:12px;font-weight:700;padding:4px 12px;border-radius:9999px;">
                  🎓 ${b.branchCode || 'All'} · ${b.academicYear ? formatYearLabel(b.academicYear) : 'All Years'} · Sec ${b.section || 'All'}
                </span>
                ${mySeat ? `
                  <span class="badge badge-green" style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:9999px;">
                    ✓ Reserved: Seat ${escapeHtml(mySeat.seatNumber)}
                  </span>
                ` : ''}
              </div>
              <h3 style="margin:6px 0 10px;font-size:1.25rem;font-weight:700;color:#0f172a;line-height:1.35;">
                ${escapeHtml(b.title)}
              </h3>
              <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13.5px;color:#475569;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  👨‍🏫 Faculty: <strong style="color:#0f172a;">${escapeHtml(faculty ? faculty.name : (b.facultyName || 'Faculty Member'))}</strong>
                </span>
                <span style="color:#cbd5e1;">•</span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  🏢 Classroom: <strong style="color:#0f172a;">${escapeHtml(room ? room.name : 'Room')}</strong> ${bldg ? `(${escapeHtml(bldg.name)})` : ''}
                </span>
                <span style="color:#cbd5e1;">•</span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  🗓️ <strong>${formatDate(b.date)}</strong>
                </span>
                <span style="color:#cbd5e1;">•</span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  ⏰ <strong>${slot ? slot.label : 'Standard Time'}</strong>
                </span>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:12px;min-width:180px;flex-shrink:0;">
              <span class="badge ${seatsAvailable > 10 ? 'badge-green' : seatsAvailable > 0 ? 'badge-amber' : 'badge-red'}" style="font-size:13px;font-weight:700;padding:6px 14px;border-radius:9999px;display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${seatsAvailable > 0 ? '#10b981' : '#ef4444'};"></span>
                ${seatsAvailable} of ${capacity} Seats Free
              </span>

              <div>
                ${mySeat ? `
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button type="button" class="btn btn-outline" disabled style="height:42px;padding:0 18px;font-size:13.5px;font-weight:700;border-radius:8px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;cursor:default;">
                      ✓ Reserved
                    </button>
                    <button type="button" class="btn btn-outline btn-danger" data-action="cancel-seat-reservation" data-reservation-id="${mySeat.id}" style="height:42px;padding:0 16px;font-size:13px;font-weight:600;border-radius:8px;" title="Cancel Reservation">
                      Cancel
                    </button>
                  </div>
                ` : seatsAvailable > 0 ? `
                  <button type="button" class="btn btn-primary" data-action="quick-reserve-seat" data-booking-id="${b.id}" style="height:42px;padding:0 24px;font-size:14px;font-weight:600;border-radius:8px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
                    ${icon('chair', 16)} Reserve Seat
                  </button>
                ` : `
                  <button type="button" class="btn btn-outline" disabled style="height:42px;padding:0 18px;font-size:13.5px;opacity:0.6;cursor:not-allowed;">
                    Class Full
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    const myReservationRows = myReservations.map((r) => {
      const b = bookings.find((item) => item.id === r.bookingId);
      const room = getRoom(r.roomId);
      const slot = (b && getSlot(b.timeSlotId)) || (r.timeSlotId && getSlot(r.timeSlotId)) || null;
      const canCancel = r.status === 'active' && (!b || b.date >= todayStr() || (r.date && r.date >= todayStr()));
      const titleStr = b ? b.title : (r.roomId === 'iet-library' || (room && room.type === 'library') ? 'Library Study Session' : 'Seat Reservation');
      const dateStr = b ? formatDate(b.date) : (r.date ? formatDate(r.date) : '—');

      return `
        <tr>
          <td><strong style="font-size:14px;color:#0f172a;">${escapeHtml(titleStr)}</strong></td>
          <td>${escapeHtml(room ? room.name : '—')}</td>
          <td><span class="badge badge-blue" style="font-weight:700;padding:4px 10px;font-size:12px;">Seat ${escapeHtml(r.seatNumber)}</span></td>
          <td>${dateStr}${slot ? `<br><small style="color:#64748b;">${slot.label}</small>` : ''}</td>
          <td>${statusBadge(r.status)}</td>
          <td style="text-align:right;">
            ${canCancel ? `
              <button type="button" class="btn btn-danger btn-sm" data-action="cancel-seat-reservation" data-reservation-id="${r.id}" style="padding:4px 10px;font-size:12px;border-radius:6px;">
                Cancel
              </button>
            ` : r.status === 'cancelled' ? `
              <button type="button" class="btn btn-outline btn-sm" data-action="hide-cancelled-seat-res" data-reservation-id="${r.id}" style="padding:3px 8px;font-size:11px;color:#64748b;border-color:#cbd5e1;" title="Remove this cancelled reservation from history">
                ${icon('trash', 12)} Remove
              </button>
            ` : '—'}
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="page-head" style="margin-bottom:1.75rem;">
        <div>
          <h2>Reserve a Seat</h2>
          <p>Find your upcoming classes and reserve your seat with one click.</p>
        </div>
      </div>

      <!-- Cohort Selection Bar (Mandatory) -->
      <div class="card" style="margin-bottom:2rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px 28px;box-shadow:0 4px 12px rgba(15,23,42,0.03);">
        <div style="margin-bottom:1.25rem;">
          <strong style="font-size:16px;color:#0f172a;display:flex;align-items:center;gap:8px;">
            <span>🎓</span> Select Your Academic Cohort
          </strong>
          <span style="font-size:13px;color:#64748b;display:block;margin-top:4px;">
            You must specify your Academic Year, Branch, and Section to see eligible lectures.
          </span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#334155;display:block;margin-bottom:6px;">Academic Year <span class="req" style="color:#ef4444;">*</span></label>
            <select id="studentCohortYear" onchange="window.DDUGU_APP.onCohortChange('academicYear', this.value);" style="width:100%;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
              <option value="" ${!studentYear ? 'selected' : ''}>-- Choose Year --</option>
              <option value="1" ${studentYear == 1 ? 'selected' : ''}>1st Year</option>
              <option value="2" ${studentYear == 2 ? 'selected' : ''}>2nd Year</option>
              <option value="3" ${studentYear == 3 ? 'selected' : ''}>3rd Year</option>
              <option value="4" ${studentYear == 4 ? 'selected' : ''}>4th Year</option>
            </select>
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#334155;display:block;margin-bottom:6px;">Branch / Department <span class="req" style="color:#ef4444;">*</span></label>
            <select id="studentCohortBranch" onchange="window.DDUGU_APP.onCohortChange('branchFilter', this.value);" style="width:100%;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
              <option value="" ${!studentBranch ? 'selected' : ''}>-- Choose Branch --</option>
              <option value="CSE" ${studentBranch === 'CSE' ? 'selected' : ''}>Computer Science & Engineering (CSE)</option>
              <option value="AI ML" ${studentBranch === 'AI ML' ? 'selected' : ''}>Artificial Intelligence & ML (AI ML)</option>
              <option value="MLDS" ${studentBranch === 'MLDS' || studentBranch === 'AI DS' ? 'selected' : ''}>Machine Learning & Data Science (MLDS)</option>
              <option value="IoT" ${studentBranch === 'IoT' ? 'selected' : ''}>Internet of Things (IoT)</option>
              <option value="ECE" ${studentBranch === 'ECE' ? 'selected' : ''}>Electronics & Comm (ECE)</option>
              <option value="ME" ${studentBranch === 'ME' ? 'selected' : ''}>Mechanical Engineering (ME)</option>
              <option value="IT" ${studentBranch === 'IT' ? 'selected' : ''}>Information Technology (IT)</option>
            </select>
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#334155;display:block;margin-bottom:6px;">Section <span class="req" style="color:#ef4444;">*</span></label>
            <select id="studentCohortSection" onchange="window.DDUGU_APP.onCohortChange('section', this.value);" style="width:100%;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
              <option value="A" ${studentSection === 'A' ? 'selected' : ''}>Section A</option>
              <option value="B" ${studentSection === 'B' ? 'selected' : ''}>Section B</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Filter Option: Date & Faculty Member -->
      <div class="card" style="margin-bottom:2rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(15,23,42,0.03);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🔍</span>
            <strong style="font-size:15px;color:#0f172a;">Filter Lectures</strong>
            <span style="font-size:12.5px;color:#64748b;">(Filter scheduled classes by Date or Faculty Member)</span>
          </div>
          ${hasActiveFilters ? `
            <button type="button" class="btn btn-sm btn-outline" onclick="window.DDUGU_APP.clearReserveFilters();" style="padding:4px 12px;font-size:12px;color:#ef4444;border-color:#fca5a5;border-radius:6px;">
              ✕ Clear All Filters
            </button>
          ` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;align-items:flex-end;">
          <!-- Date Filter -->
          <div>
            <label for="studentReserveDate" style="display:block;font-size:12.5px;font-weight:600;color:#334155;margin-bottom:6px;">
              🗓️ Filter by Date
            </label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="date" id="studentReserveDate" value="${reserveFilter.date || ''}" onchange="window.DDUGU_APP.onReserveFilterChange('date', this.value);" style="flex:1;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
              <button type="button" class="btn ${reserveFilter.date === todayStr() ? 'btn-primary' : 'btn-outline'}" onclick="window.DDUGU_APP.onReserveFilterChange('date', '${todayStr()}');" style="height:42px;padding:0 14px;font-size:12.5px;white-space:nowrap;border-radius:8px;">Today</button>
              ${reserveFilter.date ? `
                <button type="button" class="btn btn-outline" onclick="window.DDUGU_APP.onReserveFilterChange('date', '');" style="height:42px;padding:0 10px;font-size:13px;color:#64748b;border-radius:8px;" title="Clear date filter">✕</button>
              ` : ''}
            </div>
          </div>

          <!-- Faculty Member Filter -->
          <div>
            <label for="studentReserveFaculty" style="display:block;font-size:12.5px;font-weight:600;color:#334155;margin-bottom:6px;">
              👨‍🏫 Filter by Faculty Member
            </label>
            <select id="studentReserveFaculty" onchange="window.DDUGU_APP.onReserveFilterChange('facultyId', this.value);" style="width:100%;height:42px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:13.5px;background:white;">
              <option value="all" ${reserveFilter.facultyId === 'all' ? 'selected' : ''}>-- All Faculty Members --</option>
              ${sortedFaculty.map(([fId, fName]) => `
                <option value="${escapeHtml(fId)}" ${reserveFilter.facultyId === fId ? 'selected' : ''}>${escapeHtml(fName)}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Eligible Classes Grid -->
      <div style="margin-bottom:2.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
          <h3 style="font-size:1.15rem;font-weight:700;margin:0;color:#0f172a;">Scheduled Classes & Available Seats</h3>
          ${studentYear && studentBranch ? `
            <span style="font-size:13px;color:#64748b;font-weight:500;">
              ${hasActiveFilters ? `Showing ${filteredBookings.length} of ${matchingBookings.length} lecture(s)` : `${matchingBookings.length} lecture(s) available`}
            </span>
          ` : ''}
        </div>
        ${(!studentYear || !studentBranch) ? `
          <div class="card" style="padding:1.5rem;text-align:center;color:#64748b;">
            ⚠️ Please choose your <strong>Academic Year</strong> and <strong>Branch</strong> above to load scheduled lectures.
          </div>
        ` : matchingBookings.length === 0 ? `
          <div class="card">${emptyState('📚', 'No scheduled lectures found', 'No lectures are currently scheduled for your specific branch and year today or tomorrow.')}</div>
        ` : filteredBookings.length === 0 ? `
          <div class="card" style="padding:2.5rem 1.5rem;text-align:center;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>
            <h4 style="margin:0 0 0.5rem;color:#0f172a;font-size:1.1rem;font-weight:700;">No lectures match your filters</h4>
            <p style="margin:0 0 1rem;color:#64748b;font-size:13.5px;">
              No scheduled classes match ${reserveFilter.date ? `Date: <strong>${formatDate(reserveFilter.date)}</strong>` : ''} ${reserveFilter.date && reserveFilter.facultyId !== 'all' ? 'and ' : ''} ${reserveFilter.facultyId !== 'all' ? `Faculty: <strong>${escapeHtml(facultyMap.get(reserveFilter.facultyId) || reserveFilter.facultyId)}</strong>` : ''}.
            </p>
            <button type="button" class="btn btn-outline" onclick="window.DDUGU_APP.clearReserveFilters();" style="border-radius:8px;font-size:13px;padding:8px 18px;">
              Clear Filters & Show All Classes
            </button>
          </div>
        ` : lectureCards}
      </div>

      <!-- Student's My Seat Reservations Table -->
      <div class="card" style="border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.03);overflow:hidden;">
        <div class="card-head" style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
          <div>
            <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 4px;">My Seat Reservations</h3>
            <p style="margin:0;color:#64748b;font-size:13px;">Your reserved seats across current and upcoming campus lectures</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;">Lecture / Class</th>
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;">Room</th>
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;">Seat Number</th>
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;">Date & Slot</th>
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;">Status</th>
                <th style="padding:14px 18px;font-size:12px;font-weight:700;color:#475569;text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${myReservations.length ? myReservationRows : `<tr><td colspan="6" style="padding:32px 20px;">${emptyState('🪑', 'No seat reservations yet', 'Pick an available lecture above to reserve your seat.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function quickReserveSeat(bookingId) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const studentYear = state.booking.academicYear || state.user.academicYear || state.user.year;
    const studentBranch = state.booking.branchFilter || state.user.branchCode || state.user.department;
    const studentSection = state.booking.section || state.user.section || 'A';

    if (!studentYear || !studentBranch || !studentSection) {
      toast('Please select your Academic Year, Branch, and Section before reserving a seat.', 'warning');
      return;
    }

    // Check duplicate reservation by same student
    const alreadyMine = seatReservations.find(
      (r) => r.bookingId === bookingId && r.studentUserId === state.user.id && r.status === 'active'
    );
    if (alreadyMine) {
      toast('You already have a reserved seat for this class.', 'warning');
      return;
    }

    // Check room capacity
    const room = getRoom(booking.roomId);
    const capacity = room ? room.capacity : 75;
    const activeSeats = seatReservations.filter((r) => r.bookingId === bookingId && r.status === 'active');

    if (activeSeats.length >= capacity) {
      toast('This classroom is full. No seats available.', 'error');
      return;
    }

    // Auto-assign the lowest available seat number internally (1..capacity)
    const takenSeatNumbers = new Set(activeSeats.map((r) => r.seatNumber));
    let assignedSeatNumber = null;
    for (let i = 1; i <= capacity; i++) {
      const candidate = `S-${i}`;
      if (!takenSeatNumbers.has(candidate)) {
        assignedSeatNumber = candidate;
        break;
      }
    }
    if (!assignedSeatNumber) {
      toast('This classroom is full. No seats available.', 'error');
      return;
    }

    // Create reservation record
    const newRes = {
      id: 'seat-res-' + Date.now(),
      bookingId: booking.id,
      roomId: booking.roomId,
      studentUserId: state.user.id,
      studentName: state.user.name,
      academicYear: Number(studentYear),
      branchCode: studentBranch,
      section: studentSection,
      seatNumber: assignedSeatNumber,
      status: 'active',
      reservedAt: new Date().toISOString(),
    };

    seatReservations.unshift(newRes);
    saveSeatReservations();
    toast('Seat reserved successfully!', 'success');
    renderPage();
  }

  function cancelSeatReservation(resId) {
    const res = seatReservations.find((r) => r.id === resId);
    if (!res) return;
    openConfirm({
      title: 'Cancel Seat Reservation?',
      message: `Are you sure you want to release Seat ${res.seatNumber}?\n\nThe seat will immediately become available for other students.`,
      confirmLabel: 'Release Seat',
      danger: true,
      onConfirm: () => {
        res.status = 'cancelled';
        saveSeatReservations();
        toast(`Seat ${res.seatNumber} released.`, 'info');
        renderPage();
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Profile & Personal Info Management (Admin, Faculty and Student)    */
  /* ------------------------------------------------------------------ */
  function openProfileModal() {
    if (!state.user) {
      return;
    }

    const u = state.user;
    const isAdmin = u.role === 'admin';
    const isStudent = u.role === 'student';
    const isFaculty = u.role === 'faculty';

    const content = `
      <form id="editProfileForm" onsubmit="event.preventDefault(); window.DDUGU_APP.handleProfileSubmit(event);">
        <div style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
          <div style="width:48px;height:48px;border-radius:10px;background:${isAdmin ? '#f5f3ff' : (isFaculty ? '#fffbeb' : '#eef2ff')};display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid ${isAdmin ? '#ddd6fe' : (isFaculty ? '#fde68a' : '#c7d2fe')};flex-shrink:0;">
            ${escapeHtml(u.avatar || (isAdmin ? '👨‍💼' : (isFaculty ? '👨‍🏫' : '👨‍🎓')))}
          </div>
          <div>
            <strong style="font-size:15px;color:#0f172a;display:block;">${escapeHtml(u.name)}</strong>
            <span style="font-size:12.5px;color:#64748b;">${escapeHtml(u.email || u.mobileNumber || '')} · <span class="badge ${isAdmin ? 'badge-violet' : (isFaculty ? 'badge-amber' : 'badge-green')}" style="font-size:11px;padding:2px 8px;">${isAdmin ? 'Administrator' : (isFaculty ? 'Faculty Member' : 'Student')}</span></span>
          </div>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label for="profFullName" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Full Name <span class="req" style="color:#ef4444;">*</span></label>
          <input type="text" id="profFullName" required value="${escapeHtml(u.name || '')}" placeholder="Your full name" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
        </div>

        ${isAdmin ? `
          <div class="field" style="margin-bottom:14px;">
            <label for="profDesignation" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Official Designation <span class="req" style="color:#ef4444;">*</span></label>
            <input type="text" id="profDesignation" required value="${escapeHtml(u.designation || 'Campus Administrator')}" placeholder="e.g. Director, Campus Administrator, Dean" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
            <small style="color:#64748b;font-size:11.5px;display:block;margin-top:3px;">Your administrative position or title.</small>
          </div>

          <div class="field" style="margin-bottom:14px;">
            <label for="profDepartment" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Department / Office</label>
            <input type="text" id="profDepartment" value="${escapeHtml(u.department || 'Administration')}" placeholder="e.g. Administration, Academic Affairs" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
          </div>
        ` : ''}

        ${isFaculty ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label for="profDesignation" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Designation <span class="req" style="color:#ef4444;">*</span></label>
              <input type="text" id="profDesignation" required value="${escapeHtml(u.designation || 'Faculty Member')}" placeholder="e.g. Professor, Asst. Prof." style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
            </div>
            <div>
              <label for="profDepartment" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Department <span class="req" style="color:#ef4444;">*</span></label>
              <select id="profDepartment" required style="width:100%;height:40px;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="CSE" ${(u.department === 'CSE') ? 'selected' : ''}>CSE</option>
                <option value="AI ML" ${(u.department === 'AI ML' || u.department === 'AIML') ? 'selected' : ''}>AI ML</option>
                <option value="AI DS" ${(u.department === 'AI DS' || u.department === 'AIDS') ? 'selected' : ''}>AI DS</option>
                <option value="ECE" ${(u.department === 'ECE') ? 'selected' : ''}>ECE</option>
                <option value="ME" ${(u.department === 'ME') ? 'selected' : ''}>ME</option>
                <option value="IT" ${(u.department === 'IT') ? 'selected' : ''}>IT</option>
                <option value="BCA IoT" ${(u.department === 'BCA IoT') ? 'selected' : ''}>BCA IoT</option>
                <option value="BCA AIML" ${(u.department === 'BCA AIML') ? 'selected' : ''}>BCA AIML</option>
                <option value="Administration" ${(u.department === 'Administration') ? 'selected' : ''}>Administration</option>
              </select>
            </div>
          </div>

          <div class="field" style="margin-bottom:14px;">
            <label for="profEmail" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Registered Email Address</label>
            <input type="email" id="profEmail" value="${escapeHtml(u.email || '')}" placeholder="e.g. faculty@ddgu.edu" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
          </div>
        ` : ''}

        ${isStudent ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label for="profBranch" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Branch / Department <span class="req" style="color:#ef4444;">*</span></label>
              <select id="profBranch" required style="width:100%;height:40px;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="CSE" ${(u.branchCode === 'CSE' || u.department === 'CSE' || (!u.branchCode && u.department === 'Computer Science')) ? 'selected' : ''}>Computer Science (CSE)</option>
                <option value="AI ML" ${(u.branchCode === 'AI ML' || u.department === 'AI ML') ? 'selected' : ''}>Artificial Intelligence (AI ML)</option>
                <option value="AI DS" ${(u.branchCode === 'AI DS' || u.department === 'AI DS') ? 'selected' : ''}>Data Science (AI DS)</option>
                <option value="ECE" ${(u.branchCode === 'ECE' || u.department === 'ECE') ? 'selected' : ''}>Electronics & Comm (ECE)</option>
                <option value="ME" ${(u.branchCode === 'ME' || u.department === 'ME') ? 'selected' : ''}>Mechanical Eng (ME)</option>
                <option value="IT" ${(u.branchCode === 'IT' || u.department === 'IT') ? 'selected' : ''}>Information Tech (IT)</option>
              </select>
            </div>

            <div>
              <label for="profYear" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Academic Year <span class="req" style="color:#ef4444;">*</span></label>
              <select id="profYear" required style="width:100%;height:40px;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="1" ${(u.academicYear == 1 || u.year == 1) ? 'selected' : ''}>1st Year</option>
                <option value="2" ${(u.academicYear == 2 || u.year == 2) ? 'selected' : ''}>2nd Year</option>
                <option value="3" ${(u.academicYear == 3 || u.year == 3) ? 'selected' : ''}>3rd Year</option>
                <option value="4" ${(u.academicYear == 4 || u.year == 4) ? 'selected' : ''}>4th Year</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label for="profSection" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Section <span class="req" style="color:#ef4444;">*</span></label>
              <select id="profSection" required style="width:100%;height:40px;padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
                <option value="A" ${(u.section === 'A') ? 'selected' : ''}>Section A</option>
                <option value="B" ${(u.section === 'B') ? 'selected' : ''}>Section B</option>
              </select>
            </div>

            <div>
              <label for="profRollNumber" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Roll Number / Student ID</label>
              <input type="text" id="profRollNumber" value="${escapeHtml(u.rollNumber || '')}" placeholder="e.g. CS2021001" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
            </div>
          </div>
        ` : ''}

        <div class="field" style="margin-bottom:16px;">
          <label for="profPhone" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">${isFaculty ? 'Mobile Number (Primary Key)' : 'Personal Phone Number'}</label>
          <input type="tel" id="profPhone" ${isFaculty ? 'pattern="[0-9]{10}" maxlength="10"' : ''} value="${escapeHtml(u.mobileNumber || u.phone || '')}" placeholder="${isFaculty ? '10-digit mobile number' : '+91 98765 43210'}" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
          ${isFaculty ? '<small style="color:#64748b;font-size:11px;display:block;margin-top:3px;">Your 10-digit mobile number used as faculty primary key.</small>' : ''}
        </div>

        <div style="background:#f1f5f9;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;color:#64748b;display:flex;align-items:center;gap:8px;">
          <span>ℹ️</span>
          <span>To update login credentials or password, use the <strong>Change Credentials</strong> section.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;padding:8px 20px;font-size:13.5px;font-weight:600;">
            ${icon('check', 15)} Save Profile
          </button>
        </div>
      </form>
    `;

    openCustomModal({
      title: isAdmin ? 'Admin Profile Settings' : (isFaculty ? 'Faculty Profile Settings' : 'Student Profile & Academic Info'),
      content,
      maxWidth: '540px',
    });
  }

  function handleProfileSubmit(event) {
    if (!state.user) return;
    const newName = $('#profFullName').value.trim();
    if (!newName) {
      toast('Full name is required.', 'error');
      return;
    }

    state.user.name = newName;

    if (state.user.role === 'admin') {
      const designation = $('#profDesignation').value.trim() || 'Campus Administrator';
      const department = $('#profDepartment') ? $('#profDepartment').value.trim() : 'Administration';
      const phone = $('#profPhone') ? $('#profPhone').value.trim() : '';

      state.user.designation = designation;
      state.user.department = department;
      state.user.phone = phone;
    } else if (state.user.role === 'faculty') {
      const designation = $('#profDesignation') ? $('#profDesignation').value.trim() : 'Faculty Member';
      const department = $('#profDepartment') ? $('#profDepartment').value.trim() : (state.user.department || 'CSE');
      const email = $('#profEmail') ? $('#profEmail').value.trim() : state.user.email;
      const phone = $('#profPhone') ? $('#profPhone').value.trim() : '';

      state.user.designation = designation;
      state.user.department = department;
      if (email) state.user.email = email;
      if (phone) {
        state.user.phone = phone;
        state.user.mobileNumber = phone;
      }
    } else if (state.user.role === 'student') {
      const branch = $('#profBranch').value;
      const year = Number($('#profYear').value);
      const section = $('#profSection').value;
      const rollNumber = $('#profRollNumber') ? $('#profRollNumber').value.trim() : '';
      const phone = $('#profPhone') ? $('#profPhone').value.trim() : '';

      state.user.branchCode = branch;
      state.user.department = branch;
      state.user.academicYear = year;
      state.user.year = year;
      state.user.section = section;
      state.user.rollNumber = rollNumber;
      state.user.phone = phone;

      // Sync cohort selection for booking & seat reservation
      if (state.booking) {
        state.booking.academicYear = year;
        state.booking.branchFilter = branch;
        state.booking.section = section;
      }
    }

    // Update in users database
    const userRecord = users.find((u) => u.id === state.user.id);
    if (userRecord) {
      Object.assign(userRecord, state.user);
    }

    saveUsers();
    storage.set(KEYS.session, state.user.id);
    updateProfile();
    closeModal();
    toast('Profile information updated successfully!', 'success');
    renderPage();
  }

  /* ------------------------------------------------------------------ */
  /* Login Credentials Management (Admin, Faculty and Student)          */
  /* ------------------------------------------------------------------ */
  function openChangeCredentialsModal() {
    if (!state.user) {
      return;
    }

    const u = state.user;
    const isFaculty = u.role === 'faculty';
    const isAdmin = u.role === 'admin';
    const defaultHint = isAdmin
      ? 'adminpassword123'
      : (isFaculty ? 'facultypassword123' : 'studentpassword123');

    const identifierLabel = isFaculty ? 'Registered Mobile Number (Primary Key)' : 'Registered Email';
    const currentIdentifier = isFaculty
      ? (u.mobileNumber || u.phone || u.email)
      : u.email;

    const content = `
      <form id="changeCredentialsForm" onsubmit="event.preventDefault(); window.DDUGU_APP.handleChangeCredentialsSubmit(event);">
        <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:14px;font-size:13px;color:#475569;">
          Current ${escapeHtml(identifierLabel)}: <strong style="color:#0f172a;">${escapeHtml(currentIdentifier)}</strong>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label for="credCurrentPassword" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Current Password <span class="req" style="color:#ef4444;">*</span></label>
          <input type="password" id="credCurrentPassword" required placeholder="Enter current account password" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
          <small style="color:#64748b;font-size:11.5px;display:block;margin-top:3px;">Initial default password for demo accounts is: <code>${defaultHint}</code> (or <code>demo123</code>)</small>
        </div>

        ${isFaculty ? `
          <div class="field" style="margin-bottom:14px;">
            <label for="credNewMobile" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">New Registered Mobile Number</label>
            <input type="tel" id="credNewMobile" pattern="[0-9]{10}" maxlength="10" placeholder="${escapeHtml(u.mobileNumber || '10-digit mobile number')} (leave blank to keep current)" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
            <small style="color:#64748b;font-size:11.5px;display:block;margin-top:3px;">Used as primary key for faculty login.</small>
          </div>
        ` : ''}

        <div class="field" style="margin-bottom:14px;">
          <label for="credNewEmail" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">New Registered Email Address</label>
          <input type="email" id="credNewEmail" placeholder="e.g. yourname@gmail.com (leave blank to keep current)" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
          <small style="color:#64748b;font-size:11.5px;display:block;margin-top:3px;">Enter your new registered email address.</small>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label for="credNewPassword" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">New Password</label>
          <input type="password" id="credNewPassword" minlength="6" placeholder="Minimum 6 characters / letters / numbers (leave blank to keep current)" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
        </div>

        <div class="field" style="margin-bottom:18px;">
          <label for="credConfirmPassword" style="font-weight:600;display:block;margin-bottom:5px;font-size:13px;">Confirm New Password</label>
          <input type="password" id="credConfirmPassword" minlength="6" placeholder="Confirm new password" style="width:100%;height:40px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;font-size:13.5px;font-weight:600;">${icon('key', 15)} Update Credentials</button>
        </div>
      </form>
    `;

    openCustomModal({
      title: 'Change Login Credentials',
      content,
      maxWidth: '500px',
    });
  }

  /* ------------------------------------------------------------------ */
  /* Faculty Management Modal (Edit Button)                             */
  /* ------------------------------------------------------------------ */
  function openEditFacultyModal(mobileNumber) {
    const faculty = users.find((u) => u.role === 'faculty' && u.mobileNumber === mobileNumber);
    if (!faculty) {
      toast('Faculty record not found.', 'error');
      return;
    }

    const content = `
      <form id="editFacultyForm" onsubmit="event.preventDefault(); window.DDUGU_APP.handleEditFacultySubmit(event, '${escapeHtml(mobileNumber)}');">
        <div style="background:#eff6ff;padding:10px;border-radius:6px;border:1px solid #bfdbfe;margin-bottom:12px;font-size:12px;color:#1e40af;">
          ℹ️ Mobile number is the <strong>Primary Key and Login Identifier</strong>. Changing it will safely update all linked bookings, timetables, announcements, and conflict reports atomically.
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label for="editFacMobile" style="font-weight:600;display:block;margin-bottom:4px;">Faculty Mobile Number (Primary Key) <span class="req" style="color:#ef4444;">*</span></label>
          <input type="text" id="editFacMobile" required pattern="[0-9]{10}" maxlength="10" value="${escapeHtml(faculty.mobileNumber || '')}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13.5px;font-family:monospace;font-weight:700;">
          <small style="color:#64748b;font-size:11px;">Must be exactly 10 digits.</small>
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label for="editFacName" style="font-weight:600;display:block;margin-bottom:4px;">Faculty Name <span class="req" style="color:#ef4444;">*</span></label>
          <input type="text" id="editFacName" required value="${escapeHtml(faculty.name || '')}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label for="editFacDept" style="font-weight:600;display:block;margin-bottom:4px;">Department <span class="req" style="color:#ef4444;">*</span></label>
          <select id="editFacDept" required style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;background:white;">
            <option value="CSE" ${faculty.department === 'CSE' ? 'selected' : ''}>CSE</option>
            <option value="ECE" ${faculty.department === 'ECE' ? 'selected' : ''}>ECE</option>
            <option value="ME" ${faculty.department === 'ME' ? 'selected' : ''}>ME</option>
            <option value="IT" ${faculty.department === 'IT' ? 'selected' : ''}>IT</option>
            <option value="AI ML" ${faculty.department === 'AI ML' ? 'selected' : ''}>AI ML</option>
            <option value="AI DS" ${faculty.department === 'AI DS' ? 'selected' : ''}>AI DS</option>
            <option value="Administration" ${faculty.department === 'Administration' ? 'selected' : ''}>Administration</option>
          </select>
        </div>

        <div class="field" style="margin-bottom:16px;">
          <label for="editFacDesig" style="font-weight:600;display:block;margin-bottom:4px;">Designation</label>
          <input type="text" id="editFacDesig" value="${escapeHtml(faculty.designation || 'Asst. Prof.')}" placeholder="e.g. Asst. Prof. / Professor" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:10px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary">${icon('check', 15)} Save Faculty Details</button>
        </div>
      </form>
    `;

    openCustomModal({
      title: 'Edit Faculty Details',
      content,
      maxWidth: '500px',
    });
  }

  /* ------------------------------------------------------------------ */
  /* Admin Bookings Management page                                      */
  /* ------------------------------------------------------------------ */
  function renderAdminBookingsPage() {
    if (state.user.role !== 'admin') {
      return `<div class="card">${emptyState('🔒', 'Admins only', 'You need an administrator account to view this page.')}</div>`;
    }

    ensureBookingDraft();
    const draft = state.booking;
    const filter = state.adminBookingsFilter || { q: '', buildingId: 'all', status: 'all' };

    // Filter bookings
    let filtered = bookings.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (filter.buildingId !== 'all') {
      filtered = filtered.filter((b) => {
        const r = getRoom(b.roomId);
        return r && r.buildingId === filter.buildingId;
      });
    }
    if (filter.status !== 'all') {
      filtered = filtered.filter((b) => b.status === filter.status);
    }
    if (filter.q && filter.q.trim()) {
      const query = filter.q.toLowerCase().trim();
      filtered = filtered.filter((b) => {
        const r = getRoom(b.roomId);
        const u = getUser(b.userId);
        return (
          (b.title && b.title.toLowerCase().includes(query)) ||
          (b.audience && b.audience.toLowerCase().includes(query)) ||
          (r && r.name.toLowerCase().includes(query)) ||
          (u && u.name.toLowerCase().includes(query))
        );
      });
    }

    const activeCount = bookings.filter((b) => b.status !== 'cancelled').length;
    const pendingCount = bookings.filter((b) => b.status === 'pending').length;
    const todayCount = bookings.filter((b) => b.date === todayStr() && b.status !== 'cancelled').length;

    // Direct booking form setup
    const building = getBuilding(draft.buildingId) || buildings[0];
    const buildingRooms = rooms.filter((r) => r.buildingId === building.id && r.bookable !== false);
    const room = (getRoom(draft.roomId) && getRoom(draft.roomId).bookable !== false) ? getRoom(draft.roomId) : buildingRooms[0];
    const currentYear = draft.academicYear || '';
    const currentBranchFilter = draft.branchFilter || '';
    const selectedSections = Array.isArray(draft.selectedSections) ? draft.selectedSections : [];
    const totalStrength = calculateSelectedStrength(selectedSections);
    const roomCapacity = room ? room.capacity : 75;
    const isOverflow = totalStrength > roomCapacity;

    const allSections = getAllSections();
    const effectiveYear = currentYear || '1';
    const visibleSections = allSections.filter((s) => {
      const matchYear = s.yearId === effectiveYear;
      const matchBranch = !currentBranchFilter || currentBranchFilter === 'all' || s.branchId === currentBranchFilter;
      return matchYear && matchBranch;
    });

    const sectionCards = visibleSections.map((s) => {
      const isSelected = selectedSections.includes(s.id);
      return `
        <button type="button" class="section-pill ${isSelected ? 'active' : ''}" data-action="toggle-section" data-section-id="${s.id}"
          style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.65rem;border-radius:6px;border:1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#eff6ff' : '#ffffff'};cursor:pointer;font-size:0.8rem;font-weight:${isSelected ? '700' : '500'};color:${isSelected ? '#1e40af' : '#334155'};min-width:130px;transition:all 0.15s ease;">
          <span>${isSelected ? '☑ ' : '☐ '} ${escapeHtml(s.branchName)} ${s.sectionName ? `(${s.sectionName})` : ''}</span>
          <span style="background:${isSelected ? '#2563eb' : '#f1f5f9'};color:${isSelected ? '#ffffff' : '#64748b'};padding:1px 6px;border-radius:10px;font-size:0.72rem;font-weight:700;">${s.strength}</span>
        </button>`;
    }).join('');

    const bookingRows = filtered.length
      ? filtered.map((b) => {
          const r = getRoom(b.roomId);
          const bldg = r ? getBuilding(r.buildingId) : null;
          const u = getUser(b.userId);
          const slot = getSlot(b.timeSlotId);
          const activeRes = seatReservations.filter((r) => r.bookingId === b.id && r.status === 'active');
          const cap = r ? r.capacity : 75;
          return `
            <tr>
              <td>
                <span class="cell-strong">${escapeHtml(b.title)}</span>
                ${b.audience ? `<br><small style="color:#64748b;font-weight:500;">👥 ${escapeHtml(b.audience)} (${b.strength || 75} students)</small>` : ''}
              </td>
              <td>
                <strong>${escapeHtml(r ? r.name : '—')}</strong>
                <br><small class="text-muted">${escapeHtml(bldg ? bldg.name : '')} · ${r ? formatFloor(r.floor) : ''} (${r ? r.capacity : '—'} seats)</small>
              </td>
              <td>
                <div class="user-cell">
                  <span class="avatar" style="font-size:16px;">${u ? u.avatar : '👤'}</span>
                  <div>
                    <strong>${escapeHtml(u ? u.name : 'Direct Admin')}</strong>
                    <br><small class="text-muted">${escapeHtml(u ? (u.mobileNumber || u.role) : '')}</small>
                  </div>
                </div>
              </td>
              <td>
                <strong>${formatShortDate(b.date)}</strong>
                <br><small class="text-muted">${slot ? slot.label : ''}</small>
              </td>
              <td>
                <div style="display:inline-flex;align-items:center;gap:6px;">
                  ${b.status === 'confirmed' ? `
                    <button type="button" class="badge badge-blue" data-action="view-booked-seats" data-booking-id="${b.id}" style="cursor:pointer;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:11px;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:3px;" title="Click to view student reservations (${activeRes.length}/${cap} seats taken)">
                      🪑 ${activeRes.length}/${cap} Reserved
                    </button>
                  ` : ''}
                  ${statusBadge(b.status)}
                </div>
              </td>
              <td style="text-align:right;">
                <div class="table-actions" style="justify-content:flex-end;gap:6px;">
                  ${b.status === 'pending' ? `
                    <button type="button" class="btn btn-primary btn-sm" data-action="approve-booking" data-booking-id="${b.id}" style="padding:4px 8px;font-size:12px;">Approve</button>
                    <button type="button" class="btn btn-outline btn-sm" data-action="reject-booking" data-booking-id="${b.id}" style="padding:4px 8px;font-size:12px;">Reject</button>
                  ` : ''}
                  <button type="button" class="btn btn-danger btn-sm" data-action="admin-delete-booking" data-booking-id="${b.id}" style="padding:4px 8px;font-size:12px;background:#ef4444;color:white;border:none;" title="Delete booking permanently">
                    ${icon('trash', 12)} Delete
                  </button>
                </div>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6">${emptyState('📅', 'No bookings found', 'No bookings match the selected filters.')}</td></tr>`;

    const activeTab = state.adminBookingsTab || 'classroom';

    if (activeTab === 'seat-reservations') {
      const filter = state.seatResFilter || { q: '', lectureId: 'all', branch: 'all', year: 'all', section: 'all', status: 'all' };
      let seatList = seatReservations.slice().sort((a, b) => new Date(b.reservedAt) - new Date(a.reservedAt));

      if (filter.branch !== 'all') {
        seatList = seatList.filter((r) => String(r.branchCode).toUpperCase() === filter.branch.toUpperCase());
      }
      if (filter.year !== 'all') {
        seatList = seatList.filter((r) => String(r.academicYear) === String(filter.year));
      }
      if (filter.section !== 'all') {
        seatList = seatList.filter((r) => String(r.section).toUpperCase() === filter.section.toUpperCase());
      }
      if (filter.status !== 'all') {
        seatList = seatList.filter((r) => r.status === filter.status);
      }
      if (filter.q && filter.q.trim()) {
        const query = filter.q.toLowerCase().trim();
        seatList = seatList.filter((r) =>
          (r.studentName && r.studentName.toLowerCase().includes(query)) ||
          (r.seatNumber && r.seatNumber.toLowerCase().includes(query)) ||
          (r.branchCode && r.branchCode.toLowerCase().includes(query))
        );
      }

      const activeSeatCount = seatReservations.filter((r) => r.status === 'active').length;
      const cancelledSeatCount = seatReservations.filter((r) => r.status === 'cancelled').length;

      const seatRows = seatList.length ? seatList.map((r) => {
        const b = bookings.find((item) => item.id === r.bookingId);
        const rm = getRoom(r.roomId);
        const bldg = rm ? getBuilding(rm.buildingId) : null;
        return `
          <tr>
            <td>
              <div class="user-cell">
                <span class="avatar" style="font-size:16px;">👨‍🎓</span>
                <div>
                  <strong>${escapeHtml(r.studentName)}</strong>
                  <br><small class="text-muted">Student User ID: ${escapeHtml(r.studentUserId)}</small>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-blue">${formatYearLabel(r.academicYear)} · ${escapeHtml(r.branchCode)} · Sec ${escapeHtml(r.section)}</span>
            </td>
            <td>
              <strong>${escapeHtml(b ? b.title : 'Lecture')}</strong>
              ${b ? `<br><small class="text-muted">${formatDate(b.date)}</small>` : ''}
            </td>
            <td>
              <strong>${escapeHtml(rm ? rm.name : '—')}</strong>
              ${bldg ? `<br><small class="text-muted">${escapeHtml(bldg.name)}</small>` : ''}
            </td>
            <td>
              <span class="badge badge-green" style="font-size:12.5px;font-weight:800;">🪑 ${escapeHtml(r.seatNumber)}</span>
            </td>
            <td>${timeAgo(r.reservedAt)}</td>
            <td>${statusBadge(r.status)}</td>
            <td style="text-align:right;">
              ${r.status === 'active' ? `
                <button type="button" class="btn btn-sm btn-danger" data-action="cancel-seat-reservation" data-reservation-id="${r.id}" style="padding:2px 8px;font-size:11px;">Release Seat</button>
              ` : '—'}
            </td>
          </tr>`;
      }).join('') : `<tr><td colspan="8">${emptyState('🪑', 'No seat reservations match the filter', 'Adjust your filters or search query.')}</td></tr>`;

      return `
        <div class="page-head">
          <div>
            <h2>Bookings Overview & Requests</h2>
            <p>Oversee all faculty booking requests, approve or reject pending requests, and manage or delete bookings</p>
          </div>
          <div class="head-actions">
            <button type="button" class="btn btn-outline" data-action="go" data-page="schedule">${icon('clock', 15)} See Schedule</button>
            <button type="button" class="btn btn-outline" data-action="go" data-page="admin">${icon('settings', 15)} Admin Panel</button>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:1.5rem;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">
          <button type="button" class="btn btn-outline" data-action="set-admin-bookings-tab" data-tab="classroom">
            ${icon('calendar', 16)} Classroom Bookings (${bookings.length})
          </button>
          <button type="button" class="btn btn-primary" data-action="set-admin-bookings-tab" data-tab="seat-reservations">
            ${icon('chair', 16)} Student Seat Reservations (${seatReservations.length})
          </button>
        </div>

        <div class="stat-grid" style="margin-bottom:1.5rem;">
          ${statCard('chair', 'blue', activeSeatCount, 'Active Seat Reservations', 'Campus Lectures')}
          ${statCard('check', 'green', seatReservations.length, 'Total Reservations', 'Historical & active')}
          ${statCard('ban', 'amber', cancelledSeatCount, 'Cancelled Reservations', 'Seats freed up')}
        </div>

        <!-- Filters bar -->
        <div class="card" style="margin-bottom:1.25rem;padding:1rem;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;">
            <div>
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Search Student / Seat</label>
              <input type="text" placeholder="Search..." value="${escapeHtml(filter.q)}" oninput="state.seatResFilter.q = this.value; renderPage();" style="width:100%;padding:6px 8px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Academic Year</label>
              <select onchange="state.seatResFilter.year = this.value; renderPage();" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="all" ${filter.year === 'all' ? 'selected' : ''}>All Years</option>
                <option value="1" ${filter.year === '1' ? 'selected' : ''}>1st Year</option>
                <option value="2" ${filter.year === '2' ? 'selected' : ''}>2nd Year</option>
                <option value="3" ${filter.year === '3' ? 'selected' : ''}>3rd Year</option>
                <option value="4" ${filter.year === '4' ? 'selected' : ''}>4th Year</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Branch</label>
              <select onchange="state.seatResFilter.branch = this.value; renderPage();" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="all" ${filter.branch === 'all' ? 'selected' : ''}>All Branches</option>
                <option value="CSE" ${filter.branch === 'CSE' ? 'selected' : ''}>CSE</option>
                <option value="AI ML" ${filter.branch === 'AI ML' ? 'selected' : ''}>AI ML</option>
                <option value="AI DS" ${filter.branch === 'AI DS' ? 'selected' : ''}>AI DS</option>
                <option value="ECE" ${filter.branch === 'ECE' ? 'selected' : ''}>ECE</option>
                <option value="ME" ${filter.branch === 'ME' ? 'selected' : ''}>ME</option>
                <option value="IT" ${filter.branch === 'IT' ? 'selected' : ''}>IT</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Section</label>
              <select onchange="state.seatResFilter.section = this.value; renderPage();" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="all" ${filter.section === 'all' ? 'selected' : ''}>All Sections</option>
                <option value="A" ${filter.section === 'A' ? 'selected' : ''}>Section A</option>
                <option value="B" ${filter.section === 'B' ? 'selected' : ''}>Section B</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Status</label>
              <select onchange="state.seatResFilter.status = this.value; renderPage();" style="width:100%;padding:6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12.5px;background:white;">
                <option value="all" ${filter.status === 'all' ? 'selected' : ''}>All Statuses</option>
                <option value="active" ${filter.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="cancelled" ${filter.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Cohort</th>
                  <th>Lecture / Booking</th>
                  <th>Room</th>
                  <th>Seat</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${seatRows}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    return `
      <div class="page-head">
        <div>
          <h2>Bookings Overview & Requests</h2>
          <p>Oversee all faculty booking requests, approve or reject pending requests, and manage or delete bookings</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="schedule">${icon('clock', 15)} See Schedule</button>
          <button type="button" class="btn btn-outline" data-action="go" data-page="admin">${icon('settings', 15)} Admin Panel</button>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:1.5rem;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">
        <button type="button" class="btn btn-primary" data-action="set-admin-bookings-tab" data-tab="classroom">
          ${icon('calendar', 16)} Classroom Bookings (${bookings.length})
        </button>
        <button type="button" class="btn btn-outline" data-action="set-admin-bookings-tab" data-tab="seat-reservations">
          ${icon('chair', 16)} Student Seat Reservations (${seatReservations.length})
        </button>
      </div>

      <div class="stat-grid">
        ${statCard('calendar', 'blue', activeCount, 'Active Bookings', 'Campus-wide')}
        ${statCard('clock', pendingCount ? 'amber' : 'green', pendingCount, 'Pending Approvals', pendingCount ? 'Awaiting action' : 'All cleared')}
        ${statCard('check', 'teal', todayCount, "Today's Bookings", todayStr())}
      </div>

      <div class="grid-2-1" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
        <!-- Add Booking Directly as Admin -->
        <div class="card">
          <div class="card-head">
            <div>
              <h3>➕ Add New Booking</h3>
              <p>Create and confirm a booking immediately for any room and class</p>
            </div>
            <span class="badge badge-violet">Admin Authority</span>
          </div>
          <div class="card-body">
            <form id="adminDirectBookingForm">
              <div class="form-row">
                <div class="field">
                  <label for="adminBookBuilding">Building <span class="req">*</span></label>
                  <select id="adminBookBuilding" name="buildingId">
                    ${buildings.map((b) => `<option value="${b.id}" ${draft.buildingId === b.id ? 'selected' : ''}>${b.icon} ${escapeHtml(b.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label for="adminBookRoom">Room <span class="req">*</span></label>
                  <select id="adminBookRoom" name="roomId">
                    ${buildingRooms.map((r) => `<option value="${r.id}" ${draft.roomId === r.id ? 'selected' : ''}>${escapeHtml(r.name)} (${r.capacity} seats, ${formatFloor(r.floor)})</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="field">
                  <label for="adminBookDate">Date <span class="req">*</span></label>
                  <input type="date" id="adminBookDate" name="date" min="${todayStr()}" value="${draft.date || todayStr()}">
                </div>
                <div class="field">
                  <label for="adminBookSlot">Time Slot <span class="req">*</span></label>
                  <select id="adminBookSlot" name="slotId">
                    ${timeSlots.map((slot) => `<option value="${slot.id}" ${draft.slotId === slot.id ? 'selected' : ''}>${slot.label} (${slot.start} - ${slot.end})</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="field">
                <label for="adminBookTitle">Booking Purpose / Title <span class="req">*</span></label>
                <input type="text" id="adminBookTitle" placeholder="e.g. Distributed Systems Special Lecture" required>
              </div>

              <div class="field">
                <label for="adminBookRequester">Booked For / Faculty Name</label>
                <input type="text" id="adminBookRequester" placeholder="e.g. Prof. Priya Sharma (or Department)">
              </div>

              <!-- Student Audience & Strength Section -->
              <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:0.85rem;margin:0.75rem 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.4rem;">
                  <strong style="font-size:0.85rem;color:#1e293b;">🎓 Select Audience (Branch & Year)</strong>
                  <span class="badge ${isOverflow ? 'badge-red' : 'badge-green'}" style="font-size:0.78rem;font-weight:700;">
                    ${totalStrength} Students / ${roomCapacity} Seats ${isOverflow ? `(⚠️ Exceeds by ${totalStrength - roomCapacity})` : '✓'}
                  </span>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
                  <div>
                    <label for="bookAcademicYear" style="font-size:0.74rem;font-weight:600;color:#64748b;display:block;">Year</label>
                    <select id="bookAcademicYear" style="width:100%;padding:0.35rem;border-radius:5px;border:1px solid #cbd5e1;font-size:0.82rem;background:white;">
                      <option value="" ${!currentYear ? 'selected' : ''}>Choose</option>
                      ${academic.years.map((y) => `<option value="${y.id}" ${currentYear === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label for="bookAcademicBranchFilter" style="font-size:0.74rem;font-weight:600;color:#64748b;display:block;">Branch</label>
                    <select id="bookAcademicBranchFilter" style="width:100%;padding:0.35rem;border-radius:5px;border:1px solid #cbd5e1;font-size:0.82rem;background:white;">
                      <option value="" ${!currentBranchFilter ? 'selected' : ''}>Choose</option>
                      <option value="all" ${currentBranchFilter === 'all' ? 'selected' : ''}>All Branches</option>
                      ${academic.branches.map((b) => `<option value="${b.id}" ${currentBranchFilter === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;max-height:140px;overflow-y:auto;padding:2px;">
                  ${sectionCards}
                </div>
              </div>

              ${isOverflow ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;padding:0.6rem;border-radius:6px;margin-bottom:0.75rem;font-size:0.82rem;color:#991b1b;">
                  ⚠️ <strong>Capacity Warning:</strong> Total student strength (${totalStrength}) exceeds room capacity (${roomCapacity}). A confirmation window will appear upon submitting.
                </div>
              ` : ''}

              <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
                ${icon('check', 16)} Add & Confirm Booking
              </button>
            </form>
          </div>
        </div>

        <!-- Campus Booking Directory Overview / Tips -->
        <div class="card">
          <div class="card-head">
            <div>
              <h3>📋 Room Capacities & Rules</h3>
              <p>Campus standard sizes and academic allocations</p>
            </div>
          </div>
          <div class="card-body">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:0.85rem;border-radius:8px;margin-bottom:1rem;">
              <strong style="color:#166534;display:block;margin-bottom:4px;">🏢 Campus Room Capacities</strong>
              <ul style="margin:0;padding-left:1.2rem;font-size:0.85rem;color:#15803d;line-height:1.6;">
                <li><strong>All Classrooms (IET & Deeksha Bhawan):</strong> Approx 75 students capacity</li>
                <li><strong>Seminar Hall (IET 32):</strong> Approx 200 students capacity</li>
                <li><strong>Library (IET Ground Floor):</strong> Approx 150–180 students capacity</li>
              </ul>
            </div>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:0.85rem;border-radius:8px;margin-bottom:1rem;">
              <strong style="color:#1e40af;display:block;margin-bottom:4px;">🎓 IET Branches & Section Strengths (75 per section)</strong>
              <div style="font-size:0.83rem;color:#1d4ed8;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
                <span>• <strong>CSE:</strong> 150 (Sec A: 75, B: 75)</span>
                <span>• <strong>AI ML:</strong> 150 (Sec A: 75, B: 75)</span>
                <span>• <strong>AI DS:</strong> 75 students</span>
                <span>• <strong>ECE:</strong> 75 students</span>
                <span>• <strong>ME:</strong> 75 students</span>
                <span>• <strong>IT:</strong> 75 students</span>
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:0.85rem;border-radius:8px;">
              <strong style="color:#334155;display:block;margin-bottom:4px;">🛡️ Administrator Controls</strong>
              <p style="margin:0;font-size:0.83rem;color:#64748b;line-height:1.5;">
                • To <strong>delete</strong> any booking immediately and free up the room, click the red <strong>Delete</strong> button in the table below.<br>
                • As an admin, direct bookings are instantly confirmed and reserved on the master schedule.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- All Campus Bookings Table -->
      <div class="card" style="margin-top:1.5rem;">
        <div class="card-head" style="flex-wrap:wrap;gap:1rem;">
          <div>
            <h3>All Campus Bookings (${filtered.length})</h3>
            <p>Search, filter, approve, or delete reservations across all floors</p>
          </div>
          <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">
            <input type="text" id="adminBookingsSearch" placeholder="🔍 Search booking or room..." value="${escapeHtml(filter.q || '')}" style="padding:0.4rem 0.75rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;width:200px;">
            <select id="adminBookingsFilterBuilding" style="padding:0.4rem 0.6rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;background:white;">
              <option value="all" ${filter.buildingId === 'all' ? 'selected' : ''}>All Buildings</option>
              ${buildings.map((b) => `<option value="${b.id}" ${filter.buildingId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
            <select id="adminBookingsFilterStatus" style="padding:0.4rem 0.6rem;border-radius:6px;border:1px solid #cbd5e1;font-size:0.85rem;background:white;">
              <option value="all" ${filter.status === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="confirmed" ${filter.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="pending" ${filter.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="cancelled" ${filter.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Booking Purpose & Audience</th>
                <th>Room & Location</th>
                <th>Booked By</th>
                <th>Date & Slot</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${bookingRows}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Admin panel                                                         */
  /* ------------------------------------------------------------------ */
  function renderAdminPage() {
    if (state.user.role !== 'admin') {
      return `<div class="card">${emptyState('🔒', 'Admins only', 'You need an administrator account to view this page.')}</div>`;
    }

    const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled');
    const pending = sortBookingsList(bookings.filter((booking) => booking.status === 'pending'));
    const openConflicts = conflicts.filter((conflict) => conflict.status === 'reported').length;
    const recent = bookings
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);

    const pendingRows = pending.length
      ? pending.map((booking) => {
          const room = getRoom(booking.roomId);
          const slot = getSlot(booking.timeSlotId);
          const requester = getUser(booking.userId);
          return `
            <tr>
              <td>
                <div class="user-cell">
                  <span class="avatar">${requester ? requester.avatar : '👤'}</span>
                  <div>
                    <strong>${escapeHtml(requester ? requester.name : 'Unknown')}</strong>
                    <small>${escapeHtml(requester ? requester.role : '')}</small>
                  </div>
                </div>
              </td>
              <td>
                <span class="cell-strong">${escapeHtml(booking.title)}</span><br>
                <small class="text-muted">${escapeHtml(room ? room.name : '')}</small>
              </td>
              <td>${formatShortDate(booking.date)}<br><small class="text-muted">${slot ? slot.label : ''}</small></td>
              <td>
                <div class="table-actions">
                  <button type="button" class="btn btn-primary" data-action="approve-booking" data-booking-id="${booking.id}">${icon('check', 13)} Approve</button>
                  <button type="button" class="btn btn-danger" data-action="reject-booking" data-booking-id="${booking.id}">Reject</button>
                </div>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4">${emptyState('✅', 'No pending requests', 'All booking requests have been reviewed.')}</td></tr>`;

    const recentRows = recent.map((booking) => {
      const room = getRoom(booking.roomId);
      const user = getUser(booking.userId);
      return `
        <tr>
          <td><span class="cell-strong">${escapeHtml(booking.title)}</span></td>
          <td>${escapeHtml(room ? room.name : '—')}</td>
          <td>${escapeHtml(user ? firstName(user.name) : '—')}</td>
          <td>${formatShortDate(booking.date)}</td>
          <td>${statusBadge(booking.status)}</td>
          <td style="text-align:right;">
            <button type="button" class="btn btn-danger btn-sm" data-action="admin-delete-booking" data-booking-id="${booking.id}" style="padding:3px 8px;font-size:11px;background:#ef4444;color:white;border:none;">Delete</button>
          </td>
        </tr>`;
    }).join('');

    const facultyList = users.filter((u) => u.role === 'faculty');
    const facultyRows = facultyList.length
      ? facultyList.map((f) => {
          return `
            <tr>
              <td><span style="font-family:monospace;font-weight:600;background:#f1f5f9;padding:2px 8px;border-radius:4px;">📞 ${escapeHtml(f.mobileNumber || '—')}</span></td>
              <td><strong>${escapeHtml(f.name)}</strong></td>
              <td><span class="badge badge-blue">${escapeHtml(f.department || '—')}</span></td>
              <td>${escapeHtml(f.designation || 'Faculty')}</td>
              <td style="text-align:right;white-space:nowrap;">
                <button type="button" class="btn btn-outline btn-sm" data-action="edit-faculty" data-mobile="${escapeHtml(f.mobileNumber || '')}" style="padding:3px 8px;font-size:12px;margin-right:6px;">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" data-action="remove-faculty" data-mobile="${escapeHtml(f.mobileNumber || '')}" style="padding:3px 8px;font-size:12px;">Remove</button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="5">${emptyState('👨‍🏫', 'No faculty members', 'Add faculty members using the form below.')}</td></tr>`;

    const userRows = users.map((user) => {
      const badge = user.role === 'admin' ? 'badge-violet' : user.role === 'faculty' ? 'badge-blue' : 'badge-green';
      return `
        <tr>
          <td>
            <div class="user-cell">
              <span class="avatar">${user.avatar}</span>
              <div>
                <strong>${escapeHtml(user.name)}</strong>
                <small>${escapeHtml(user.email)}</small>
              </div>
            </div>
          </td>
          <td>${escapeHtml(user.department || '—')}</td>
          <td><span class="badge ${badge}">${user.role}</span></td>
        </tr>`;
    }).join('');

    return `
      <div class="page-head">
        <div>
          <h2>Admin panel</h2>
          <p>Approve requests and keep an eye on the whole campus.</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn btn-outline" data-action="go" data-page="conflicts">${icon('alert', 16)} Conflicts (${openConflicts})</button>
        </div>
      </div>

      <div class="stats-grid">
        ${statCard('calendar', '', activeBookings.length, 'Active bookings', 'Confirmed + pending')}
        ${statCard('clock', 'amber', pending.length, 'Pending approvals', pending.length ? 'Needs review' : 'All clear')}
        ${statCard('alert', 'red', openConflicts, 'Open conflicts', openConflicts ? 'Needs attention' : 'All clear')}
        ${statCard('users', 'teal', users.length, 'Registered users', 'Demo accounts')}
      </div>

      <div class="admin-grid">
        <!-- Admin Profile Section -->
        <div class="card" style="grid-column: 1 / -1; border-radius: 14px; border: 1px solid #e2e8f0; padding: 22px 26px; background: #ffffff; box-shadow: 0 4px 12px rgba(15,23,42,0.03); margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="width:52px;height:52px;border-radius:12px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #ddd6fe;flex-shrink:0;">
                ${escapeHtml(state.user.avatar || '👨‍💼')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span class="badge badge-violet" style="font-weight: 700; font-size: 11px;">Admin Profile</span>
                  <span style="font-size: 12px; color: #64748b;">Administrator Information</span>
                </div>
                <h3 style="margin: 0 0 4px; font-size: 1.15rem; font-weight: 700; color: #0f172a;">${escapeHtml(state.user.name)}</h3>
                <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13.5px;color:#475569;margin-top:4px;">
                  <span>🏷️ Designation: <strong style="color:#0f172a;">${escapeHtml(state.user.designation || 'Campus Administrator')}</strong></span>
                  <span style="color:#cbd5e1;">•</span>
                  <span>🏢 Dept: <strong>${escapeHtml(state.user.department || 'Administration')}</strong></span>
                  ${state.user.phone ? `<span style="color:#cbd5e1;">•</span><span>📞 <strong>${escapeHtml(state.user.phone)}</strong></span>` : ''}
                </div>
              </div>
            </div>
            <div>
              <button type="button" class="btn btn-outline" onclick="event.preventDefault(); window.DDUGU_APP.openProfileModal();" data-action="open-profile-modal" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13.5px; font-weight: 600; border-radius: 8px; border: 1.5px solid #cbd5e1;">
                ${icon('user', 16)} Edit Profile
              </button>
            </div>
          </div>
        </div>

        <!-- Admin Login Credentials Section -->
        <div class="card" style="grid-column: 1 / -1; border-radius: 14px; border: 1px solid #e2e8f0; padding: 22px 26px; background: #ffffff; box-shadow: 0 4px 12px rgba(15,23,42,0.03); margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge badge-violet" style="font-weight: 700; font-size: 11px;">Admin Profile Security</span>
                <span style="font-size: 12px; color: #64748b;">Primary Account Authentication</span>
              </div>
              <h3 style="margin: 0 0 4px; font-size: 1.15rem; font-weight: 700; color: #0f172a;">Change Login Credentials</h3>
              <p style="margin: 0; font-size: 13.5px; color: #475569;">
                Registered Admin Email: <strong style="color: #0f172a;">${escapeHtml(state.user.email)}</strong> · Password: <strong>••••••••</strong>
              </p>
            </div>
            <div>
              <button type="button" class="btn btn-primary" onclick="event.preventDefault(); window.DDUGU_APP.openChangeCredentialsModal();" data-action="open-change-credentials" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13.5px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                ${icon('key', 16)} Change Credentials
              </button>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-head">
            <div>
              <h3>Faculty Management</h3>
              <p>Add and remove faculty members. (mobile_number, name, department, designation)</p>
            </div>
            <span class="badge badge-blue">${facultyList.length} faculty</span>
          </div>

          <form id="adminFacultyForm" style="display:flex;gap:0.75rem;flex-wrap:wrap;padding:1rem;background:var(--surface,#f8fafc);border-radius:8px;margin-bottom:1.25rem;align-items:flex-end;">
            <div style="flex:1;min-width:140px;">
              <label style="font-size:0.75rem;font-weight:600;display:block;margin-bottom:0.25rem;">Mobile Number (Primary Key) *</label>
              <input type="tel" id="adminFacultyMobile" placeholder="10-digit number" maxlength="10" required style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">
            </div>
            <div style="flex:1.5;min-width:180px;">
              <label style="font-size:0.75rem;font-weight:600;display:block;margin-bottom:0.25rem;">Faculty Name *</label>
              <input type="text" id="adminFacultyName" placeholder="e.g. Dr. Rajesh Kumar" required style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">
            </div>
            <div style="flex:1;min-width:120px;">
              <label style="font-size:0.75rem;font-weight:600;display:block;margin-bottom:0.25rem;">Department *</label>
              <select id="adminFacultyDept" required style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;background:white;">
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="IT">IT</option>
                <option value="ME">ME</option>
                <option value="APPLIED">APPLIED</option>
                <option value="PHYSICS">PHYSICS</option>
                <option value="CHEMISTRY">CHEMISTRY</option>
                <option value="MATH">MATH</option>
              </select>
            </div>
            <div style="flex:1;min-width:130px;">
              <label style="font-size:0.75rem;font-weight:600;display:block;margin-bottom:0.25rem;">Designation</label>
              <select id="adminFacultyDesig" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;background:white;">
                <option value="Asst. Prof.">Asst. Prof.</option>
                <option value="Assoc. Prof.">Assoc. Prof.</option>
                <option value="Professor">Professor</option>
                <option value="Guest Faculty">Guest Faculty</option>
              </select>
            </div>
            <div>
              <button type="submit" class="btn btn-primary" style="padding:0.55rem 1.25rem;">Add Faculty</button>
            </div>
          </form>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Mobile Number</th><th>Faculty Name</th><th>Department</th><th>Designation</th><th style="text-align:right;">Actions</th></tr>
              </thead>
              <tbody>${facultyRows}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <h3>Pending approvals</h3>
              <p>Student booking requests waiting for a decision</p>
            </div>
            <span class="badge ${pending.length ? 'badge-amber' : 'badge-green'}">${pending.length} pending</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Requester</th><th>Booking</th><th>When</th><th>Actions</th></tr>
              </thead>
              <tbody>${pendingRows}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <h3>Recent bookings</h3>
              <p>The latest reservations across both buildings</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" data-action="go" data-page="bookings">Manage All Bookings →</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Purpose</th><th>Room</th><th>Booked by</th><th>Date</th><th>Status</th><th style="text-align:right;">Actions</th></tr>
              </thead>
              <tbody>${recentRows || `<tr><td colspan="6">${emptyState('📅', 'No bookings', 'New bookings will appear here.')}</td></tr>`}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <h3>Users</h3>
              <p>Accounts with access to the booking system</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>User</th><th>Department</th><th>Role</th></tr>
              </thead>
              <tbody>${userRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    loadStoredData();
    wireEvents();

    $('#email').value = roleIdentifiers[selectedRole] || '';
    const initialUser = users.find((u) => u.role === selectedRole);
    $('#password').value = (initialUser && initialUser.password) ? initialUser.password : 'demo123';

    const sessionId = storage.get(KEYS.session, null);
    const user = users.find((item) => item.id === sessionId);

    if (user) {
      enterApp(user);
    } else {
      $('#loginPage').classList.remove('hidden');
      $('#app').classList.add('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DDUGU_APP = {
    handleAnnouncementSubmit(event) {
      const title = $('#annTitle').value.trim();
      const message = $('#annMessage').value.trim();
      const audienceType = $('#annAudienceType').value;
      const priority = $('#annPriority').value;
      const expiry = $('#annExpiry').value || null;

      let targetRoles = ['faculty', 'student'];
      let targetFacultyIds = [];
      let targetYear = null;
      let targetBranch = null;
      let targetSection = null;

      if (audienceType === 'selected_faculty') {
        targetRoles = ['faculty'];
        targetFacultyIds = $$('input[name="targetFaculty"]:checked').map((cb) => cb.value);
        if (targetFacultyIds.length === 0) {
          toast('Please select at least one faculty member.', 'warning');
          return;
        }
      } else if (audienceType === 'selected_students') {
        targetRoles = ['student'];
        targetYear = $('#targetYear').value ? Number($('#targetYear').value) : null;
        targetBranch = $('#targetBranch').value || null;
        targetSection = $('#targetSection').value || null;
      }

      const newAnn = {
        id: 'ann-' + Date.now(),
        title,
        content: message,
        authorId: state.user.id,
        authorRole: state.user.role,
        creatorName: state.user.name,
        audienceType,
        targetRoles,
        targetFacultyIds,
        targetAcademicYear: targetYear,
        targetBranchCode: targetBranch,
        targetSection,
        priority,
        expiryDate: expiry,
        createdAt: new Date().toISOString(),
      };

      announcements.unshift(newAnn);
      saveAnnouncements();
      closeModal();
      toast('Announcement published successfully.', 'success');
      renderPage();
    },

    onAudienceTypeChange(val) {
      const facultyBox = $('#targetFacultyBox');
      const studentBox = $('#targetStudentsBox');
      if (facultyBox) facultyBox.style.display = val === 'selected_faculty' ? 'block' : 'none';
      if (studentBox) studentBox.style.display = val === 'selected_students' ? 'block' : 'none';
    },

    filterFacultyCheckboxes(query) {
      const q = query.trim().toLowerCase();
      $$('#facultyListContainer .faculty-select-item').forEach((el) => {
        const text = el.dataset.facultyItem || '';
        el.style.display = !q || text.includes(q) ? 'flex' : 'none';
      });
    },

    handleConflictSubmit(event) {
      const title = $('#confTitle').value.trim();
      const roomId = $('#confRoom').value;
      const bookingId = $('#confBooking').value || null;
      const seatId = ($('#confSeat').value || '').trim() || null;
      const description = $('#confDescription').value.trim();
      const isFaculty = state.user.role === 'faculty';

      const newConflict = {
        id: 'conflict-' + Date.now(),
        reporterType: isFaculty ? 'faculty' : 'student',
        reporterUserId: state.user.id,
        reporterFacultyMobile: isFaculty ? (state.user.mobileNumber || '') : null,
        reporterName: state.user.name,
        priority: isFaculty ? 'high' : 'normal',
        roomId,
        bookingId,
        seatId,
        title,
        description,
        status: 'pending',
        resolutionNote: null,
        history: [
          {
            status: 'pending',
            actionBy: state.user.name,
            note: isFaculty ? 'High priority conflict submitted by Faculty' : 'Conflict report submitted by Student',
            timestamp: new Date().toISOString(),
          },
        ],
        reportedAt: new Date().toISOString(),
      };

      conflicts.unshift(newConflict);
      saveConflicts();
      toast(isFaculty ? 'Faculty conflict submitted with High Priority!' : 'Conflict report submitted successfully.', 'success');
      renderPage();
    },

    handleConflictResolutionSubmit(conflictId, form) {
      const conflict = conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;
      const newStatus = form.status.value;
      const note = form.note.value.trim();

      if (newStatus === 'resolved') {
        const idx = conflicts.findIndex((c) => c.id === conflictId);
        if (idx !== -1) {
          conflicts.splice(idx, 1);
        }
        saveConflicts();
        toast('Conflict marked as RESOLVED and permanently deleted from all profiles.', 'success');
        renderPage();
        return;
      }

      const oldStatus = conflict.status;
      conflict.status = newStatus;
      conflict.resolutionNote = note || conflict.resolutionNote;

      if (!Array.isArray(conflict.history)) conflict.history = [];
      conflict.history.push({
        status: newStatus,
        fromStatus: oldStatus,
        actionBy: state.user.name,
        note: note || `Status transitioned to ${newStatus}`,
        timestamp: new Date().toISOString(),
      });

      saveConflicts();
      toast(`Conflict marked as ${newStatus.toUpperCase().replace('_', ' ')}.`, 'success');
      renderPage();
    },

    onCohortChange(field, val) {
      state.booking[field] = val;
      renderPage();
    },

    onReserveFilterChange(field, val) {
      if (!state.studentReserveFilter) {
        state.studentReserveFilter = { date: '', facultyId: 'all' };
      }
      state.studentReserveFilter[field] = val;
      renderPage();
    },

    clearReserveFilters() {
      state.studentReserveFilter = { date: '', facultyId: 'all' };
      renderPage();
    },

    onAdminScheduleFilterChange(field, val) {
      if (!state.adminScheduleFilter) {
        state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      }
      state.adminScheduleFilter[field] = val;
      renderPage();
    },

    clearAdminScheduleFilters() {
      state.adminScheduleFilter = { date: '', facultyId: 'all', branch: 'all' };
      renderPage();
    },

    onSeatResFilterChange(field, val) {
      if (!state.seatResFilter) {
        state.seatResFilter = { q: '', lectureId: 'all', branch: 'all', year: 'all', section: 'all', status: 'all' };
      }
      state.seatResFilter[field] = val;
      renderPage();
    },

    onRoomFilterChange(field, val) {
      if (!state.filters) {
        state.filters = { q: '', buildingId: 'all', type: 'all', capacity: 'any', slotId: 'all', date: todayStr() };
      }
      state.filters[field] = val;
      refreshRoomResults();
    },

    quickReserveSeat(bookingId) {
      quickReserveSeat(bookingId);
    },

    openProfileModal() {
      closeDropdowns();
      openProfileModal();
    },

    handleProfileSubmit(event) {
      handleProfileSubmit(event);
    },

    openChangeCredentialsModal() {
      closeDropdowns();
      openChangeCredentialsModal();
    },

    handleChangeCredentialsSubmit(event) {
      const currentPass = $('#credCurrentPassword').value;
      const newEmail = $('#credNewEmail') ? $('#credNewEmail').value.trim() : '';
      const newPass = $('#credNewPassword') ? $('#credNewPassword').value : '';
      const confirmPass = $('#credConfirmPassword') ? $('#credConfirmPassword').value : '';
      const newMobile = $('#credNewMobile') ? $('#credNewMobile').value.trim() : '';

      // 1. Validate current password
      const expectedPass = state.user.password || (
        state.user.role === 'admin'
          ? 'adminpassword123'
          : (state.user.role === 'faculty' ? 'facultypassword123' : 'studentpassword123')
      );
      if (currentPass !== expectedPass && currentPass !== 'demo123') {
        toast(`Current password incorrect. (Default demo: ${expectedPass})`, 'error');
        return;
      }

      if (!newEmail && !newPass && !newMobile) {
        toast('Please enter a new mobile number, email address, or password to update.', 'warning');
        return;
      }

      // 2. Validate mobile if entered
      let targetMobile = state.user.mobileNumber || state.user.phone;
      if (newMobile) {
        if (!/^[0-9]{10}$/.test(newMobile)) {
          toast('Mobile number must be exactly 10 digits.', 'error');
          return;
        }
        const duplicateMobile = users.find((u) => u.id !== state.user.id && (u.mobileNumber === newMobile || u.phone === newMobile));
        if (duplicateMobile) {
          toast('This mobile number is already registered to another account.', 'error');
          return;
        }
        targetMobile = newMobile;
      }

      // 3. Validate email if entered
      let targetEmail = state.user.email;
      if (newEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
          toast('Please enter a valid email address.', 'error');
          return;
        }

        const duplicate = users.find((u) => u.id !== state.user.id && u.email && u.email.toLowerCase() === newEmail.toLowerCase());
        if (duplicate) {
          toast('This email address is already registered to another account.', 'error');
          return;
        }
        targetEmail = newEmail;
      }

      // 4. Validate password if entered
      let targetPass = state.user.password || expectedPass;
      if (newPass) {
        if (newPass.length < 6) {
          toast('New password must be at least 6 characters (letters/numbers).', 'error');
          return;
        }

        if (newPass !== confirmPass) {
          toast('New password and confirmation do not match.', 'error');
          return;
        }
        targetPass = newPass;
      }

      // Update user credentials
      state.user.email = targetEmail;
      state.user.password = targetPass;
      if (newMobile) {
        state.user.mobileNumber = targetMobile;
        state.user.phone = targetMobile;
      }

      const userRecord = users.find((u) => u.id === state.user.id);
      if (userRecord) {
        userRecord.email = targetEmail;
        userRecord.password = targetPass;
        if (newMobile) {
          userRecord.mobileNumber = targetMobile;
          userRecord.phone = targetMobile;
        }
      }
      saveUsers();
      storage.set(KEYS.session, state.user.id);
      if (roleIdentifiers && state.user.role) {
        roleIdentifiers[state.user.role] = state.user.role === 'faculty' ? targetMobile : targetEmail;
      }

      // Try syncing immediately with backend API if running
      try {
        const token = storage.get(KEYS.token, null);
        fetch('http://localhost:8000/api/v1/auth/change-credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            current_password: currentPass,
            new_email: newEmail || null,
            new_password: newPass || null,
          }),
        }).catch(() => {});
      } catch (e) {}
      storage.set(KEYS.session, state.user.id);
      updateProfile();
      closeModal();
      toast('Login credentials updated successfully!', 'success');
      renderPage();
    },

    handleEditFacultySubmit(event, oldMobile) {
      const faculty = users.find((u) => u.role === 'faculty' && u.mobileNumber === oldMobile);
      if (!faculty) return;

      const newMobile = $('#editFacMobile').value.trim();
      const newName = $('#editFacName').value.trim();
      const newDept = $('#editFacDept').value.trim();
      const newDesig = $('#editFacDesig').value.trim();

      if (!/^\d{10}$/.test(newMobile)) {
        toast('Mobile number must be exactly 10 digits.', 'error');
        return;
      }

      if (newMobile !== oldMobile) {
        const exists = users.find((u) => u.role === 'faculty' && u.mobileNumber === newMobile);
        if (exists) {
          toast('Another faculty member already has this mobile number.', 'error');
          return;
        }
      }

      // Atomic update
      faculty.name = newName;
      faculty.department = newDept;
      faculty.designation = newDesig;

      if (newMobile !== oldMobile) {
        faculty.mobileNumber = newMobile;

        // Cascade to bookings
        bookings.forEach((b) => {
          if (b.userId === faculty.id || b.facultyMobileNumber === oldMobile) {
            b.facultyMobileNumber = newMobile;
          }
        });
        saveBookings();

        // Cascade to announcements
        announcements.forEach((a) => {
          if (a.authorId === faculty.id || a.created_by_faculty_mobile === oldMobile) {
            a.created_by_faculty_mobile = newMobile;
          }
        });
        saveAnnouncements();

        // Cascade to conflict reports
        conflicts.forEach((c) => {
          if (c.reporterFacultyMobile === oldMobile) {
            c.reporterFacultyMobile = newMobile;
          }
        });
        saveConflicts();

        // Log audit event
        adminAuditLogs.unshift({
          id: 'log-' + Date.now(),
          adminName: state.user.name,
          action: 'UPDATE_FACULTY_MOBILE',
          targetType: 'faculty',
          targetId: newMobile,
          details: `Updated mobile number from ${oldMobile} to ${newMobile} for ${newName}`,
          createdAt: new Date().toISOString(),
        });
        saveAdminAuditLogs();
      }

      saveUsers();
      closeModal();
      toast('Faculty details and linked records updated successfully.', 'success');
      renderPage();
    },
  };

  window.app = {
    logout,
    navigate,
    selectRoom,
    openBuilding,
    getState: () => state,
  };
})();
