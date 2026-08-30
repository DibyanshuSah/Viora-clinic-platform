import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';

const TopHeader = ({ title, breadcrumb = [], onMenuClick }) => {
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
        border: '1px solid #C7D2FE'
      };
    }
    if (role === 'DOCTOR') {
      return {
        bg: 'var(--role-doctor-bg)',
        color: 'var(--role-doctor-primary)',
        border: '1px solid #BAE6FD'
      };
    }
    return {
      bg: 'var(--role-staff-bg)',
      color: 'var(--role-staff-primary)',
      border: '1px solid #99F6E4'
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
        zIndex: 100
      }}
    >
      {/* LEFT: MOBILE TOGGLE & TITLE / BREADCRUMB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <button
          className="sidebar-mobile-toggle"
          onClick={onMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {clinic?.clinicName || 'VIORA'}
            </span>
            {breadcrumb.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>/</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            {title}
          </h1>
        </div>
      </div>

      {/* RIGHT: TIME, ROLE BADGE, NOTIFICATIONS, AVATAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        {/* DATE & TIME */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            padding: '4px 10px',
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
            fontSize: '0.75rem',
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

        {/* NOTIFICATIONS */}
        <button
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
          title="System notifications"
        >
          <Bell size={16} />
        </button>

        {/* USER AVATAR */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {role === 'ADMIN' && clinic?.logoUrl ? (
              <img
                src={clinic.logoUrl}
                alt="Admin"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
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
                  fontSize: '0.9rem'
                }}
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
