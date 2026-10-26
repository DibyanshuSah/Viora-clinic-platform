import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  FileText,
  History,
  Trash2,
  Printer,
  Edit,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  IndianRupee,
  Search,
  ShieldAlert,
  ArrowRight,
  Link,
  ShieldCheck,
  Copy,
  ExternalLink,
  Lock,
  Plus
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import InvoicePreview from '../../components/common/InvoicePreview';
import { FormInput, SelectInput } from '../../components/common/FormInput';
import { LoadingState } from '../../components/common/LoadingState';

const AdminBillingManagementPage = () => {
  const [bills, setBills] = useState([]);
  const [logs, setLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'logs'
  const { showToast } = useToast();

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Edit Bill Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [editFormData, setEditFormData] = useState({
    paid: 0,
    paymentMethod: 'UPI',
    paymentStatus: 'Paid',
    discount: 0
  });

  // Delete Single Bill Confirmation
  const [deleteBillModalOpen, setDeleteBillModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [deletingBill, setDeletingBill] = useState(false);

  // Delete Total Bill for Patient Modal State
  const [deletePatientBillsModalOpen, setDeletePatientBillsModalOpen] = useState(false);
  const [selectedPatientIdForDelete, setSelectedPatientIdForDelete] = useState('');
  const [deletingPatientBills, setDeletingPatientBills] = useState(false);

  // Bill Link & WhatsApp Management Modal State
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedBillForLinks, setSelectedBillForLinks] = useState(null);
  const [billLinks, setBillLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [billsRes, logsRes, patientsRes, auditRes] = await Promise.all([
        api.getBills(),
        api.getBillingLogs(),
        api.getPatients(),
        api.getAuditLogs().catch(() => ({ success: false, data: { logs: [] } }))
      ]);

      if (billsRes.success) setBills(billsRes.data);
      
      const combinedLogs = [];
      if (auditRes.success && auditRes.data?.logs?.length > 0) {
        combinedLogs.push(...auditRes.data.logs.map(l => ({
          logId: l.id,
          action: l.action,
          billId: l.resourceId,
          invoiceNumber: l.resourceId,
          patientId: l.patientId,
          patientName: l.patientId ? (patientsRes.data?.find(p => p.patientId === l.patientId)?.name || 'Patient') : 'System',
          total: null,
          details: l.details,
          performedBy: `${l.userName} (${l.userRole})`,
          timestamp: l.createdAt
        })));
      } else if (logsRes.success) {
        combinedLogs.push(...logsRes.data);
      }

      combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(combinedLogs);

      if (patientsRes.success) setPatients(patientsRes.data);
    } catch (err) {
      showToast(err.message || 'Failed to load billing records and audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLinkModal = async (bill) => {
    setSelectedBillForLinks(bill);
    setLinkModalOpen(true);
    try {
      setLoadingLinks(true);
      const res = await api.getBillLinks(bill.billId);
      if (res.success) {
        setBillLinks(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Could not load bill links', 'error');
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleGenerateNewLink = async (billId, expiryDays = 365) => {
    try {
      setActionLoading(true);
      const res = await api.generateBillLink(billId, expiryDays);
      if (res.success) {
        showToast('Generated fresh secure UUID bill link!', 'success');
        const linksRes = await api.getBillLinks(billId);
        if (linksRes.success) setBillLinks(linksRes.data);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to generate link', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeLink = async (linkId, billId) => {
    try {
      setActionLoading(true);
      const res = await api.revokeBillLink(linkId);
      if (res.success) {
        showToast('Bill link revoked successfully. Token is no longer accessible.', 'info');
        const linksRes = await api.getBillLinks(billId);
        if (linksRes.success) setBillLinks(linksRes.data);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to revoke link', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryWhatsApp = async (messageId) => {
    try {
      setActionLoading(true);
      const res = await api.retryWhatsAppMessage(messageId);
      if (res.success) {
        showToast('WhatsApp notification re-sent successfully!', 'success');
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Retry failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast('Secure UUID Bill Link copied to clipboard!', 'success');
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary Metrics
  const totalBilled = useMemo(() => bills.reduce((acc, b) => acc + (Number(b.total) || 0), 0), [bills]);
  const totalCollected = useMemo(() => bills.reduce((acc, b) => acc + (Number(b.paid) || 0), 0), [bills]);
  const totalOutstanding = useMemo(() => Math.max(0, totalBilled - totalCollected), [totalBilled, totalCollected]);

  // Patients who currently have bills
  const patientsWithBills = useMemo(() => {
    const map = new Map();
    bills.forEach((b) => {
      if (!map.has(b.patientId)) {
        map.set(b.patientId, {
          patientId: b.patientId,
          patientName: b.patientName,
          billsCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalBalance: 0,
          bills: []
        });
      }
      const record = map.get(b.patientId);
      record.billsCount += 1;
      record.totalBilled += Number(b.total) || 0;
      record.totalPaid += Number(b.paid) || 0;
      record.totalBalance += Number(b.balance) || 0;
      record.bills.push(b);
    });
    return Array.from(map.values());
  }, [bills]);

  const selectedPatientDeleteDetails = useMemo(() => {
    if (!selectedPatientIdForDelete) return null;
    return patientsWithBills.find((p) => p.patientId === selectedPatientIdForDelete);
  }, [selectedPatientIdForDelete, patientsWithBills]);

  // Handle Edit Bill
  const handleOpenEdit = (bill) => {
    setEditingBill(bill);
    setEditFormData({
      paid: bill.paid || 0,
      paymentMethod: bill.paymentMethod || 'UPI',
      paymentStatus: bill.paymentStatus || 'Paid',
      discount: bill.discount || 0
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBill) return;
    try {
      const discountNum = Number(editFormData.discount) || 0;
      const isDiscountAdded = discountNum > 0;
      const res = await api.updateBill(editingBill.billId, {
        paid: isDiscountAdded ? Math.max(Number(editFormData.paid), Math.max(0, editingBill.total - discountNum)) : Number(editFormData.paid),
        paymentMethod: editFormData.paymentMethod,
        paymentStatus: isDiscountAdded ? 'Paid' : editFormData.paymentStatus,
        discount: discountNum
      });
      if (res.success) {
        showToast(`Invoice ${editingBill.invoiceNumber} updated successfully`, 'success');
        setEditModalOpen(false);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update invoice', 'error');
    }
  };

  // Handle Delete Single Bill
  const handleConfirmDeleteBill = async () => {
    if (!billToDelete) return;
    try {
      setDeletingBill(true);
      const res = await api.deleteBill(billToDelete.billId);
      if (res.success) {
        showToast(`Invoice ${billToDelete.invoiceNumber} deleted from system`, 'success');
        setDeleteBillModalOpen(false);
        setBillToDelete(null);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete bill', 'error');
    } finally {
      setDeletingBill(false);
    }
  };

  // Handle Delete Total Bills for Patient
  const handleConfirmDeletePatientBills = async () => {
    if (!selectedPatientIdForDelete) {
      showToast('Please select a patient to delete bills', 'error');
      return;
    }
    try {
      setDeletingPatientBills(true);
      const res = await api.deletePatientBills(selectedPatientIdForDelete);
      if (res.success) {
        showToast(
          `Successfully deleted ${res.data.deletedCount} bill(s) (₹${res.data.totalAmount.toLocaleString()}) for patient ${selectedPatientIdForDelete}`,
          'success'
        );
        setDeletePatientBillsModalOpen(false);
        setSelectedPatientIdForDelete('');
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete patient bills', 'error');
    } finally {
      setDeletingPatientBills(false);
    }
  };

  // Action badge helper for audit logs
  const renderLogActionBadge = (action) => {
    switch (action) {
      case 'GENERATED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#DCFCE7',
              color: '#15803D',
              border: '1px solid #BBF7D0',
              display: 'inline-block'
            }}
          >
            GENERATED
          </span>
        );
      case 'EDITED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#E0F2FE',
              color: '#0369A1',
              border: '1px solid #BAE6FD',
              display: 'inline-block'
            }}
          >
            EDITED
          </span>
        );
      case 'PAYMENT_UPDATED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE',
              display: 'inline-block'
            }}
          >
            PAYMENT
          </span>
        );
      case 'DELETED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
              display: 'inline-block'
            }}
          >
            DELETED
          </span>
        );
      case 'PATIENT_BILLS_DELETED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#FEE2E2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
              display: 'inline-block'
            }}
          >
            TOTAL BILL DELETED
          </span>
        );
      case 'LINK_GENERATED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF', display: 'inline-block' }}>
            LINK GENERATED
          </span>
        );
      case 'LINK_ACCESSED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', display: 'inline-block' }}>
            LINK ACCESSED
          </span>
        );
      case 'LINK_REVOKED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA', display: 'inline-block' }}>
            LINK REVOKED
          </span>
        );
      case 'WHATSAPP_SENT':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#CCFBF1', color: '#0F766E', border: '1px solid #99F6E4', display: 'inline-block' }}>
            WHATSAPP SENT
          </span>
        );
      case 'WHATSAPP_RETRIED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', display: 'inline-block' }}>
            WHATSAPP RETRIED
          </span>
        );
      case 'WHATSAPP_FAILED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', display: 'inline-block' }}>
            WHATSAPP FAILED
          </span>
        );
      case 'VISIT_COMPLETED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', display: 'inline-block' }}>
            VISIT COMPLETED
          </span>
        );
      case 'PATIENT_REGISTERED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', display: 'inline-block' }}>
            PATIENT REGISTERED
          </span>
        );
      case 'SETTINGS_UPDATED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', display: 'inline-block' }}>
            SETTINGS UPDATED
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#F1F5F9',
              color: '#475569',
              display: 'inline-block'
            }}
          >
            {action}
          </span>
        );
    }
  };

  // Table Columns for Invoices
  const invoiceColumns = [
    {
      header: 'Invoice #',
      render: (row) => (
        <span
          style={{
            fontWeight: 800,
            color: 'var(--role-admin-primary)',
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
          {row.patientPhone && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              📞 {row.patientPhone}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Attending Doctor',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.doctorName || 'Dr. Assigned'}</div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {row.doctorSpecialization || 'Specialist'}
          </span>
        </div>
      )
    },
    {
      header: 'Date',
      render: (row) => (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }) : '-'}
        </div>
      )
    },
    {
      header: 'Total Amount',
      render: (row) => (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 800 }}>₹{row.total?.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Paid: ₹{row.paid?.toLocaleString()}{' '}
            {row.balance > 0 ? (
              <span style={{ color: '#DC2626', fontWeight: 600 }}>
                (Bal: ₹{row.balance?.toLocaleString()})
              </span>
            ) : (
              <span style={{ color: '#16A34A' }}>(Cleared)</span>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Payment Method',
      render: (row) => (
        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{row.paymentMethod || 'UPI'}</span>
      )
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.paymentStatus} />
    },
    {
      header: 'WhatsApp & Link Access',
      render: (row) => {
        const msg = row.whatsappMessage;
        const link = row.activeLink;
        const hasActiveLink = Boolean(link?.url);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {msg ? (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: msg.status === 'Sent' || msg.status === 'Delivered' ? '#DCFCE7' : (msg.status === 'Pending' ? '#FEF3C7' : '#FEE2E2'),
                    color: msg.status === 'Sent' || msg.status === 'Delivered' ? '#166534' : (msg.status === 'Pending' ? '#92400E' : '#991B1B')
                  }}
                  title={msg.failureReason || `Sent to ${msg.recipientPhone}`}
                >
                  {msg.status}
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  {row.patientWhatsappConsent === false ? 'No Consent' : 'Not Sent'}
                </span>
              )}

              {hasActiveLink && (
                <button
                  type="button"
                  onClick={() => handleCopyLink(link.url)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                  title="Copy Secure UUID Bill Link"
                >
                  <Copy size={11} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleOpenLinkModal(row)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                title="Manage Bill Links & Revocation"
              >
                <Link size={10} /> {hasActiveLink ? 'Manage Link' : 'Create Link'}
              </button>

              {msg?.status === 'Failed' && (
                <button
                  type="button"
                  onClick={() => handleRetryWhatsApp(msg.id)}
                  disabled={actionLoading}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.7rem', color: '#DC2626', borderColor: '#FECACA' }}
                  title="Retry Failed WhatsApp"
                >
                  <RefreshCw size={10} />
                </button>
              )}
            </div>
          </div>
        );
      }
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
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Preview & Print Tax Invoice"
          >
            <Printer size={13} /> Bill
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Edit Bill & Payment"
          >
            <Edit size={13} /> Edit
          </button>
          <button
            onClick={() => {
              setBillToDelete(row);
              setDeleteBillModalOpen(true);
            }}
            className="btn btn-danger btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Delete this Bill"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )
    }
  ];

  // Table Columns for Logs
  const logColumns = [
    {
      header: 'Timestamp',
      render: (row) => (
        <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600 }}>
            {new Date(row.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            {new Date(row.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })}
          </div>
        </div>
      )
    },
    {
      header: 'Action',
      render: (row) => renderLogActionBadge(row.action)
    },
    {
      header: 'Invoice #',
      render: (row) => (
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--role-admin-primary)' }}>
          {row.invoiceNumber || 'Multiple / All'}
        </span>
      )
    },
    {
      header: 'Patient Details',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{row.patientName || 'N/A'}</div>
          {row.patientId && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              ID: {row.patientId}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Amount',
      render: (row) => (
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
          {row.total !== null && row.total !== undefined ? `₹${row.total.toLocaleString()}` : '-'}
        </span>
      )
    },
    {
      header: 'Audit Description / Details',
      render: (row) => (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: '350px' }}>
          {row.details}
        </div>
      )
    },
    {
      header: 'Performed By',
      render: (row) => (
        <div style={{ fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 600 }}>{row.user?.name || 'System'}</div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
            {row.user?.role || 'SYSTEM'}
          </span>
        </div>
      )
    }
  ];

  if (loading && bills.length === 0 && logs.length === 0) {
    return <LoadingState message="Loading Billing Management & Audit Records..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* HEADER SECTION */}
      <div className="v-card">
        <div className="v-card-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={22} color="var(--role-admin-primary)" />
              Billing Management & Financial Audit
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Complete control of patient invoices, payment status, real-time audit logs, and patient total bill deletion.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchData}
              className="btn btn-secondary btn-sm"
              title="Refresh all billing data and logs"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => {
                setSelectedPatientIdForDelete('');
                setDeletePatientBillsModalOpen(true);
              }}
              className="btn btn-danger btn-sm"
              style={{ fontWeight: 700 }}
              title="Delete all bills for a specific patient"
            >
              <Trash2 size={14} /> Delete Total Bill for Patient
            </button>
          </div>
        </div>

        {/* SUMMARY STAT METRICS */}
        <div className="stat-grid" style={{ marginTop: '16px' }}>
          <StatCard
            label="Total Invoiced"
            value={`₹${totalBilled.toLocaleString()}`}
            subtext={`${bills.length} total bills created`}
            icon={IndianRupee}
            role="admin"
          />
          <StatCard
            label="Total Collected"
            value={`₹${totalCollected.toLocaleString()}`}
            subtext="Payments cleared into clinic account"
            icon={CheckCircle2}
            role="admin"
          />
          <StatCard
            label="Outstanding Balance"
            value={`₹${totalOutstanding.toLocaleString()}`}
            subtext="Pending payment from patients"
            icon={AlertTriangle}
            role="admin"
          />
          <StatCard
            label="Audit Log Entries"
            value={logs.length}
            subtext="Tracked billing generation & edits"
            icon={History}
            role="admin"
          />
        </div>
      </div>

      {/* TAB NAVIGATION & DATA TABLE */}
      <div className="v-card">
        {/* TABS HEADER */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '14px',
            marginBottom: '16px'
          }}
        >
          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'invoices' ? '2px solid var(--role-admin-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: activeTab === 'invoices' ? 'var(--role-admin-primary)' : '#FFFFFF',
              color: activeTab === 'invoices' ? '#FFFFFF' : 'var(--text-main)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={16} /> All Invoices & Bills ({bills.length})
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'logs' ? '2px solid var(--role-admin-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: activeTab === 'logs' ? 'var(--role-admin-primary)' : '#FFFFFF',
              color: activeTab === 'logs' ? '#FFFFFF' : 'var(--text-main)',
              transition: 'all 0.2s ease'
            }}
          >
            <History size={16} /> Billing Audit & Change Logs ({logs.length})
          </button>
        </div>

        {/* TAB CONTENT: INVOICES */}
        {activeTab === 'invoices' && (
          <div>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Viewing all patient billing records, tax invoices, and payment statuses.
              </span>
            </div>

            <DataTable
              columns={invoiceColumns}
              data={bills}
              searchPlaceholder="Search invoices by number, patient name, doctor, phone..."
              loading={loading}
              emptyMessage="No billing records found in the clinic database"
            />
          </div>
        )}

        {/* TAB CONTENT: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Live, immutable audit trail tracking all bills generated, edited, payments updated, and deletions.
              </span>
            </div>

            <DataTable
              columns={logColumns}
              data={logs}
              searchPlaceholder="Search audit logs by invoice #, patient, action, details..."
              loading={loading}
              emptyMessage="No billing action logs recorded yet"
            />
          </div>
        )}
      </div>

      {/* MODAL: DELETE TOTAL BILL FOR PATIENT */}
      <Modal
        isOpen={deletePatientBillsModalOpen}
        onClose={() => setDeletePatientBillsModalOpen(false)}
        title="Delete Total Bill for Patient"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDeletePatientBillsModalOpen(false)}
              disabled={deletingPatientBills}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleConfirmDeletePatientBills}
              disabled={!selectedPatientIdForDelete || deletingPatientBills}
              style={{ fontWeight: 700 }}
            >
              {deletingPatientBills ? 'Deleting Bills...' : 'Confirm Total Bill Deletion'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #F87171',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <ShieldAlert size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.875rem' }}>
                Permanent Total Bill Deletion Warning
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#B91C1C', fontSize: '0.8rem', lineHeight: '1.4' }}>
                This action will delete <strong>ALL bills and invoices</strong> associated with the selected patient from the system.
                The patient record itself will remain intact, but all billing and financial history will be purged. This action is permanently logged in the audit trail.
              </p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Patient with Bills *</label>
            <select
              className="form-select"
              value={selectedPatientIdForDelete}
              onChange={(e) => setSelectedPatientIdForDelete(e.target.value)}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patientsWithBills.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.patientName} ({p.patientId}) - {p.billsCount} bill(s), Total: ₹{p.totalBilled.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {selectedPatientDeleteDetails && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Billing Summary for {selectedPatientDeleteDetails.patientName} ({selectedPatientDeleteDetails.patientId}):
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total Bills</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--role-admin-primary)' }}>
                    {selectedPatientDeleteDetails.billsCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cumulative Amount</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#DC2626' }}>
                    ₹{selectedPatientDeleteDetails.totalBilled.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total Paid</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16A34A' }}>
                    ₹{selectedPatientDeleteDetails.totalPaid.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Invoices to be purged:</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {selectedPatientDeleteDetails.bills.map((b) => (
                    <li key={b.billId} style={{ marginBottom: '4px' }}>
                      <strong>{b.invoiceNumber}</strong>: ₹{b.total?.toLocaleString()} ({b.paymentStatus}) &bull;{' '}
                      {new Date(b.createdAt).toLocaleDateString('en-IN')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: EDIT BILL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={editingBill ? `Edit Invoice: ${editingBill.invoiceNumber}` : 'Edit Bill'}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-admin btn-sm"
              onClick={handleSaveEdit}
            >
              Save Changes
            </button>
          </>
        }
      >
        {editingBill && (
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: '#F8FAFC',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{editingBill.patientName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Patient ID: {editingBill.patientId} &bull; Doctor: {editingBill.doctorName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Invoice Total</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--role-admin-primary)' }}>
                  ₹{editingBill.total?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <SelectInput
                label="Payment Status"
                name="paymentStatus"
                value={editFormData.paymentStatus}
                onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value })}
                options={['Paid', 'Partially Paid', 'Pending']}
                required
              />
              <SelectInput
                label="Payment Method"
                name="paymentMethod"
                value={editFormData.paymentMethod}
                onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                options={['UPI', 'Cash', 'Card', 'Other']}
                required
              />
            </div>

            <div className="form-grid-2">
              <FormInput
                label="Paid Amount (₹)"
                name="paid"
                type="number"
                value={editFormData.paid}
                onChange={(e) => setEditFormData({ ...editFormData, paid: e.target.value })}
                helperText={`Balance: ₹${Math.max(0, editingBill.total - Number(editFormData.paid)).toLocaleString()}`}
              />
              <FormInput
                label="Discount (₹)"
                name="discount"
                type="number"
                value={editFormData.discount}
                onChange={(e) => setEditFormData({ ...editFormData, discount: e.target.value })}
              />
            </div>
          </form>
        )}
      </Modal>

      {/* CONFIRMATION MODAL: DELETE SINGLE BILL */}
      <ConfirmationModal
        isOpen={deleteBillModalOpen}
        onClose={() => {
          setDeleteBillModalOpen(false);
          setBillToDelete(null);
        }}
        onConfirm={handleConfirmDeleteBill}
        title="Delete Bill & Invoice"
        message={
          billToDelete
            ? `Are you sure you want to delete invoice "${billToDelete.invoiceNumber}" for patient "${billToDelete.patientName}" (₹${billToDelete.total?.toLocaleString()})? This action will permanently remove this invoice and record an audit log.`
            : 'Are you sure you want to delete this bill?'
        }
        confirmText="Delete Invoice"
        isDestructive={true}
        loading={deletingBill}
      />

      {/* MODAL: INVOICE PREVIEW & PRINT */}
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

      {/* SECURE UUID BILL LINK & WHATSAPP MODAL */}
      <Modal
        isOpen={linkModalOpen}
        onClose={() => {
          setLinkModalOpen(false);
          setSelectedBillForLinks(null);
        }}
        title={`Secure UUID Bill Access • ${selectedBillForLinks?.invoiceNumber || 'Bill Link'}`}
        size="lg"
      >
        {selectedBillForLinks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{selectedBillForLinks.patientName}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Invoice: {selectedBillForLinks.invoiceNumber} &bull; Total: ₹{selectedBillForLinks.total?.toLocaleString()} &bull; Phone: {selectedBillForLinks.patientPhone}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateNewLink(selectedBillForLinks.billId)}
                disabled={actionLoading}
                className="btn btn-admin btn-sm"
              >
                <Plus size={13} /> Generate New UUID Link
              </button>
            </div>

            {/* WHATSAPP MESSAGE STATUS */}
            {selectedBillForLinks.whatsappMessage && (
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: selectedBillForLinks.whatsappMessage.status === 'Sent' || selectedBillForLinks.whatsappMessage.status === 'Delivered'
                    ? '#F0FDF4'
                    : (selectedBillForLinks.whatsappMessage.status === 'Pending' ? '#FEF3C7' : '#FEF2F2'),
                  border: `1px solid ${
                    selectedBillForLinks.whatsappMessage.status === 'Sent' || selectedBillForLinks.whatsappMessage.status === 'Delivered'
                      ? '#BBF7D0'
                      : (selectedBillForLinks.whatsappMessage.status === 'Pending' ? '#FDE68A' : '#FECACA')
                  }`,
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      WhatsApp Status: <strong>{selectedBillForLinks.whatsappMessage.status}</strong>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      to {selectedBillForLinks.whatsappMessage.recipientPhone}
                    </span>
                  </div>
                  {selectedBillForLinks.whatsappMessage.status === 'Failed' && (
                    <button
                      type="button"
                      onClick={() => handleRetryWhatsApp(selectedBillForLinks.whatsappMessage.id)}
                      disabled={actionLoading}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#DC2626', borderColor: '#FECACA' }}
                    >
                      <RefreshCw size={13} /> Retry WhatsApp Dispatch
                    </button>
                  )}
                </div>
                {selectedBillForLinks.whatsappMessage.failureReason && (
                  <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '6px' }}>
                    Failure Reason: {selectedBillForLinks.whatsappMessage.failureReason}
                  </div>
                )}
              </div>
            )}

            {/* LINKS LIST */}
            <div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 10px 0' }}>
                Cryptographically Secure Bill-Sharing Links
              </h4>
              {loadingLinks ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>Loading link security data...</div>
              ) : billLinks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                  No bill sharing link generated yet. Click "Generate New UUID Link" above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {billLinks.map((lnk) => {
                    const isRevoked = lnk.status === 'Revoked';
                    const isExpired = lnk.isExpired || lnk.status === 'Expired';
                    const isActive = !isRevoked && !isExpired;
                    return (
                      <div
                        key={lnk.id}
                        style={{
                          padding: '12px 14px',
                          border: `1px solid ${isActive ? '#BBF7D0' : '#E2E8F0'}`,
                          backgroundColor: isActive ? '#F0FDF4' : '#F8FAFC',
                          borderRadius: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: isActive ? '#DCFCE7' : (isRevoked ? '#FEE2E2' : '#F1F5F9'),
                                color: isActive ? '#166534' : (isRevoked ? '#991B1B' : '#475569')
                              }}
                            >
                              {isActive ? 'ACTIVE' : (isRevoked ? 'REVOKED' : 'EXPIRED')}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                              Created: {new Date(lnk.createdAt).toLocaleDateString()} &bull; Expires: {new Date(lnk.expiresAt).toLocaleDateString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              (Accessed: {lnk.accessCount || 0} times)
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {isActive && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(lnk.url)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  title="Copy secure link to clipboard"
                                >
                                  <Copy size={12} /> Copy URL
                                </button>
                                <a
                                  href={lnk.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem', textDecoration: 'none' }}
                                  title="Open patient bill view in new tab"
                                >
                                  <ExternalLink size={12} /> Open View
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeLink(lnk.id, selectedBillForLinks.billId)}
                                  disabled={actionLoading}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#DC2626', borderColor: '#FECACA' }}
                                  title="Revoke this link immediately"
                                >
                                  <Lock size={12} /> Revoke Link
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isActive && (
                          <div
                            style={{
                              backgroundColor: '#FFFFFF',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              color: '#334155'
                            }}
                          >
                            {lnk.url}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.5 }}>
              <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: '#16A34A' }} />
              UUID tokens are unguessable and 128-bit cryptographically secure. Revoked or expired links immediately block patient bill viewing.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminBillingManagementPage;
