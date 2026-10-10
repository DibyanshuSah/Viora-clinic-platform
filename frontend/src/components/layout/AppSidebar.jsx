import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Calendar,
  Clock,
  CreditCard,
  Building2,
  BarChart3,
  ListFilter,
  Settings,
  LogOut,
  Stethoscope,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';

const AppSidebar = ({ mobileOpen, setMobileOpen }) => {
  const { user, role, logout, switchDemoRole } = useAuth();
  const { clinic } = useClinic();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (role === 'ADMIN') {
      return [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/doctors', label: 'Doctor Management', icon: Stethoscope },
        { to: '/admin/billing', label: 'Billing Management', icon: CreditCard },
        { to: '/admin/list-management', label: 'List Management', icon: ListFilter },
        { to: '/admin/staff', label: 'Staff Management', icon: Users },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/admin/clinic-profile', label: 'Clinic Profile', icon: Building2 },
        { to: '/admin/settings', label: 'Settings', icon: Settings }
      ];
    } else if (role === 'DOCTOR') {
      return [
        { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
        { to: '/doctor/patients', label: 'Patients', icon: Users },
        { to: '/doctor/settings', label: 'Settings', icon: Settings }
      ];
    } else {
      // STAFF / FRONT DESK
      return [
        { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/staff/registration', label: 'Patient Registration', icon: UserPlus },
        { to: '/staff/appointments', label: 'Appointments', icon: Calendar },
        { to: '/staff/schedules', label: 'Doctor Schedule', icon: Clock },
        { to: '/staff/billing', label: 'Billing', icon: CreditCard }
      ];
    }
  };

  const navLinks = getNavLinks();

  const getRoleAccentClass = () => {
    if (role === 'ADMIN') return 'role-accent-admin';
    if (role === 'DOCTOR') return 'role-accent-doctor';
    return 'role-accent-staff';
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`app-sidebar ${mobileOpen ? 'sidebar-open' : ''} ${getRoleAccentClass()}`}
      >
        {/* TOP BRANDING & CLINIC NAME */}
        <div>
          <div
            style={{
              padding: '20px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {clinic?.logoUrl ? (
                <img
                  src={clinic.logoUrl}
                  alt="VIORA"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor:
                      role === 'ADMIN'
                        ? 'var(--role-admin-primary)'
                        : role === 'DOCTOR'
                        ? 'var(--role-doctor-primary)'
                        : 'var(--role-staff-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF'
                  }}
                >
                  V
                </div>
              )}
              <div>
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    lineHeight: 1.1
                  }}
                >
                  VIORA
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  Clinic Management
                </div>
              </div>
            </div>
          </div>

          {/* USER PROFILE INFO IN SIDEBAR */}
          {user && (
            <div
              style={{
                padding: '14px 16px',
                margin: '12px 12px 6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '4px'
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      role === 'ADMIN'
                        ? 'rgba(79, 70, 229, 0.25)'
                        : role === 'DOCTOR'
                        ? 'rgba(2, 132, 199, 0.25)'
                        : 'rgba(13, 148, 136, 0.25)',
                    color:
                      role === 'ADMIN'
                        ? '#A5B4FC'
                        : role === 'DOCTOR'
                        ? '#7DD3FC'
                        : '#5EEAD4',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {role}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  @{user.username}
                </span>
              </div>
            </div>
          )}

          {/* NAVIGATION LINKS */}
          <nav style={{ padding: '8px' }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={() => setMobileOpen && setMobileOpen(false)}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        justifyContent: 'flex-start',
                        borderRadius: 'var(--radius-sm)',
                        color: isActive ? '#FFFFFF' : '#94A3B8',
                        backgroundColor: isActive
                          ? role === 'ADMIN'
                            ? 'var(--role-admin-primary)'
                            : role === 'DOCTOR'
                            ? 'var(--role-doctor-primary)'
                            : 'var(--role-staff-primary)'
                          : 'transparent',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '0.875rem',
                        transition: 'all var(--transition-fast)'
                      })}
                    >
                      <IconComponent size={18} />
                      <span>{link.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* BOTTOM SECTION: LOGOUT */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'rgba(220, 38, 38, 0.12)',
              color: '#F87171',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'background var(--transition-fast)'
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
