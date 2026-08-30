import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  IndianRupee,
  Activity,
  Users,
  Clock,
  ArrowDownRight,
  TrendingUp,
  Download,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import StatCard from '../../components/common/StatCard';
import RevenueChart from '../../components/common/RevenueChart';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';

const AnalyticsPage = () => {
  const [period, setPeriod] = useState('month'); // today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminAnalytics(period, startDate, endDate);
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch financial analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const handleCustomFilterSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      showToast('Please select both start and end date for custom range', 'error');
      return;
    }
    fetchAnalytics();
  };

  if (loading && !analytics) {
    return <LoadingState message="Calculating VIORA financial and clinical metrics..." />;
  }

  const summary = analytics?.summary || {};
  const doctorPayouts = analytics?.doctorPayouts || [];
  const staffHours = analytics?.staffHours || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* FILTER BAR */}
      <div
        className="v-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)',
          padding: '16px 20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} color="var(--role-admin-primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Reporting Timeline:</span>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {['today', 'week', 'month'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderColor: period === p ? 'var(--role-admin-primary)' : 'var(--border-subtle)',
                  backgroundColor: period === p ? 'var(--role-admin-primary)' : 'var(--bg-surface)',
                  color: period === p ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOM DATE RANGE */}
        <form onSubmit={handleCustomFilterSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            className="form-input"
            style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPeriod('custom');
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
          <input
            type="date"
            className="form-input"
            style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPeriod('custom');
            }}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="stat-card-grid">
        <StatCard
          label="Total Gross Revenue"
          value={`₹${(summary.totalRevenue || 0).toLocaleString()}`}
          subtext={`Today: ₹${(summary.revenueToday || 0).toLocaleString()}`}
          icon={IndianRupee}
          role="admin"
        />
        <StatCard
          label="Clinic Net Share"
          value={`₹${(summary.totalClinicRevenue || 0).toLocaleString()}`}
          subtext="Retained clinic earnings"
          icon={TrendingUp}
          role="admin"
        />
        <StatCard
          label="Total Doctor Payouts"
          value={`₹${(summary.totalDoctorPayout || 0).toLocaleString()}`}
          subtext="Amount payable to physicians"
          icon={Activity}
          role="admin"
        />
        <StatCard
          label="Total Consultations & Procedures"
          value={`${summary.totalConsultations || 0} / ${summary.totalProcedures || 0}`}
          subtext={`Total patients: ${summary.totalPatients || 0}`}
          icon={Users}
          role="admin"
        />
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* REVENUE TIMELINE */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <BarChart3 size={18} color="var(--role-admin-primary)" />
              <span>Revenue over Time & Doctor Cut Split</span>
            </div>
          </div>
          <RevenueChart timeline={analytics?.timeline} breakdown={analytics?.breakdown} />
        </div>

        {/* CONSULTATION VS PROCEDURE REVENUE SPLIT */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Activity size={18} color="var(--role-admin-primary)" />
              <span>Revenue Streams Breakdown</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            {/* Consultation bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600 }}>Consultation Fees ({summary.totalConsultations} visits)</span>
                <span style={{ fontWeight: 700 }}>₹{(summary.consultationRevenue || 0).toLocaleString()}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${summary.totalRevenue > 0 ? (summary.consultationRevenue / summary.totalRevenue) * 100 : 0}%`,
                    backgroundColor: 'var(--role-admin-primary)',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            {/* Procedure bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600 }}>Clinical Procedures ({summary.totalProcedures} services)</span>
                <span style={{ fontWeight: 700 }}>₹{(summary.procedureRevenue || 0).toLocaleString()}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${summary.totalRevenue > 0 ? (summary.procedureRevenue / summary.totalRevenue) * 100 : 0}%`,
                    backgroundColor: 'var(--role-doctor-primary)',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            {/* Total Paid vs Outstanding */}
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Cash/UPI/Card Collected:</span>
                <strong style={{ color: 'var(--status-available-text)' }}>₹{(summary.totalPaidReceived || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Outstanding Pending Balance:</span>
                <strong style={{ color: 'var(--status-danger-text)' }}>₹{(summary.totalOutstanding || 0).toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOCTOR PAYOUT TABLE */}
      <div className="v-card">
        <div className="v-card-header">
          <div className="v-card-title">
            <IndianRupee size={18} color="var(--role-admin-primary)" />
            <span>Doctor Financial Payout & Revenue Share Statement</span>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="v-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Consultations</th>
                <th>Procedures</th>
                <th>Gross Revenue</th>
                <th>Doctor Cut</th>
                <th>Clinic Share</th>
                <th>Amount Payable</th>
              </tr>
            </thead>
            <tbody>
              {doctorPayouts.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No doctor revenue data recorded for this period.
                  </td>
                </tr>
              ) : (
                doctorPayouts.map((doc) => (
                  <tr key={doc.doctorId}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{doc.doctorName}</div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {doc.specialization}
                      </span>
                    </td>
                    <td>{doc.consultations}</td>
                    <td>{doc.procedures}</td>
                    <td style={{ fontWeight: 600 }}>₹{doc.grossRevenue.toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: 'var(--role-doctor-primary)' }}>
                      ₹{doc.doctorCut.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--role-admin-primary)' }}>
                      ₹{doc.clinicShare.toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: 'var(--status-available-text)',
                          backgroundColor: 'var(--status-available-bg)',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        ₹{doc.amountPayable.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STAFF WORKING HOURS & ATTENDANCE */}
      <div className="v-card">
        <div className="v-card-header">
          <div className="v-card-title">
            <Clock size={18} color="var(--role-admin-primary)" />
            <span>Staff Duty Roster & Worked Hours Summary</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Total Staff Hours: {summary.totalStaffHours || 0} hrs
          </span>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="v-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Shift Type</th>
                <th>Scheduled Hours</th>
                <th>Worked Hours</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {staffHours.map((st) => (
                <tr key={st.staffId}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{st.name}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.staffId}</span>
                  </td>
                  <td>{st.shift}</td>
                  <td>{st.scheduledHours} hrs</td>
                  <td style={{ fontWeight: 600 }}>{st.workedHours} hrs</td>
                  <td>
                    <StatusBadge status={st.attendance} />
                  </td>
                  <td>
                    <StatusBadge status={st.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
