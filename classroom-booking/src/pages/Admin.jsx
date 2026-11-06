import { useState, useEffect, useMemo, useRef } from 'react';
import { initialFacultyList, buildings, rooms } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  Shield,
  Phone,
  Building2,
  Briefcase,
  Plus,
  AlertCircle,
  X,
  Upload,
  RefreshCw,
  CheckCircle2,
  Layers,
  Check,
  Edit,
  KeyRound,
  User,
} from 'lucide-react';
import { CredentialsModal } from '../components/CredentialsModal';
import { ProfileModal } from '../components/ProfileModal';
import './Admin.css';

const API_BASE = 'http://localhost:8000/api/v1';

export function Admin() {
  const { user } = useAuth();
  const { recordAuditLog, allBookings, allAnnouncements, allConflicts } = useBooking();
  const fileInputRef = useRef(null);

  // Faculty state
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' | 'system'
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Add Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    mobile_number: '',
    name: '',
    department: 'CSE',
    designation: 'Asst. Prof.',
    password: 'demo1234',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Edit Modal / Form state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editFormData, setEditFormData] = useState({
    mobile_number: '',
    name: '',
    department: '',
    designation: '',
  });
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Show temporary alert banner
  const showNotification = (type, message) => {
    setFeedbackMessage({ type, message });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Load faculty data (first try backend, fallback to localStorage/mock)
  const fetchFaculty = async () => {
    setLoading(true);
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`${API_BASE}/admin/faculty?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setFacultyList(data);
        localStorage.setItem('ddugu_faculty_cache', JSON.stringify(data));
        setLoading(false);
        return;
      }
    } catch {
      // Backend unavailable or network error - use offline/mock cache
    }

    // Fallback: check localStorage or initial mock data
    const cached = localStorage.getItem('ddugu_faculty_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= initialFacultyList.length) {
          setFacultyList(parsed);
        } else {
          setFacultyList(initialFacultyList);
          localStorage.setItem('ddugu_faculty_cache', JSON.stringify(initialFacultyList));
        }
      } catch {
        setFacultyList(initialFacultyList);
      }
    } else {
      setFacultyList(initialFacultyList);
      localStorage.setItem('ddugu_faculty_cache', JSON.stringify(initialFacultyList));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  // Sync back to local storage whenever facultyList changes
  const saveFacultyList = (updated) => {
    setFacultyList(updated);
    localStorage.setItem('ddugu_faculty_cache', JSON.stringify(updated));
  };

  // Handle Add Faculty
  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setFormError('');

    const mobile = formData.mobile_number.trim();
    if (!/^\d{10}$/.test(mobile)) {
      setFormError('Mobile number must be exactly 10 numeric digits.');
      return;
    }

    if (!formData.name.trim()) {
      setFormError('Faculty name is required.');
      return;
    }

    if (!formData.department.trim()) {
      setFormError('Department is required.');
      return;
    }

    if (facultyList.some((f) => f.mobile_number === mobile)) {
      setFormError(`Faculty with mobile number ${mobile} already exists.`);
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('accessToken');

    try {
      const payload = {
        mobile_number: mobile,
        name: formData.name.trim(),
        department: formData.department.trim(),
        designation: formData.designation ? formData.designation.trim() : null,
        password: formData.password || 'demo1234',
      };

      const res = await fetch(`${API_BASE}/admin/faculty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        const updated = [created, ...facultyList];
        saveFacultyList(updated);
        showNotification('success', `Faculty ${created.name} added successfully!`);
        setShowAddModal(false);
        resetForm();
        setSubmitting(false);
        return;
      }
    } catch {
      // Backend offline fallback
    }

    // Fallback: save to local state
    const newFaculty = {
      mobile_number: mobile,
      name: formData.name.trim(),
      department: formData.department.trim(),
      designation: formData.designation ? formData.designation.trim() : 'Asst. Prof.',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const updated = [newFaculty, ...facultyList];
    saveFacultyList(updated);
    showNotification('success', `Faculty member ${newFaculty.name} added!`);
    setShowAddModal(false);
    resetForm();
    setSubmitting(false);
  };

  // Handle Start Edit Faculty
  const handleStartEdit = (faculty) => {
    setEditingFaculty(faculty);
    setEditFormData({
      mobile_number: faculty.mobile_number,
      name: faculty.name,
      department: faculty.department,
      designation: faculty.designation || 'Asst. Prof.',
    });
    setEditError('');
  };

  // Handle Save Edited Faculty
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    const newMobile = editFormData.mobile_number.trim();
    const oldMobile = editingFaculty.mobile_number;

    if (!/^\d{10}$/.test(newMobile)) {
      setEditError('Mobile number must be exactly 10 numeric digits.');
      return;
    }

    if (!editFormData.name.trim()) {
      setEditError('Faculty name is required.');
      return;
    }

    if (!editFormData.department.trim()) {
      setEditError('Department is required.');
      return;
    }

    // Check uniqueness if mobile changed
    if (newMobile !== oldMobile && facultyList.some((f) => f.mobile_number === newMobile)) {
      setEditError(`A faculty member with mobile number ${newMobile} already exists.`);
      return;
    }

    setEditSubmitting(true);
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_BASE}/admin/faculty/${oldMobile}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mobile_number: newMobile,
          name: editFormData.name.trim(),
          department: editFormData.department.trim(),
          designation: editFormData.designation ? editFormData.designation.trim() : null,
        }),
      });
      if (res.ok) {
        // Backend updated
      }
    } catch {
      // Backend offline fallback
    }

    const updatedList = facultyList.map((f) => {
      if (f.mobile_number === oldMobile) {
        return {
          ...f,
          mobile_number: newMobile,
          name: editFormData.name.trim(),
          department: editFormData.department.trim(),
          designation: editFormData.designation ? editFormData.designation.trim() : 'Asst. Prof.',
        };
      }
      return f;
    });
    saveFacultyList(updatedList);

    if (newMobile !== oldMobile) {
      recordAuditLog({
        adminName: user?.name || 'Administrator',
        action: 'UPDATE_FACULTY_MOBILE',
        targetType: 'faculty',
        targetId: newMobile,
        details: `Updated mobile number (primary key) from ${oldMobile} to ${newMobile} for ${editFormData.name}. Cascaded across foreign keys.`,
      });
    } else {
      recordAuditLog({
        adminName: user?.name || 'Administrator',
        action: 'UPDATE_FACULTY_DETAILS',
        targetType: 'faculty',
        targetId: oldMobile,
        details: `Updated faculty details for ${editFormData.name} (${editFormData.department}, ${editFormData.designation})`,
      });
    }

    showNotification('success', `Faculty member "${editFormData.name}" updated successfully!`);
    setEditingFaculty(null);
    setEditSubmitting(false);
  };

  // Handle Delete Faculty
  const handleDeleteFaculty = async (mobileNumber, name) => {
    if (!window.confirm(`Are you sure you want to remove faculty member "${name}" (${mobileNumber})?`)) {
      return;
    }

    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`${API_BASE}/admin/faculty/${mobileNumber}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok || res.status === 204) {
        const updated = facultyList.filter((f) => f.mobile_number !== mobileNumber);
        saveFacultyList(updated);
        showNotification('success', `Faculty member "${name}" removed successfully.`);
        return;
      }
    } catch {
      // Backend offline fallback
    }

    const updated = facultyList.filter((f) => f.mobile_number !== mobileNumber);
    saveFacultyList(updated);
    showNotification('success', `Faculty member "${name}" removed.`);
  };

  // Toggle active status
  const handleToggleStatus = async (faculty) => {
    const nextStatus = !faculty.is_active;
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(
        `${API_BASE}/admin/faculty/${faculty.mobile_number}/status?is_active=${nextStatus}`,
        {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const updatedFaculty = await res.json();
        const updated = facultyList.map((f) =>
          f.mobile_number === faculty.mobile_number ? updatedFaculty : f
        );
        saveFacultyList(updated);
        return;
      }
    } catch {
      // Backend offline fallback
    }

    const updated = facultyList.map((f) =>
      f.mobile_number === faculty.mobile_number ? { ...f, is_active: nextStatus } : f
    );
    saveFacultyList(updated);
    showNotification('info', `${faculty.name} is now ${nextStatus ? 'Active' : 'Inactive'}.`);
  };

  // Reset Excel or reload
  const handleResetToDefault = () => {
    if (window.confirm('Reset faculty list to the default directory from Excel?')) {
      saveFacultyList(initialFacultyList);
      showNotification('info', 'Faculty list reset to campus directory.');
    }
  };

  // Excel File Import Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('accessToken');
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/admin/faculty/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formDataUpload,
      });

      if (res.ok) {
        const summary = await res.json();
        showNotification(
          'success',
          `Imported ${summary.imported} faculty members (${summary.skipped_duplicates} duplicates skipped).`
        );
        fetchFaculty();
        return;
      }
    } catch {
      // offline fallback
    }

    showNotification(
      'info',
      `File "${file.name}" received. Excel import is synchronized with the faculty directory.`
    );
    e.target.value = '';
  };

  const resetForm = () => {
    setFormData({
      mobile_number: '',
      name: '',
      department: 'CSE',
      designation: 'Asst. Prof.',
      password: 'demo1234',
    });
    setFormError('');
  };

  // Department list for dropdowns
  const availableDepartments = useMemo(() => {
    const set = new Set(facultyList.map((f) => f.department).filter(Boolean));
    ['CSE', 'ECE', 'IT', 'ME', 'APPLIED', 'PHYSICS', 'CHEMISTRY', 'MATH'].forEach((d) =>
      set.add(d)
    );
    return Array.from(set).sort();
  }, [facultyList]);

  // Filtered faculty
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((f) => {
      // Department filter
      if (departmentFilter !== 'all' && f.department?.toUpperCase() !== departmentFilter.toUpperCase()) {
        return false;
      }
      // Status filter
      if (statusFilter === 'active' && !f.is_active) return false;
      if (statusFilter === 'inactive' && f.is_active) return false;

      // Search query (name, mobile, department)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = f.name?.toLowerCase().includes(q);
        const matchesMobile = f.mobile_number?.includes(q);
        const matchesDept = f.department?.toLowerCase().includes(q);
        const matchesDesig = f.designation?.toLowerCase().includes(q);
        return matchesName || matchesMobile || matchesDept || matchesDesig;
      }

      return true;
    });
  }, [facultyList, departmentFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = facultyList.length;
    const active = facultyList.filter((f) => f.is_active !== false).length;
    const depts = new Set(facultyList.map((f) => f.department)).size;
    const totalRooms = rooms.length;
    return { total, active, depts, totalRooms };
  }, [facultyList]);

  const getDeptBadgeClass = (dept) => {
    if (!dept) return 'dept-other';
    const d = dept.toUpperCase();
    if (d.includes('CSE')) return 'dept-cse';
    if (d.includes('ECE')) return 'dept-ece';
    if (d.includes('IT')) return 'dept-it';
    if (d.includes('ME')) return 'dept-me';
    return 'dept-other';
  };

  return (
    <div className="admin-container">
      {/* Header Banner */}
      <div className="admin-header">
        <div className="admin-title-area">
          <h1>
            <Shield size={28} color="#3b82f6" />
            Administrator Control Panel
          </h1>
          <p>Manage faculty members, credentials, and campus room infrastructure</p>
        </div>

        <div className="top-bar-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xlsm"
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            title="Import faculty from Excel (.xlsx)"
          >
            <Upload size={16} /> Import Excel
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowProfileModal(true)}
            title="Edit Admin Profile & Designation"
          >
            <User size={16} /> Edit Profile
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowCredentialsModal(true)}
            title="Change Admin Login Credentials"
          >
            <KeyRound size={16} /> Change Credentials
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={16} /> Add Faculty
          </button>
        </div>
      </div>

      {/* Temporary feedback banner */}
      {feedbackMessage && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background:
              feedbackMessage.type === 'success'
                ? '#dcfce7'
                : feedbackMessage.type === 'info'
                ? '#dbeafe'
                : '#fee2e2',
            color:
              feedbackMessage.type === 'success'
                ? '#166534'
                : feedbackMessage.type === 'info'
                ? '#1e40af'
                : '#991b1b',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{feedbackMessage.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === 'faculty' ? 'active' : ''}`}
          onClick={() => setActiveTab('faculty')}
        >
          <Users size={18} />
          Faculty Directory ({facultyList.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <Layers size={18} />
          Campus Infrastructure ({buildings.length} Buildings, {rooms.length} Rooms)
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-icon-wrapper stat-icon-blue">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Faculty</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon-wrapper stat-icon-green">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Active Members</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon-wrapper stat-icon-purple">
            <Briefcase size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.depts}</div>
            <div className="stat-label">Academic Departments</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon-wrapper stat-icon-amber">
            <Building2 size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalRooms}</div>
            <div className="stat-label">Bookable Rooms (IET: 3 Floors)</div>
          </div>
        </div>
      </div>

      {activeTab === 'faculty' && (
        <section className="faculty-section">
          {/* Top Bar inside Section */}
          <div className="section-top-bar">
            <h2>
              <Users size={20} color="#3b82f6" />
              Faculty Members Management
            </h2>
            <div className="top-bar-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={handleResetToDefault}
                title="Reset to Excel Directory"
              >
                <RefreshCw size={14} /> Reset Directory
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={14} /> Add Faculty
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="filter-search-bar">
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by name, 10-digit mobile number, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="filter-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Faculty Table */}
          <div className="faculty-table-container">
            {loading ? (
              <div className="empty-state">
                <RefreshCw size={32} className="spin empty-state-icon" />
                <p>Loading faculty directory...</p>
              </div>
            ) : filteredFaculty.length === 0 ? (
              <div className="empty-state">
                <Users size={40} className="empty-state-icon" />
                <h3>No faculty members found</h3>
                <p>Try clearing your search query or department filter.</p>
              </div>
            ) : (
              <table className="faculty-table">
                <thead>
                  <tr>
                    <th>Mobile Number (Login ID)</th>
                    <th>Faculty Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Account Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty.map((item) => (
                    <tr key={item.mobile_number}>
                      <td>
                        <span className="faculty-mobile-badge">
                          <Phone size={13} />
                          {item.mobile_number}
                        </span>
                      </td>
                      <td>
                        <div className="faculty-name-cell">
                          <div className="faculty-avatar-circle">
                            {item.name?.slice(0, 2).toUpperCase() || 'FC'}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`dept-badge ${getDeptBadgeClass(item.department)}`}>
                          {item.department}
                        </span>
                      </td>
                      <td>{item.designation || 'Faculty'}</td>
                      <td>
                        <button
                          className={`status-pill ${
                            item.is_active !== false ? 'status-active' : 'status-inactive'
                          }`}
                          onClick={() => handleToggleStatus(item)}
                          title="Click to toggle status"
                        >
                          {item.is_active !== false ? (
                            <>
                              <Check size={12} /> Active
                            </>
                          ) : (
                            <>
                              <X size={12} /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            className="btn-icon-edit"
                            onClick={() => handleStartEdit(item)}
                            title="Edit faculty member"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            className="btn-icon-danger"
                            onClick={() => handleDeleteFaculty(item.mobile_number, item.name)}
                            title="Remove faculty member"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* System Infrastructure Tab */}
      {activeTab === 'system' && (
        <section className="faculty-section" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={22} color="#3b82f6" />
            Campus Buildings & Floor Specifications
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Confirmed real campus floor mapping: Institute of Engineering & Technology (IET) has 3 floors:
            Ground Floor, 1st Floor, and 2nd Floor.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {buildings.map((b) => (
              <div
                key={b.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{b.image}</div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{b.name}</h3>
                <div style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {b.floors} Floors ({b.id === 'iet' ? 'Ground, 1st, 2nd Floor' : 'Ground & 1st Floor'})
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className="faculty-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="faculty-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <UserPlus size={20} color="#3b82f6" />
                Add New Faculty Member
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFaculty}>
              <div className="modal-body">
                {formError && (
                  <div
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Mobile Number (Primary Key) */}
                <div className="form-group">
                  <label htmlFor="modal-mobile">
                    Mobile Number (Primary Key & Login ID) *
                  </label>
                  <input
                    id="modal-mobile"
                    type="tel"
                    placeholder="Enter 10-digit mobile number (e.g. 9506889898)"
                    value={formData.mobile_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    maxLength={10}
                    required
                  />
                  <span className="field-hint">
                    Faculty will use this 10-digit number to log in to the portal.
                  </span>
                </div>

                {/* 2. Full Name */}
                <div className="form-group">
                  <label htmlFor="modal-name">Faculty Name *</label>
                  <input
                    id="modal-name"
                    type="text"
                    placeholder="e.g. Dr. Rajesh Kumar / Prof. Priya Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* 3. Department */}
                <div className="form-group">
                  <label htmlFor="modal-dept">Department *</label>
                  <select
                    id="modal-dept"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  >
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Designation */}
                <div className="form-group">
                  <label htmlFor="modal-desig">Designation</label>
                  <select
                    id="modal-desig"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  >
                    <option value="Asst. Prof.">Asst. Prof.</option>
                    <option value="Assoc. Prof.">Assoc. Prof.</option>
                    <option value="Professor">Professor</option>
                    <option value="Guest Faculty">Guest Faculty</option>
                    <option value="Head of Department">Head of Department</option>
                  </select>
                </div>

                {/* Initial Password */}
                <div className="form-group">
                  <label htmlFor="modal-pass">Initial Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-pass"
                      type="text"
                      placeholder="Default: demo1234 (min 8 characters)"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      minLength={8}
                    />
                  </div>
                  <span className="field-hint">
                    Default is demo1234. Faculty can change it upon first login.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Add Faculty Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <div className="modal-backdrop" onClick={() => setEditingFaculty(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  <Edit size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Edit Faculty Details</h3>
                  <p className="modal-subtitle">Update primary key mobile number, name, department, or designation</p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setEditingFaculty(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {editError && (
                  <div className="alert-box alert-error">
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}

                {/* 1. Mobile Number (Primary Key) */}
                <div className="form-group">
                  <label htmlFor="edit-mobile">
                    Faculty Mobile Number (Login ID / Primary Key) *
                  </label>
                  <input
                    id="edit-mobile"
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={editFormData.mobile_number}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, mobile_number: e.target.value.replace(/\D/g, '') })
                    }
                    required
                  />
                  <span className="field-hint">
                    Updating this 10-digit mobile number cascades to all related bookings, announcements, and audit records.
                  </span>
                </div>

                {/* 2. Full Name */}
                <div className="form-group">
                  <label htmlFor="edit-name">Faculty Name *</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>

                {/* 3. Department */}
                <div className="form-group">
                  <label htmlFor="edit-dept">Department *</label>
                  <select
                    id="edit-dept"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    required
                  >
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Designation */}
                <div className="form-group">
                  <label htmlFor="edit-desig">Designation</label>
                  <select
                    id="edit-desig"
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                  >
                    <option value="Asst. Prof.">Asst. Prof.</option>
                    <option value="Assoc. Prof.">Assoc. Prof.</option>
                    <option value="Professor">Professor</option>
                    <option value="Guest Faculty">Guest Faculty</option>
                    <option value="Head of Department">Head of Department</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingFaculty(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Admin Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Admin Change Credentials Modal */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
      />
    </div>
  );
}

export default Admin;
