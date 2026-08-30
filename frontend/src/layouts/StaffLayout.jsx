import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AppSidebar from '../components/layout/AppSidebar';
import TopHeader from '../components/layout/TopHeader';
import { useAuth } from '../context/AuthContext';

const StaffLayout = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading VIORA Front Desk...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'STAFF') {
    if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'DOCTOR') return <Navigate to="/doctor/appointments" replace />;
    return <Navigate to="/login" replace />;
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Front Desk Command Centre';
    if (path.includes('registration')) return 'Patient Registration & Booking';
    if (path.includes('appointments')) return 'Appointment Scheduling';
    if (path.includes('schedules')) return 'Doctor Daily Schedules & Availability';
    if (path.includes('billing')) return 'Front Desk Billing & Invoicing';
    return 'Front Desk Workspace';
  };

  return (
    <div className="app-container role-staff">
      <AppSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="main-content">
        <TopHeader
          title={getPageTitle()}
          breadcrumb={['Front Desk']}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
