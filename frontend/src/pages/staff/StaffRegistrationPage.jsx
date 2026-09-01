import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
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
  AlertCircle
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docRes, procRes] = await Promise.all([
        api.getDoctorSchedules(todayStr),
        api.getProcedures()
      ]);

      if (docRes.success && docRes.data.length > 0) {
        setDoctors(docRes.data);
        const firstDoc = docRes.data[0];
        setAppointmentData((prev) => ({
          ...prev,
          doctorId: firstDoc.doctorId,
          time: firstDoc.slots?.find((s) => s.available)?.time || '10:00'
        }));
        setAvailableSlots(firstDoc.slots || []);
      }

      if (procRes.success) {
        setProceduresCatalog(procRes.data.filter((p) => p.status === 'Active'));
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
        showToast(`Patient ${res.data.patient.name} registered & bill generated!`, 'success');
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
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--role-staff-primary)', margin: 0 }}>
                Step 1: Patient Personal & Contact Information
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Unique VIORA Patient ID will be assigned automatically upon completion.
              </p>
            </div>

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
                  {doctors.map((d) => (
                    <option key={d.doctorId} value={d.doctorId}>
                      {d.name} ({d.specialization}) - Fee: ₹{d.consultationFee}
                    </option>
                  ))}
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

            {/* PROCEDURE SELECT IF PROCEDURE TYPE */}
            {appointmentData.appointmentType === 'Procedure' && (
              <div className="form-group">
                <label className="form-label">Select Primary Procedure</label>
                <select
                  className="form-select"
                  value={appointmentData.procedureId}
                  onChange={(e) => {
                    const proc = proceduresCatalog.find((p) => p.procedureId === e.target.value);
                    setAppointmentData({
                      ...appointmentData,
                      procedureId: e.target.value,
                      procedureName: proc ? proc.name : ''
                    });
                    if (proc) {
                      handleAddProcedureToBill(proc.procedureId);
                    }
                  }}
                >
                  <option value="">-- Choose Procedure from Catalog --</option>
                  {proceduresCatalog.map((p) => (
                    <option key={p.procedureId} value={p.procedureId}>
                      {p.name} - ₹{p.defaultPrice}
                    </option>
                  ))}
                </select>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Invoice Line Items</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      width: 'auto',
                      border: '2px solid #16A34A',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#F0FDF4',
                      color: '#15803D',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(22, 163, 74, 0.15)'
                    }}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddProcedureToBill(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" style={{ fontWeight: 600, color: '#15803D' }}>+ Add Procedure Item...</option>
                    {proceduresCatalog.map((p) => (
                      <option key={p.procedureId} value={p.procedureId} style={{ color: 'var(--text-main)' }}>
                        {p.name} (₹{p.defaultPrice})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                <table className="v-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Consultation Line */}
                    {appointmentData.appointmentType === 'Consultation' && (
                      <tr>
                        <td style={{ fontWeight: 600 }}>Doctor Consultation Fee</td>
                        <td>1</td>
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
                        <td>1</td>
                        <td>₹0</td>
                        <td style={{ fontWeight: 700, color: '#166534' }}>₹0</td>
                        <td>-</td>
                      </tr>
                    )}

                    {/* Added Procedures */}
                    {billingProcedures.map((proc, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{proc.name}</td>
                        <td>{proc.qty}</td>
                        <td>₹{proc.price}</td>
                        <td style={{ fontWeight: 700 }}>₹{proc.price * proc.qty}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemoveProcedureFromBill(idx)}
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleRegisterAndBill}
                  className="btn btn-staff btn-lg"
                  disabled={submitting}
                >
                  <CreditCard size={18} /> {submitting ? 'Registering & Generating Documents...' : 'Register & Bill'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

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
