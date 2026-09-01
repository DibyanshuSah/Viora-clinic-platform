import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, User, Stethoscope, CheckCircle2, XCircle, Printer, FileText } from 'lucide-react';
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aptRes, patRes, docRes, procRes] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getDoctorSchedules(todayStr),
        api.getProcedures()
      ]);

      if (aptRes.success) setAppointments(aptRes.data);
      if (patRes.success) setPatients(patRes.data);
      if (docRes.success) {
        setDoctors(docRes.data);
        if (docRes.data.length > 0 && !formData.doctorId) {
          const firstDoc = docRes.data[0];
          setFormData((prev) => ({ ...prev, doctorId: firstDoc.doctorId }));
          setAvailableSlots(firstDoc.slots || []);
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
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSelectedAppointmentForRX(row);
              setRxModalOpen(true);
            }}
            className="btn btn-doctor btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Prescription (RX)"
          >
            <Printer size={13} /> RX
          </button>
          
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
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Tax Invoice"
          >
            <FileText size={13} /> Bill
          </button>

          {row.status !== 'Completed' && row.status !== 'Cancelled' && (
            <button
              onClick={() => {
                setAppointmentToCancel(row);
                setCancelModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--status-danger-text)', padding: '4px 8px', fontSize: '0.75rem' }}
            >
              Cancel
            </button>
          )}
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
              {doctors.map((d) => (
                <option key={d.doctorId} value={d.doctorId}>
                  {d.name} ({d.specialization}) - Fee: ₹{d.consultationFee}
                </option>
              ))}
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
