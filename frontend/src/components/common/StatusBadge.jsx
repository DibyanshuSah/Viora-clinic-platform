import React from 'react';

const StatusBadge = ({ status }) => {
  if (!status) return null;

  const normalized = String(status).toLowerCase();

  let badgeClass = 'badge-info';
  let dotColor = 'var(--status-active-text)';

  if (['available', 'active', 'completed', 'paid', 'present'].includes(normalized)) {
    badgeClass = 'badge-available';
    dotColor = 'var(--status-available-text)';
  } else if (['paused', 'waiting', 'partially paid'].includes(normalized)) {
    badgeClass = 'badge-paused';
    dotColor = 'var(--status-paused-text)';
  } else if (['in consultation'].includes(normalized)) {
    badgeClass = 'badge-in-consultation';
    dotColor = 'var(--status-active-text)';
  } else if (['danger', 'cancelled', 'inactive', 'pending', 'absent'].includes(normalized)) {
    badgeClass = 'badge-danger';
    dotColor = 'var(--status-danger-text)';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: dotColor
        }}
      />
      {status}
    </span>
  );
};

export default StatusBadge;
