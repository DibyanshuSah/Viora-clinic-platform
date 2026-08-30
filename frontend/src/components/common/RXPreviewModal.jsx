import React from 'react';
import { Printer, X } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

const RXPreviewModal = ({ prescription, consultation, onClose, onPrint }) => {
  const { clinic } = useClinic();

  if (!prescription && !consultation) return null;

  const rx = prescription || consultation?.prescription || {};
  const cons = consultation || {};

  const patientName = rx.patientName || cons.patientName || 'N/A';
  const patientId = rx.patientId || cons.patientId || 'N/A';
  const patientAge = rx.patientAge || cons.patientAge || 'N/A';
  const patientGender = rx.patientGender || cons.patientGender || 'N/A';
  const patientPhone = rx.patientPhone || cons.patientPhone || 'N/A';
  const patientDOB = rx.patientDOB || cons.patientDOB || '';

  const doctorName = rx.doctorName || cons.doctorName || 'Dr. Vikram Malhotra';
  const doctorSpecialization = rx.doctorSpecialization || cons.doctorSpecialization || 'General Physician & Diabetologist';
  const doctorRegNo = rx.doctorRegNo || cons.doctorRegNo || 'KMC-42910';
  const rawDate = rx.consultationDate || rx.createdAt || cons.date || Date.now();

  const formatDate = (dateInput) => {
    if (!dateInput) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return dateInput;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateInput;
    }
  };

  const consultationDateFormatted = formatDate(rawDate);
  const formattedDOB = patientDOB ? formatDate(patientDOB) : 'N/A';

  const chiefComplaintsText = rx.chiefComplaints || cons.chiefComplaint || (cons.procedureDetails ? `Procedure: ${cons.procedureDetails}` : '');

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', padding: '6px' }}>
      {/* ACTIONS TOOLBAR (HIDDEN DURING PRINT) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
            Medical Prescription (RX)
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Patient: {patientName} ({patientId}) &bull; Attending: {doctorName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrint} className="btn btn-doctor btn-sm">
            <Printer size={15} /> Print RX
          </button>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={15} /> Close
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE RX DOCUMENT PAPER (FITS IN 1 PAGE STRICTLY ON A4) */}
      <div
        id="viora-rx-document"
        style={{
          backgroundColor: '#FFFFFF',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0',
          fontFamily: 'var(--font-sans)',
          color: '#0F172A',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        {/* 1. CLINIC & DOCTOR HEADER BOX */}
        <div
          style={{
            border: '2px solid #000000',
            borderRadius: '4px',
            padding: '6px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            boxSizing: 'border-box'
          }}
        >
          {/* LEFT: CLINIC DETAILS */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              {clinic?.logoUrl ? (
                <img
                  src={clinic.logoUrl}
                  alt="Clinic Logo"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    objectFit: 'cover',
                    border: '1px solid #CBD5E1'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '4px',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    letterSpacing: '-0.02em'
                  }}
                >
                  V
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#0F172A', lineHeight: 1.1, letterSpacing: '0.02em' }}>
                  {clinic?.clinicName || 'VIORA CLINIC'}
                </h1>
                <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600 }}>
                  {clinic?.tagline || 'Advanced Clinical & Healthcare Centre'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: '#334155', lineHeight: 1.25 }}>
              <div>{clinic?.address || '42, Health Crest Boulevard, Medical Enclave,'}</div>
              <div>{clinic?.city && clinic?.pinCode ? `${clinic.city} - ${clinic.pinCode}` : '4th Block, Koramangala, Bengaluru - 560034'}</div>
              <div style={{ marginTop: '1px', fontWeight: 500 }}>
                {clinic?.contactNumber || '+91 90000 00000'} | {clinic?.email || 'contact@vioraclinic.com'}
              </div>
            </div>
          </div>

          {/* RIGHT: ATTENDING PHYSICIAN DETAILS */}
          <div style={{ textAlign: 'right', minWidth: '200px' }}>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              {doctorName}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#0284C7', fontWeight: 700, marginTop: '1px' }}>
              {doctorSpecialization}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '1px', fontWeight: 600 }}>
              Reg. No: {doctorRegNo}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#334155', marginTop: '1px', fontWeight: 600 }}>
              Consultation Date: {consultationDateFormatted}
            </div>
          </div>
        </div>

        {/* 2. PATIENT INFORMATION CARD BOX */}
        <div
          style={{
            border: '2px solid #000000',
            borderRadius: '4px',
            overflow: 'hidden',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#F8FAFC',
              borderBottom: '2px solid #000000',
              padding: '2px 8px',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '0.74rem',
              letterSpacing: '0.06em',
              color: '#0F172A',
              textTransform: 'uppercase'
            }}
          >
            PATIENT INFORMATION CARD
          </div>

          <div
            style={{
              padding: '5px 16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: '24px',
              rowGap: '2px',
              fontSize: '0.74rem'
            }}
          >
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '75px', fontWeight: 700, color: '#475569' }}>Name:</span>
                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.8rem' }}>{patientName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '75px', fontWeight: 700, color: '#475569' }}>Gender:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{patientGender}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '75px', fontWeight: 700, color: '#475569' }}>Phone No.:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{patientPhone}</span>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '45px', fontWeight: 700, color: '#475569' }}>Age:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{patientAge} yrs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '45px', fontWeight: 700, color: '#475569' }}>ID:</span>
                <span style={{ fontWeight: 800, color: '#0284C7' }}>{patientId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '45px', fontWeight: 700, color: '#475569' }}>DOB:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{formattedDOB}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TWO-COLUMN CLINICAL SECTION (CHIEF COMPLAINTS | RX) WITH PROMINENT SOLID PRINTABLE DIVIDER */}
        <div
          className="rx-clinical-box"
          style={{
            border: '2px solid #000000',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            minHeight: '720px',
            height: '740px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            backgroundColor: '#FFFFFF',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* LEFT COLUMN: CHIEF COMPLAINTS */}
          <div
            className="rx-left-col"
            style={{
              width: '28%',
              borderRight: '2px solid #000000',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '2px solid #000000',
                padding: '5px 8px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: '0.05em',
                color: '#000000'
              }}
            >
              CHIEF COMPLAINTS
            </div>

            <div
              style={{
                padding: '12px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF'
              }}
            >
              {chiefComplaintsText ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    borderLeft: '3px solid #0284C7',
                    marginBottom: '8px'
                  }}
                >
                  {chiefComplaintsText}
                </div>
              ) : null}
              {/* Entire remaining area is completely blank white space */}
            </div>
          </div>

          {/* RIGHT COLUMN: RX */}
          <div
            className="rx-right-col"
            style={{
              width: '72%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '2px solid #000000',
                padding: '5px 8px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                letterSpacing: '0.08em',
                color: '#0284C7'
              }}
            >
              RX
            </div>

            <div
              style={{
                padding: '12px 16px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                backgroundColor: '#FFFFFF'
              }}
            >
              <div
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  fontFamily: 'serif',
                  color: '#0284C7',
                  lineHeight: 1,
                  marginBottom: '6px'
                }}
              >
                ℞
              </div>
              {/* Entire remaining area is completely blank white space */}
            </div>
          </div>
        </div>

        {/* 4. FOOTER: POWERED BY & GENEROUS SIGNATURE CLEARANCE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '6px',
            marginTop: '2px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          {/* LEFT: POWERED BY */}
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#64748B',
              letterSpacing: '0.02em',
              paddingBottom: '4px'
            }}
          >
            powered by <strong style={{ color: '#0F172A', fontWeight: 800 }}>clinqoAI</strong>
          </div>

          {/* RIGHT: DEDICATED PHYSICAL SIGNATURE CLEARANCE & SIGNATURE LINE */}
          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            {/* Generous signing space for the doctor to sign with pen */}
            <div style={{ height: '55px' }} />
            <div
              style={{
                width: '180px',
                borderBottom: '2px solid #000000',
                margin: '0 auto 4px auto'
              }}
            />
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              {doctorName}
            </div>
            <div style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RXPreviewModal;
