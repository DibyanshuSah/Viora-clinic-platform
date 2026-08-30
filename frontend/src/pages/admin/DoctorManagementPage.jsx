import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, KeyRound, Check, Stethoscope, Clock, IndianRupee } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import { LoadingState } from '../../components/common/LoadingState';

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DoctorManagementPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const { showToast } = useToast();

  const initialFormState = {
    name: '',
    gender: 'Male',
    specialization: '',
    qualification: '',
    registrationNumber: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    consultationFee: 800,
    doctorCut: 500,
    clinicShare: 300,
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    workingHoursStart: "09:00",
    workingHoursEnd: "17:00",
    breakTimeStart: "13:00",
    breakTimeEnd: "14:00",
    status: 'Active'
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await api.getDoctors();
      if (res.success) {
        setDoctors(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load doctors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleOpenAddModal = () => {
    setEditingDoctor(null);
    setFormData(initialFormState);
    setModalOpen(true);
  };

  const handleOpenEditModal = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name || '',
      gender: doctor.gender || 'Male',
      specialization: doctor.specialization || '',
      qualification: doctor.qualification || '',
      registrationNumber: doctor.registrationNumber || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      username: doctor.username || '',
      password: '', // Leave blank if not changing
      consultationFee: doctor.consultationRates?.consultationFee || 800,
      doctorCut: doctor.consultationRates?.doctorCut || 500,
      clinicShare: doctor.consultationRates?.clinicShare || 300,
      workingDays: doctor.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      workingHoursStart: doctor.workingHours?.start || "09:00",
      workingHoursEnd: doctor.workingHours?.end || "17:00",
      breakTimeStart: doctor.breakTimes?.start || "13:00",
      breakTimeEnd: doctor.breakTimes?.end || "14:00",
      status: doctor.status || 'Active'
    });
    setModalOpen(true);
  };

  const handleFeeChange = (e) => {
    const fee = Number(e.target.value) || 0;
    const cut = Number(formData.doctorCut) || 0;
    setFormData((prev) => ({
      ...prev,
      consultationFee: fee,
      clinicShare: Math.max(0, fee - cut)
    }));
  };

  const handleDoctorCutChange = (e) => {
    const cut = Number(e.target.value) || 0;
    const fee = Number(formData.consultationFee) || 0;
    setFormData((prev) => ({
      ...prev,
      doctorCut: cut,
      clinicShare: Math.max(0, fee - cut)
    }));
  };

  const handleDayToggle = (day) => {
    setFormData((prev) => {
      const exists = prev.workingDays.includes(day);
      const nextDays = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: nextDays };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        gender: formData.gender,
        specialization: formData.specialization,
        qualification: formData.qualification,
        registrationNumber: formData.registrationNumber,
        phone: formData.phone,
        email: formData.email,
        username: formData.username,
        password: formData.password || undefined,
        consultationFee: Number(formData.consultationFee),
        doctorCut: Number(formData.doctorCut),
        clinicShare: Number(formData.clinicShare),
        workingDays: formData.workingDays,
        workingHours: {
          start: formData.workingHoursStart,
          end: formData.workingHoursEnd
        },
        breakTimes: {
          start: formData.breakTimeStart,
          end: formData.breakTimeEnd
        },
        status: formData.status
      };

      if (editingDoctor) {
        await api.updateDoctor(editingDoctor.doctorId, payload);
        showToast(`Doctor ${formData.name} updated successfully`, 'success');
      } else {
        if (!formData.username || !formData.password) {
          showToast('Username and Password are required for new doctor account', 'error');
          return;
        }
        await api.createDoctor(payload);
        showToast(`Doctor ${formData.name} registered successfully`, 'success');
      }

      setModalOpen(false);
      fetchDoctors();
    } catch (err) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteDoctor = async () => {
    if (!doctorToDelete) return;
    try {
      await api.deleteDoctor(doctorToDelete.doctorId);
      showToast(`Doctor ${doctorToDelete.name} deactivated`, 'info');
      setDeleteConfirmOpen(false);
      fetchDoctors();
    } catch (err) {
      showToast(err.message || 'Failed to deactivate doctor', 'error');
    }
  };

  const columns = [
    {
      header: 'Doctor Name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.qualification || 'MBBS'} &bull; Reg: {row.registrationNumber || 'N/A'}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--role-admin-primary)', fontWeight: 600 }}>
            {row.doctorId}
          </span>
        </div>
      )
    },
    {
      header: 'Specialization',
      accessor: 'specialization',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.specialization}</span>
    },
    {
      header: 'Contact Info',
      render: (row) => (
        <div style={{ fontSize: '0.8rem' }}>
          <div>{row.phone}</div>
          <div style={{ color: 'var(--text-muted)' }}>{row.email}</div>
        </div>
      )
    },
    {
      header: 'Consultation Rate & Split',
      render: (row) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div style={{ fontWeight: 700 }}>Fee: ₹{row.consultationRates?.consultationFee || 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Doc Cut: ₹{row.consultationRates?.doctorCut || 0} &bull; Clinic: ₹{row.consultationRates?.clinicShare || 0}
          </div>
        </div>
      )
    },
    {
      header: 'Working Schedule',
      render: (row) => (
        <div style={{ fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 600 }}>
            {row.workingHours?.start} - {row.workingHours?.end}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Break: {row.breakTimes?.start} - {row.breakTimes?.end}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {row.workingDays?.length} days/week
          </div>
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
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => handleOpenEditModal(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px' }}
            title="Edit Doctor & Pricing"
          >
            <Edit size={14} />
          </button>
          {row.status === 'Active' && (
            <button
              onClick={() => {
                setDoctorToDelete(row);
                setDeleteConfirmOpen(true);
              }}
              className="btn btn-danger btn-sm"
              style={{ padding: '4px 8px' }}
              title="Deactivate Doctor"
            >
              <Trash2 size={14} />
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
              Doctor Management & Availability
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Configure doctor credentials, consultation pricing, cuts, working hours, and roster availability.
            </p>
          </div>
          <button onClick={handleOpenAddModal} className="btn btn-admin">
            <Plus size={16} /> Add New Doctor
          </button>
        </div>

        <DataTable
          columns={columns}
          data={doctors}
          searchPlaceholder="Search doctor by name, specialization, phone..."
          loading={loading}
          emptyMessage="No doctors found in VIORA clinic roster"
        />
      </div>

      {/* ADD / EDIT DOCTOR MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDoctor ? `Edit Doctor: ${editingDoctor.name}` : 'Register New Doctor'}
        size="lg"
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
              className="btn btn-admin btn-sm"
              onClick={handleSubmit}
            >
              {editingDoctor ? 'Update Doctor Details' : 'Create Doctor & Credentials'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* SECTION 1: PERSONAL & PROFESSIONAL */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              1. Professional & Contact Information
            </h4>
            <div className="form-grid-3">
              <FormInput
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dr. Rajesh Sharma"
                required
              />
              <SelectInput
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                options={['Male', 'Female', 'Other']}
                required
              />
              <FormInput
                label="Specialization"
                name="specialization"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="e.g. Senior Cardiologist"
                required
              />
            </div>

            <div className="form-grid-3">
              <FormInput
                label="Qualifications"
                name="qualification"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                placeholder="e.g. MBBS, MD, DM"
              />
              <FormInput
                label="Medical Registration No."
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                placeholder="e.g. KMC-49210"
              />
              <SelectInput
                label="Status"
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={['Active', 'Inactive']}
                required
              />
            </div>

            <div className="form-grid-2">
              <FormInput
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 98450 77665"
                required
              />
              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. doctor@vioraclinic.com"
                required
              />
            </div>
          </div>

          {/* SECTION 2: AUTHENTICATION CREDENTIALS */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              2. Doctor Portal Credentials
            </h4>
            <div className="form-grid-2">
              <FormInput
                label="Username (Login ID)"
                name="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. dr.sharma"
                disabled={!!editingDoctor}
                required
              />
              <FormInput
                label={editingDoctor ? "Reset Password (leave empty to keep current)" : "Password"}
                name="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
                required={!editingDoctor}
              />
            </div>
          </div>

          {/* SECTION 3: CONSULTATION PRICING & CUTS */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              3. Consultation Fee & Revenue Split
            </h4>
            <div className="form-grid-3">
              <FormInput
                label="Consultation Fee (₹)"
                name="consultationFee"
                type="number"
                value={formData.consultationFee}
                onChange={handleFeeChange}
                required
              />
              <FormInput
                label="Doctor Cut (₹)"
                name="doctorCut"
                type="number"
                value={formData.doctorCut}
                onChange={handleDoctorCutChange}
                required
              />
              <FormInput
                label="Clinic Share (₹) [Auto]"
                name="clinicShare"
                type="number"
                value={formData.clinicShare}
                disabled
              />
            </div>
          </div>

          {/* SECTION 4: WORKING SCHEDULE & AVAILABILITY */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              4. Working Days, Shift Hours & Break Times
            </h4>
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>
                Select Available Working Days:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALL_DAYS.map((day) => {
                  const selected = formData.workingDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: selected ? 'var(--role-admin-primary)' : 'var(--border-subtle)',
                        backgroundColor: selected ? 'var(--role-admin-bg)' : 'var(--bg-surface)',
                        color: selected ? 'var(--role-admin-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {selected && <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-grid-4">
              <FormInput
                label="Shift Start Time"
                name="workingHoursStart"
                type="time"
                value={formData.workingHoursStart}
                onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                required
              />
              <FormInput
                label="Shift End Time"
                name="workingHoursEnd"
                type="time"
                value={formData.workingHoursEnd}
                onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                required
              />
              <FormInput
                label="Break Start"
                name="breakTimeStart"
                type="time"
                value={formData.breakTimeStart}
                onChange={(e) => setFormData({ ...formData, breakTimeStart: e.target.value })}
              />
              <FormInput
                label="Break End"
                name="breakTimeEnd"
                type="time"
                value={formData.breakTimeEnd}
                onChange={(e) => setFormData({ ...formData, breakTimeEnd: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* DEACTIVATE CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteDoctor}
        title="Deactivate Doctor"
        message={`Are you sure you want to deactivate ${doctorToDelete?.name}? They will no longer be available for appointment bookings at the front desk.`}
        confirmText="Deactivate"
        isDestructive
      />
    </div>
  );
};

export default DoctorManagementPage;
