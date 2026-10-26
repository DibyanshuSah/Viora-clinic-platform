import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  Stethoscope,
  IndianRupee,
  ArrowRight,
  Hourglass
} from 'lucide-react';
import { api } from '../../services/api';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { useToast } from '../../context/ToastContext';

const StaffDashboardPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endingAptId, setEndingAptId] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [aptRes, docRes, patRes, billRes] = await Promise.all([
        api.getAppointments({ date: todayStr, role: 'STAFF', sortBy: 'recentRegisteredPatient' }),
        api.getDoctorSchedules(todayStr),
        api.getPatients(),
        api.getBills({ date: todayStr })
      ]);

      if (patRes.success) setPatients(patRes.data.slice(0, 5));

      if (aptRes.success) {
        const patientMap = new Map((patRes?.data || []).map((p) => [p.patientId, p]));
        const sortedAppointments = [...aptRes.data].map((apt) => {
          const pat = patientMap.get(apt.patientId);
          return {
            ...apt,
            patientCreatedAt: apt.patientCreatedAt || pat?.createdAt || null
          };
        }).sort((a, b) => {
          const timeA = a.patientCreatedAt ? new Date(a.patientCreatedAt).getTime() : 0;
          const timeB = b.patientCreatedAt ? new Date(b.patientCreatedAt).getTime() : 0;
          if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
            return timeB - timeA; // most recent registered patient first
          }
          const patientDiff = (b.patientId || '').localeCompare(a.patientId || '', undefined, { numeric: true });
          if (patientDiff !== 0) return patientDiff;

          const aptTimeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(`${a.date}T${a.time}`).getTime();
          const aptTimeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(`${b.date}T${b.time}`).getTime();
          if (!isNaN(aptTimeA) && !isNaN(aptTimeB) && aptTimeA !== aptTimeB) {
            return aptTimeB - aptTimeA;
          }
          return (b.appointmentId || '').localeCompare(a.appointmentId || '');
        });
        setAppointments(sortedAppointments);
      }
      if (docRes.success) setDoctors(docRes.data);
      if (billRes.success) setBills(billRes.data);
    } catch (err) {
      console.error('Front desk data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleEndAppointment = async (apt) => {
    try {
      setEndingAptId(apt.appointmentId);
      const res = await api.endVisit(apt.appointmentId);
      if (res.success) {
        await fetchDashboardData();
        const wa = res.data?.whatsappMessage;
        if (wa?.status === 'Sent' || wa?.status === 'Delivered') {
          showToast(`Visit ended. Bill ${res.data.bill?.invoiceNumber} finalized & WhatsApp link sent to ${apt.patientName}!`, 'success');
        } else if (wa?.status === 'Failed') {
          showToast(`Visit completed. WhatsApp dispatch failed (${wa?.failureReason || 'Error'}). Staff can retry in Appointments.`, 'warning');
        } else {
          showToast(`Visit ended and bill finalized for ${apt.patientName}`, 'success');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete visit', 'error');
    } finally {
      setEndingAptId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Front Desk Command Centre..." />;
  }

  const waitingPatients = appointments.filter((a) => a.status === 'Waiting');
  const inConsultation = appointments.filter((a) => a.status === 'In Consultation');
  const completedAppointments = appointments.filter((a) => a.status === 'Completed');
  const activeDoctors = doctors.filter((d) => d.isWorkingToday);

  const revenueBilledToday = bills.reduce((acc, b) => acc + (b.total || 0), 0);
  const pendingPayments = bills.filter((b) => b.paymentStatus !== 'Paid').reduce((acc, b) => acc + (b.balance || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* QUICK ACTIONS BANNER */}
      <div
        className="v-card"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          padding: '20px 24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--role-staff-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              Front Desk Command
            </span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '2px 0 4px 0' }}>
              Connected Patient Reception & Billing Workflow
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>
              Seamlessly register a patient, schedule with an available doctor, and generate bill in one transaction.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => navigate('/staff/registration')}
              className="btn btn-staff"
            >
              <UserPlus size={16} /> Register & Book Patient
            </button>
            <button
              onClick={() => navigate('/staff/billing')}
              className="btn btn-secondary"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <CreditCard size={16} /> Quick Bill
            </button>
            <button
              onClick={() => navigate('/staff/schedules')}
              className="btn btn-secondary"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Clock size={16} /> Doctor Schedules
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="stat-card-grid">
        <StatCard
          label="Total Patients Today"
          value={appointments.length}
          subtext={`${patients.length} total registered`}
          icon={Users}
          role="staff"
        />
        <StatCard
          label="Doctors on Duty"
          value={activeDoctors.length}
          subtext="Available for walk-ins & bookings"
          icon={Stethoscope}
          role="staff"
        />
        <StatCard
          label="Patients Waiting"
          value={waitingPatients.length}
          subtext={`${inConsultation.length} in consultation`}
          icon={Hourglass}
          role="staff"
        />
        <StatCard
          label="Revenue Billed Today"
          value={`₹${revenueBilledToday.toLocaleString()}`}
          subtext={`Pending: ₹${pendingPayments.toLocaleString()}`}
          icon={IndianRupee}
          role="staff"
        />
      </div>

      {/* TWO-COLUMN GRID: TODAY'S QUEUE & DOCTOR SCHEDULES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* ACTIVE APPOINTMENT QUEUE */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Calendar size={18} color="var(--role-staff-primary)" />
              <span>Current Clinic Patient Queue</span>
            </div>
            <button
              onClick={() => navigate('/staff/appointments')}
              className="btn btn-secondary btn-sm"
            >
              Manage Queue <ArrowRight size={14} />
            </button>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No patients currently in queue.
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt.appointmentId}>
                      <td style={{ fontWeight: 800, color: 'var(--role-staff-primary)' }}>
                        {apt.queueNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{apt.patientName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {apt.patientId}
                          {apt.patientCreatedAt && (
                            <span style={{ color: 'var(--role-staff-primary)', marginLeft: '6px', fontWeight: 600 }}>
                              &bull; Reg: {new Date(apt.patientCreatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{apt.doctorName}</div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{apt.doctorSpecialization}</span>
                      </td>
                      <td>{apt.time}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{apt.appointmentType}</span>
                      </td>
                      <td>
                        <StatusBadge status={apt.status} />
                      </td>
                      <td>
                        <button
                          onClick={() => handleEndAppointment(apt)}
                          disabled={apt.status === 'Completed' || apt.status === 'Cancelled' || endingAptId === apt.appointmentId}
                          className="btn btn-sm"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: apt.status === 'Completed' ? '#E2E8F0' : '#DCFCE7',
                            color: apt.status === 'Completed' ? '#64748B' : '#166534',
                            border: `1px solid ${apt.status === 'Completed' ? '#CBD5E1' : '#BBF7D0'}`,
                            fontWeight: 700,
                            cursor: apt.status === 'Completed' ? 'default' : 'pointer'
                          }}
                          title={apt.status === 'Completed' ? 'Visit Completed' : 'End visit and finalize bill & send WhatsApp'}
                        >
                          <CheckCircle2 size={13} /> {endingAptId === apt.appointmentId ? 'Ending...' : (apt.status === 'Completed' ? 'Ended' : 'End')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TODAY'S DOCTOR AVAILABILITY */}
        <div className="v-card">
          <div className="v-card-header">
            <div className="v-card-title">
              <Stethoscope size={18} color="var(--role-staff-primary)" />
              <span>Doctor Roster & Queue Loads</span>
            </div>
            <button
              onClick={() => navigate('/staff/schedules')}
              className="btn btn-secondary btn-sm"
            >
              Slots View
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {doctors.map((doc) => (
              <div
                key={doc.doctorId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Fee: ₹{doc.consultationFee} &bull; {doc.availableSlotsCount} slots left
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={doc.isWorkingToday ? 'Available' : 'Paused'} />
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Queue: {doc.waitingCount || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboardPage;
