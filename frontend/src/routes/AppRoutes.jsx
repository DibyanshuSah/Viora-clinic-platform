import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Layouts
import AdminLayout from '../layouts/AdminLayout';
import DoctorLayout from '../layouts/DoctorLayout';
import StaffLayout from '../layouts/StaffLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import DoctorManagementPage from '../pages/admin/DoctorManagementPage';
import ListManagementPage from '../pages/admin/ListManagementPage';
import StaffManagementPage from '../pages/admin/StaffManagementPage';
import AnalyticsPage from '../pages/admin/AnalyticsPage';
import ClinicProfilePage from '../pages/admin/ClinicProfilePage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';

// Doctor Pages
import DoctorAppointmentsPage from '../pages/doctor/DoctorAppointmentsPage';
import DoctorPatientsPage from '../pages/doctor/DoctorPatientsPage';
import DoctorConsultationPage from '../pages/doctor/DoctorConsultationPage';
import DoctorSettingsPage from '../pages/doctor/DoctorSettingsPage';

// Staff Pages
import StaffDashboardPage from '../pages/staff/StaffDashboardPage';
import StaffRegistrationPage from '../pages/staff/StaffRegistrationPage';
import StaffAppointmentsPage from '../pages/staff/StaffAppointmentsPage';
import StaffDoctorSchedulePage from '../pages/staff/StaffDoctorSchedulePage';
import StaffBillingPage from '../pages/staff/StaffBillingPage';

const RootRedirect = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
        Loading VIORA Clinic System...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'DOCTOR') return <Navigate to="/doctor/appointments" replace />;
  if (role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;

  return <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Root & Auth */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin Workspace */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="doctors" element={<DoctorManagementPage />} />
        <Route path="list-management" element={<ListManagementPage />} />
        <Route path="staff" element={<StaffManagementPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="clinic-profile" element={<ClinicProfilePage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* Doctor Workspace */}
      <Route path="/doctor" element={<DoctorLayout />}>
        <Route index element={<Navigate to="appointments" replace />} />
        <Route path="appointments" element={<DoctorAppointmentsPage />} />
        <Route path="patients" element={<DoctorPatientsPage />} />
        <Route path="consultation/:appointmentId" element={<DoctorConsultationPage />} />
        <Route path="settings" element={<DoctorSettingsPage />} />
      </Route>

      {/* Staff Workspace */}
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboardPage />} />
        <Route path="registration" element={<StaffRegistrationPage />} />
        <Route path="appointments" element={<StaffAppointmentsPage />} />
        <Route path="schedules" element={<StaffDoctorSchedulePage />} />
        <Route path="billing" element={<StaffBillingPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

export default AppRoutes;
