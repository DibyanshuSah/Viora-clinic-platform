import React, { useState, useEffect } from 'react';
import { Menu, X, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';

const TopHeader = ({ title, breadcrumb = [], onMenuClick, sidebarOpen = true }) => {
  const { user, role } = useAuth();
  const { clinic } = useClinic();
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      setCurrentDateTime(now.toLocaleDateString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadgeStyle = () => {
    if (role === 'ADMIN') {
      return {
        bg: 'var(--role-admin-bg)',
        color: 'var(--role-admin-primary)',
        border: '1px solid var(--role-admin-border)'
      };
    }
    if (role === 'DOCTOR') {
      return {
        bg: 'var(--role-doctor-bg)',
        color: 'var(--role-doctor-primary)',
        border: '1px solid var(--role-doctor-border)'
      };
    }
    return {
      bg: 'var(--role-staff-bg)',
      color: 'var(--role-staff-primary)',
      border: '1px solid var(--role-staff-border)'
    };
  };

  const badgeStyle = getRoleBadgeStyle();

  return (
    <header
      className="top-header no-print"
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-lg)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 'var(--spacing-md)'
      }}
    >
      {/* LEFT: SIDEBAR TOGGLE & TITLE / BREADCRUMB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', minWidth: 0 }}>
        <button
          className="sidebar-mobile-toggle"
          onClick={onMenuClick}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color var(--transition-fast), border-color var(--transition-fast)'
          }}
          aria-label={sidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {clinic?.clinicName || 'VIORA'}
            </span>
            {breadcrumb.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
          <h1
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </h1>
        </div>
      </div>

      {/* RIGHT: TIME, ROLE BADGE, AVATAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* DATE & TIME */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            padding: '5px 10px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}
          className="header-datetime"
        >
          <CalendarIcon size={14} color="var(--text-muted)" />
          <span>{currentDateTime}</span>
        </div>

        {/* ROLE BADGE */}
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: badgeStyle.bg,
            color: badgeStyle.color,
            border: badgeStyle.border,
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <ShieldCheck size={13} />
          <span>{role}</span>
        </div>

        {/* USER AVATAR / PROFILE BADGE */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {role === 'ADMIN' && clinic?.logoUrl ? (
              <img
                src={clinic.logoUrl}
                alt="Clinic Logo"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            ) : (
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor:
                    role === 'ADMIN'
                      ? 'var(--role-admin-primary)'
                      : role === 'DOCTOR'
                      ? 'var(--role-doctor-primary)'
                      : 'var(--role-staff-primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
                title={user.name || user.username}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default TopHeader;
