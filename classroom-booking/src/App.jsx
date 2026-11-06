import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BookingProvider } from './context/BookingContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RoomSearch } from './pages/RoomSearch';
import { Booking } from './pages/Booking';
import { Schedule } from './pages/Schedule';
import { Conflicts } from './pages/Conflicts';
import { RoomDetails } from './pages/RoomDetails';
import FloorPlan from './pages/FloorPlan';
import { Admin } from './pages/Admin';
import { AdminBookings } from './pages/AdminBookings';
import { Announcements } from './pages/Announcements';
import { ReserveSeat } from './pages/ReserveSeat';
import { Loader2 } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Protected route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 size={32} className="spin" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="search" element={<RoomSearch />} />
              <Route path="booking" element={<Booking />} />
              <Route path="reserve-seat" element={<ReserveSeat />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="conflicts" element={<Conflicts />} />
              <Route path="floor-plan" element={<FloorPlan />} />
              <Route path="room/:roomId" element={<RoomDetails />} />
              <Route path="admin" element={<Admin />} />
              <Route path="admin-bookings" element={<AdminBookings />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="profile" element={<Admin />} />
            </Route>
          </Routes>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </BrowserRouter>
      </BookingProvider>
    </AuthProvider>
  );
}

export default App;