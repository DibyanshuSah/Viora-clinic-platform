import React from 'react';

const StatCard = ({ label, value, subtext, icon: Icon, role = 'admin' }) => {
  const getColors = () => {
    if (role === 'admin') {
      return {
        iconBg: 'var(--role-admin-bg)',
        iconColor: 'var(--role-admin-primary)',
        borderColor: 'var(--role-admin-border)'
      };
    }
    if (role === 'doctor') {
      return {
        iconBg: 'var(--role-doctor-bg)',
        iconColor: 'var(--role-doctor-primary)',
        borderColor: 'var(--role-doctor-border)'
      };
    }
    return {
      iconBg: 'var(--role-staff-bg)',
      iconColor: 'var(--role-staff-primary)',
      borderColor: 'var(--role-staff-border)'
    };
  };

  const { iconBg, iconColor } = getColors();

  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-value">{value}</div>
        {subtext && <span className="stat-card-sub">{subtext}</span>}
      </div>
      {Icon && (
        <div className="stat-card-icon-wrap" style={{ backgroundColor: iconBg }}>
          <Icon size={22} color={iconColor} />
        </div>
      )}
    </div>
  );
};

export default StatCard;
