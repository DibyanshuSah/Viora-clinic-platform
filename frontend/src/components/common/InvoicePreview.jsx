import React from 'react';
import { Printer, Download, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { printDocument } from '../../utils/printUtils';

const InvoicePreview = ({ invoice, onClose, onPrint }) => {
  const { clinic } = useClinic();

  if (!invoice) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      printDocument('viora-invoice-document', `Invoice - ${invoice.invoiceNumber || 'Tax Invoice'}`);
    }
  };

  return (
    <div className="invoice-container" style={{ padding: '24px', backgroundColor: '#FFFFFF', color: '#0F172A' }}>
      {/* HEADER ACTIONS (HIDDEN IN PRINT) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Tax Invoice Preview
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Invoice ID: {invoice.invoiceNumber}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrint} className="btn btn-staff btn-sm">
            <Printer size={15} /> Print Invoice
          </button>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={15} /> Close
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE INVOICE PAPER CANVAS */}
      <div
        id="viora-invoice-document"
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: '#FFFFFF',
          fontFamily: 'var(--font-sans)',
          maxWidth: '800px',
          margin: '0 auto',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          pageBreakAfter: 'avoid',
          breakAfter: 'avoid',
          pageBreakBefore: 'avoid',
          breakBefore: 'avoid'
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
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    border: '1px solid #E2E8F0'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.3rem'
                  }}
                >
                  V
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, letterSpacing: '0.02em', color: '#0F172A' }}>
                  {clinic?.clinicName || 'VIORA'}
                </h1>
                <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  {clinic?.tagline || 'Advanced Clinic & Healthcare Centre'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
              <div>{clinic?.address}</div>
              <div>{clinic?.city}, {clinic?.state} - {clinic?.pinCode}</div>
              <div>Tel: {clinic?.contactNumber} | Email: {clinic?.email}</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              TAX INVOICE
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '4px', color: '#0D9488' }}>
              {invoice.invoiceNumber}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
              Date: {new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            {clinic?.gstNumber && (
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                GSTIN: {clinic.gstNumber}
              </div>
            )}
            {clinic?.registrationNumber && (
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Reg No: {clinic.registrationNumber}
              </div>
            )}
          </div>
        </div>

        {/* PATIENT & DOCTOR METADATA BOX */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            padding: '16px 0',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '0.85rem'
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Billed To (Patient)
            </span>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', marginTop: '2px' }}>
              {invoice.patientName}
            </div>
            <div style={{ color: '#475569', marginTop: '2px' }}>
              Patient ID: <strong>{invoice.patientId}</strong>
            </div>
            <div style={{ color: '#475569' }}>
              Age / Gender: {invoice.patientAge} yrs / {invoice.patientGender}
            </div>
            {invoice.patientPhone && <div style={{ color: '#475569' }}>Phone: {invoice.patientPhone}</div>}
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attending Physician
            </span>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', marginTop: '2px' }}>
              {invoice.doctorName}
            </div>
            <div style={{ color: '#475569', marginTop: '2px' }}>
              {invoice.doctorSpecialization}
            </div>
            {invoice.doctorRegNo && (
              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                Reg: {invoice.doctorRegNo}
              </div>
            )}
          </div>
        </div>

        {/* ITEMIZED TABLE */}
        <div style={{ marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 700, width: '45%' }}>
                  Item Description
                </th>
                <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: 700, width: '15%' }}>
                  Qty
                </th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: 700, width: '20%' }}>
                  Rate (₹)
                </th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: 700, width: '20%' }}>
                  Amount (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Consultation row if applicable */}
              {invoice.consultationType === 'Consultation' && invoice.consultationFee > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>
                    Physician Consultation ({invoice.doctorSpecialization || 'General'})
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>₹{invoice.consultationFee.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                    ₹{invoice.consultationFee.toLocaleString()}
                  </td>
                </tr>
              )}

              {/* Follow-up Visit (Zero Bill) row */}
              {(invoice.consultationType === 'Follow-up Visit (Zero Bill)' || invoice.consultationType === 'Follow-up Visit') && (
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F0FDF4' }}>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#166534' }}>
                    Follow-up Visit (Zero Bill) &bull; {invoice.doctorSpecialization || 'General'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>₹0</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                    ₹0
                  </td>
                </tr>
              )}

              {/* Procedure line items */}
              {(invoice.procedures || []).map((proc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{proc.name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Clinical Procedure</span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{proc.qty || 1}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>₹{proc.price.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                    ₹{(proc.price * (proc.qty || 1)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TOTALS & PAYMENT SUMMARY */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: '24px',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #CBD5E1'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
              Payment Mode: <strong style={{ color: '#0F172A' }}>{invoice.paymentMethod || 'Cash'}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
              Payment Status:{' '}
              <span
                style={{
                  fontWeight: 700,
                  color: invoice.paymentStatus === 'Paid' ? '#16A34A' : '#DC2626'
                }}
              >
                {invoice.paymentStatus}
              </span>
            </div>
            <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>
              This is a computer-generated tax invoice issued by VIORA Clinic Management System. No physical signature required.
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
              <span style={{ color: '#475569' }}>Subtotal:</span>
              <span>₹{invoice.subtotal?.toLocaleString() || '0'}</span>
            </div>

            {invoice.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#16A34A' }}>
                <span>Discount:</span>
                <span>- ₹{invoice.discount?.toLocaleString()}</span>
              </div>
            )}

            {invoice.tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                <span style={{ color: '#475569' }}>Tax / GST:</span>
                <span>+ ₹{invoice.tax?.toLocaleString()}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderTop: '2px solid #0F172A',
                borderBottom: '2px solid #0F172A',
                marginTop: '6px',
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#0F172A'
              }}
            >
              <span>Total Amount:</span>
              <span>₹{invoice.total?.toLocaleString() || '0'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', marginTop: '4px' }}>
              <span style={{ color: '#475569' }}>Paid:</span>
              <span style={{ fontWeight: 700, color: '#16A34A' }}>₹{invoice.paid?.toLocaleString() || '0'}</span>
            </div>

            {invoice.balance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#DC2626', fontWeight: 700 }}>
                <span>Balance Due:</span>
                <span>₹{invoice.balance?.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
