import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, PlayCircle, Clock, User, FileText, Printer, XCircle, CreditCard, RefreshCw, Copy } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import InvoicePreview from '../../components/common/InvoicePreview';
import { LoadingState } from '../../components/common/LoadingState';

const DoctorAppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [selectedAppointmentForRX, setSelectedAppointmentForRX] = useState(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);
  const [retryingAptId, setRetryingAptId] = useState(null);
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

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const res = await api.updateAppointmentStatus(appointmentId, newStatus);
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a.appointmentId === appointmentId ? { ...a, status: newStatus } : a))
        );
        showToast(`Appointment status updated to "${newStatus}"`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleRetryWhatsApp = async (appointment) => {
    try {
      setRetryingAptId(appointment.appointmentId);
      const res = await api.retryAppointmentWhatsApp(appointment.appointmentId);
      if (res.success) {
        showToast(`WhatsApp bill notification re-sent for ${appointment.patientName}!`, 'success');
        await fetchDoctorAppointments();
      }
    } catch (err) {
      showToast(err.message || 'Retry failed', 'error');
    } finally {
      setRetryingAptId(null);
    }
  };

  const handleCopyBillLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast('Secure UUID Bill Link copied to clipboard!', 'success');
  };

  const handleOpenRX = async (appointment) => {
    setSelectedAppointmentForRX(appointment);
    setRxModalOpen(true);
    // status - 2: on RX printed / opened, transition to "In Consultation"
    if (appointment.status === 'Waiting') {
      try {
        await api.updateAppointmentStatus(appointment.appointmentId, 'In Consultation');
        setAppointments((prev) =>
          prev.map((a) => (a.appointmentId === appointment.appointmentId ? { ...a, status: 'In Consultation' } : a))
        );
        showToast(`Status transitioned to "In Consultation" on RX access`, 'info');
      } catch (err) {
        console.warn('Status transition note:', err.message);
      }
    }
  };

  const handleCancelAppointment = async (appointment) => {
    if (!window.confirm(`Are you sure you want to cancel the appointment for ${appointment.patientName}?`)) {
      return;
    }
    try {
      const res = await api.cancelAppointment(appointment.appointmentId);
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a.appointmentId === appointment.appointmentId ? { ...a, status: 'Cancelled' } : a))
        );
        showToast(`Appointment cancelled for ${appointment.patientName}`, 'info');
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel appointment', 'error');
    }
  };

  const getStatusSelectStyle = (status) => {
    switch (status) {
      case 'Waiting':
        return { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' };
      case 'In Consultation':
        return { backgroundColor: '#EFF6FF', color: '#1E40AF', borderColor: '#3B82F6' };
      case 'Completed':
        return { backgroundColor: '#DCFCE7', color: '#166534', borderColor: '#22C55E' };
      case 'Cancelled':
        return { backgroundColor: '#FEE2E2', color: '#991B1B', borderColor: '#EF4444' };
      default:
        return { backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' };
    }
  };

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
      render: (row) => (
        <select
          className="form-select"
          value={row.status}
          onChange={(e) => handleStatusChange(row.appointmentId, e.target.value)}
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            height: '28px',
            borderRadius: '14px',
            border: '1.5px solid',
            cursor: 'pointer',
            ...getStatusSelectStyle(row.status)
          }}
          title="Change Status (Doctor or Front Desk)"
        >
          <option value="Waiting">Waiting</option>
          <option value="In Consultation">In Consultation</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      )
    },
    {
      header: 'WhatsApp Status',
      render: (row) => {
        const msg = row.whatsappMessage;
        const link = row.activeLink;
        if (!msg) {
          if (row.status === 'Completed') {
            return (
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                {row.patientWhatsappConsent === false ? 'No Consent' : 'Not Sent'}
              </span>
            );
          }
          return (
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Auto-sends on End
            </span>
          );
        }

        const isFailed = msg.status === 'Failed';
        const isSent = msg.status === 'Sent' || msg.status === 'Delivered';
        const isPending = msg.status === 'Pending';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: isSent ? '#DCFCE7' : (isPending ? '#FEF3C7' : '#FEE2E2'),
                  color: isSent ? '#166534' : (isPending ? '#92400E' : '#991B1B')
                }}
                title={msg.failureReason || `Sent to ${msg.recipientPhone}`}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isSent ? '#16A34A' : (isPending ? '#D97706' : '#DC2626') }} />
                {msg.status}
              </span>

              {link?.url && (
                <button
                  type="button"
                  onClick={() => handleCopyBillLink(link.url)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                  title="Copy Secure UUID Bill Link"
                >
                  <Copy size={11} />
                </button>
              )}
            </div>

            {isFailed && (
              <button
                type="button"
                onClick={() => handleRetryWhatsApp(row)}
                disabled={retryingAptId === row.appointmentId}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  color: '#DC2626',
                  borderColor: '#FECACA',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={`Failure: ${msg.failureReason || 'Error'}. Click to Retry.`}
              >
                <RefreshCw size={10} className={retryingAptId === row.appointmentId ? 'spin' : ''} />
                {retryingAptId === row.appointmentId ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions (RX • Bill • Cancel • Consult)',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* 1. RX */}
          <button
            onClick={() => handleOpenRX(row)}
            className="btn btn-doctor btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Preview & Print Prescription (RX) - transitions to In Consultation"
          >
            <Printer size={13} /> RX
          </button>

          {/* 2. Bill */}
          <button
            onClick={async () => {
              if (row.bill) {
                setSelectedBillForPrint(row.bill);
                setBillModalOpen(true);
              } else {
                try {
                  const billRes = await api.getBills({ patientId: row.patientId });
                  if (billRes.success && billRes.data.length > 0) {
                    setSelectedBillForPrint(billRes.data[0]);
                    setBillModalOpen(true);
                  } else {
                    showToast('No generated bill found for this patient yet.', 'info');
                  }
                } catch {
                  showToast('No generated bill found for this patient yet.', 'info');
                }
              }
            }}
            className="btn btn-staff btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Preview & Print Patient Bill"
          >
            <FileText size={13} /> Bill
          </button>

          {/* 3. Cancel */}
          <button
            onClick={() => handleCancelAppointment(row)}
            disabled={row.status === 'Completed' || row.status === 'Cancelled'}
            className="btn btn-secondary btn-sm"
            style={{
              color: row.status === 'Cancelled' ? '#94A3B8' : 'var(--status-danger-text)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              opacity: (row.status === 'Completed' || row.status === 'Cancelled') ? 0.6 : 1
            }}
            title="Cancel Appointment"
          >
            <XCircle size={13} /> Cancel
          </button>

          {/* Consult Workspace Link */}
          <button
            onClick={() => handleStartConsultation(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Open clinical workstation"
          >
            <PlayCircle size={13} /> {row.status === 'Completed' ? 'View' : 'Consult'}
          </button>
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
              appointmentId: selectedAppointmentForRX.appointmentId,
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
              appointmentId: selectedAppointmentForRX.appointmentId,
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
            onPrint={() => {
              setAppointments(prev =>
                prev.map(a => a.appointmentId === selectedAppointmentForRX.appointmentId ? { ...a, status: 'In Consultation' } : a)
              );
            }}
            onClose={() => {
              setRxModalOpen(false);
              setSelectedAppointmentForRX(null);
            }}
          />
        )}
      </Modal>

      {/* INVOICE PREVIEW MODAL */}
      <Modal
        isOpen={billModalOpen}
        onClose={() => {
          setBillModalOpen(false);
          setSelectedBillForPrint(null);
        }}
        title="VIORA Tax Invoice"
        size="xl"
      >
        <InvoicePreview
          invoice={selectedBillForPrint}
          onClose={() => {
            setBillModalOpen(false);
            setSelectedBillForPrint(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default DoctorAppointmentsPage;
