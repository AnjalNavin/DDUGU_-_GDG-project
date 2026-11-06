import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  Megaphone,
  Plus,
  Trash2,
  Calendar,
  Users,
  Search,
  Check,
  AlertCircle,
  X,
  Clock,
  Filter,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import { initialFacultyList, academicStructure } from '../data/mockData';
import { formatYearLabel } from '../utils/formatYear';

export function Announcements() {
  const { user } = useAuth();
  const {
    allAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
  } = useBooking();

  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [hiddenIds, setHiddenIds] = useState(() => {
    try {
      const raw = localStorage.getItem(`ddugu_hidden_announcements_${user?.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleHideFromView = (id) => {
    const next = [...hiddenIds, id];
    setHiddenIds(next);
    localStorage.setItem(`ddugu_hidden_announcements_${user?.id}`, JSON.stringify(next));
    showBanner('info', 'Announcement removed from your personal view.');
  };

  // Announcement Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    audienceType: 'all', // 'all' | 'selected_faculty' | 'selected_students'
    selectedFacultyMobiles: [],
    targetYear: 'all',
    targetBranch: 'all',
    targetSection: 'all',
    priority: 'medium',
    expiryDate: '',
  });

  const [facultySearch, setFacultySearch] = useState('');

  const canCreate = user?.role === 'admin' || user?.role === 'faculty';

  const showBanner = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filter announcements based on user role and permissions
  const visibleAnnouncements = useMemo(() => {
    return allAnnouncements.filter((item) => {
      if (hiddenIds.includes(item.id)) return false;
      // Admin sees everything
      if (user?.role === 'admin') {
        // Can filter by audienceFilter in view
        if (audienceFilter !== 'all' && item.audienceType !== audienceFilter) return false;
      } else if (user?.role === 'faculty') {
        // Faculty sees 'all', or announcements targeted to them, or created by them
        const isAuthor =
          item.authorId === user.id ||
          item.authorId === user.mobileNumber ||
          item.authorId === user.email;
        const targetedToFaculty =
          item.audienceType === 'all' ||
          (item.audienceType === 'selected_faculty' &&
            Array.isArray(item.targetFacultyMobiles) &&
            item.targetFacultyMobiles.includes(user.mobileNumber));

        if (!isAuthor && !targetedToFaculty) return false;
      } else if (user?.role === 'student') {
        // Student only sees targeted
        if (item.audienceType === 'all') {
          // Visible to all
        } else if (item.audienceType === 'selected_students') {
          const matchYear =
            item.targetYear === 'all' ||
            String(item.targetYear) === String(user?.academicYear);
          const matchBranch =
            item.targetBranch === 'all' ||
            item.targetBranch?.toUpperCase() === user?.branchCode?.toUpperCase();
          const matchSection =
            item.targetSection === 'all' ||
            item.targetSection?.toUpperCase() === user?.section?.toUpperCase();

          if (!matchYear || !matchBranch || !matchSection) return false;
        } else {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchContent = item.content?.toLowerCase().includes(q);
        const matchAuthor = item.creatorName?.toLowerCase().includes(q);
        return matchTitle || matchContent || matchAuthor;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [allAnnouncements, user, audienceFilter, searchQuery]);

  // Handle Faculty Checkbox Toggle
  const toggleFacultySelection = (mobile) => {
    setFormData((prev) => {
      const exists = prev.selectedFacultyMobiles.includes(mobile);
      return {
        ...prev,
        selectedFacultyMobiles: exists
          ? prev.selectedFacultyMobiles.filter((m) => m !== mobile)
          : [...prev.selectedFacultyMobiles, mobile],
      };
    });
  };

  // Filtered faculty for picker modal
  const pickerFaculty = useMemo(() => {
    if (!facultySearch.trim()) return initialFacultyList;
    const q = facultySearch.toLowerCase();
    return initialFacultyList.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.mobile_number.includes(q) ||
        f.department.toLowerCase().includes(q)
    );
  }, [facultySearch]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showBanner('error', 'Please provide an announcement title.');
      return;
    }
    if (!formData.content.trim()) {
      showBanner('error', 'Please provide announcement content.');
      return;
    }
    if (
      formData.audienceType === 'selected_faculty' &&
      formData.selectedFacultyMobiles.length === 0
    ) {
      showBanner('error', 'Please select at least one faculty member.');
      return;
    }

    let audienceDesc = 'All Faculty & Students';
    if (formData.audienceType === 'selected_faculty') {
      audienceDesc = `${formData.selectedFacultyMobiles.length} Selected Faculty Member(s)`;
    } else if (formData.audienceType === 'selected_students') {
      const yr = formData.targetYear === 'all' ? 'All Years' : formatYearLabel(formData.targetYear);
      const br = formData.targetBranch === 'all' ? 'All Branches' : formData.targetBranch;
      const sec = formData.targetSection === 'all' ? 'All Sections' : `Sec ${formData.targetSection}`;
      audienceDesc = `Students: ${yr}, ${br}, ${sec}`;
    }

    const payload = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      audienceType: formData.audienceType,
      audienceDesc,
      targetFacultyMobiles: formData.selectedFacultyMobiles,
      targetYear: formData.targetYear,
      targetBranch: formData.targetBranch,
      targetSection: formData.targetSection,
      priority: formData.priority,
      expiryDate: formData.expiryDate || null,
      authorId: user?.id || user?.mobileNumber || user?.email,
      authorRole: user?.role || 'staff',
      creatorName: user?.name || 'Administrator',
    };

    createAnnouncement(payload);
    showBanner('success', 'Announcement published successfully!');
    setShowCreateModal(false);
    setFormData({
      title: '',
      content: '',
      audienceType: 'all',
      selectedFacultyMobiles: [],
      targetYear: 'all',
      targetBranch: 'all',
      targetSection: 'all',
      priority: 'medium',
      expiryDate: '',
    });
  };

  const handleDelete = (annId) => {
    const ann = allAnnouncements.find((a) => a.id === annId);
    if (!ann) return;

    const isCreator =
      ann.authorId === user?.id ||
      ann.authorId === user?.mobileNumber ||
      ann.authorId === user?.email;
    const isAdmin = user?.role === 'admin';

    if (!isCreator && !isAdmin) {
      alert("Unauthorized: Only Admin or the original creator can delete this announcement.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${ann.title}"?`)) {
      const res = deleteAnnouncement(annId, user);
      if (res.success) {
        showBanner('success', 'Announcement deleted successfully.');
      } else {
        showBanner('error', res.error || 'Failed to delete announcement.');
      }
    }
  };

  return (
    <div className="announcements-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner Feedback */}
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
          <AlertCircle size={18} />
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
            <Megaphone size={26} color="#3b82f6" />
            Campus Announcements
          </h1>
          <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
            Official notices, department updates, and academic notifications
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            <Plus size={18} />
            Post Announcement
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search announcements by title, content, or author..."
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

        {user?.role === 'admin' && (
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: 'white',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <option value="all">All Audience Types</option>
            <option value="all">Public / All Users</option>
            <option value="selected_faculty">Targeted to Faculty</option>
            <option value="selected_students">Targeted to Students</option>
          </select>
        )}
      </div>

      {/* Announcements Feed */}
      {visibleAnnouncements.length === 0 ? (
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
          <Megaphone size={48} style={{ color: '#cbd5e1', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>No announcements found</h3>
          <p style={{ margin: 0 }}>
            {user?.role === 'student'
              ? 'There are no active notices targeted to your academic cohort right now.'
              : 'Try clearing your search filters or create a new announcement.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visibleAnnouncements.map((item) => {
            const isCreator =
              item.authorId === user?.id ||
              item.authorId === user?.mobileNumber ||
              item.authorId === user?.email;
            const isAdmin = user?.role === 'admin';
            const canDelete = isAdmin || isCreator;

            const priorityColors = {
              high: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
              medium: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
              low: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
            };
            const pStyle = priorityColors[item.priority] || priorityColors.medium;

            return (
              <div
                key={item.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: pStyle.bg,
                        color: pStyle.text,
                        border: `1px solid ${pStyle.border}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {item.priority || 'NORMAL'} PRIORITY
                    </span>

                    <span
                      style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Users size={13} />
                      {item.audienceDesc || (item.audienceType === 'all' ? 'All Faculty & Students' : item.audienceType)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleHideFromView(item.id)}
                      title="Remove this announcement from your personal view"
                      style={{
                        background: 'transparent',
                        border: '1px solid #cbd5e1',
                        color: '#64748b',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Trash2 size={14} /> Remove from My View
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        title={isAdmin && !isCreator ? "Delete announcement (Admin privilege)" : "Delete your announcement"}
                        style={{
                          background: 'transparent',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0.25rem 0 0.5rem' }}>
                  {item.title}
                </h3>

                <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.55', whiteSpace: 'pre-wrap', margin: '0 0 1rem' }}>
                  {item.content}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.82rem',
                    color: '#64748b',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>Posted by:</strong>
                    <span>{item.creatorName || 'Staff'} ({item.authorRole})</span>
                    <span>•</span>
                    <Clock size={13} />
                    <span>{item.createdAt ? format(new Date(item.createdAt), 'PPP p') : 'Recently'}</span>
                  </div>

                  {item.expiryDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b45309' }}>
                      <Calendar size={13} />
                      <span>Expires: {item.expiryDate}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
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
              maxWidth: '620px',
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
                <Megaphone size={20} color="#2563eb" />
                Post New Announcement
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#1e293b' }}>
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule for Mid-Term Examination 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#1e293b' }}>
                  Message / Details *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write full announcement details..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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

              {/* Target Audience Picker */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#1e293b' }}>
                  Target Audience *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  {[
                    { id: 'all', label: 'All Users', desc: 'Faculty & Students' },
                    { id: 'selected_faculty', label: 'Selected Faculty', desc: 'Individual Faculty' },
                    { id: 'selected_students', label: 'Selected Students', desc: 'Year / Branch / Sec' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, audienceType: aud.id })}
                      style={{
                        padding: '0.75rem 0.5rem',
                        borderRadius: '8px',
                        border: `2px solid ${formData.audienceType === aud.id ? '#2563eb' : '#e2e8f0'}`,
                        backgroundColor: formData.audienceType === aud.id ? '#eff6ff' : 'white',
                        color: formData.audienceType === aud.id ? '#1e40af' : '#475569',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{aud.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{aud.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Sub-audience 1: Selected Faculty */}
                {formData.audienceType === 'selected_faculty' && (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                        Choose Faculty ({formData.selectedFacultyMobiles.length} selected)
                      </span>
                      <input
                        type="text"
                        placeholder="Search faculty..."
                        value={facultySearch}
                        onChange={(e) => setFacultySearch(e.target.value)}
                        style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {pickerFaculty.map((f) => {
                        const isSelected = formData.selectedFacultyMobiles.includes(f.mobile_number);
                        return (
                          <label
                            key={f.mobile_number}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? '#dbeafe' : 'white',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFacultySelection(f.mobile_number)}
                            />
                            <strong>{f.name}</strong>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({f.department} - {f.mobile_number})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-audience 2: Selected Students */}
                {formData.audienceType === 'selected_students' && (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Academic Year
                      </label>
                      <select
                        value={formData.targetYear}
                        onChange={(e) => setFormData({ ...formData, targetYear: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="all">All Years (1-4)</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Branch
                      </label>
                      <select
                        value={formData.targetBranch}
                        onChange={(e) => setFormData({ ...formData, targetBranch: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="all">All Branches</option>
                        {academicStructure.branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.id}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Section
                      </label>
                      <select
                        value={formData.targetSection}
                        onChange={(e) => setFormData({ ...formData, targetSection: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="all">All Sections</option>
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority & Optional Expiry Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#1e293b' }}>
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority (Urgent)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#1e293b' }}>
                    Optional Expiry Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
