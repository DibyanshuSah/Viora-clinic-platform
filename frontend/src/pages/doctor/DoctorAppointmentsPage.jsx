import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, PlayCircle, Clock, CheckCircle2, User, FileText, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import { LoadingState } from '../../components/common/LoadingState';

const DoctorAppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [selectedAppointmentForRX, setSelectedAppointmentForRX] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchDoctorAppointments = async () => {
    try {
      setLoading(true);
      const doctorId = user?.referenceId;
      const res = await api.getAppointments({
        date: todayStr,
        ...(doctorId ? { doctorId } : {})
      });

      if (res.success) {
        setAppointments(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load appointment queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorAppointments();
  }, [user]);

  const handleStartConsultation = async (appointment) => {
    try {
      if (appointment.status === 'Waiting') {
        await api.updateAppointmentStatus(appointment.appointmentId, 'In Consultation');
      }
      navigate(`/doctor/consultation/${appointment.appointmentId}`);
    } catch (err) {
      showToast('Unable to transition appointment', 'error');
      navigate(`/doctor/consultation/${appointment.appointmentId}`);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter === 'All') return true;
    return apt.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const columns = [
    {
      header: 'Queue #',
      render: (row) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: '1rem',
            color: 'var(--role-doctor-primary)',
            backgroundColor: 'var(--role-doctor-bg)',
            padding: '4px 10px',
            borderRadius: '6px'
          }}
        >
          {row.queueNumber}
        </span>
      ),
      width: '100px'
    },
    {
      header: 'Patient Details',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{row.patientName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.patientId} &bull; {row.patientAge} yrs &bull; {row.patientGender}
          </div>
          {row.patientPhone && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.patientPhone}</div>
          )}
        </div>
      )
    },
    {
      header: 'Appointment Time',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <Clock size={14} color="var(--role-doctor-primary)" />
          <span>{row.time}</span>
        </div>
      )
    },
    {
      header: 'Type',
      render: (row) => (
        <div>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: row.appointmentType === 'Consultation' ? 'var(--role-doctor-primary)' : 'var(--role-staff-primary)'
            }}
          >
            {row.appointmentType}
          </span>
          {row.procedureName && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {row.procedureName}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Waiting Time',
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {row.status === 'Completed' ? 'Completed' : `${row.waitingTimeMinutes || 0} mins`}
        </span>
      )
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Clinical Action',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSelectedAppointmentForRX(row);
              setRxModalOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Prescription (RX)"
          >
            <Printer size={13} /> Print RX
          </button>
          {row.status === 'Completed' ? (
            <button
              onClick={() => navigate(`/doctor/consultation/${row.appointmentId}`)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Review Completed Consultation Record"
            >
              <FileText size={13} /> View
            </button>
          ) : (
            <button
              onClick={() => handleStartConsultation(row)}
              className="btn btn-doctor btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Open clinical consultation workspace"
            >
              <PlayCircle size={13} />
              <span>{row.status === 'In Consultation' ? 'Resume' : 'Start'}</span>
            </button>
          )}
        </div>
      )
    }
  ];

  const waitingCount = appointments.filter((a) => a.status === 'Waiting').length;
  const inConsultationCount = appointments.filter((a) => a.status === 'In Consultation').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* QUEUE STATUS BAR */}
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
            Today's Clinical Appointment Queue
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Date: <strong>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--status-paused-bg)',
              color: 'var(--status-paused-text)',
              fontSize: '0.8125rem',
              fontWeight: 700
            }}
          >
            {waitingCount} Waiting
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--status-active-bg)',
              color: 'var(--status-active-text)',
              fontSize: '0.8125rem',
              fontWeight: 700
            }}
          >
            {inConsultationCount} In Consultation
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--status-available-bg)',
              color: 'var(--status-available-text)',
              fontSize: '0.8125rem',
              fontWeight: 700
            }}
          >
            {completedCount} Completed
          </div>
        </div>
      </div>

      {/* APPOINTMENTS TABLE */}
      <div className="v-card">
        <DataTable
          columns={columns}
          data={filteredAppointments}
          searchPlaceholder="Search queue by patient name, ID, phone..."
          loading={loading}
          emptyMessage="No queued patients for your clinic session today"
          filters={
            <div style={{ display: 'flex', gap: '4px' }}>
              {['All', 'Waiting', 'In Consultation', 'Completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid',
                    cursor: 'pointer',
                    borderColor: statusFilter === status ? 'var(--role-doctor-primary)' : 'var(--border-subtle)',
                    backgroundColor: statusFilter === status ? 'var(--role-doctor-primary)' : 'var(--bg-surface)',
                    color: statusFilter === status ? '#FFFFFF' : 'var(--text-secondary)'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          }
        />
      </div>

      {/* RX PREVIEW MODAL */}
      <Modal
        isOpen={rxModalOpen}
        onClose={() => {
          setRxModalOpen(false);
          setSelectedAppointmentForRX(null);
        }}
        title="Prescription Slip (RX Preview)"
        size="xl"
      >
        {selectedAppointmentForRX && (
          <RXPreviewModal
            prescription={{
              prescriptionId: selectedAppointmentForRX.prescription?.prescriptionId || `RX-${selectedAppointmentForRX.patientId}`,
              patientName: selectedAppointmentForRX.patientName,
              patientId: selectedAppointmentForRX.patientId,
              patientAge: selectedAppointmentForRX.patientAge,
              patientGender: selectedAppointmentForRX.patientGender,
              patientPhone: selectedAppointmentForRX.patientPhone,
              patientDOB: selectedAppointmentForRX.patientDOB,
              doctorName: selectedAppointmentForRX.doctorName,
              doctorSpecialization: selectedAppointmentForRX.doctorSpecialization,
              doctorQualification: selectedAppointmentForRX.doctorQualification,
              doctorRegNo: selectedAppointmentForRX.doctorRegNo,
              consultationDate: selectedAppointmentForRX.date,
              chiefComplaints: selectedAppointmentForRX.appointmentType === 'Procedure' && selectedAppointmentForRX.procedureName
                ? `Procedure: ${selectedAppointmentForRX.procedureName}`
                : (selectedAppointmentForRX.consultation?.chiefComplaint || (selectedAppointmentForRX.medicalHistory && selectedAppointmentForRX.medicalHistory !== 'None' ? `History: ${selectedAppointmentForRX.medicalHistory}` : '')),
              allergies: selectedAppointmentForRX.allergies,
              medicalHistory: selectedAppointmentForRX.medicalHistory,
              medicines: selectedAppointmentForRX.prescription?.medicines || [],
              procedures: selectedAppointmentForRX.prescription?.procedures || (selectedAppointmentForRX.procedureName ? [selectedAppointmentForRX.procedureName] : []),
              createdAt: selectedAppointmentForRX.createdAt
            }}
            consultation={selectedAppointmentForRX.consultation || {
              patientName: selectedAppointmentForRX.patientName,
              patientId: selectedAppointmentForRX.patientId,
              patientAge: selectedAppointmentForRX.patientAge,
              patientGender: selectedAppointmentForRX.patientGender,
              patientPhone: selectedAppointmentForRX.patientPhone,
              doctorName: selectedAppointmentForRX.doctorName,
              doctorSpecialization: selectedAppointmentForRX.doctorSpecialization,
              doctorQualification: selectedAppointmentForRX.doctorQualification,
              doctorRegNo: selectedAppointmentForRX.doctorRegNo,
              procedureDetails: selectedAppointmentForRX.procedureName,
              chiefComplaint: selectedAppointmentForRX.procedureName ? `Procedure: ${selectedAppointmentForRX.procedureName}` : ''
            }}
            onClose={() => {
              setRxModalOpen(false);
              setSelectedAppointmentForRX(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default DoctorAppointmentsPage;
