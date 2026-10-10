import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AppSidebar from '../components/layout/AppSidebar';
import TopHeader from '../components/layout/TopHeader';
import { useAuth } from '../context/AuthContext';

const AdminLayout = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading VIORA System...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'ADMIN') {
    // Redirect to respective role dashboard
    if (role === 'DOCTOR') return <Navigate to="/doctor/appointments" replace />;
    if (role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Executive Dashboard';
    if (path.includes('doctors')) return 'Doctor Management';
    if (path.includes('billing')) return 'Billing Management & Financial Audit';
    if (path.includes('list-management')) return 'List & Procedures Management';
    if (path.includes('staff')) return 'Staff Management';
    if (path.includes('analytics')) return 'Financial & Operational Analytics';
    if (path.includes('clinic-profile')) return 'VIORA Clinic Profile';
    if (path.includes('settings')) return 'System Settings';
    return 'Admin Workspace';
  };

  return (
    <div className="app-container role-admin">
      <AppSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="main-content">
        <TopHeader
          title={getPageTitle()}
          breadcrumb={['Administration']}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
