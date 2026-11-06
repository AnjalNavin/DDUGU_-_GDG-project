import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, GraduationCap, UserCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { demoCredentials } from '../data/mockData';

export function Login() {
  const { loginWithRole, login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: 'admin', label: 'Administrator', icon: UserCheck, description: 'Full system access, manage users & bookings' },
    { id: 'faculty', label: 'Faculty', icon: GraduationCap, description: 'Book rooms, manage classes, approve requests' },
    { id: 'student', label: 'Student', icon: BookOpen, description: 'View schedule, book rooms, report conflicts' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (selectedRole === 'faculty') {
      result = await login(mobileNumber, password);
    } else {
      result = await login(email, password);
    }

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left panel - Branding */}
        <div className="login-branding">
          <div className="brand-content">
            <div className="logo-large">🏫</div>
            <h1>DDUGU Classroom Booking</h1>
            <p className="tagline">Smart Room Management for Modern Education</p>

            <div className="features">
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <span>Real-time Availability</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔍</span>
                <span>AI-Powered Search</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🛡️</span>
                <span>Conflict Prevention</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📱</span>
                <span>Mobile Friendly</span>
              </div>
            </div>

            <div className="buildings-info">
              <h3>Available Buildings</h3>
              <div className="building-cards">
                <div className="building-card">
                  <span className="building-emoji">🏢</span>
                  <div>
                    <strong>IET</strong>
                    <small>Institute of Engineering & Technology</small>
                  </div>
                </div>
                <div className="building-card">
                  <span className="building-emoji">🏫</span>
                  <div>
                    <strong>Deeksha Bhawan</strong>
                    <small>Academic Block</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Login form */}
        <div className="login-form-panel">
          <div className="form-container">
            <div className="form-header">
              <h2>Sign In</h2>
              <p>Choose your role or use your credentials</p>
            </div>

            {/* Role selector */}
            <div className="role-selector">
              {roles.map(r => (
                <button
                  key={r.id}
                  className={`role-option ${selectedRole === r.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedRole(r.id);
                    const creds = demoCredentials[r.id];
                    if (creds) {
                      if (r.id === 'faculty') {
                        setMobileNumber(creds.mobileNumber || '');
                      } else {
                        setEmail(creds.email);
                      }
                      setPassword(creds.password);
                    }
                  }}
                >
                  <r.icon size={24} className="role-icon" />
                  <div className="role-info">
                    <strong>{r.label}</strong>
                    <small>{r.description}</small>
                  </div>
                  {selectedRole === r.id && <div className="role-check">✓</div>}
                </button>
              ))}
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="error-message">{error}</div>}

              {selectedRole === 'faculty' ? (
                <div className="form-group">
                  <label htmlFor="mobileNumber">Mobile Number</label>
                  <input
                    id="mobileNumber"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    required
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>
              )}

              <div className="form-group">
                <div className="form-group-header">
                  <label htmlFor="password">Password</label>
                </div>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div className="demo-hint">
              <p><strong>Demo Credentials:</strong> Password is <code>demo123</code> for all roles</p>
              <ul>
                <li>Admin: admin@ddgu.edu</li>
                <li>Faculty: 1112223334 (mobile number)</li>
                <li>Student: arjun.patel@ddgu.edu</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}