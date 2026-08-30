import React from 'react';

const StatCard = ({ label, value, subtext, icon: Icon, role = 'admin', trend }) => {
  const getColors = () => {
    if (role === 'admin') {
      return {
        iconBg: 'var(--role-admin-bg)',
        iconColor: 'var(--role-admin-primary)'
      };
    }
    if (role === 'doctor') {
      return {
        iconBg: 'var(--role-doctor-bg)',
        iconColor: 'var(--role-doctor-primary)'
      };
    }
    return {
      iconBg: 'var(--role-staff-bg)',
      iconColor: 'var(--role-staff-primary)'
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
          <Icon size={24} color={iconColor} />
        </div>
      )}
    </div>
  );
};

export default StatCard;
