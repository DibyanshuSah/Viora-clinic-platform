import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, User, Stethoscope, CheckCircle2, XCircle, Printer, FileText, RefreshCw, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import InvoicePreview from '../../components/common/InvoicePreview';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import { LoadingState } from '../../components/common/LoadingState';

const StaffAppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  
  // RX and Bill Print Modals
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [selectedAppointmentForRX, setSelectedAppointmentForRX] = useState(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);

  // WhatsApp Action States
  const [endingAptId, setEndingAptId] = useState(null);
  const [retryingAptId, setRetryingAptId] = useState(null);
  
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentType: 'Consultation', // ONLY 'Consultation' or 'Procedure'
    procedureId: '',
    date: todayStr,
    time: '10:00'
  });

  const [availableSlots, setAvailableSlots] = useState([]);

  const defaultSlots = [
    { time: '09:00', available: true },
    { time: '09:30', available: true },
    { time: '10:00', available: true },
    { time: '10:30', available: true },
    { time: '11:00', available: true },
    { time: '11:30', available: true },
    { time: '12:00', available: true },
    { time: '14:00', available: true },
    { time: '14:30', available: true },
    { time: '15:00', available: true },
    { time: '15:30', available: true },
    { time: '16:00', available: true },
    { time: '16:30', available: true },
    { time: '17:00', available: true }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aptRes, patRes, allDocsRes, schedRes, procRes] = await Promise.all([
        api.getAppointments({ role: 'STAFF', sortBy: 'recentRegisteredPatient' }),
        api.getPatients(),
        api.getDoctors().catch(() => ({ success: false, data: [] })),
        api.getDoctorSchedules(todayStr).catch(() => ({ success: false, data: [] })),
        api.getProcedures()
      ]);

      if (patRes.success) setPatients(patRes.data);

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

      let combinedDoctors = [];
      if (allDocsRes.success && allDocsRes.data?.length > 0) {
        const schedMap = new Map((schedRes?.data || []).map((s) => [s.doctorId, s]));
        combinedDoctors = allDocsRes.data
          .filter((d) => d.status === 'Active')
          .map((doc) => {
            const sched = schedMap.get(doc.doctorId);
            const fee = doc.consultationFee || doc.consultationRates?.consultationFee || sched?.consultationFee || 800;
            const slots = (sched?.slots && sched.slots.length > 0) ? sched.slots : defaultSlots;
            return {
              ...doc,
              consultationFee: fee,
              slots,
              isWorkingToday: sched ? sched.isWorkingToday : true
            };
          });
      } else if (schedRes.success && schedRes.data?.length > 0) {
        combinedDoctors = schedRes.data;
      }

      if (combinedDoctors.length > 0) {
        setDoctors(combinedDoctors);
        if (!formData.doctorId) {
          const firstDoc = combinedDoctors[0];
          setFormData((prev) => ({ ...prev, doctorId: firstDoc.doctorId }));
          setAvailableSlots(firstDoc.slots || defaultSlots);
        }
      }

      if (procRes.success) setProcedures(procRes.data);
    } catch (err) {
      showToast(err.message || 'Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDoctorChange = (doctorId) => {
    const doc = doctors.find((d) => d.doctorId === doctorId);
    setFormData((prev) => ({
      ...prev,
      doctorId,
      time: doc?.slots?.find((s) => s.available)?.time || '10:00'
    }));
    if (doc) {
      setAvailableSlots(doc.slots || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.patientId || !formData.doctorId || !formData.date || !formData.time) {
        showToast('Please fill all required appointment fields', 'error');
        return;
      }

      const procObj = procedures.find((p) => p.procedureId === formData.procedureId);

      const payload = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentType: formData.appointmentType,
        procedureId: formData.appointmentType === 'Procedure' ? formData.procedureId : undefined,
        procedureName: formData.appointmentType === 'Procedure' ? procObj?.name : undefined,
        date: formData.date,
        time: formData.time,
        status: 'Waiting'
      };

      await api.createAppointment(payload);
      showToast('Appointment booked and added to doctor queue', 'success');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Booking failed', 'error');
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    try {
      await api.cancelAppointment(appointmentToCancel.appointmentId);
      showToast(`Appointment ${appointmentToCancel.queueNumber} cancelled`, 'info');
      setCancelModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Failed to cancel appointment', 'error');
    }
  };

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

  const handleEndAppointment = async (appointment) => {
    try {
      setEndingAptId(appointment.appointmentId);
      const res = await api.endVisit(appointment.appointmentId);
      if (res.success) {
        await fetchData();
        const wa = res.data?.whatsappMessage;
        if (wa?.status === 'Sent' || wa?.status === 'Delivered') {
          showToast(`Visit ended. Bill ${res.data.bill?.invoiceNumber} finalized & WhatsApp link sent to ${appointment.patientName}!`, 'success');
        } else if (wa?.status === 'Failed') {
          showToast(`Visit completed. WhatsApp dispatch failed (${wa?.failureReason || 'Error'}). Staff can retry.`, 'warning');
        } else {
          showToast(`Visit ended & bill finalized for ${appointment.patientName}`, 'success');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete appointment', 'error');
    } finally {
      setEndingAptId(null);
    }
  };

  const handleRetryWhatsApp = async (appointment) => {
    try {
      setRetryingAptId(appointment.appointmentId);
      const res = await api.retryAppointmentWhatsApp(appointment.appointmentId);
      if (res.success) {
        showToast(`WhatsApp notification re-sent for ${appointment.patientName}!`, 'success');
        await fetchData();
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

  const columns = [
    {
      header: 'Queue #',
      render: (row) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: '1rem',
            color: 'var(--role-staff-primary)',
            backgroundColor: 'var(--role-staff-bg)',
            padding: '4px 10px',
            borderRadius: '6px'
          }}
        >
          {row.queueNumber}
        </span>
      )
    },
    {
      header: 'Patient Details',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700 }}>{row.patientName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.patientId} &bull; {row.patientAge} yrs &bull; {row.patientGender}
          </div>
          {row.patientCreatedAt && (
            <div style={{ fontSize: '0.7rem', color: 'var(--role-staff-primary)', fontWeight: 600, marginTop: '2px' }}>
              Registered: {new Date(row.patientCreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Doctor',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.doctorName}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.doctorSpecialization}
          </span>
        </div>
      )
    },
    {
      header: 'Date & Time',
      render: (row) => (
        <div style={{ fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 600 }}>{row.time}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.date}</div>
        </div>
      )
    },
    {
      header: 'Type',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{row.appointmentType}</span>
          {row.procedureName && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.procedureName}</div>
          )}
        </div>
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
          title="Change Status (Front Desk or Doctor)"
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
      header: 'Actions (RX • Bill • End • Cancel)',
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
            title="Preview & Print Tax Invoice (Bill)"
          >
            <FileText size={13} /> Bill
          </button>

          {/* 3. End */}
          <button
            onClick={() => handleEndAppointment(row)}
            disabled={row.status === 'Completed' || row.status === 'Cancelled' || endingAptId === row.appointmentId}
            className="btn btn-sm"
            style={{
              padding: '4px 8px',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: row.status === 'Completed' ? '#E2E8F0' : '#DCFCE7',
              color: row.status === 'Completed' ? '#64748B' : '#166534',
              border: `1px solid ${row.status === 'Completed' ? '#CBD5E1' : '#BBF7D0'}`,
              fontWeight: 700,
              cursor: row.status === 'Completed' ? 'default' : 'pointer'
            }}
            title={row.status === 'Completed' ? 'Visit Completed' : 'End visit and finalize bill & send WhatsApp'}
          >
            <CheckCircle2 size={13} /> {endingAptId === row.appointmentId ? 'Ending...' : (row.status === 'Completed' ? 'Ended' : 'End')}
          </button>

          {/* 4. Cancel */}
          <button
            onClick={() => {
              setAppointmentToCancel(row);
              setCancelModalOpen(true);
            }}
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
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Appointment Scheduling & Queue Roster
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Schedule physician consultations or clinical procedures.
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn btn-staff">
            <Plus size={16} /> Book Appointment
          </button>
        </div>

        <DataTable
          columns={columns}
          data={appointments}
          searchPlaceholder="Search appointment queue by patient or doctor..."
          loading={loading}
          emptyMessage="No scheduled appointments found"
        />
      </div>

      {/* BOOK APPOINTMENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Clinical Appointment"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-staff btn-sm"
              onClick={handleSubmit}
            >
              Confirm Appointment
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Patient Select */}
          <div className="form-group">
            <label className="form-label">Select Registered Patient *</label>
            <select
              className="form-select"
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name} ({p.patientId}) - Ph: {p.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Select */}
          <div className="form-group">
            <label className="form-label">Select Attending Doctor *</label>
            <select
              className="form-select"
              value={formData.doctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              required
            >
              {doctors.length === 0 ? (
                <option value="">No doctors registered yet (Add doctor in Admin &gt; Doctor Management)</option>
              ) : (
                doctors.map((d) => (
                  <option key={d.doctorId} value={d.doctorId}>
                    {d.name} ({d.specialization}) - Fee: ₹{d.consultationFee}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Consultation Type */}
          <div className="form-group">
            <label className="form-label">Consultation Type *</label>
            <select
              className="form-select"
              value={formData.appointmentType}
              onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
            >
              <option value="Consultation">Consultation (Physician Visit)</option>
              <option value="Follow-up Visit (Zero Bill)">Follow-up Visit (Zero Bill)</option>
              <option value="Procedure">Procedure (Clinical Procedure Only)</option>
            </select>
          </div>

          {formData.appointmentType === 'Procedure' && (
            <div className="form-group">
              <label className="form-label">Procedure *</label>
              <select
                className="form-select"
                value={formData.procedureId}
                onChange={(e) => setFormData({ ...formData, procedureId: e.target.value })}
                required
              >
                <option value="">-- Select Procedure from Catalog --</option>
                {procedures.map((p) => (
                  <option key={p.procedureId} value={p.procedureId}>
                    {p.name} (₹{p.defaultPrice})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date & Time Slot */}
          <FormInput
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <div>
            <label className="form-label" style={{ marginBottom: '6px' }}>Available Slots:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
              {availableSlots.map((slot, idx) => (
                <button
                  type="button"
                  key={idx}
                  disabled={!slot.available}
                  onClick={() => setFormData({ ...formData, time: slot.time })}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: '1px solid',
                    cursor: slot.available ? 'pointer' : 'not-allowed',
                    borderColor: formData.time === slot.time ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
                    backgroundColor: formData.time === slot.time ? 'var(--role-staff-primary)' : slot.available ? 'var(--bg-surface)' : '#F1F5F9',
                    color: formData.time === slot.time ? '#FFFFFF' : slot.available ? 'var(--text-main)' : 'var(--text-muted)'
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* CANCEL CONFIRMATION */}
      <ConfirmationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelAppointment}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel appointment for ${appointmentToCancel?.patientName} (${appointmentToCancel?.queueNumber})?`}
        confirmText="Cancel Appointment"
        isDestructive
      />

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

export default StaffAppointmentsPage;
