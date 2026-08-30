import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ListFilter, Activity, DollarSign } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import { LoadingState } from '../../components/common/LoadingState';

const ListManagementPage = () => {
  const [procedures, setProcedures] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState(null);
  const { showToast } = useToast();

  const initialFormState = {
    name: '',
    defaultPrice: 300,
    defaultDoctorCut: 100,
    description: '',
    status: 'Active'
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [procRes, docRes] = await Promise.all([
        api.getProcedures(),
        api.getDoctors()
      ]);
      if (procRes.success) setProcedures(procRes.data);
      if (docRes.success) setDoctors(docRes.data);
    } catch (err) {
      showToast(err.message || 'Failed to load list catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleOpenAdd = () => {
    setEditingProcedure(null);
    setFormData(initialFormState);
    setModalOpen(true);
  };

  const handleOpenEdit = (proc) => {
    setEditingProcedure(proc);
    setFormData({
      name: proc.name || '',
      defaultPrice: proc.defaultPrice || 0,
      defaultDoctorCut: proc.defaultDoctorCut || 0,
      description: proc.description || '',
      status: proc.status || 'Active'
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || formData.defaultPrice === undefined) {
        showToast('Procedure name and price are required', 'error');
        return;
      }

      const payload = {
        name: formData.name,
        defaultPrice: Number(formData.defaultPrice),
        defaultDoctorCut: Number(formData.defaultDoctorCut),
        description: formData.description,
        status: formData.status
      };

      if (editingProcedure) {
        await api.updateProcedure(editingProcedure.procedureId, payload);
        showToast(`Procedure "${formData.name}" updated`, 'success');
      } else {
        await api.createProcedure(payload);
        showToast(`Procedure "${formData.name}" added to VIORA catalog`, 'success');
      }

      setModalOpen(false);
      fetchCatalog();
    } catch (err) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!procedureToDelete) return;
    try {
      await api.deleteProcedure(procedureToDelete.procedureId);
      showToast(`Procedure "${procedureToDelete.name}" deactivated`, 'info');
      setDeleteConfirmOpen(false);
      fetchCatalog();
    } catch (err) {
      showToast(err.message || 'Failed to deactivate procedure', 'error');
    }
  };

  const columns = [
    {
      header: 'Procedure Code',
      accessor: 'procedureId',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--role-admin-primary)' }}>
          {row.procedureId}
        </span>
      )
    },
    {
      header: 'Procedure Name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.description || 'Standard clinic clinical procedure'}
          </div>
        </div>
      )
    },
    {
      header: 'Default Price',
      accessor: 'defaultPrice',
      render: (row) => (
        <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
          ₹{row.defaultPrice?.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Default Doctor Cut',
      render: (row) => (
        <div style={{ fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--role-admin-primary)' }}>
            ₹{row.defaultDoctorCut || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Clinic: ₹{(row.defaultPrice - (row.defaultDoctorCut || 0)).toLocaleString()}
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
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px' }}
            title="Edit Procedure"
          >
            <Edit size={14} />
          </button>
          {row.status === 'Active' && (
            <button
              onClick={() => {
                setProcedureToDelete(row);
                setDeleteConfirmOpen(true);
              }}
              className="btn btn-danger btn-sm"
              style={{ padding: '4px 8px' }}
              title="Deactivate Procedure"
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
              Clinical Procedures & Master Lists
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Maintain catalog of clinical procedures, standard prices, and physician payout splits.
            </p>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-admin">
            <Plus size={16} /> Add Procedure
          </button>
        </div>

        <DataTable
          columns={columns}
          data={procedures}
          searchPlaceholder="Search procedures by name or code..."
          loading={loading}
          emptyMessage="No clinical procedures configured in VIORA"
        />
      </div>

      {/* ADD / EDIT PROCEDURE MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProcedure ? `Edit Procedure: ${editingProcedure.name}` : 'Add New Clinical Procedure'}
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
              {editingProcedure ? 'Update Procedure' : 'Save to Catalog'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormInput
            label="Procedure Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 12-Lead Electrocardiogram (ECG)"
            required
          />

          <div className="form-grid-2">
            <FormInput
              label="Default Patient Price (₹)"
              name="defaultPrice"
              type="number"
              value={formData.defaultPrice}
              onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })}
              required
            />
            <FormInput
              label="Default Doctor Cut (₹)"
              name="defaultDoctorCut"
              type="number"
              value={formData.defaultDoctorCut}
              onChange={(e) => setFormData({ ...formData, defaultDoctorCut: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Clinical Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Clinical details, sterile supplies required, protocol..."
            />
          </div>

          <SelectInput
            label="Status"
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
        title="Deactivate Procedure"
        message={`Are you sure you want to deactivate "${procedureToDelete?.name}"? It will no longer appear in Front Desk billing.`}
        confirmText="Deactivate"
        isDestructive
      />
    </div>
  );
};

export default ListManagementPage;
