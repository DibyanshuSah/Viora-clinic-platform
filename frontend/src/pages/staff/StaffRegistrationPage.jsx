import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Users,
  Calendar,
  CreditCard,
  CheckCircle2,
  Printer,
  FileText,
  Clock,
  Plus,
  Trash2,
  Stethoscope,
  IndianRupee,
  ShieldCheck,
  AlertCircle,
  Search,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import Modal from '../../components/common/Modal';
import InvoicePreview from '../../components/common/InvoicePreview';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import { LoadingState } from '../../components/common/LoadingState';

const StaffRegistrationPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [proceduresCatalog, setProceduresCatalog] = useState([]);
  const [existingPatients, setExistingPatients] = useState([]);
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState('');
  const [nextPatientId, setNextPatientId] = useState('');
  const [draftInvoiceModalOpen, setDraftInvoiceModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Active step in connected transaction
  const [currentStep, setCurrentStep] = useState(1); // 1: Patient Details, 2: Appointment, 3: Billing & Review

  // Generated results after transaction
  const [transactionResult, setTransactionResult] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [printTab, setPrintTab] = useState('bill'); // 'bill' (a) or 'rx' (b)

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Patient State
  const [patientData, setPatientData] = useState({
    patientId: '',
    name: '',
    dateOfBirth: '',
    age: '',
    gender: 'Female',
    phone: '',
    email: '',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '',
    allergies: 'None',
    medicalHistory: 'None',
    emergencyContact: ''
  });

  // 2. Appointment State
  const [appointmentData, setAppointmentData] = useState({
    doctorId: '',
    appointmentType: 'Consultation', // ONLY 'Consultation' or 'Procedure'
    procedureId: '',
    procedureName: '',
    date: todayStr,
    time: '10:00'
  });

  // Available slots for selected doctor
  const [availableSlots, setAvailableSlots] = useState([]);

  // 3. Billing State
  const [billingProcedures, setBillingProcedures] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI');

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
      const [allDocsRes, schedRes, procRes, patRes, nextIdRes] = await Promise.all([
        api.getDoctors().catch(() => ({ success: false, data: [] })),
        api.getDoctorSchedules(todayStr).catch(() => ({ success: false, data: [] })),
        api.getProcedures(),
        api.getPatients(),
        api.getNextPatientId()
      ]);

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
        const firstDoc = combinedDoctors[0];
        setAppointmentData((prev) => ({
          ...prev,
          doctorId: prev.doctorId || firstDoc.doctorId,
          time: prev.time || firstDoc.slots?.find((s) => s.available)?.time || '10:00'
        }));
        setAvailableSlots(firstDoc.slots || defaultSlots);
      }

      if (procRes.success) {
        setProceduresCatalog(procRes.data.filter((p) => p.status === 'Active'));
      }

      if (patRes.success) {
        setExistingPatients(patRes.data || []);
      }

      if (nextIdRes.success && nextIdRes.data?.nextPatientId) {
        setNextPatientId(nextIdRes.data.nextPatientId);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load clinic roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update available slots when doctor or date changes
  const handleDoctorChange = async (doctorId) => {
    const selectedDoc = doctors.find((d) => d.doctorId === doctorId);
    setAppointmentData((prev) => ({
      ...prev,
      doctorId,
      time: selectedDoc?.slots?.find((s) => s.available)?.time || '10:00'
    }));

    if (selectedDoc) {
      setAvailableSlots(selectedDoc.slots || []);
    }
  };

  // DOB to Age Auto calculation
  const handleDOBChange = (e) => {
    const dob = e.target.value;
    let calculatedAge = patientData.age;
    if (dob) {
      const birthDate = new Date(dob);
      const diff = Date.now() - birthDate.getTime();
      const ageDate = new Date(diff);
      calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    setPatientData({ ...patientData, dateOfBirth: dob, age: calculatedAge });
  };

  // Billing Calculations
  const selectedDoctorObj = doctors.find((d) => d.doctorId === appointmentData.doctorId);
  const consultationFee = appointmentData.appointmentType === 'Consultation' ? (selectedDoctorObj?.consultationFee || 0) : 0;
  const proceduresSubtotal = billingProcedures.reduce((acc, p) => acc + (p.price * (p.qty || 1)), 0);
  const subtotal = consultationFee + proceduresSubtotal;
  const grandTotal = Math.max(0, subtotal - Number(discount) + Number(tax));

  // Add Procedure to Bill
  const handleAddProcedureToBill = (procedureId) => {
    const proc = proceduresCatalog.find((p) => p.procedureId === procedureId);
    if (!proc) return;

    setBillingProcedures((prev) => [
      ...prev,
      {
        procedureId: proc.procedureId,
        name: proc.name,
        price: proc.defaultPrice,
        qty: 1,
        doctorCut: proc.defaultDoctorCut
      }
    ]);
  };

  const handleRemoveProcedureFromBill = (idx) => {
    setBillingProcedures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateProcedureItem = (idx, field, value) => {
    setBillingProcedures((prev) => {
      const updated = [...prev];
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
      return updated;
    });
  };

  // Step 3 Procedure Search Box & Manual Item Entry State
  const [procedureSearchQuery, setProcedureSearchQuery] = useState('');
  const [showProcedureSearchResults, setShowProcedureSearchResults] = useState(false);
  const procedureSearchContainerRef = useRef(null);

  const [manualItem, setManualItem] = useState({
    name: '',
    qty: 1,
    rate: ''
  });

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

    let matchedProc = proceduresCatalog.find(
      (p) => p.name && p.name.trim().toLowerCase() === itemName.toLowerCase()
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
          description: 'Added via Patient Registration'
        });
        if (createRes.success && createRes.data) {
          matchedProc = createRes.data;
          procedureId = createRes.data.procedureId;
          setProceduresCatalog((prev) => [createRes.data, ...prev]);
          showToast(`Saved "${itemName}" to DB procedure catalog`, 'info');
        }
      } catch (err) {
        console.warn('Procedure API auto-creation note:', err.message);
      }
    }

    setBillingProcedures((prev) => [
      ...prev,
      {
        procedureId: procedureId || 'CUSTOM',
        name: itemName,
        price: rate,
        qty,
        doctorCut
      }
    ]);

    setManualItem({ name: '', qty: 1, rate: '' });
    setProcedureSearchQuery('');
    showToast(`Added ${itemName} (Qty: ${qty}, Rate: ₹${rate}) to invoice`, 'success');
  };

  // Step 2 Procedure Search Box State & Filtering (if appointmentType === 'Procedure')
  const [step2ProcedureSearchQuery, setStep2ProcedureSearchQuery] = useState('');
  const [showStep2ProcedureResults, setShowStep2ProcedureResults] = useState(false);
  const step2SearchRef = useRef(null);

  // Filter procedures for Step 3 search box
  const filteredProcedures = proceduresCatalog.filter((p) => {
    if (!procedureSearchQuery.trim()) return true;
    const q = procedureSearchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.procedureId?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  });

  // Filter procedures for Step 2 search box
  const filteredStep2Procedures = proceduresCatalog.filter((p) => {
    if (!step2ProcedureSearchQuery.trim()) return true;
    const q = step2ProcedureSearchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.procedureId?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  });

  // Handle click outside to close search result dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        procedureSearchContainerRef.current &&
        !procedureSearchContainerRef.current.contains(event.target)
      ) {
        setShowProcedureSearchResults(false);
      }
      if (
        step2SearchRef.current &&
        !step2SearchRef.current.contains(event.target)
      ) {
        setShowStep2ProcedureResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Resolved Patient ID (Pre-allocated or Existing)
  const assignedPatientId = isExistingPatient
    ? (patientData.patientId || selectedExistingPatientId || 'PAT-EXISTING')
    : (nextPatientId || 'PAT-NEW');

  // Match existing patient by entered phone number
  const matchedExistingPatient = patientData.phone && patientData.phone.length >= 8
    ? existingPatients.find((p) => p.phone && p.phone.trim() === patientData.phone.trim())
    : null;

  const handleSelectExistingPatient = (patientId) => {
    setSelectedExistingPatientId(patientId);
    if (!patientId) {
      setIsExistingPatient(false);
      setPatientData({
        patientId: '',
        name: '',
        dateOfBirth: '',
        age: '',
        gender: 'Female',
        phone: '',
        email: '',
        address: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '',
        allergies: 'None',
        medicalHistory: 'None',
        emergencyContact: ''
      });
      return;
    }

    const pat = existingPatients.find((p) => p.patientId === patientId);
    if (pat) {
      setIsExistingPatient(true);
      setPatientData({
        patientId: pat.patientId,
        name: pat.name || '',
        dateOfBirth: pat.dateOfBirth || '',
        age: pat.age || '',
        gender: pat.gender || 'Female',
        phone: pat.phone || '',
        email: pat.email || '',
        address: pat.address || '',
        city: pat.city || 'Bengaluru',
        state: pat.state || 'Karnataka',
        pinCode: pat.pinCode || '',
        allergies: pat.allergies || 'None',
        medicalHistory: pat.medicalHistory || 'None',
        emergencyContact: pat.emergencyContact || ''
      });
      showToast(`Selected existing record: ${pat.name} (${pat.patientId})`, 'info');
    }
  };

  // Draft Bill / Temporary Consultation & Procedure State under Patient ID
  const draftInvoice = {
    invoiceNumber: `DRAFT-${assignedPatientId}`,
    patientId: assignedPatientId,
    patientName: patientData.name || 'Draft Patient Record',
    patientAge: patientData.age || 0,
    patientGender: patientData.gender || 'Other',
    patientPhone: patientData.phone || '',
    patientAddress: patientData.address ? `${patientData.address}, ${patientData.city}` : 'Clinic Walk-in',
    doctorName: selectedDoctorObj?.name || 'Attending Physician',
    doctorSpecialization: selectedDoctorObj?.specialization || 'Physician',
    doctorQualification: selectedDoctorObj?.qualification || '',
    doctorRegNo: selectedDoctorObj?.registrationNumber || '',
    consultationType: appointmentData.appointmentType,
    consultationFee,
    procedures: billingProcedures,
    subtotal,
    discount: Number(discount),
    tax: Number(tax),
    total: grandTotal,
    paid: Number(paidAmount || grandTotal),
    balance: Math.max(0, grandTotal - Number(paidAmount || grandTotal)),
    paymentMethod,
    paymentStatus: (Number(paidAmount) >= grandTotal || !paidAmount) ? 'Paid' : 'Partially Paid',
    createdAt: new Date().toISOString()
  };

  // COMPLETE CONNECTED WORKFLOW TRANSACTION: REGISTER AND BILL
  const handleRegisterAndBill = async () => {
    if (!patientData.name || !patientData.phone) {
      showToast('Patient Name and Phone are required', 'error');
      setCurrentStep(1);
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        patient: {
          ...patientData,
          patientId: isExistingPatient ? (patientData.patientId || selectedExistingPatientId) : undefined,
          age: Number(patientData.age) || 0
        },
        appointment: {
          doctorId: appointmentData.doctorId,
          appointmentType: appointmentData.appointmentType,
          procedureId: appointmentData.procedureId || undefined,
          procedureName: appointmentData.procedureName || undefined,
          date: appointmentData.date,
          time: appointmentData.time,
          status: 'Waiting'
        },
        bill: {
          doctorId: appointmentData.doctorId,
          consultationType: appointmentData.appointmentType,
          consultationFee,
          procedures: billingProcedures,
          discount: Number(discount),
          tax: Number(tax),
          paid: Number(paidAmount || grandTotal), // Default to paid if paidAmount set
          paymentMethod,
          paymentStatus: (Number(paidAmount) >= grandTotal || !paidAmount) ? 'Paid' : 'Partially Paid'
        }
      };

      const res = await api.connectedRegisterAndBill(payload);
      if (res.success) {
        showToast(
          isExistingPatient
            ? `Existing patient ${res.data.patient.name} updated & new bill generated!`
            : `Patient ${res.data.patient.name} registered & bill generated!`,
          'success'
        );
        setTransactionResult(res.data);
        setInvoiceModalOpen(true);
      }
    } catch (err) {
      showToast(err.message || 'Connected transaction failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Initializing Front Desk Registration Desk..." />;
  }

  const rxObject = transactionResult ? {
    prescriptionId: `RX-${transactionResult.patient?.patientId || 'REG'}`,
    appointmentId: transactionResult.appointment?.appointmentId,
    patientName: transactionResult.patient?.name || patientData.name,
    patientId: transactionResult.patient?.patientId || 'PAT-NEW',
    patientAge: transactionResult.patient?.age || patientData.age,
    patientGender: transactionResult.patient?.gender || patientData.gender,
    patientPhone: transactionResult.patient?.phone || patientData.phone,
    patientDOB: transactionResult.patient?.dateOfBirth || patientData.dateOfBirth,
    doctorName: selectedDoctorObj?.name || transactionResult.bill?.doctorName || 'Attending Physician',
    doctorSpecialization: selectedDoctorObj?.specialization || transactionResult.bill?.doctorSpecialization || '',
    doctorQualification: selectedDoctorObj?.qualification || transactionResult.bill?.doctorQualification || '',
    doctorRegNo: selectedDoctorObj?.registrationNumber || transactionResult.bill?.doctorRegNo || '',
    consultationDate: appointmentData.date || todayStr,
    chiefComplaints: appointmentData.appointmentType === 'Procedure' && appointmentData.procedureName
      ? `Procedure: ${appointmentData.procedureName}`
      : (patientData.medicalHistory && patientData.medicalHistory !== 'None' ? `History: ${patientData.medicalHistory}` : ''),
    allergies: patientData.allergies,
    medicalHistory: patientData.medicalHistory,
    medicines: [],
    procedures: billingProcedures.map((p) => p.name),
    createdAt: new Date().toISOString()
  } : null;

  return (
    <div>
      {/* BACKGROUND REGISTRATION WIZARD (HIDDEN IN PRINT) */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* RECENT TRANSACTION BANNER (REMAINS ACCESSIBLE TO PRINT RX OR BILL EVEN IF PREVIEW MODAL IS CLOSED) */}
        {transactionResult && (
          <div
            className="v-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              backgroundColor: '#F0FDF4',
              borderColor: '#BBF7D0',
              color: '#166534',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={24} color="#16A34A" />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532D' }}>
                  Transaction Completed for {transactionResult.patient?.name} ({transactionResult.patient?.patientId})
                </div>
                <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                  Queue: <strong>{transactionResult.appointment?.queueNumber}</strong> &bull; Invoice: <strong>{transactionResult.bill?.invoiceNumber}</strong> &bull; Doctor: <strong>{selectedDoctorObj?.name}</strong> (Reg No: {selectedDoctorObj?.registrationNumber || 'KMC-42910'})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setPrintTab('rx');
                  setInvoiceModalOpen(true);
                }}
                className="btn btn-doctor btn-sm"
              >
                <Printer size={15} /> Print RX
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintTab('bill');
                  setInvoiceModalOpen(true);
                }}
                className="btn btn-staff btn-sm"
              >
                <Printer size={15} /> Print Bill
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransactionResult(null);
                  setCurrentStep(1);
                  setPatientData({
                    name: '',
                    dateOfBirth: '',
                    age: '',
                    gender: 'Female',
                    phone: '',
                    email: '',
                    address: '',
                    city: 'Bengaluru',
                    state: 'Karnataka',
                    pinCode: '',
                    allergies: 'None',
                    medicalHistory: 'None',
                    emergencyContact: ''
                  });
                }}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={15} /> Register Another
              </button>
              <button
                type="button"
                onClick={() => navigate('/staff/appointments')}
                className="btn btn-secondary btn-sm"
              >
                View Appointments &rarr;
              </button>
            </div>
          </div>
        )}
        {/* WORKFLOW STEP INDICATOR */}
        <div
          className="v-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 1 ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}
          >
            1
          </div>
          <span style={{ fontWeight: currentStep === 1 ? 800 : 600, color: currentStep === 1 ? 'var(--text-main)' : 'var(--text-muted)' }}>
            Patient Demographics
          </span>
        </div>

        <div style={{ height: '2px', flex: 1, backgroundColor: 'var(--border-subtle)', margin: '0 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 2 ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}
          >
            2
          </div>
          <span style={{ fontWeight: currentStep === 2 ? 800 : 600, color: currentStep === 2 ? 'var(--text-main)' : 'var(--text-muted)' }}>
            Doctor & Appointment
          </span>
        </div>

        <div style={{ height: '2px', flex: 1, backgroundColor: 'var(--border-subtle)', margin: '0 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 3 ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}
          >
            3
          </div>
          <span style={{ fontWeight: currentStep === 3 ? 800 : 600, color: currentStep === 3 ? 'var(--text-main)' : 'var(--text-muted)' }}>
            Billing & Confirmation
          </span>
        </div>
      </div>

      {/* FORM CONTAINER */}
      <div className="v-card">
        {/* STEP 1: PATIENT DEMOGRAPHICS */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--role-staff-primary)', margin: 0 }}>
                  Step 1: Patient Personal & Contact Information
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  {isExistingPatient
                    ? 'Updating existing registered patient record and attaching new visit/bill.'
                    : 'Registering new patient. Target Patient ID allocated below.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--role-staff-bg)', padding: '6px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Target Patient ID:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--role-staff-primary)' }}>{assignedPatientId}</span>
              </div>
            </div>

            {/* REGISTER NEW VS EXISTING PATIENT SELECTOR */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-app)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsExistingPatient(false);
                    setSelectedExistingPatientId('');
                    setPatientData({
                      patientId: '',
                      name: '',
                      dateOfBirth: '',
                      age: '',
                      gender: 'Female',
                      phone: '',
                      email: '',
                      address: '',
                      city: 'Bengaluru',
                      state: 'Karnataka',
                      pinCode: '',
                      allergies: 'None',
                      medicalHistory: 'None',
                      emergencyContact: ''
                    });
                  }}
                  className={`btn btn-sm ${!isExistingPatient ? 'btn-staff' : 'btn-secondary'}`}
                >
                  <UserPlus size={14} /> Register New Patient
                </button>
                <button
                  type="button"
                  onClick={() => setIsExistingPatient(true)}
                  className={`btn btn-sm ${isExistingPatient ? 'btn-staff' : 'btn-secondary'}`}
                >
                  <Users size={14} /> Existing Patient (Add Visit & Bill)
                </button>
              </div>

              {isExistingPatient && (
                <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>
                  ✔ Single Patient Record Policy: No duplicates will be created
                </span>
              )}
            </div>

            {/* EXISTING PATIENT DROPDOWN */}
            {isExistingPatient && (
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label className="form-label" style={{ fontWeight: 700, color: '#166534', margin: 0 }}>
                  Select Existing Registered Patient *
                </label>
                <select
                  className="form-select"
                  value={selectedExistingPatientId}
                  onChange={(e) => handleSelectExistingPatient(e.target.value)}
                  style={{ borderColor: '#86EFAC' }}
                >
                  <option value="">-- Choose Registered Patient from Database --</option>
                  {existingPatients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.name} ({p.patientId}) - Phone: {p.phone}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#15803D' }}>
                  ℹ Loading an existing patient preserves their patient ID and history. You can edit any details below and they will update this single record.
                </span>
              </div>
            )}

            {/* PHONE MATCH SUGGESTION FOR NEW PATIENT */}
            {!isExistingPatient && matchedExistingPatient && (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: '#1E40AF' }}>
                  <strong>Existing Patient Found:</strong> {matchedExistingPatient.name} ({matchedExistingPatient.patientId}) is registered with phone {patientData.phone}.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: '#3B82F6', color: '#1D4ED8' }}
                  onClick={() => handleSelectExistingPatient(matchedExistingPatient.patientId)}
                >
                  Use Existing Record & Avoid Duplicate
                </button>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Personal Information
              </h4>
              <div className="form-grid-3">
                <FormInput
                  label="Full Name"
                  name="name"
                  value={patientData.name}
                  onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                  placeholder="e.g. Rajeshwari Kulkarni"
                  required
                />
                <SelectInput
                  label="Gender"
                  name="gender"
                  value={patientData.gender}
                  onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                  options={['Female', 'Male', 'Other']}
                  required
                />
                <FormInput
                  label="Phone Number"
                  name="phone"
                  value={patientData.phone}
                  onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                  placeholder="e.g. +91 98450 12345"
                  required
                />
              </div>

              <div className="form-grid-3">
                <FormInput
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                  value={patientData.dateOfBirth}
                  onChange={handleDOBChange}
                />
                <FormInput
                  label="Age (Years)"
                  name="age"
                  type="number"
                  value={patientData.age}
                  onChange={(e) => setPatientData({ ...patientData, age: e.target.value })}
                  placeholder="e.g. 48"
                  required
                />
                <FormInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={patientData.email}
                  onChange={(e) => setPatientData({ ...patientData, email: e.target.value })}
                  placeholder="patient@example.com"
                />
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Address & Emergency Contact
              </h4>
              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <input
                  className="form-input"
                  value={patientData.address}
                  onChange={(e) => setPatientData({ ...patientData, address: e.target.value })}
                  placeholder="Apartment, Street name, Locality..."
                />
              </div>

              <div className="form-grid-3">
                <FormInput
                  label="City"
                  name="city"
                  value={patientData.city}
                  onChange={(e) => setPatientData({ ...patientData, city: e.target.value })}
                />
                <FormInput
                  label="State"
                  name="state"
                  value={patientData.state}
                  onChange={(e) => setPatientData({ ...patientData, state: e.target.value })}
                />
                <FormInput
                  label="PIN Code"
                  name="pinCode"
                  value={patientData.pinCode}
                  onChange={(e) => setPatientData({ ...patientData, pinCode: e.target.value })}
                />
              </div>

              <div className="form-grid-3">
                <FormInput
                  label="Drug Allergies"
                  name="allergies"
                  value={patientData.allergies}
                  onChange={(e) => setPatientData({ ...patientData, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Sulfa"
                />
                <FormInput
                  label="Chronic Conditions / History"
                  name="medicalHistory"
                  value={patientData.medicalHistory}
                  onChange={(e) => setPatientData({ ...patientData, medicalHistory: e.target.value })}
                  placeholder="e.g. Hypertension, Diabetes"
                />
                <FormInput
                  label="Emergency Contact (Name & Phone)"
                  name="emergencyContact"
                  value={patientData.emergencyContact}
                  onChange={(e) => setPatientData({ ...patientData, emergencyContact: e.target.value })}
                  placeholder="e.g. Suresh (Husband) - +91 98450 99882"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (!patientData.name || !patientData.phone) {
                    showToast('Patient Name and Phone are required', 'error');
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="btn btn-staff"
              >
                Continue to Appointment Scheduling &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: APPOINTMENT SCHEDULING */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--role-staff-primary)', margin: 0 }}>
                Step 2: Doctor Selection & Appointment Details
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Select attending physician, consultation type, and appointment date.
              </p>
            </div>

            <div className="form-grid-3">
              {/* Doctor Select */}
              <div className="form-group">
                <label className="form-label">
                  Attending Doctor <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={appointmentData.doctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
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
                <label className="form-label">
                  Consultation Type <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={appointmentData.appointmentType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setAppointmentData({ ...appointmentData, appointmentType: newType });
                    if (newType === 'Follow-up Visit (Zero Bill)') {
                      setBillingProcedures([]);
                      setDiscount(0);
                      setTax(0);
                      setPaidAmount(0);
                    }
                  }}
                >
                  <option value="Consultation">Consultation (Physician Visit)</option>
                  <option value="Follow-up Visit (Zero Bill)">Follow-up Visit (Zero Bill)</option>
                  <option value="Procedure">Procedure (Clinical Procedure Only)</option>
                </select>
              </div>

              {/* Date */}
              <FormInput
                label="Appointment Date"
                name="date"
                type="date"
                value={appointmentData.date}
                onChange={(e) => setAppointmentData({ ...appointmentData, date: e.target.value })}
                required
              />
            </div>

            {/* PROCEDURE SEARCH IF PROCEDURE TYPE */}
            {appointmentData.appointmentType === 'Procedure' && (
              <div className="form-group" ref={step2SearchRef} style={{ position: 'relative' }}>
                <label className="form-label">
                  Search & Select Primary Procedure <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    color="var(--role-staff-primary)"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={step2ProcedureSearchQuery || appointmentData.procedureName || ''}
                    onChange={(e) => {
                      setStep2ProcedureSearchQuery(e.target.value);
                      setShowStep2ProcedureResults(true);
                    }}
                    onFocus={() => setShowStep2ProcedureResults(true)}
                    placeholder="Search procedure item (e.g. Dental Cleaning, X-Ray, Root Canal)..."
                    style={{
                      paddingLeft: '34px',
                      paddingRight: (step2ProcedureSearchQuery || appointmentData.procedureName) ? '28px' : '10px'
                    }}
                  />
                  {(step2ProcedureSearchQuery || appointmentData.procedureName) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep2ProcedureSearchQuery('');
                        setAppointmentData({
                          ...appointmentData,
                          procedureId: '',
                          procedureName: ''
                        });
                        setShowStep2ProcedureResults(false);
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

                {appointmentData.procedureName && (
                  <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                    ✔ Selected Procedure: {appointmentData.procedureName} ({appointmentData.procedureId})
                  </div>
                )}

                {showStep2ProcedureResults && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }}
                  >
                    {filteredStep2Procedures.length > 0 ? (
                      filteredStep2Procedures.map((p) => (
                        <div
                          key={p.procedureId}
                          onClick={() => {
                            setAppointmentData({
                              ...appointmentData,
                              procedureId: p.procedureId,
                              procedureName: p.name
                            });
                            handleAddProcedureToBill(p.procedureId);
                            setStep2ProcedureSearchQuery(p.name);
                            setShowStep2ProcedureResults(false);
                            showToast(`Selected primary procedure: ${p.name}`, 'success');
                          }}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: appointmentData.procedureId === p.procedureId ? '#F0FDF4' : '#FFFFFF'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = appointmentData.procedureId === p.procedureId ? '#F0FDF4' : '#FFFFFF'}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Code: {p.procedureId}</div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--role-staff-primary)' }}>
                            ₹{p.defaultPrice}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No procedures found matching "{step2ProcedureSearchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn btn-secondary"
              >
                &larr; Back to Demographics
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn btn-staff"
              >
                Continue to Billing & Summary &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: BILLING & CONFIRMATION */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--role-staff-primary)', margin: 0 }}>
                Step 3: Billing, Payment & Transaction Confirmation
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Review transaction breakdown and choose confirmation action.
              </p>
            </div>

            {/* TRANSACTION SUMMARY STRIP */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Patient
                </span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                  {patientData.name} ({patientData.age} yrs, {patientData.gender})
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Ph: {patientData.phone}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Doctor & Timing
                </span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--role-staff-primary)' }}>
                  {selectedDoctorObj?.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {appointmentData.date} at {appointmentData.time} &bull; {appointmentData.appointmentType}
                </div>
              </div>
            </div>

            {/* BILLING ITEMS & PROCEDURES */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Invoice Line Items</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Type in the search box to search and add procedures to this patient's invoice.
                  </p>
                </div>

                {/* PROCEDURE ITEM SEARCH BOX (REPLACES OLD DROPDOWN) */}
                <div ref={procedureSearchContainerRef} style={{ position: 'relative', width: '380px', maxWidth: '100%' }}>
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
                        setShowProcedureSearchResults(true);
                      }}
                      onFocus={() => setShowProcedureSearchResults(true)}
                      placeholder="Search procedure item (e.g. Dental, X-Ray, Root Canal)..."
                      style={{
                        paddingLeft: '34px',
                        paddingRight: procedureSearchQuery ? '28px' : '10px',
                        fontSize: '0.82rem',
                        borderColor: showProcedureSearchResults ? 'var(--role-staff-primary)' : 'var(--border-subtle)',
                        boxShadow: showProcedureSearchResults ? '0 0 0 2px rgba(22, 163, 74, 0.15)' : 'none'
                      }}
                    />
                    {procedureSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setProcedureSearchQuery('');
                          setShowProcedureSearchResults(false);
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
                  {showProcedureSearchResults && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                        maxHeight: '260px',
                        overflowY: 'auto'
                      }}
                    >
                      {filteredProcedures.length > 0 ? (
                        filteredProcedures.map((p) => {
                          const isAdded = billingProcedures.some(bp => bp.procedureId === p.procedureId);
                          return (
                            <div
                              key={p.procedureId}
                              onClick={() => {
                                handleAddProcedureToBill(p.procedureId);
                                setProcedureSearchQuery('');
                                setShowProcedureSearchResults(false);
                                showToast(`Added ${p.name} (₹${p.defaultPrice}) to invoice`, 'success');
                              }}
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
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
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
                                {isAdded ? (
                                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 600 }}>
                                    Added
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F0FDF4', color: '#15803D', fontWeight: 700, border: '1px solid #BBF7D0' }}>
                                    + Add
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          No procedure items matching "{procedureSearchQuery}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* MANUAL ITEM, QTY, RATE ENTRY BAR */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 120px 110px',
                  gap: '8px',
                  alignItems: 'end',
                  padding: '10px 12px',
                  marginBottom: '12px',
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

              <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                <table className="v-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '130px' }}>Rate (₹)</th>
                      <th style={{ width: '120px' }}>Amount (₹)</th>
                      <th style={{ width: '40px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Consultation Line */}
                    {appointmentData.appointmentType === 'Consultation' && (
                      <tr>
                        <td style={{ fontWeight: 600 }}>Doctor Consultation Fee</td>
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td>₹{consultationFee}</td>
                        <td style={{ fontWeight: 700 }}>₹{consultationFee}</td>
                        <td>-</td>
                      </tr>
                    )}

                    {/* Follow-up Visit (Zero Bill) Line */}
                    {appointmentData.appointmentType === 'Follow-up Visit (Zero Bill)' && (
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

                    {/* Added Procedures */}
                    {billingProcedures.map((proc, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            value={proc.name}
                            onChange={(e) => handleUpdateProcedureItem(idx, 'name', e.target.value)}
                            style={{ fontSize: '0.82rem', padding: '4px 8px', fontWeight: 600 }}
                          />
                          {proc.procedureId && proc.procedureId !== 'CUSTOM' && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Code: {proc.procedureId}
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-input"
                            value={proc.qty}
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
                              value={proc.price}
                              onChange={(e) => handleUpdateProcedureItem(idx, 'price', e.target.value)}
                              style={{ fontSize: '0.82rem', padding: '4px 6px', width: '100%' }}
                            />
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--role-staff-primary)' }}>
                          ₹{(Number(proc.price || 0) * Number(proc.qty || 1)).toLocaleString()}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemoveProcedureFromBill(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--status-danger-text)', cursor: 'pointer', padding: '4px' }}
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TOTALS & PAYMENT SELECTION */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div className="form-grid-2">
                  <SelectInput
                    label="Payment Method"
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    options={['UPI', 'Cash', 'Card', 'Other']}
                    required
                  />
                  <FormInput
                    label="Discount (₹)"
                    name="discount"
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                <FormInput
                  label="Amount Collected (₹)"
                  name="paidAmount"
                  type="number"
                  value={paidAmount || grandTotal}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  helperText={`Grand total: ₹${grandTotal}`}
                />
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {Number(discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--status-available-text)' }}>
                    <span>Discount:</span>
                    <span>- ₹{Number(discount).toLocaleString()}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    paddingTop: '8px',
                    borderTop: '2px solid var(--border-subtle)'
                  }}
                >
                  <span>Grand Total:</span>
                  <span>₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* CONNECTED WORKFLOW ACTIONS (Register and Bill) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn btn-secondary"
              >
                &larr; Back to Appointment
              </button>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDraftInvoiceModalOpen(true)}
                  className="btn btn-secondary btn-lg"
                  style={{ borderColor: 'var(--role-staff-primary)', color: 'var(--role-staff-primary)' }}
                  title="Preview and print bill for consultation and procedures stored under this patient ID"
                >
                  <Printer size={18} /> Print Bill (Draft / Preview)
                </button>
                <button
                  type="button"
                  onClick={handleRegisterAndBill}
                  className="btn btn-staff btn-lg"
                  disabled={submitting}
                >
                  <CreditCard size={18} /> {submitting ? 'Processing Transaction...' : (isExistingPatient ? 'Update Patient & Generate Bill' : 'Register & Generate Bill')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* DRAFT INVOICE PREVIEW MODAL */}
      <Modal
        isOpen={draftInvoiceModalOpen}
        onClose={() => setDraftInvoiceModalOpen(false)}
        title={`Draft Bill Preview - Patient ID: ${assignedPatientId}`}
        size="xl"
      >
        <InvoicePreview
          invoice={draftInvoice}
          onClose={() => setDraftInvoiceModalOpen(false)}
        />
      </Modal>

      {/* SUCCESS CONFIRMATION MODAL WITH WORKING PRINT BILL & PRINT RX OPTIONS */}
      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          navigate('/staff/appointments');
        }}
        title={printTab === 'rx' ? 'Prescription Slip (RX Preview)' : 'Tax Invoice (Bill Preview)'}
        size="xl"
      >
        <div style={{ padding: '0 8px 16px' }}>
          {/* TAB & PRINT ACTION STRIP */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            {/* DOCUMENT SELECTOR TABS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPrintTab('rx')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: printTab === 'rx' ? '2px solid #0284C7' : '1px solid var(--border-subtle)',
                  backgroundColor: printTab === 'rx' ? '#0284C7' : '#FFFFFF',
                  color: printTab === 'rx' ? '#FFFFFF' : 'var(--text-main)',
                  boxShadow: printTab === 'rx' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Stethoscope size={16} />
                <span>℞ Preview RX</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintTab('bill')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: printTab === 'bill' ? '2px solid var(--role-staff-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: printTab === 'bill' ? 'var(--role-staff-primary)' : '#FFFFFF',
                  color: printTab === 'bill' ? '#FFFFFF' : 'var(--text-main)',
                  boxShadow: printTab === 'bill' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <FileText size={16} />
                <span>📄 Preview Bill</span>
              </button>
            </div>

            {/* DIRECT PRINT BUTTONS */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setPrintTab('rx');
                  setTimeout(() => {
                    window.print();
                  }, 120);
                }}
                className="btn btn-doctor btn-sm"
                title="Print Prescription Slip"
              >
                <Printer size={15} /> Print RX
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintTab('bill');
                  setTimeout(() => {
                    window.print();
                  }, 120);
                }}
                className="btn btn-staff btn-sm"
                title="Print Tax Invoice Bill"
              >
                <Printer size={15} /> Print Bill
              </button>

              <button
                type="button"
                onClick={() => {
                  setInvoiceModalOpen(false);
                  navigate('/staff/appointments');
                }}
                className="btn btn-secondary btn-sm"
              >
                Done & View Appointments
              </button>
            </div>
          </div>

          {/* ACTIVE DOCUMENT PREVIEW */}
          {printTab === 'rx' ? (
            <RXPreviewModal
              prescription={rxObject}
              consultation={{
                appointmentId: transactionResult?.appointment?.appointmentId,
                patientName: transactionResult?.patient?.name,
                patientId: transactionResult?.patient?.patientId,
                patientAge: transactionResult?.patient?.age,
                patientGender: transactionResult?.patient?.gender,
                doctorName: selectedDoctorObj?.name,
                doctorSpecialization: selectedDoctorObj?.specialization,
                doctorRegNo: selectedDoctorObj?.registrationNumber,
                procedureDetails: appointmentData.appointmentType === 'Procedure' ? appointmentData.procedureName : undefined,
                vitals: {}
              }}
              onClose={() => {
                setInvoiceModalOpen(false);
                navigate('/staff/appointments');
              }}
            />
          ) : (
            <InvoicePreview
              invoice={transactionResult?.bill}
              onClose={() => {
                setInvoiceModalOpen(false);
                navigate('/staff/appointments');
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StaffRegistrationPage;
