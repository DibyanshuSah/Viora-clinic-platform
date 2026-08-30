import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Stethoscope, Clock, PlusCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import { LoadingState } from '../../components/common/LoadingState';

const DoctorPatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await api.getPatients();
      if (res.success) {
        setPatients(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load clinical patients', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const columns = [
    {
      header: 'Patient Identifier',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
            {row.name}
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--role-doctor-primary)',
              backgroundColor: 'var(--role-doctor-bg)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {row.patientId}
          </span>
        </div>
      )
    },
    {
      header: 'Demographics',
      render: (row) => (
        <span style={{ fontSize: '0.85rem' }}>
          {row.age} yrs &bull; {row.gender}
        </span>
      )
    },
    {
      header: 'Contact',
      render: (row) => (
        <div style={{ fontSize: '0.8rem' }}>
          <div>{row.phone}</div>
          <div style={{ color: 'var(--text-muted)' }}>{row.city || 'Bengaluru'}</div>
        </div>
      )
    },
    {
      header: 'Allergies & Medical History',
      render: (row) => (
        <div style={{ maxWidth: '280px', fontSize: '0.8rem' }}>
          <div style={{ color: row.allergies !== 'None' ? 'var(--status-danger-text)' : 'var(--text-secondary)', fontWeight: 600 }}>
            Allergies: {row.allergies || 'None'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
            History: {row.medicalHistory || 'None'}
          </div>
        </div>
      )
    },
    {
      header: 'Emergency Contact',
      render: (row) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {row.emergencyContact || 'N/A'}
        </span>
      )
    },
    {
      header: 'Clinical Action',
      render: (row) => (
        <button
          onClick={() => navigate(`/doctor/consultation/new?patientId=${row.patientId}`)}
          className="btn btn-doctor btn-sm"
          title="Open consultation workspace"
        >
          <Stethoscope size={14} /> Consult
        </button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Assigned Patients & Medical Records
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Access patient background, chronic conditions, and previous clinical consultations.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={patients}
          searchPlaceholder="Search patients by name, ID, phone..."
          loading={loading}
          emptyMessage="No patient records found in VIORA database"
        />
      </div>
    </div>
  );
};

export default DoctorPatientsPage;
