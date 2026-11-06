import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  LayoutDashboard,
  Calendar,
  Search,
  Building2,
  History,
  AlertTriangle,
  Megaphone,
  LogOut,
  User,
  Settings,
  Menu,
  X,
  ChevronDown,
  Bell,
  Armchair,
  KeyRound,
} from 'lucide-react';
import { useState } from 'react';
import { CredentialsModal } from './CredentialsModal';
import { ProfileModal } from './ProfileModal';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'faculty', 'student'] },
  { path: '/search', label: 'Room Search', icon: Search, roles: ['admin', 'faculty', 'student'] },
  { path: '/booking', label: 'Book Room', icon: Calendar, roles: ['faculty'] },
  { path: '/reserve-seat', label: 'Reserve a Seat', icon: Armchair, roles: ['student'] },
  { path: '/admin-bookings', label: 'Bookings', icon: Calendar, roles: ['admin'] },
  { path: '/floor-plan', label: 'Floor Plan', icon: Building2, roles: ['admin', 'faculty', 'student'] },
  { path: '/schedule', label: 'My Schedule', icon: History, roles: ['admin', 'student', 'faculty'] },
  { path: '/announcements', label: 'Announcements', icon: Megaphone, roles: ['admin', 'faculty', 'student'] },
  { path: '/conflicts', label: 'Conflicts', icon: AlertTriangle, roles: ['admin', 'faculty', 'student'] },
  { path: '/history', label: 'Booking History', icon: History, roles: ['admin', 'faculty'] },
  { path: '/admin', label: 'Admin Panel', icon: Settings, roles: ['admin'] },
];

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { selectedBuilding, setSelectedBuilding, buildings } = useBooking();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  const filteredNavItems = navItems
    .filter(item => item.roles.includes(user?.role))
    .map(item => {
      if (item.path === '/conflicts') {
        return {
          ...item,
          label: user?.role === 'admin' ? 'Conflict Resolution' : 'Report a Conflict',
        };
      }
      if (item.path === '/schedule') {
        return {
          ...item,
          label: user?.role === 'admin' ? 'See Schedule' : 'My Schedule',
        };
      }
      return item;
    });

  const handleLogout = () => {
    logout();
    navigate('/login');
    setProfileOpen(false);
  };

  const building = buildings.find(b => b.id === selectedBuilding);

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🏫</span>
            <span className="logo-text">DDUGU Booking</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="building-selector">
            <label>Current Building</label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="building-select"
            >
              {buildings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.image} {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Main content */}
      <main className="main-content">
        {/* Top bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">
              {filteredNavItems.find(item => item.path === window.location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="top-bar-right">
            {/* Notifications */}
            <button className="icon-btn" aria-label="Notifications">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>

            {/* Profile dropdown */}
            <div className="profile-dropdown">
              <button
                className="profile-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="User menu"
              >
                <span className="avatar">{user?.avatar || '👤'}</span>
                <div className="user-info">
                  <span className="user-name">{user?.name || 'User'}</span>
                  <span className="user-role">{user?.role || 'guest'}</span>
                </div>
                <ChevronDown size={16} />
              </button>

              {profileOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <span className="avatar large">{user?.avatar || '👤'}</span>
                    <div>
                      <strong>{user?.name}</strong>
                      <small>{user?.email}</small>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  {/* Profile Settings */}
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setProfileOpen(false);
                      setProfileModalOpen(true);
                    }}
                    style={{ cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none', background: 'none' }}
                  >
                    <User size={16} /> Profile
                  </button>
                  {/* Change Login Credentials */}
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setProfileOpen(false);
                      setCredentialsModalOpen(true);
                    }}
                    style={{ cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none', background: 'none' }}
                  >
                    <KeyRound size={16} /> Change Credentials
                  </button>
                  <NavLink to="/settings" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                    <Settings size={16} /> Settings
                  </NavLink>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Modal */}
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
        />

        {/* Credentials Modal */}
        <CredentialsModal
          isOpen={credentialsModalOpen}
          onClose={() => setCredentialsModalOpen(false)}
        />

        {/* Page content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}