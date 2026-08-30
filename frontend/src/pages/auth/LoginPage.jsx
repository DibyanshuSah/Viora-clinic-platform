import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FormInput } from '../../components/common/FormInput';

const PORTALS = [
  {
    id: 'ADMIN',
    label: 'Admin Portal',
    icon: ShieldCheck,
    badgeText: 'Clinic Director & Admin Access',
    color: '#4F46E5',
    btnClass: 'btn-admin',
    bgBadge: 'var(--role-admin-bg)',
    colorBadge: 'var(--role-admin-primary)',
    borderBadge: '#C7D2FE'
  },
  {
    id: 'DOCTOR',
    label: 'Doctor Portal',
    icon: Stethoscope,
    badgeText: 'Attending Physician & Clinical Workspace',
    color: '#0284C7',
    btnClass: 'btn-doctor',
    bgBadge: 'var(--role-doctor-bg)',
    colorBadge: 'var(--role-doctor-primary)',
    borderBadge: '#BAE6FD'
  },
  {
    id: 'STAFF',
    label: 'Staff Portal',
    icon: Users,
    badgeText: 'Front Desk & Reception Desk',
    color: '#0D9488',
    btnClass: 'btn-staff',
    bgBadge: 'var(--role-staff-bg)',
    colorBadge: 'var(--role-staff-primary)',
    borderBadge: '#99F6E4'
  }
];

const LoginPage = () => {
  const [activePortal, setActivePortal] = useState('ADMIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const currentPortalConfig = PORTALS.find((p) => p.id === activePortal) || PORTALS[0];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInUser = await login(username, password);
      if (loggedInUser.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (loggedInUser.role === 'DOCTOR') {
        navigate('/doctor/appointments');
      } else {
        navigate('/staff/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials for this workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-subtle)',
          padding: '32px 28px'
        }}
      >
        {/* LOGO & TITLE */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-sidebar)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.75rem',
              margin: '0 auto 12px auto',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            V
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 900,
              color: 'var(--text-main)',
              letterSpacing: '0.04em',
              margin: 0
            }}
          >
            VIORA CLINIC
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Advanced Clinical & Healthcare Management System
          </p>
        </div>

        {/* SEPARATE ROLE PORTAL SELECTOR TABS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            backgroundColor: 'var(--bg-app)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            const isSelected = activePortal === portal.id;
            return (
              <button
                key={portal.id}
                type="button"
                onClick={() => {
                  setActivePortal(portal.id);
                  setError('');
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? `1px solid ${portal.color}` : '1px solid transparent',
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  color: isSelected ? portal.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '0.78rem',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icon size={16} />
                <span>{portal.label}</span>
              </button>
            );
          })}
        </div>

        {/* PORTAL CONTEXT BANNER */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: currentPortalConfig.bgBadge,
            border: `1px solid ${currentPortalConfig.borderBadge}`,
            borderRadius: 'var(--radius-sm)',
            color: currentPortalConfig.colorBadge,
            fontSize: '0.75rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '20px'
          }}
        >
          {currentPortalConfig.badgeText}
        </div>

        {/* ERROR ALERT */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger-text)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: '20px',
              border: '1px solid #FECACA'
            }}
          >
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin}>
          <FormInput
            label="Username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            icon={User}
            required
          />

          <FormInput
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            icon={Lock}
            required
          />

          <button
            type="submit"
            className={`btn ${currentPortalConfig.btnClass}`}
            style={{ width: '100%', marginTop: '8px', padding: '10px 16px', fontSize: '0.9rem', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : `Sign In to ${currentPortalConfig.label}`}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '20px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} VIORA Healthcare Systems. Secure Clinical Access.
      </div>
    </div>
  );
};

export default LoginPage;
