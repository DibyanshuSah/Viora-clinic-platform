import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Stethoscope,
  Calendar,
  IndianRupee,
  Activity,
  UserPlus,
  ArrowUpRight
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
          label="Patients Today"
          value={summary.patientsToday !== undefined ? summary.patientsToday : '0'}
          subtext={`Registered total: ${summary.totalPatients || 0}`}
          icon={Users}
          role="admin"
        />
        <StatCard
          label="Doctors on Duty"
          value={activeDoctors.length}
          subtext="Active clinical roster"
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
          label="Gross Billed Today"
          value={`₹${(summary.revenueToday || 0).toLocaleString()}`}
          subtext={`Clinic Net: ₹${(summary.totalClinicRevenue || 0).toLocaleString()}`}
          icon={IndianRupee}
          role="admin"
        />
      </div>

      {/* TWO-COLUMN GRID: REVENUE TIMELINE & DOCTOR AVAILABILITY */}
      <div className="grid-two-column-split">
        {/* REVENUE OVERVIEW & TREND */}
        <div className="v-card">
          <div className="v-card-header">
            <div>
              <div className="v-card-title">
                <Activity size={18} color="var(--role-admin-primary)" />
                <span>Revenue Trend & Distribution</span>
              </div>
              <div className="v-card-subtitle">7-day financial snapshot</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin/analytics')}
            >
              Full Analytics <ArrowUpRight size={14} />
            </button>
          </div>
          <RevenueChart timeline={analytics?.timeline} breakdown={analytics?.breakdown} />
        </div>

        {/* CURRENT DOCTOR AVAILABILITY */}
        <div className="v-card">
          <div className="v-card-header">
            <div>
              <div className="v-card-title">
                <Stethoscope size={18} color="var(--role-admin-primary)" />
                <span>Doctor Roster</span>
              </div>
              <div className="v-card-subtitle">{doctors.length} configured physicians</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin/doctors')}
            >
              Manage
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doctors.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No doctors registered yet.
              </div>
            ) : (
              doctors.map((doc) => {
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
                      border: '1px solid var(--border-subtle)',
                      gap: '8px'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {doc.specialization} &bull; {doc.workingHours?.start} - {doc.workingHours?.end}
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={isWorkingToday && doc.status === 'Active' ? 'Available' : 'Paused'} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S APPOINTMENT QUEUE & RECENT PATIENTS */}
      <div className="grid-two-column-split">
        {/* TODAY'S APPOINTMENTS TABLE */}
        <div className="v-card">
          <div className="v-card-header">
            <div>
              <div className="v-card-title">
                <Calendar size={18} color="var(--role-admin-primary)" />
                <span>Today's Appointment Queue</span>
              </div>
              <div className="v-card-subtitle">{appointments.length} patients scheduled</div>
            </div>
          </div>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Queue</th>
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
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
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
            <div>
              <div className="v-card-title">
                <UserPlus size={18} color="var(--role-admin-primary)" />
                <span>Recent Registrations</span>
              </div>
              <div className="v-card-subtitle">Latest enrolled patients</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {patients.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No patients registered yet.
              </div>
            ) : (
              patients.map((pat) => (
                <div
                  key={pat.patientId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pat.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {pat.age} yrs &bull; {pat.gender} &bull; {pat.phone}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--role-admin-primary)',
                        backgroundColor: 'var(--role-admin-bg)',
                        border: '1px solid var(--role-admin-border)',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      {pat.patientId}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
