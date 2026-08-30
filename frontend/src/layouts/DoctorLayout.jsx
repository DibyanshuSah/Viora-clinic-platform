import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AppSidebar from '../components/layout/AppSidebar';
import TopHeader from '../components/layout/TopHeader';
import { useAuth } from '../context/AuthContext';

const DoctorLayout = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading VIORA Doctor Workspace...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'DOCTOR') {
    if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('appointments')) return 'Clinical Appointments Queue';
    if (path.includes('consultation')) return 'Patient Consultation Workspace';
    if (path.includes('patients')) return 'Assigned Patients & Clinical Records';
    if (path.includes('settings')) return 'Doctor Clinical Preferences';
    return 'Doctor Workspace';
  };

  return (
    <div className="app-container role-doctor">
      <AppSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="main-content">
        <TopHeader
          title={getPageTitle()}
          breadcrumb={['Clinical Practice']}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DoctorLayout;
