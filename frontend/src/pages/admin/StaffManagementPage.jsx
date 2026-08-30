import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Clock, Check, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { FormInput, SelectInput } from '../../components/common/FormInput';

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const StaffManagementPage = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const { showToast } = useToast();

  const initialFormState = {
    name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    shift: 'Morning Shift',
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    startTime: "08:00",
    endTime: "14:00",
    scheduledHours: 6,
    status: 'Active'
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.getStaff();
      if (res.success) {
        setStaffList(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load staff records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData(initialFormState);
    setModalOpen(true);
  };

  const handleOpenEdit = (st) => {
    setEditingStaff(st);
    setFormData({
      name: st.name || '',
      phone: st.phone || '',
      email: st.email || '',
      username: st.username || '',
      password: '',
      shift: st.shift || 'Morning Shift',
      workingDays: st.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      startTime: st.startTime || "08:00",
      endTime: st.endTime || "14:00",
      scheduledHours: st.scheduledHours || 6,
      status: st.status || 'Active'
    });
    setModalOpen(true);
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
        phone: formData.phone,
        email: formData.email,
        username: formData.username,
        password: formData.password || undefined,
        shift: formData.shift,
        workingDays: formData.workingDays,
        startTime: formData.startTime,
        endTime: formData.endTime,
        scheduledHours: Number(formData.scheduledHours),
        status: formData.status
      };

      if (editingStaff) {
        await api.updateStaff(editingStaff.staffId, payload);
        showToast(`Staff member ${formData.name} updated`, 'success');
      } else {
        if (!formData.username || !formData.password) {
          showToast('Username and Password are required for staff user account', 'error');
          return;
        }
        await api.createStaff(payload);
        showToast(`Staff member ${formData.name} registered`, 'success');
      }

      setModalOpen(false);
      fetchStaff();
    } catch (err) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;
    try {
      await api.deleteStaff(staffToDelete.staffId);
      showToast(`Staff member ${staffToDelete.name} deactivated`, 'info');
      setDeleteConfirmOpen(false);
      fetchStaff();
    } catch (err) {
      showToast(err.message || 'Failed to deactivate staff member', 'error');
    }
  };

  const columns = [
    {
      header: 'Staff Member',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--role-admin-primary)', fontWeight: 600 }}>
            {row.staffId} &bull; @{row.username}
          </div>
        </div>
      )
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
      header: 'Shift & Hours',
      render: (row) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div style={{ fontWeight: 600 }}>{row.shift}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.startTime} - {row.endTime} ({row.scheduledHours} hrs/day)
          </div>
        </div>
      )
    },
    {
      header: 'Working Days',
      render: (row) => (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {row.workingDays?.join(', ')}
        </div>
      )
    },
    {
      header: 'Attendance Status',
      render: (row) => <StatusBadge status={row.attendance || 'Present'} />
    },
    {
      header: 'Account Status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px' }}
            title="Edit Staff Member"
          >
            <Edit size={14} />
          </button>
          {row.status === 'Active' && (
            <button
              onClick={() => {
                setStaffToDelete(row);
                setDeleteConfirmOpen(true);
              }}
              className="btn btn-danger btn-sm"
              style={{ padding: '4px 8px' }}
              title="Deactivate Staff"
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
              Staff & Front Desk Personnel Management
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Manage front desk receptionists, nurses, and administrative staff accounts and shift rosters.
            </p>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-admin">
            <Plus size={16} /> Add Staff Member
          </button>
        </div>

        <DataTable
          columns={columns}
          data={staffList}
          searchPlaceholder="Search staff by name, username, phone..."
          loading={loading}
          emptyMessage="No staff members registered in VIORA system"
        />
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Register Front Desk Staff Member'}
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
              className="btn btn-admin btn-sm"
              onClick={handleSubmit}
            >
              {editingStaff ? 'Update Staff Member' : 'Create Staff Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormInput
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Priya Nair"
            required
          />

          <div className="form-grid-2">
            <FormInput
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. +91 97410 22334"
              required
            />
            <FormInput
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. priya@vioraclinic.com"
              required
            />
          </div>

          <div className="form-grid-2">
            <FormInput
              label="Username"
              name="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="e.g. staff1"
              disabled={!!editingStaff}
              required
            />
            <FormInput
              label={editingStaff ? "Reset Password (leave empty to keep current)" : "Password"}
              name="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
              required={!editingStaff}
            />
          </div>

          <div className="form-grid-3">
            <SelectInput
              label="Shift"
              name="shift"
              value={formData.shift}
              onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
              options={['Morning Shift', 'Evening Shift', 'General Day Shift', 'Night Duty']}
              required
            />
            <FormInput
              label="Start Time"
              name="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
            <FormInput
              label="End Time"
              name="endTime"
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '6px' }}>
              Working Days:
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
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
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

          <SelectInput
            label="Account Status"
            name="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={['Active', 'Inactive']}
            required
          />
        </form>
      </Modal>

      {/* CONFIRM DEACTIVATE */}
      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Deactivate Staff Account"
        message={`Are you sure you want to deactivate ${staffToDelete?.name}? They will not be able to log in to the front desk.`}
        confirmText="Deactivate"
        isDestructive
      />
    </div>
  );
};

export default StaffManagementPage;
