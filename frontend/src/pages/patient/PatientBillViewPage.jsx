import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Printer,
  AlertTriangle,
  Clock,
  Building2,
  Phone,
  Mail,
  Calendar,
  User,
  CheckCircle2,
  FileText,
  Lock
} from 'lucide-react';
import { api } from '../../services/api';
import { printDocument } from '../../utils/printUtils';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';

const PatientBillViewPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getPublicBillByToken(token);
        if (res.success && res.data) {
          setBillData(res.data);
        } else {
          setError(res.message || 'Unable to retrieve bill.');
        }
      } catch (err) {
        setError(err.message || 'This bill link has expired or is invalid.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchBill();
    } else {
      setError('No bill access token provided.');
      setLoading(false);
    }
  }, [token]);

  const handlePrint = () => {
    printDocument('viora-patient-bill-view', `VIORA-Invoice-${billData?.invoice?.invoiceNumber || 'Bill'}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <LoadingState message="Verifying secure bill access..." />
      </div>
    );
  }

  // Error / Expired / Revoked state
  if (error || !billData) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'var(--font-sans)'
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            padding: '32px 28px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px auto',
              color: '#DC2626'
            }}
          >
            <AlertTriangle size={32} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
            Bill Link Inactive or Expired
          </h2>

          <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6, marginBottom: '20px' }}>
            {error || 'This healthcare bill link is invalid, expired, or has been revoked for your privacy and data protection.'}
          </p>

          <div
            style={{
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              textAlign: 'left',
              fontSize: '0.85rem',
              color: '#334155',
              marginBottom: '24px'
            }}
          >
            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} color="var(--role-staff-primary)" /> Why is my link expired?
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#64748B' }}>
              Under healthcare access policies, bill links sent via WhatsApp are protected with time-limited tokens to safeguard your medical billing privacy.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
              <div><strong>Need an updated link?</strong> Contact our front desk reception:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="var(--role-staff-primary)" /> +91 80 4920 8800
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={14} color="var(--role-staff-primary)" /> contact@vioraclinic.com
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
            VIORA Healthcare Systems &bull; Patient Privacy & Security Shield
          </div>
        </div>
      </div>
    );
  }

  const { clinic, invoice, linkMetadata } = billData;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        padding: '24px 16px',
        fontFamily: 'var(--font-sans)',
        color: '#0F172A'
      }}
    >
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        {/* TOP STATUS BAR */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.78rem'
              }}
            >
              <ShieldCheck size={15} /> Verified Secure Access
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Expires: {new Date(linkMetadata?.expiresAt).toLocaleDateString()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              className="btn btn-staff btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} /> Print / Download Bill
            </button>
          </div>
        </div>

        {/* INVOICE CANVAS (FOR DISPLAY & PRINT) */}
        <div
          id="viora-patient-bill-view"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: '32px'
          }}
        >
          {/* CLINIC BRAND HEADER */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              paddingBottom: '24px',
              borderBottom: '2px solid #0F172A'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {clinic?.logoUrl ? (
                  <img
                    src={clinic.logoUrl}
                    alt="VIORA Logo"
                    style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--role-staff-primary, #0D9488)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '1.2rem'
                    }}
                  >
                    V
                  </div>
                )}
                <div>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '0.5px' }}>
                    {clinic.clinicName}
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>
                    {clinic.tagline}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                <div>{clinic.address}</div>
                <div>{clinic.city}, {clinic.state} - {clinic.pinCode}</div>
                <div>Ph: {clinic.contactNumber} | Email: {clinic.email}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  letterSpacing: '1px',
                  marginBottom: '10px'
                }}
              >
                TAX INVOICE
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{invoice.invoiceNumber}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                Date: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : 'N/A'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                GSTIN: {clinic.gstNumber}
              </div>
            </div>
          </div>

          {/* PATIENT & DOCTOR INFO BAR */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              padding: '18px 0',
              borderBottom: '1px solid #E2E8F0'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                Billed To (Patient)
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '4px' }}>{invoice.patientName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                {invoice.patientAge ? `${invoice.patientAge} yrs` : ''} &bull; {invoice.patientGender}
                {invoice.patientPhone ? ` &bull; Ph: ${invoice.patientPhone}` : ''}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                Attending Physician
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '4px' }}>{invoice.doctorName}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                {invoice.doctorSpecialization} {invoice.doctorRegNo ? `(Reg: ${invoice.doctorRegNo})` : ''}
              </div>
            </div>
          </div>

          {/* ITEMIZATION TABLE */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B' }}>
                <th style={{ padding: '10px 12px' }}>#</th>
                <th style={{ padding: '10px 12px' }}>Description</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.85rem' }}>
              {/* Consultation line */}
              {invoice.consultationFee > 0 && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px' }}>1</td>
                  <td style={{ padding: '12px' }}>
                    <strong>{invoice.consultationType || 'Outpatient Consultation'}</strong>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Physician Consultation & Clinical Assessment</div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>₹{invoice.consultationFee.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>₹{invoice.consultationFee.toLocaleString()}</td>
                </tr>
              )}

              {/* Procedures lines */}
              {invoice.procedures && invoice.procedures.map((proc, idx) => {
                const lineIndex = (invoice.consultationFee > 0 ? 2 : 1) + idx;
                const price = Number(proc.price || proc.rate || 0);
                const qty = Number(proc.qty || 1);
                const amount = price * qty;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px' }}>{lineIndex}</td>
                    <td style={{ padding: '12px' }}>
                      <strong>{proc.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Clinical Procedure</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{qty}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>₹{price.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>₹{amount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TOTALS & PAYMENT DETAILS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '2px solid #E2E8F0',
              flexWrap: 'wrap',
              gap: '20px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                Payment Method & Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{invoice.paymentMethod || 'UPI'}</span>
                <StatusBadge status={invoice.paymentStatus} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px' }}>
                Received with thanks. Authorized computer generated receipt.
              </div>
            </div>

            <div style={{ minWidth: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Subtotal:</span>
                <span style={{ fontWeight: 700 }}>₹{invoice.subtotal?.toLocaleString()}</span>
              </div>
              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px', color: '#166534' }}>
                  <span>Discount:</span>
                  <span>-₹{invoice.discount?.toLocaleString()}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Taxes:</span>
                  <span>+₹{invoice.tax?.toLocaleString()}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  borderTop: '2px solid #0F172A',
                  paddingTop: '8px',
                  marginTop: '8px'
                }}
              >
                <span>Grand Total:</span>
                <span>₹{invoice.total?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '6px', color: '#047857', fontWeight: 700 }}>
                <span>Paid Amount:</span>
                <span>₹{invoice.paid?.toLocaleString()}</span>
              </div>
              {invoice.balance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '4px', color: '#DC2626', fontWeight: 700 }}>
                  <span>Balance Due:</span>
                  <span>₹{invoice.balance?.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div
            style={{
              marginTop: '40px',
              paddingTop: '16px',
              borderTop: '1px solid #E2E8F0',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#94A3B8'
            }}
          >
            Thank you for trusting VIORA Healthcare &bull; For inquiries, call {clinic.contactNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientBillViewPage;
