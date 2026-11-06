import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { users, demoCredentials } from '../data/mockData';

const API_URL = 'http://localhost:8000/api/v1';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const apiLogin = async (endpoint, payload) => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || 'Login failed' };
      }

      const token = data.access_token;
      const userData = data.user;

      // Store token and user
      localStorage.setItem('accessToken', token);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Network error. Please check if the server is running.' };
    }
  };

  const login = useCallback(async (identifier, password) => {
    // First try the real API
    let endpoint, payload;

    if (identifier.includes('@')) {
      // Email-based login (admin or student)
      endpoint = '/auth/login';
      payload = { email: identifier, password };
    } else {
      // Mobile number login (faculty)
      endpoint = '/auth/faculty/login';
      payload = { mobile_number: identifier, password };
    }

    let result = await apiLogin(endpoint, payload);

    // Fallback to mock data for demo if API fails
    if (!result.success) {
      const stored = localStorage.getItem('currentUser');
      let foundUser = stored ? JSON.parse(stored) : null;
      if (!foundUser || (foundUser.email?.toLowerCase() !== identifier.toLowerCase() && foundUser.mobileNumber !== identifier)) {
        foundUser = users.find(u =>
          u.email?.toLowerCase() === identifier.toLowerCase() || u.mobileNumber === identifier
        );
      }

      if (foundUser) {
        const expectedPassword = foundUser.password || (foundUser.role === 'admin' ? 'adminpassword123' : foundUser.role === 'faculty' ? 'facultypassword123' : 'studentpassword123');
        if (password === expectedPassword || password === 'demo123') {
          setUser(foundUser);
          localStorage.setItem('currentUser', JSON.stringify(foundUser));
          localStorage.setItem('accessToken', 'demo-token');
          return { success: true, user: foundUser };
        }
      }

      return { success: false, error: 'Invalid credentials' };
    }

    return result;
  }, []);

  const loginWithRole = useCallback(async (role) => {
    const credentials = demoCredentials[role];
    if (credentials) {
      if (role === 'faculty') {
        return login(credentials.mobileNumber, credentials.password);
      }
      return login(credentials.email, credentials.password);
    }
    return { success: false, error: 'Invalid role' };
  }, [login]);

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  const updateUserProfile = useCallback((updatedFields) => {
    setUser(prev => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    loading,
    login,
    loginWithRole,
    logout,
    hasRole,
    updateUserProfile,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}