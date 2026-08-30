import React, { useState } from 'react';
import { Settings, Save, Clock, Stethoscope, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FormInput } from '../../components/common/FormInput';

const DoctorSettingsPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const doc = user?.profileDetails || {};

  const handleSave = (e) => {
    e.preventDefault();
    showToast('Clinical preferences saved', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Physician Practice Profile & Clinical Schedule
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Your roster hours and consultation rates are managed by Clinic Administration.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* PROFILE SUMMARY */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Physician Name
              </span>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--role-doctor-primary)' }}>
                {doc.specialization || 'Cardiologist'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Registration Number
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {doc.registrationNumber || 'KMC-49210'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {doc.qualification || 'MBBS, MD'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Working Hours
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {doc.workingHours?.start || '09:00'} - {doc.workingHours?.end || '17:00'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Break: {doc.breakTimes?.start || '13:00'} - {doc.breakTimes?.end || '14:00'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorSettingsPage;
