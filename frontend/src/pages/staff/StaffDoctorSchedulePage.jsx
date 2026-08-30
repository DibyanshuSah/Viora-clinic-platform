import React, { useState, useEffect } from 'react';
import { Clock, Stethoscope, Users, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';

const StaffDoctorSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await api.getDoctorSchedules(selectedDate);
      if (res.success) {
        setSchedules(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch doctor schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

  if (loading && schedules.length === 0) {
    return <LoadingState message="Checking doctor schedules and availability..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* HEADER & DATE PICKER */}
      <div
        className="v-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Doctor Availability & Roster Schedules
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Live roster availability derived from Admin configuration.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--role-staff-primary)" />
          <input
            type="date"
            className="form-input"
            style={{ padding: '6px 12px', fontSize: '0.8125rem', width: 'auto' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* DOCTORS SCHEDULE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--spacing-md)' }}>
        {schedules.map((doc) => (
          <div
            key={doc.doctorId}
            className="v-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              borderTop: `4px solid ${doc.isWorkingToday ? 'var(--role-staff-primary)' : 'var(--border-subtle)'}`
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{doc.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--role-staff-primary)', fontWeight: 600, marginTop: '2px' }}>
                    {doc.specialization}
                  </div>
                </div>
                <StatusBadge status={doc.isWorkingToday ? 'Available' : 'Paused'} />
              </div>

              {/* TIMINGS & BREAKS */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Shift Hours:</span>
                  <strong>{doc.workingHours?.start} - {doc.workingHours?.end}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Break Time:</span>
                  <span>{doc.breakTimes?.start} - {doc.breakTimes?.end}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Consultation Fee:</span>
                  <strong style={{ color: 'var(--text-main)' }}>₹{doc.consultationFee}</strong>
                </div>
              </div>

              {/* QUEUE LOADS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px', textAlign: 'center' }}>
                <div style={{ padding: '8px 4px', backgroundColor: 'var(--status-paused-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-paused-text)' }}>
                    {doc.waitingCount}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--status-paused-text)', fontWeight: 700 }}>Waiting</span>
                </div>
                <div style={{ padding: '8px 4px', backgroundColor: 'var(--status-active-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-active-text)' }}>
                    {doc.inConsultationCount}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--status-active-text)', fontWeight: 700 }}>In Consult</span>
                </div>
                <div style={{ padding: '8px 4px', backgroundColor: 'var(--status-available-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-available-text)' }}>
                    {doc.availableSlotsCount}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--status-available-text)', fontWeight: 700 }}>Slots Left</span>
                </div>
              </div>

              {/* SLOTS TIMELINE */}
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Slot Availability Timeline
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {doc.slots?.slice(0, 10).map((slot, sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '3px 6px',
                        borderRadius: '3px',
                        backgroundColor: slot.available ? 'var(--role-staff-bg)' : slot.isBreak ? 'var(--status-paused-bg)' : '#F1F5F9',
                        color: slot.available ? 'var(--role-staff-primary)' : slot.isBreak ? 'var(--status-paused-text)' : 'var(--text-muted)'
                      }}
                    >
                      {slot.time}
                    </span>
                  ))}
                  {doc.slots?.length > 10 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '3px 6px' }}>
                      +{doc.slots.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffDoctorSchedulePage;
