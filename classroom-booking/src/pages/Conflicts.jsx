import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  Users,
  Building2,
  Armchair,
  Calendar,
  X,
  MessageSquare,
  ShieldAlert,
  Flame,
  Check,
  History,
} from 'lucide-react';

export function Conflicts() {
  const { user } = useAuth();
  const {
    allConflicts,
    allBookings,
    allRooms,
    timeSlots,
    reportConflict,
    updateConflictStatus,
  } = useBooking();

  const isAdmin = user?.role === 'admin';
  const isFaculty = user?.role === 'faculty';

  const [showReportModal, setShowReportModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);

  // New conflict report form state
  const [reportForm, setReportForm] = useState({
    roomId: '',
    bookingId: '',
    seatId: '',
    title: '',
    description: '',
  });

  // Admin resolution action state
  const [resolvingConflict, setResolvingConflict] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('resolved');
  const [resolutionNote, setResolutionNote] = useState('');

  const showBanner = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filter conflicts for display
  const displayedConflicts = useMemo(() => {
    return allConflicts
      .filter((conflict) => {
        // Resolved conflicts are permanently cleared from system
        if (conflict.status === 'resolved') return false;

        // If student or faculty (non-admin), show reports submitted by them
        if (!isAdmin) {
          const isMyReport =
            conflict.reporterUserId === user?.id ||
            conflict.reporterFacultyMobile === user?.mobileNumber ||
            conflict.reporterFacultyMobile === user?.mobile_number ||
            conflict.reporterName === user?.name;
          if (!isMyReport) return false;
        }

        // Status filter
        if (filterStatus !== 'all' && conflict.status !== filterStatus) return false;

        // Priority filter
        if (filterPriority !== 'all' && conflict.priority !== filterPriority) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = conflict.title?.toLowerCase().includes(q);
          const matchDesc = conflict.description?.toLowerCase().includes(q);
          const matchReporter = conflict.reporterName?.toLowerCase().includes(q);
          const room = allRooms.find((r) => r.id === conflict.roomId);
          const matchRoom = room?.name?.toLowerCase().includes(q);
          return matchTitle || matchDesc || matchReporter || matchRoom;
        }

        return true;
      })
      .sort((a, b) => {
        // High priority first, then most recent
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      });
  }, [allConflicts, isAdmin, user, filterStatus, filterPriority, searchQuery, allRooms]);

  // Submit new report
  const handleReportSubmit = (e) => {
    e.preventDefault();

    if (!reportForm.roomId) {
      showBanner('error', 'Please select the affected classroom or space.');
      return;
    }
    if (!reportForm.title.trim()) {
      showBanner('error', 'Please provide a title for the conflict.');
      return;
    }
    if (!reportForm.description.trim()) {
      showBanner('error', 'Please describe the conflict in detail.');
      return;
    }

    const payload = {
      reporterType: isFaculty ? 'faculty' : 'student',
      reporterUserId: user?.id || 'user-1',
      reporterFacultyMobile: isFaculty ? (user?.mobileNumber || user?.mobile_number || '9506889898') : null,
      reporterName: user?.name || (isFaculty ? 'Faculty Member' : 'Student'),
      roomId: reportForm.roomId,
      bookingId: reportForm.bookingId || null,
      seatId: reportForm.seatId ? reportForm.seatId.trim() : null,
      title: reportForm.title.trim(),
      description: reportForm.description.trim(),
      priority: isFaculty ? 'high' : 'normal',
    };

    reportConflict(payload);
    showBanner(
      'success',
      isFaculty
        ? '🔥 High-Priority Faculty Conflict submitted. Admin notified for immediate review.'
        : 'Conflict report submitted successfully. An administrator will review it shortly.'
    );

    setShowReportModal(false);
    setReportForm({
      roomId: '',
      bookingId: '',
      seatId: '',
      title: '',
      description: '',
    });
  };

  // Admin submit resolution
  const handleResolutionSubmit = (e) => {
    e.preventDefault();
    if (!resolvingConflict) return;

    updateConflictStatus(
      resolvingConflict.id,
      resolutionStatus,
      resolutionNote.trim(),
      user?.name || 'Administrator'
    );

    if (resolutionStatus === 'resolved') {
      showBanner('success', `Conflict "${resolvingConflict.title}" resolved and permanently deleted from all accounts.`);
    } else {
      showBanner('success', `Conflict status updated to "${resolutionStatus}" with resolution notes.`);
    }
    setResolvingConflict(null);
    setResolutionNote('');
  };

  return (
    <div className="conflicts-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Feedback Banner */}
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
          <AlertTriangle size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'white',
          padding: '1.5rem 2rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <AlertTriangle size={26} color={isAdmin ? '#b45309' : '#dc2626'} />
            {isAdmin ? 'Conflict Resolution Management' : 'Report a Classroom or Booking Conflict'}
          </h1>
          <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
            {isAdmin
              ? 'Review and resolve reported classroom overlaps, seat clashes, and resource disputes with faculty priority.'
              : 'Submit dispute reports regarding room bookings, double bookings, or seat occupation.'}
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: isFaculty ? '#dc2626' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
            }}
          >
            <Plus size={18} />
            {isFaculty ? '🔥 Report Conflict (Faculty Priority)' : 'Report a Conflict'}
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search conflicts by title, room, reporter, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.95rem',
              backgroundColor: 'white',
            }}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: 'white',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>

        {isAdmin && (
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: 'white',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <option value="all">All Priorities</option>
            <option value="high">🔥 High Priority (Faculty)</option>
            <option value="normal">Normal (Student)</option>
          </select>
        )}
      </div>

      {/* Conflicts List Feed */}
      {displayedConflicts.length === 0 ? (
        <div
          style={{
            background: 'white',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
          }}
        >
          <CheckCircle2 size={48} style={{ color: '#22c55e', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>No conflicts found</h3>
          <p style={{ margin: 0 }}>
            {isAdmin
              ? 'All reported disputes have been reviewed or no conflicts match your filter.'
              : 'You have not submitted any active conflict reports.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayedConflicts.map((item) => {
            const room = allRooms.find((r) => r.id === item.roomId);
            const isFacultyReport = item.reporterType === 'faculty' || item.priority === 'high';

            const statusStyles = {
              pending: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d', label: 'Pending' },
              under_review: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', label: 'Under Review' },
              resolved: { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'Resolved' },
              rejected: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Rejected' },
            };
            const sStyle = statusStyles[item.status] || statusStyles.pending;

            return (
              <div
                key={item.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: isFacultyReport ? '1.5px solid #f87171' : '1px solid #e2e8f0',
                  padding: '1.5rem',
                  boxShadow: isFacultyReport ? '0 2px 6px rgba(239, 68, 68, 0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {isFacultyReport ? (
                      <span
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #f87171',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Flame size={14} />
                        HIGH PRIORITY (FACULTY)
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        STUDENT REPORT (NORMAL)
                      </span>
                    )}

                    <span
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: sStyle.bg,
                        color: sStyle.text,
                        border: `1px solid ${sStyle.border}`,
                      }}
                    >
                      {sStyle.label}
                    </span>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setResolvingConflict(item);
                        setResolutionStatus(item.status === 'pending' ? 'under_review' : 'resolved');
                        setResolutionNote(item.resolutionNote || '');
                      }}
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      Resolve / Update Status
                    </button>
                  )}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0.25rem 0 0.5rem' }}>
                  {item.title}
                </h3>

                <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.55', margin: '0 0 1rem' }}>
                  {item.description}
                </p>

                {/* Conflict Details Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    background: '#f8fafc',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={15} color="#64748b" />
                    <span><strong>Room:</strong> {room?.name || item.roomId}</span>
                  </div>

                  {item.seatId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Armchair size={15} color="#64748b" />
                      <span><strong>Seat Number:</strong> {item.seatId}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Users size={15} color="#64748b" />
                    <span>
                      <strong>Reporter:</strong> {item.reporterName} ({item.reporterType})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={15} color="#64748b" />
                    <span>
                      <strong>Reported:</strong> {item.reportedAt ? format(new Date(item.reportedAt), 'PPP p') : 'Recently'}
                    </span>
                  </div>
                </div>

                {/* Resolution note if available */}
                {item.resolutionNote && (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      marginBottom: '1rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={16} /> Official Resolution Note
                    </div>
                    <p style={{ color: '#166534', margin: 0 }}>{item.resolutionNote}</p>
                  </div>
                )}

                {/* Audit History Timeline */}
                {Array.isArray(item.history) && item.history.length > 0 && (
                  <details style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                      View Audit Trail ({item.history.length} action{item.history.length > 1 ? 's' : ''})
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid #cbd5e1' }}>
                      {item.history.map((h, i) => (
                        <div key={i}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>[{h.status?.toUpperCase()}]</span> by {h.actionBy}: {h.note}
                          <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            ({h.timestamp ? format(new Date(h.timestamp), 'PP p') : ''})
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Report Conflict Modal (Faculty & Student) */}
      {showReportModal && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color={isFaculty ? '#dc2626' : '#2563eb'} />
                {isFaculty ? 'Report Conflict (Faculty Priority)' : 'Report a Conflict'}
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {isFaculty && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#991b1b',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Flame size={16} />
                  Faculty reports automatically receive HIGH PRIORITY in the administrative resolution queue.
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Affected Room / Space *
                </label>
                <select
                  required
                  value={reportForm.roomId}
                  onChange={(e) => setReportForm({ ...reportForm, roomId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="">Select Room</option>
                  {allRooms.filter((r) => r.bookable !== false).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.buildingId.toUpperCase()} - Floor {r.floor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Seat Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. S-14 or Row C Seat 2"
                  value={reportForm.seatId}
                  onChange={(e) => setReportForm({ ...reportForm, seatId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Conflict Subject / Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Double booking during 10:00 AM slot, Unauthorized room usage..."
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe what happened, any persons involved, and needed resolution..."
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isFaculty ? '#dc2626' : '#2563eb',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Submit Conflict Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Conflict Resolution Modal */}
      {resolvingConflict && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} color="#2563eb" />
                Admin Conflict Resolution
              </h2>
              <button
                onClick={() => setResolvingConflict(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleResolutionSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Resolving Conflict:</div>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{resolvingConflict.title}</strong>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                  Reported by {resolvingConflict.reporterName} ({resolvingConflict.reporterType})
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Update Resolution Status *
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  Resolution Notes & Audit Remarks *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain actions taken (e.g. room reassigned, reservation confirmed, student advised)..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Status & Audit Remarks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
