import React, { useState, useEffect } from 'react';
import { Plus, CreditCard, Printer, Eye, Trash2, IndianRupee, FileText, CheckCircle2, Stethoscope } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import InvoicePreview from '../../components/common/InvoicePreview';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import { LoadingState } from '../../components/common/LoadingState';

const StaffBillingPage = () => {
  const [bills, setBills] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [proceduresCatalog, setProceduresCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  
  // RX Print Modal State
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [selectedRXForPrint, setSelectedRXForPrint] = useState(null);
  
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    consultationType: 'Consultation',
    consultationFee: 800,
    procedures: [],
    discount: 0,
    tax: 0,
    paid: 0,
    paymentMethod: 'UPI'
  });

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [billsRes, patsRes, docsRes, procRes] = await Promise.all([
        api.getBills(),
        api.getPatients(),
        api.getDoctors(),
        api.getProcedures()
      ]);

      if (billsRes.success) setBills(billsRes.data);
      if (patsRes.success) setPatients(patsRes.data);
      if (docsRes.success) {
        setDoctors(docsRes.data);
        if (docsRes.data.length > 0 && !formData.doctorId) {
          const firstDoc = docsRes.data[0];
          setFormData((prev) => ({
            ...prev,
            doctorId: firstDoc.doctorId,
            consultationFee: firstDoc.consultationRates?.consultationFee || 800
          }));
        }
      }
      if (procRes.success) setProceduresCatalog(procRes.data.filter((p) => p.status === 'Active'));
    } catch (err) {
      showToast(err.message || 'Failed to load billing records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleDoctorChange = (doctorId) => {
    const doc = doctors.find((d) => d.doctorId === doctorId);
    setFormData((prev) => ({
      ...prev,
      doctorId,
      consultationFee: doc?.consultationRates?.consultationFee || 800
    }));
  };

  const handleAddProcedure = (procedureId) => {
    const proc = proceduresCatalog.find((p) => p.procedureId === procedureId);
    if (!proc) return;

    setFormData((prev) => ({
      ...prev,
      procedures: [
        ...prev.procedures,
        {
          procedureId: proc.procedureId,
          name: proc.name,
          price: proc.defaultPrice,
          qty: 1,
          doctorCut: proc.defaultDoctorCut
        }
      ]
    }));
  };

  const handleRemoveProcedure = (idx) => {
    setFormData((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((_, i) => i !== idx)
    }));
  };

  // Computations
  const fee = formData.consultationType === 'Consultation' ? Number(formData.consultationFee || 0) : 0;
  const procTotal = formData.procedures.reduce((acc, p) => acc + (p.price * (p.qty || 1)), 0);
  const subtotal = fee + procTotal;
  const grandTotal = Math.max(0, subtotal - Number(formData.discount || 0) + Number(formData.tax || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.patientId || !formData.doctorId) {
        showToast('Patient and Doctor must be selected', 'error');
        return;
      }

      const payload = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        consultationType: formData.consultationType,
        consultationFee: fee,
        procedures: formData.procedures,
        discount: Number(formData.discount),
        tax: Number(formData.tax),
        paid: Number(formData.paid || grandTotal),
        paymentMethod: formData.paymentMethod,
        paymentStatus: Number(formData.paid || grandTotal) >= grandTotal ? 'Paid' : 'Partially Paid'
      };

      const res = await api.createBill(payload);
      if (res.success) {
        showToast(`Invoice ${res.data.invoiceNumber} generated!`, 'success');
        setModalOpen(false);
        fetchBillingData();
        setSelectedInvoice(res.data);
        setInvoiceModalOpen(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create bill', 'error');
    }
  };

  const columns = [
    {
      header: 'Invoice #',
      render: (row) => (
        <span
          style={{
            fontWeight: 800,
            color: 'var(--role-staff-primary)',
            fontSize: '0.85rem'
          }}
        >
          {row.invoiceNumber}
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
      header: 'Attending Doctor',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.doctorName}</div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {row.doctorSpecialization}
          </span>
        </div>
      )
    },
    {
      header: 'Total Amount',
      render: (row) => (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 800 }}>₹{row.total?.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Paid: ₹{row.paid?.toLocaleString()} {row.balance > 0 ? `(Bal: ₹${row.balance})` : ''}
          </div>
        </div>
      )
    },
    {
      header: 'Payment Method',
      render: (row) => (
        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{row.paymentMethod}</span>
      )
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.paymentStatus} />
    },
    {
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSelectedInvoice(row);
              setInvoiceModalOpen(true);
            }}
            className="btn btn-staff btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Tax Invoice"
          >
            <Printer size={13} /> Bill
          </button>
          
          <button
            onClick={() => {
              const rxData = {
                prescriptionId: row.prescription?.prescriptionId || `RX-${row.patientId}`,
                patientName: row.patientName,
                patientId: row.patientId,
                patientAge: row.patientAge,
                patientGender: row.patientGender,
                patientPhone: row.patientPhone,
                patientDOB: row.patientDOB,
                doctorName: row.doctorName,
                doctorSpecialization: row.doctorSpecialization,
                doctorQualification: row.doctorQualification,
                doctorRegNo: row.doctorRegNo,
                consultationDate: row.appointmentDate || row.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                chiefComplaints: row.consultation?.chiefComplaint || (row.procedures && row.procedures.length > 0 ? `Procedures: ${row.procedures.map(p => p.name).join(', ')}` : (row.medicalHistory && row.medicalHistory !== 'None' ? `History: ${row.medicalHistory}` : '')),
                allergies: row.allergies,
                medicalHistory: row.medicalHistory,
                medicines: row.prescription?.medicines || [],
                procedures: (row.procedures || []).map(p => p.name),
                createdAt: row.createdAt
              };
              setSelectedRXForPrint({
                rx: rxData,
                consultation: row.consultation || {
                  patientName: row.patientName,
                  patientId: row.patientId,
                  patientAge: row.patientAge,
                  patientGender: row.patientGender,
                  patientPhone: row.patientPhone,
                  doctorName: row.doctorName,
                  doctorSpecialization: row.doctorSpecialization,
                  doctorQualification: row.doctorQualification,
                  doctorRegNo: row.doctorRegNo,
                  procedureDetails: (row.procedures || []).map(p => p.name).join(', ')
                }
              });
              setRxModalOpen(true);
            }}
            className="btn btn-doctor btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Prescription (RX)"
          >
            <Stethoscope size={13} /> RX
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
              Front Desk Billing & Patient Invoicing
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Create bills for consultations and procedures, collect payments, and print tax invoices.
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn btn-staff">
            <Plus size={16} /> Create New Bill
          </button>
        </div>

        <DataTable
          columns={columns}
          data={bills}
          searchPlaceholder="Search invoices by number, patient name, doctor..."
          loading={loading}
          emptyMessage="No billing records found"
        />
      </div>

      {/* CREATE BILL MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Patient Bill & Tax Invoice"
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
              className="btn btn-staff btn-sm"
              onClick={handleSubmit}
            >
              Generate Invoice & Print
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-grid-3">
            {/* Patient Select */}
            <div className="form-group">
              <label className="form-label">Select Patient *</label>
              <select
                className="form-select"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                required
              >
                <option value="">-- Choose Patient --</option>
                {patients.map((p) => (
                  <option key={p.patientId} value={p.patientId}>
                    {p.name} ({p.patientId})
                  </option>
                ))}
              </select>
            </div>

            {/* Doctor Select */}
            <div className="form-group">
              <label className="form-label">Attending Doctor *</label>
              <select
                className="form-select"
                value={formData.doctorId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                required
              >
                {doctors.map((d) => (
                  <option key={d.doctorId} value={d.doctorId}>
                    {d.name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            {/* Consultation Type */}
            <div className="form-group">
              <label className="form-label">Consultation Type *</label>
              <select
                className="form-select"
                value={formData.consultationType}
                onChange={(e) => {
                  const newType = e.target.value;
                  const doc = doctors.find(d => d.doctorId === formData.doctorId);
                  setFormData({
                    ...formData,
                    consultationType: newType,
                    consultationFee: newType === 'Consultation' ? (doc?.consultationRates?.consultationFee || 800) : 0,
                    procedures: newType === 'Follow-up Visit (Zero Bill)' ? [] : formData.procedures,
                    discount: newType === 'Follow-up Visit (Zero Bill)' ? 0 : formData.discount,
                    tax: newType === 'Follow-up Visit (Zero Bill)' ? 0 : formData.tax,
                    paid: newType === 'Follow-up Visit (Zero Bill)' ? 0 : formData.paid
                  });
                }}
              >
                <option value="Consultation">Consultation (Physician Visit)</option>
                <option value="Follow-up Visit (Zero Bill)">Follow-up Visit (Zero Bill)</option>
                <option value="Procedure">Procedure (Procedure Only)</option>
              </select>
            </div>
          </div>

          {/* PROCEDURES SELECTOR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Clinical Procedures</span>
              <select
                className="form-select"
                style={{
                  width: 'auto',
                  padding: '6px 12px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: '2px solid #16A34A',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#F0FDF4',
                  color: '#15803D',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.15)'
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddProcedure(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="" style={{ fontWeight: 600, color: '#15803D' }}>+ Add Procedure...</option>
                {proceduresCatalog.map((p) => (
                  <option key={p.procedureId} value={p.procedureId} style={{ color: 'var(--text-main)' }}>
                    {p.name} (₹{p.defaultPrice})
                  </option>
                ))}
              </select>
            </div>

            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="v-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.consultationType === 'Consultation' && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Doctor Consultation Fee</td>
                      <td>1</td>
                      <td>₹{formData.consultationFee}</td>
                      <td style={{ fontWeight: 700 }}>₹{formData.consultationFee}</td>
                      <td>-</td>
                    </tr>
                  )}
                  {formData.consultationType === 'Follow-up Visit (Zero Bill)' && (
                    <tr style={{ backgroundColor: '#F0FDF4' }}>
                      <td style={{ fontWeight: 600, color: '#166534' }}>
                        Follow-up Visit (Zero Bill)
                      </td>
                      <td>1</td>
                      <td>₹0</td>
                      <td style={{ fontWeight: 700, color: '#166534' }}>₹0</td>
                      <td>-</td>
                    </tr>
                  )}
                  {formData.procedures.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.qty}</td>
                      <td>₹{p.price}</td>
                      <td style={{ fontWeight: 700 }}>₹{p.price * p.qty}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveProcedure(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--status-danger-text)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOTALS & PAYMENT DETAILS */}
          <div className="form-grid-3" style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <SelectInput
              label="Payment Method"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              options={['UPI', 'Cash', 'Card', 'Other']}
              required
            />
            <FormInput
              label="Discount (₹)"
              name="discount"
              type="number"
              value={formData.discount}
              onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
            />
            <FormInput
              label="Paid Amount (₹)"
              name="paid"
              type="number"
              value={formData.paid || grandTotal}
              onChange={(e) => setFormData({ ...formData, paid: e.target.value })}
              helperText={`Grand Total: ₹${grandTotal.toLocaleString()}`}
            />
          </div>
        </form>
      </Modal>

      {/* INVOICE PREVIEW MODAL */}
      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title="VIORA Tax Invoice"
        size="xl"
      >
        <InvoicePreview
          invoice={selectedInvoice}
          onClose={() => setInvoiceModalOpen(false)}
        />
      </Modal>

      {/* RX PREVIEW MODAL */}
      <Modal
        isOpen={rxModalOpen}
        onClose={() => {
          setRxModalOpen(false);
          setSelectedRXForPrint(null);
        }}
        title="Prescription Slip (RX Preview)"
        size="xl"
      >
        {selectedRXForPrint && (
          <RXPreviewModal
            prescription={selectedRXForPrint.rx}
            consultation={selectedRXForPrint.consultation}
            onClose={() => {
              setRxModalOpen(false);
              setSelectedRXForPrint(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default StaffBillingPage;
