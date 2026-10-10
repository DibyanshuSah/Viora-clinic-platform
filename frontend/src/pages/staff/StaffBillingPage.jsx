import React, { useState, useEffect, useRef } from 'react';
import { Plus, CreditCard, Printer, Eye, Trash2, IndianRupee, FileText, CheckCircle2, Stethoscope, Edit, AlertCircle, Search, X, Sparkles } from 'lucide-react';
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
  
  // Existing Bill being edited (ensures single invoice per patient)
  const [editingBill, setEditingBill] = useState(null);
  
  // RX Print Modal State
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [selectedRXForPrint, setSelectedRXForPrint] = useState(null);

  // Procedure Search & Manual Item States
  const [procedureSearchQuery, setProcedureSearchQuery] = useState('');
  const [showProcedureResults, setShowProcedureResults] = useState(false);
  const procedureSearchRef = useRef(null);

  const [manualItem, setManualItem] = useState({
    procedureId: '',
    name: '',
    qty: 1,
    rate: ''
  });
  
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

  // Editable patient details for updating existing patient without duplicates
  const [patientFormDetails, setPatientFormDetails] = useState({
    phone: '',
    email: '',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '',
    allergies: 'None',
    medicalHistory: 'None'
  });

  const handlePatientSelect = (patientId) => {
    // Check if patient already has an existing invoice
    const existing = bills.find((b) => b.patientId === patientId);
    if (existing) {
      // Switch to edit mode for this existing invoice - DO NOT create a new invoice
      setEditingBill(existing);
      setFormData({
        patientId: existing.patientId,
        doctorId: existing.doctorId,
        consultationType: existing.consultationType || 'Consultation',
        consultationFee: existing.consultationFee !== undefined ? existing.consultationFee : (existing.consultationType === 'Consultation' ? 800 : 0),
        procedures: existing.procedures ? existing.procedures.map(p => ({ ...p })) : [],
        discount: existing.discount || 0,
        tax: existing.tax || 0,
        paid: existing.paid || 0,
        paymentMethod: existing.paymentMethod || 'UPI'
      });
      setPatientFormDetails({
        phone: existing.patientPhone || '',
        email: existing.patientEmail || '',
        address: existing.patientAddress || '',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '',
        allergies: existing.allergies || 'None',
        medicalHistory: existing.medicalHistory || 'None'
      });
      showToast(`Patient has existing invoice ${existing.invoiceNumber}. Switched to Edit Mode.`, 'info');
    } else {
      setEditingBill(null);
      setFormData((prev) => ({
        ...prev,
        patientId,
        procedures: []
      }));
      const pat = patients.find((p) => p.patientId === patientId);
      if (pat) {
        setPatientFormDetails({
          phone: pat.phone || '',
          email: pat.email || '',
          address: pat.address || '',
          city: pat.city || 'Bengaluru',
          state: pat.state || 'Karnataka',
          pinCode: pat.pinCode || '',
          allergies: pat.allergies || 'None',
          medicalHistory: pat.medicalHistory || 'None'
        });
      }
    }
  };

  // Click-outside listener for procedure search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (procedureSearchRef.current && !procedureSearchRef.current.contains(event.target)) {
        setShowProcedureResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenEdit = async (bill) => {
    setEditingBill(bill);
    setFormData({
      patientId: bill.patientId,
      doctorId: bill.doctorId,
      consultationType: bill.consultationType || 'Consultation',
      consultationFee: bill.consultationFee !== undefined ? bill.consultationFee : (bill.consultationType === 'Consultation' ? 800 : 0),
      procedures: bill.procedures ? bill.procedures.map(p => ({
        procedureId: p.procedureId || 'CUSTOM',
        name: p.name || 'Procedure',
        price: Number(p.price !== undefined ? p.price : (p.rate || 0)),
        qty: Math.max(1, Number(p.qty || 1)),
        doctorCut: Number(p.doctorCut || 0)
      })) : [],
      discount: bill.discount || 0,
      tax: bill.tax || 0,
      paid: bill.paid || 0,
      paymentMethod: bill.paymentMethod || 'UPI'
    });
    setPatientFormDetails({
      phone: bill.patientPhone || '',
      email: bill.patientEmail || '',
      address: bill.patientAddress || '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '',
      allergies: bill.allergies || 'None',
      medicalHistory: bill.medicalHistory || 'None'
    });
    setManualItem({ procedureId: '', name: '', qty: 1, rate: '' });
    setProcedureSearchQuery('');
    setShowProcedureResults(false);

    // Refresh procedure catalog from DB so any recently added procedure is immediately available
    try {
      const procRes = await api.getProcedures();
      if (procRes.success) {
        setProceduresCatalog(procRes.data.filter((p) => p.status === 'Active'));
      }
    } catch (err) {
      console.warn('Could not refresh procedures catalog:', err.message);
    }

    setModalOpen(true);
  };

  const handleOpenCreateOrEdit = async () => {
    setEditingBill(null);
    setFormData({
      patientId: '',
      doctorId: doctors[0]?.doctorId || '',
      consultationType: 'Consultation',
      consultationFee: doctors[0]?.consultationRates?.consultationFee || 800,
      procedures: [],
      discount: 0,
      tax: 0,
      paid: 0,
      paymentMethod: 'UPI'
    });
    setPatientFormDetails({
      phone: '',
      email: '',
      address: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '',
      allergies: 'None',
      medicalHistory: 'None'
    });
    setManualItem({ procedureId: '', name: '', qty: 1, rate: '' });
    setProcedureSearchQuery('');
    setShowProcedureResults(false);

    try {
      const procRes = await api.getProcedures();
      if (procRes.success) {
        setProceduresCatalog(procRes.data.filter((p) => p.status === 'Active'));
      }
    } catch (err) {
      console.warn('Could not refresh procedures catalog:', err.message);
    }

    setModalOpen(true);
  };

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

  const filteredProcedures = proceduresCatalog.filter((p) => {
    if (!procedureSearchQuery) return true;
    const q = procedureSearchQuery.toLowerCase().trim();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.procedureId && p.procedureId.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const handleSelectProcedureFromSearch = (proc) => {
    setManualItem({
      procedureId: proc.procedureId,
      name: proc.name,
      qty: 1,
      rate: proc.defaultPrice
    });
    setProcedureSearchQuery(proc.name);
    setShowProcedureResults(false);
  };

  const handleQuickAddFromSearch = (proc) => {
    setFormData((prev) => ({
      ...prev,
      procedures: [
        ...prev.procedures,
        {
          procedureId: proc.procedureId,
          name: proc.name,
          price: Number(proc.defaultPrice || 0),
          qty: 1,
          doctorCut: Number(proc.defaultDoctorCut || 0)
        }
      ]
    }));
    setProcedureSearchQuery('');
    setShowProcedureResults(false);
    showToast(`Added ${proc.name} (₹${proc.defaultPrice}) to invoice`, 'success');
  };

  const handleManualAddItem = async () => {
    const itemName = manualItem.name.trim();
    if (!itemName) {
      showToast('Item description / procedure name is required', 'error');
      return;
    }
    const rate = parseFloat(manualItem.rate);
    if (isNaN(rate) || rate < 0) {
      showToast('Please enter a valid rate (₹)', 'error');
      return;
    }
    const qty = Math.max(1, parseInt(manualItem.qty, 10) || 1);

    // Check if this procedure already exists in the catalog (by ID or name)
    let matchedProc = proceduresCatalog.find(
      (p) =>
        (manualItem.procedureId && p.procedureId === manualItem.procedureId) ||
        (p.name && p.name.trim().toLowerCase() === itemName.toLowerCase())
    );

    let procedureId = matchedProc ? matchedProc.procedureId : null;
    let doctorCut = matchedProc ? matchedProc.defaultDoctorCut : Math.round(rate * 0.3);

    // If NOT in DB catalog, save it to the DB so it is permanently stored for all future patients!
    if (!matchedProc) {
      try {
        const createRes = await api.createProcedure({
          name: itemName,
          defaultPrice: rate,
          defaultDoctorCut: doctorCut,
          description: 'Added via Staff Billing'
        });
        if (createRes.success && createRes.data) {
          matchedProc = createRes.data;
          procedureId = createRes.data.procedureId;
          // Add to local catalog immediately so it is available for all future searches
          setProceduresCatalog((prev) => [createRes.data, ...prev]);
          showToast(`Saved "${itemName}" to DB procedure catalog`, 'info');
        }
      } catch (err) {
        console.warn('Procedure API auto-creation note:', err.message);
      }
    }

    setFormData((prev) => ({
      ...prev,
      procedures: [
        ...prev.procedures,
        {
          procedureId: procedureId || 'CUSTOM',
          name: itemName,
          price: rate,
          qty,
          doctorCut
        }
      ]
    }));

    setManualItem({ procedureId: '', name: '', qty: 1, rate: '' });
    setProcedureSearchQuery('');
    showToast(`Added ${itemName} (Qty: ${qty}, Rate: ₹${rate}) to invoice`, 'success');
  };

  const handleUpdateProcedureItem = (idx, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.procedures];
      if (!updated[idx]) return prev;
      const current = { ...updated[idx] };
      if (field === 'qty') {
        current.qty = Math.max(1, parseInt(value, 10) || 1);
      } else if (field === 'price') {
        current.price = Math.max(0, parseFloat(value) || 0);
      } else if (field === 'name') {
        current.name = value;
      }
      updated[idx] = current;
      return { ...prev, procedures: updated };
    });
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
        patientUpdates: patientFormDetails,
        doctorId: formData.doctorId,
        consultationType: formData.consultationType,
        consultationFee: fee,
        procedures: formData.procedures,
        discount: Number(formData.discount),
        tax: Number(formData.tax),
        paid: Number(formData.paid !== undefined ? formData.paid : grandTotal),
        paymentMethod: formData.paymentMethod,
        paymentStatus: Number(formData.paid !== undefined ? formData.paid : grandTotal) >= grandTotal ? 'Paid' : 'Partially Paid'
      };

      if (editingBill) {
        // Edit existing patient bill - do NOT create a new invoice!
        const res = await api.updateBill(editingBill.billId, payload);
        if (res.success) {
          showToast(`Invoice ${editingBill.invoiceNumber} updated successfully! (No new invoice created)`, 'success');
          setModalOpen(false);
          fetchBillingData();
          setSelectedInvoice(res.data);
          setInvoiceModalOpen(true);
        }
      } else {
        const res = await api.createBill(payload);
        if (res.success) {
          showToast(`Invoice ${res.data.invoiceNumber} generated!`, 'success');
          setModalOpen(false);
          fetchBillingData();
          setSelectedInvoice(res.data);
          setInvoiceModalOpen(true);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to save bill', 'error');
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
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
            title="Edit this Patient's Bill & Procedures"
          >
            <Edit size={13} /> Edit
          </button>

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
              Add and edit patient bills for consultations and procedures, collect payments, and print invoices. Existing patients maintain a single invoice.
            </p>
          </div>
          <button onClick={handleOpenCreateOrEdit} className="btn btn-staff">
            <Plus size={16} /> New / Edit Patient Bill
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

      {/* CREATE / EDIT BILL MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBill ? `Edit Patient Invoice — ${editingBill.invoiceNumber}` : 'Create Patient Bill & Tax Invoice'}
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
              {editingBill ? `Update Invoice (${editingBill.invoiceNumber})` : 'Generate Invoice & Print'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* EDIT NOTICE BANNER FOR EXISTING PATIENT INVOICE */}
          {editingBill && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#1E40AF',
                fontSize: '0.82rem'
              }}
            >
              <AlertCircle size={18} color="#2563EB" style={{ flexShrink: 0 }} />
              <div>
                <strong>Editing Existing Invoice ({editingBill.invoiceNumber})</strong>: This patient already has an active invoice. Duplicate invoices are not created for the same patient. Any changes to consultations, procedures, discounts, or payments will edit and update this invoice directly.
              </div>
            </div>
          )}

          <div className="form-grid-3">
            {/* Patient Select */}
            <div className="form-group">
              <label className="form-label">Select Patient *</label>
              <select
                className="form-select"
                value={formData.patientId}
                onChange={(e) => handlePatientSelect(e.target.value)}
                required
              >
                <option value="">-- Choose Patient --</option>
                {patients.map((p) => {
                  const existing = bills.find((b) => b.patientId === p.patientId);
                  return (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name} ({p.patientId}) {existing ? `— [Invoice: ${existing.invoiceNumber} (Edit Only)]` : '— [No Invoice Yet]'}
                    </option>
                  );
                })}
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
                {doctors.length === 0 ? (
                  <option value="">No doctors registered yet (Add doctor in Admin &gt; Doctor Management)</option>
                ) : (
                  doctors.map((d) => (
                    <option key={d.doctorId} value={d.doctorId}>
                      {d.name} ({d.specialization})
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

          {/* EDITABLE PATIENT DETAILS ACCORDION/CARD */}
          {formData.patientId && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--role-staff-primary)', textTransform: 'uppercase' }}>
                  Patient Billing & Contact Details (Single Patient Record)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>
                  ✔ Updates save directly to this existing patient record (no duplicate patient)
                </span>
              </div>

              <div className="form-grid-3">
                <FormInput
                  label="Phone Number"
                  name="phone"
                  value={patientFormDetails.phone}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, phone: e.target.value })}
                />
                <FormInput
                  label="Email Address"
                  name="email"
                  value={patientFormDetails.email}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, email: e.target.value })}
                />
                <FormInput
                  label="Residential Address"
                  name="address"
                  value={patientFormDetails.address}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, address: e.target.value })}
                />
              </div>

              <div className="form-grid-3">
                <FormInput
                  label="City"
                  name="city"
                  value={patientFormDetails.city}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, city: e.target.value })}
                />
                <FormInput
                  label="Drug Allergies"
                  name="allergies"
                  value={patientFormDetails.allergies}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, allergies: e.target.value })}
                />
                <FormInput
                  label="Medical History"
                  name="medicalHistory"
                  value={patientFormDetails.medicalHistory}
                  onChange={(e) => setPatientFormDetails({ ...patientFormDetails, medicalHistory: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* BILLABLE PROCEDURES & ITEMS SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Billable Items & Procedures
                </span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Search procedure from catalog or enter Item, Qty, Rate manually. Newly added items are automatically saved to the DB catalog for all future patients.
                </p>
              </div>
            </div>

            {/* SEARCH BAR (REPLACES OLD DROPDOWN) */}
            <div ref={procedureSearchRef} style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  color="var(--role-staff-primary)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={procedureSearchQuery}
                  onChange={(e) => {
                    setProcedureSearchQuery(e.target.value);
                    setShowProcedureResults(true);
                  }}
                  onFocus={() => setShowProcedureResults(true)}
                  placeholder="Search procedure from catalog (e.g. Scaling, X-Ray, Root Canal, Extraction)..."
                  style={{
                    paddingLeft: '34px',
                    paddingRight: procedureSearchQuery ? '28px' : '10px',
                    fontSize: '0.82rem',
                    borderColor: showProcedureResults ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
                    boxShadow: showProcedureResults ? '0 0 0 2px rgba(22, 163, 74, 0.15)' : 'none'
                  }}
                />
                {procedureSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProcedureSearchQuery('');
                      setShowProcedureResults(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* SEARCH RESULTS OVERLAY */}
              {showProcedureResults && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: '250px',
                    overflowY: 'auto'
                  }}
                >
                  {filteredProcedures.length > 0 ? (
                    filteredProcedures.map((p) => {
                      const isAdded = formData.procedures.some(
                        (bp) => bp.procedureId === p.procedureId || bp.name?.toLowerCase() === p.name?.toLowerCase()
                      );
                      return (
                        <div
                          key={p.procedureId}
                          onClick={() => handleSelectProcedureFromSearch(p)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: '#FFFFFF',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Code: {p.procedureId} {p.description ? `• ${p.description}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--role-staff-primary)' }}>
                              ₹{p.defaultPrice}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAddFromSearch(p);
                              }}
                              className="btn btn-sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                backgroundColor: isAdded ? '#DCFCE7' : '#F0FDF4',
                                color: '#166534',
                                border: '1px solid #BBF7D0',
                                fontWeight: 700,
                                borderRadius: '4px'
                              }}
                            >
                              {isAdded ? 'Added (+)' : '+ Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No procedures matching "{procedureSearchQuery}". Enter Item, Qty, Rate below to add and save to catalog!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* MANUAL ITEM, QTY, RATE ENTRY BAR */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 120px 110px',
                gap: '8px',
                alignItems: 'end',
                padding: '10px 12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Item / Procedure Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={manualItem.name}
                  onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                  placeholder="e.g. Scaling, X-Ray, Root Canal, Dressing..."
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualAddItem();
                    }
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={manualItem.qty}
                  onChange={(e) => setManualItem({ ...manualItem, qty: e.target.value })}
                  style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'center' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualAddItem();
                    }
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={manualItem.rate}
                  onChange={(e) => setManualItem({ ...manualItem, rate: e.target.value })}
                  placeholder="0"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualAddItem();
                    }
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleManualAddItem}
                className="btn btn-staff"
                style={{ height: '35px', padding: '0 10px', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                title="Add item to invoice and save to DB catalog if new"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* TABLE OF LINE ITEMS WITH INLINE EDITABLE ITEM, QTY, RATE */}
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="v-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '130px' }}>Rate (₹)</th>
                    <th style={{ width: '120px' }}>Amount (₹)</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.consultationType === 'Consultation' && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Doctor Consultation Fee</td>
                      <td style={{ textAlign: 'center' }}>1</td>
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
                      <td style={{ textAlign: 'center' }}>1</td>
                      <td>₹0</td>
                      <td style={{ fontWeight: 700, color: '#166534' }}>₹0</td>
                      <td>-</td>
                    </tr>
                  )}
                  {formData.procedures.map((p, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={p.name}
                          onChange={(e) => handleUpdateProcedureItem(idx, 'name', e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '4px 8px', fontWeight: 600 }}
                        />
                        {p.procedureId && p.procedureId !== 'CUSTOM' && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Code: {p.procedureId}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={p.qty}
                          onChange={(e) => handleUpdateProcedureItem(idx, 'qty', e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '4px 6px', textAlign: 'center', width: '100%' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>₹</span>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={p.price}
                            onChange={(e) => handleUpdateProcedureItem(idx, 'price', e.target.value)}
                            style={{ fontSize: '0.82rem', padding: '4px 6px', width: '100%' }}
                          />
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--role-staff-primary)' }}>
                        ₹{(Number(p.price || 0) * Number(p.qty || 1)).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveProcedure(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--status-danger-text)', cursor: 'pointer', padding: '4px' }}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {formData.procedures.length === 0 && formData.consultationType === 'Procedure' && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No procedures added yet. Use the search bar above or enter Item, Qty, Rate manually.
                      </td>
                    </tr>
                  )}
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
