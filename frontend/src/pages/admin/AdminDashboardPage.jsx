import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Stethoscope,
  Calendar,
  IndianRupee,
  Activity,
  UserPlus,
  ArrowUpRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import RevenueChart from '../../components/common/RevenueChart';
import { LoadingState } from '../../components/common/LoadingState';

const AdminDashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, aptsRes, docsRes, patsRes] = await Promise.all([
        api.getAdminAnalytics('today'),
        api.getAppointments({ date: new Date().toISOString().split('T')[0] }),
        api.getDoctors(),
        api.getPatients()
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (aptsRes.success) setAppointments(aptsRes.data);
      if (docsRes.success) setDoctors(docsRes.data);
      if (patsRes.success) setPatients(patsRes.data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingState message="Loading VIORA Executive Analytics..." />;
  }

  const summary = analytics?.summary || {};
  const activeDoctors = doctors.filter((d) => d.status === 'Active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* KPI METRIC CARDS */}
      <div className="stat-card-grid">
        <StatCard
          label="Total Patients Today"
          value={summary.patientsToday !== undefined ? summary.patientsToday : '0'}
          subtext={`Total registered: ${summary.totalPatients || 0}`}
          icon={Users}
          role="admin"
        />
        <StatCard
          label="Doctors Available"
          value={activeDoctors.length}
          subtext="Configured on clinical duty"
          icon={Stethoscope}
          role="admin"
        />
        <StatCard
          label="Appointments Today"
          value={appointments.length}
          subtext={`${appointments.filter((a) => a.status === 'Completed').length} completed`}
          icon={Calendar}
          role="admin"
        />
        <StatCard
          label="Revenue Billed Today"
          value={`₹${(summary.revenueToday || 0).toLocaleString()}`}
          subtext={`Clinic Share: ₹${(summary.totalClinicRevenue || 0).toLocaleString()}`}
          icon={IndianRupee}
          role="admin"
        />
      </div>

      {/* TWO-COLUMN GRID: REVENUE TIMELINE & DOCTOR AVAILABILITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* REVENUE OVERVIEW & TREND */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Activity size={18} color="var(--role-admin-primary)" />
              <span>Revenue Trend & Payout (7-Day Overview)</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin/analytics')}
            >
              Detailed Analytics <ArrowUpRight size={14} />
            </button>
          </div>
          <RevenueChart timeline={analytics?.timeline} breakdown={analytics?.breakdown} />
        </div>

        {/* CURRENT DOCTOR AVAILABILITY */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Stethoscope size={18} color="var(--role-admin-primary)" />
              <span>Doctor Availability & Roster</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin/doctors')}
            >
              Manage Doctors
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {doctors.map((doc) => {
              const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
              const isWorkingToday = doc.workingDays?.includes(todayName);
              return (
                <div
                  key={doc.doctorId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{doc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {doc.specialization} &bull; {doc.workingHours?.start} - {doc.workingHours?.end}
                    </div>
                  </div>
                  <div>
                    <StatusBadge status={isWorkingToday && doc.status === 'Active' ? 'Available' : 'Paused'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TODAY'S APPOINTMENT QUEUE & RECENT PATIENTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* TODAY'S APPOINTMENTS TABLE */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Calendar size={18} color="var(--role-admin-primary)" />
              <span>Today's Clinic Queue & Appointments</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {appointments.length} scheduled
            </span>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="v-table">
              <thead>
                <tr>
                  <th>Queue #</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No appointments scheduled for today.
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt.appointmentId}>
                      <td style={{ fontWeight: 700, color: 'var(--role-admin-primary)' }}>
                        {apt.queueNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{apt.patientName}</div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{apt.patientId}</span>
                      </td>
                      <td>{apt.doctorName}</td>
                      <td>{apt.time}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{apt.appointmentType}</span>
                      </td>
                      <td>
                        <StatusBadge status={apt.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT PATIENT REGISTRATIONS */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <UserPlus size={18} color="var(--role-admin-primary)" />
              <span>Recent Patient Registrations</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {patients.map((pat) => (
              <div
                key={pat.patientId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{pat.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {pat.age} yrs &bull; {pat.gender} &bull; {pat.phone}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--role-admin-primary)',
                      backgroundColor: 'var(--role-admin-bg)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {pat.patientId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
