import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save,
  Lock,
  History,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Printer,
  Plus,
  Trash2,
  Pill
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import RXPreviewModal from '../../components/common/RXPreviewModal';
import { LoadingState } from '../../components/common/LoadingState';

const DoctorConsultationPage = () => {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { clinic } = useClinic();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rxModalOpen, setRxModalOpen] = useState(false);

  // Active Patient & Appointment info
  const [patient, setPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState({ consultations: [], prescriptions: [], appointments: [] });
  const [appointment, setAppointment] = useState(null);
  const [expandedVisitId, setExpandedVisitId] = useState(null);

  // Form State
  const [consultationId, setConsultationId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [vitals, setVitals] = useState({ bp: '', pulse: '', temp: '', weight: '', spo2: '' });
  const [examination, setExamination] = useState('');
  const [treatment, setTreatment] = useState('');
  const [procedureDetails, setProcedureDetails] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Prescribed Medicines State
  const [medicines, setMedicines] = useState([]);
  const [newMed, setNewMed] = useState({
    name: '',
    dosage: '1 Tablet',
    frequency: '1-0-1',
    duration: '5 Days',
    instructions: 'After Food'
  });

  // Deduplicate previous visits by date (YYYY-MM-DD), keeping only the latest updated record for each day
  const displayConsultations = React.useMemo(() => {
    if (!patientHistory?.consultations || !Array.isArray(patientHistory.consultations)) return [];
    const dayMap = new Map();
    for (const c of patientHistory.consultations) {
      const dayKey = (c.createdAt || '').split('T')[0] || c.consultationId;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, c);
      } else {
        const existing = dayMap.get(dayKey);
        const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        const cTime = new Date(c.updatedAt || c.createdAt).getTime();
        if (cTime > existingTime) {
          dayMap.set(dayKey, c);
        }
      }
    }
    return Array.from(dayMap.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  }, [patientHistory?.consultations]);

  const loadConsultationData = async () => {
    try {
      setLoading(true);
      let targetPatientId = searchParams.get('patientId');
      let aptData = null;

      if (appointmentId && appointmentId !== 'new') {
        const aptRes = await api.getAppointments();
        if (aptRes.success) {
          aptData = aptRes.data.find((a) => a.appointmentId === appointmentId);
          if (aptData) {
            setAppointment(aptData);
            targetPatientId = aptData.patientId;
          }
        }
      }

      if (targetPatientId) {
        const [patRes, histRes] = await Promise.all([
          api.getPatientById(targetPatientId),
          api.getPatientHistory(targetPatientId)
        ]);

        if (patRes.success) setPatient(patRes.data);
        if (histRes.success) setPatientHistory(histRes.data);

        // Check if there is an existing consultation for this appointment
        if (appointmentId && appointmentId !== 'new') {
          const existingConsRes = await api.getConsultations({ appointmentId });
          if (existingConsRes.success && existingConsRes.data.length > 0) {
            const existing = existingConsRes.data[0];
            setConsultationId(existing.consultationId);
            setChiefComplaint(existing.chiefComplaint || '');
            setSymptoms(existing.symptoms || '');
            setDiagnosis(existing.diagnosis || '');
            setVitals(existing.vitals || { bp: '', pulse: '', temp: '', weight: '', spo2: '' });
            setExamination(existing.examination || '');
            setTreatment(existing.treatment || '');
            setProcedureDetails(existing.procedureDetails || '');
            setPrivateNotes(existing.privateNotes || '');
            if (existing.prescription) {
              setAdvice(existing.prescription.advice || '');
              setFollowUpDate(existing.prescription.followUpDate || '');
              if (Array.isArray(existing.prescription.medicines)) {
                setMedicines(existing.prescription.medicines);
              }
            }
          }
        }
      }
    } catch (err) {
      showToast(err.message || 'Error loading clinical workspace', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsultationData();
  }, [appointmentId]);

  const handleSave = async (completeAndExit = false) => {
    if (!patient) {
      showToast('No patient context found', 'error');
      return;
    }

    try {
      setSaving(true);
      const doctorId = user?.referenceId || appointment?.doctorId || '';

      const payload = {
        consultationId: consultationId || undefined,
        appointmentId: appointment?.appointmentId || undefined,
        patientId: patient.patientId,
        doctorId,
        chiefComplaint,
        symptoms,
        diagnosis,
        vitals,
        examination,
        treatment,
        procedureDetails,
        privateNotes,
        medicines,
        advice,
        followUpDate,
        status: 'Completed'
      };

      const res = await api.saveConsultation(payload);
      if (res.success) {
        showToast('Clinical consultation and Doctor Remarks saved successfully', 'success');
        if (res.data?.consultationId) {
          setConsultationId(res.data.consultationId);
        }
        // Immediately refresh patient history so that remarks and updated consultation appear in Previous Visits!
        if (patient?.patientId) {
          const histRes = await api.getPatientHistory(patient.patientId);
          if (histRes.success) setPatientHistory(histRes.data);
        }
        if (completeAndExit) {
          navigate('/doctor/appointments');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to save consultation', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading VIORA clinical workstation..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* WORKSPACE TOP BAR */}
      <div
        className="v-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          padding: '12px 20px',
          gap: 'var(--spacing-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/doctor/appointments')}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeft size={15} /> Queue
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                {patient?.name || 'Patient Consultation'}
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--role-doctor-primary)',
                  backgroundColor: 'var(--role-doctor-bg)',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}
              >
                {patient?.patientId}
              </span>
              {appointment?.queueNumber && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--status-active-bg)',
                    color: 'var(--status-active-text)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {appointment.queueNumber}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {patient?.age} yrs &bull; {patient?.gender} &bull; Ph: {patient?.phone}
            </span>
          </div>
        </div>

        {/* CLINICAL ACTIONS */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setRxModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Preview & Print Prescription"
          >
            <Printer size={15} /> Preview & Print RX
          </button>
          <button
            onClick={() => handleSave(true)}
            className="btn btn-doctor btn-sm"
            disabled={saving}
          >
            <Save size={15} /> {saving ? 'Saving...' : 'Save & Complete'}
          </button>
        </div>
      </div>

      {/* 3-COLUMN CLINICAL WORKSPACE LAYOUT */}
      <div
        className="consultation-workspace-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr 300px',
          gap: 'var(--spacing-md)',
          alignItems: 'start'
        }}
      >
        {/* COLUMN 1: LEFT - PATIENT MEDICAL HISTORY */}
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="v-card-title" style={{ fontSize: '0.95rem' }}>
            <History size={16} color="var(--role-doctor-primary)" />
            <span>Patient Medical History</span>
          </div>

          {/* ALLERGIES WARNING */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: patient?.allergies && patient.allergies !== 'None' ? 'var(--status-danger-bg)' : 'var(--bg-app)',
              border: `1px solid ${patient?.allergies && patient.allergies !== 'None' ? '#FECACA' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: patient?.allergies && patient.allergies !== 'None' ? 'var(--status-danger-text)' : 'var(--text-main)',
                textTransform: 'uppercase'
              }}
            >
              <AlertTriangle size={14} />
              <span>Known Drug Allergies</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '4px', color: patient?.allergies && patient.allergies !== 'None' ? 'var(--status-danger-text)' : 'var(--text-secondary)' }}>
              {patient?.allergies || 'No known drug allergies reported'}
            </div>
          </div>

          {/* CHRONIC MEDICAL HISTORY */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Chronic Conditions & Background
            </span>
            <div
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-main)',
                marginTop: '4px',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {patient?.medicalHistory || 'No previous chronic history recorded'}
            </div>
          </div>

          {/* PREVIOUS VISITS CHRONOLOGY WITH DOCTOR REMARKS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Previous Visits ({displayConsultations.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {displayConsultations.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  First visit for this patient.
                </div>
              ) : (
                displayConsultations.map((c) => {
                  const isExpanded = expandedVisitId === c.consultationId;
                  const dateStr = new Date(c.createdAt || Date.now()).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const isUpdated = c.updatedAt && c.updatedAt !== c.createdAt;
                  const activeTimeStr = new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={c.consultationId}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* VISIT HEADER */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, color: 'var(--role-doctor-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📅 {dateStr}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            ({activeTimeStr})
                          </span>
                          {isUpdated && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: '#16A34A',
                                backgroundColor: '#DCFCE7',
                                padding: '1px 5px',
                                borderRadius: '3px'
                              }}
                            >
                              Latest
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Dr. {c.doctorName}
                        </span>
                      </div>

                      {/* DIAGNOSIS & CHIEF COMPLAINTS */}
                      {c.diagnosis && (
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Diagnosis:</span> {c.diagnosis}
                        </div>
                      )}
                      {c.chiefComplaint && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Complaint:</span> {c.chiefComplaint}
                        </div>
                      )}

                      {/* DOCTOR REMARKS / PRIVATE NOTES - PROMINENTLY DISPLAYED */}
                      {c.privateNotes ? (
                        <div
                          style={{
                            marginTop: '4px',
                            padding: '8px 10px',
                            backgroundColor: '#FEF3C7',
                            border: '1px solid #FDE68A',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            color: '#92400E'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, marginBottom: '2px', color: '#B45309' }}>
                            <Lock size={12} />
                            <span>Doctor Remarks on this visit:</span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4, color: '#78350F', fontWeight: 500 }}>
                            {c.privateNotes}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          No doctor remarks recorded for this visit.
                        </div>
                      )}

                      {/* EXPAND / COLLAPSE DETAILS BUTTON */}
                      <button
                        type="button"
                        onClick={() => setExpandedVisitId(isExpanded ? null : c.consultationId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--role-doctor-primary)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: '2px 0 0 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isExpanded ? '▲ Hide Clinical Details' : '▼ View Vitals, Medications & Notes'}
                      </button>

                      {/* EXPANDED VISIT CLINICAL DETAILS */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px dashed var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)'
                          }}
                        >
                          {/* VITALS */}
                          {c.vitals && (c.vitals.bp || c.vitals.pulse || c.vitals.temp || c.vitals.weight || c.vitals.spo2) && (
                            <div style={{ backgroundColor: 'var(--bg-app)', padding: '6px 8px', borderRadius: '4px' }}>
                              <strong style={{ color: 'var(--text-muted)' }}>Vitals: </strong>
                              {c.vitals.bp && <span>BP: {c.vitals.bp} | </span>}
                              {c.vitals.pulse && <span>Pulse: {c.vitals.pulse} bpm | </span>}
                              {c.vitals.temp && <span>Temp: {c.vitals.temp} °F | </span>}
                              {c.vitals.spo2 && <span>SpO2: {c.vitals.spo2}%</span>}
                            </div>
                          )}

                          {/* EXAMINATION / PROCEDURE */}
                          {c.examination && (
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Physical Findings: </strong>
                              <span>{c.examination}</span>
                            </div>
                          )}
                          {c.treatment && (
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Treatment: </strong>
                              <span>{c.treatment}</span>
                            </div>
                          )}
                          {c.procedureDetails && (
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Procedure: </strong>
                              <span>{c.procedureDetails}</span>
                            </div>
                          )}

                          {/* ADVICE & FOLLOW-UP */}
                          {c.prescription?.advice && (
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Advice: </strong>
                              <span>{c.prescription.advice}</span>
                            </div>
                          )}
                          {c.prescription?.followUpDate && (
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Follow-up: </strong>
                              <span>{c.prescription.followUpDate}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: CENTER - CURRENT CONSULTATION WORKSPACE */}
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="v-card-title" style={{ fontSize: '1.05rem' }}>
            <Activity size={18} color="var(--role-doctor-primary)" />
            <span>Active Clinical Consultation</span>
          </div>

          {/* VITALS ENTRY STRIP */}
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Patient Vitals Examination
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                marginTop: '6px'
              }}
            >
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>BP (mmHg)</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                  placeholder="120/80"
                  value={vitals.bp}
                  onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pulse (bpm)</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                  placeholder="72"
                  value={vitals.pulse}
                  onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Temp (°F)</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                  placeholder="98.4"
                  value={vitals.temp}
                  onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Weight (kg)</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                  placeholder="68"
                  value={vitals.weight}
                  onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>SpO2 (%)</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                  placeholder="99"
                  value={vitals.spo2}
                  onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* CHIEF COMPLAINTS & DIAGNOSIS */}
          <div className="form-grid-2">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Chief Complaint & Symptoms</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Patient symptoms, onset duration, severity..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clinical Diagnosis</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Acute Pharyngitis with upper respiratory tract infection..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
          </div>

          {/* EXAMINATION & CLINICAL FINDINGS */}
          <div className="form-grid-2">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Physical Examination Findings</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Chest clear, tonsils congested, throat redness..."
                value={examination}
                onChange={(e) => setExamination(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Procedures / In-Clinic Treatment</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Nebulization, wound dressing, ECG conducted..."
                value={procedureDetails}
                onChange={(e) => setProcedureDetails(e.target.value)}
              />
            </div>
          </div>

          {/* PRESCRIBED MEDICATIONS BUILDER (℞) */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 800, color: 'var(--role-doctor-primary)' }}>
                <Pill size={16} />
                <span>Prescribed Medications (℞)</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {medicines.length} medicine(s) added
              </span>
            </div>

            {/* QUICK PRESCRIBE CHIPS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Add:</span>
              {[
                { name: 'Tab. Augmentin 625mg', dosage: '1 Tablet', freq: '1-0-1', dur: '5 Days', inst: 'After Food' },
                { name: 'Tab. Dolo 650mg', dosage: '1 Tablet', freq: 'SOS', dur: '3 Days', inst: 'After Food for Fever' },
                { name: 'Cap. Pantocid 40mg', dosage: '1 Capsule', freq: '1-0-0', dur: '5 Days', inst: 'Empty Stomach' },
                { name: 'Syrup Ascoril-D', dosage: '10 ml', freq: '1-1-1', dur: '5 Days', inst: 'After Food' },
                { name: 'Tab. Azithromycin 500mg', dosage: '1 Tablet', freq: '1-0-0', dur: '3 Days', inst: 'After Food' },
                { name: 'Tab. Montair-LC', dosage: '1 Tablet', freq: '0-0-1', dur: '7 Days', inst: 'At Bedtime' }
              ].map((chip, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    if (!medicines.some(m => m.name === chip.name)) {
                      setMedicines([...medicines, { name: chip.name, dosage: chip.dosage, frequency: chip.freq, duration: chip.dur, instructions: chip.inst }]);
                    }
                  }}
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  + {chip.name}
                </button>
              ))}
            </div>

            {/* ADD MEDICINE INPUT ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr auto', gap: '6px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Medicine Name</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  placeholder="e.g. Tab. Amoxicillin 500mg"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newMed.name.trim()) {
                        setMedicines([...medicines, { ...newMed, name: newMed.name.trim() }]);
                        setNewMed({ name: '', dosage: '1 Tablet', frequency: '1-0-1', duration: '5 Days', instructions: 'After Food' });
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Dosage</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  placeholder="1 Tab / 5ml"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Frequency</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  placeholder="1-0-1 / SOS"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Duration</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  placeholder="5 Days"
                  value={newMed.duration}
                  onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Instructions</label>
                <input
                  className="form-input"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  placeholder="After Food"
                  value={newMed.instructions}
                  onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="btn btn-doctor btn-sm"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                onClick={() => {
                  if (!newMed.name.trim()) {
                    showToast('Please enter a medicine name', 'warning');
                    return;
                  }
                  setMedicines([...medicines, { ...newMed, name: newMed.name.trim() }]);
                  setNewMed({ name: '', dosage: '1 Tablet', frequency: '1-0-1', duration: '5 Days', instructions: 'After Food' });
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {/* MEDICINES TABLE LIST */}
            {medicines.length > 0 && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#475569', width: '35%' }}>Medicine</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', color: '#475569', width: '15%' }}>Dosage</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', color: '#475569', width: '15%' }}>Frequency</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', color: '#475569', width: '15%' }}>Duration</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#475569', width: '15%' }}>Instructions</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((med, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {idx + 1}. {med.name}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748B' }}>{med.dosage}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--role-doctor-primary)' }}>{med.frequency}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{med.duration}</td>
                        <td style={{ padding: '6px 8px', color: '#475569' }}>{med.instructions}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setMedicines(medicines.filter((_, i) => i !== idx))}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                            title="Remove Medicine"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="form-grid-2" style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">General Advice / Dietary / Precautions</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Steam inhalation, drink warm fluids, avoid dairy at night..."
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Follow-up Recommendation</label>
              <input
                className="form-input"
                placeholder="e.g. Review after 4 days or if symptoms worsen"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* COLUMN 3: RIGHT - PRIVATE DOCTOR NOTES / REMARKS */}
        <div
          className="v-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#F8FAFC',
            borderColor: '#CBD5E1'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309' }}>
            <Lock size={16} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Private Doctor Remarks</span>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: '#92400E',
              backgroundColor: '#FEF3C7',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #FDE68A',
              lineHeight: 1.4
            }}
          >
            <strong>Strict Confidentiality:</strong> These notes are private to the physician. They are never exposed to Staff APIs or printed on patient RX/invoices.
          </div>

          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <textarea
              className="form-textarea"
              rows={12}
              style={{
                height: '100%',
                minHeight: '260px',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem'
              }}
              placeholder="Record private clinical impressions, psychological state, family context, differential suspicions, or confidential doctor notes..."
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
            />
          </div>

          <button
            onClick={() => handleSave(false)}
            className="btn btn-doctor btn-sm"
            style={{ width: '100%' }}
            disabled={saving}
          >
            <Save size={14} /> Quick Save Notes
          </button>
        </div>
      </div>

      {/* RX PREVIEW MODAL */}
      <Modal
        isOpen={rxModalOpen}
        onClose={() => setRxModalOpen(false)}
        title="Prescription Slip (RX Preview)"
        size="xl"
      >
        <RXPreviewModal
          prescription={{
            prescriptionId: consultationId ? `RX-${consultationId}` : `RX-${patient?.patientId || 'CONS'}`,
            patientName: patient?.name,
            patientId: patient?.patientId,
            patientAge: patient?.age,
            patientGender: patient?.gender,
            patientPhone: patient?.phone,
            patientDOB: patient?.dateOfBirth,
            doctorName: user?.name || appointment?.doctorName || 'Attending Physician',
            doctorSpecialization: user?.profileDetails?.specialization || appointment?.doctorSpecialization || '',
            doctorQualification: user?.profileDetails?.qualification || appointment?.doctorQualification || '',
            doctorRegNo: user?.profileDetails?.registrationNumber || appointment?.doctorRegNo || '',
            consultationDate: appointment?.date || new Date().toISOString().split('T')[0],
            chiefComplaints: chiefComplaint || (appointment?.appointmentType === 'Procedure' && appointment?.procedureName ? `Procedure: ${appointment.procedureName}` : ''),
            diagnosis,
            vitals,
            examination,
            allergies: patient?.allergies,
            medicalHistory: patient?.medicalHistory,
            medicines,
            procedures: procedureDetails ? [procedureDetails] : [],
            advice,
            followUpDate,
            createdAt: new Date().toISOString()
          }}
          consultation={{
            patientName: patient?.name,
            patientId: patient?.patientId,
            patientAge: patient?.age,
            patientGender: patient?.gender,
            patientPhone: patient?.phone,
            doctorName: user?.name || appointment?.doctorName || 'Attending Physician',
            doctorSpecialization: user?.profileDetails?.specialization || appointment?.doctorSpecialization || '',
            doctorQualification: user?.profileDetails?.qualification || appointment?.doctorQualification || '',
            doctorRegNo: user?.profileDetails?.registrationNumber || appointment?.doctorRegNo || '',
            procedureDetails,
            chiefComplaint,
            diagnosis,
            vitals,
            examination,
            medicines,
            advice,
            followUpDate
          }}
          onClose={() => setRxModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default DoctorConsultationPage;
