import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Save,
  CheckCircle2,
  Clock,
  FileCheck,
  Server,
  Lock,
  CalendarCheck
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { FormInput } from '../../components/common/FormInput';

const AdminSettingsPage = () => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  // Front Desk & Clinical Rules
  const [autoCompleteAppointments, setAutoCompleteAppointments] = useState(true);
  const [enforceWorkingHours, setEnforceWorkingHours] = useState(true);
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [defaultSlotDuration, setDefaultSlotDuration] = useState(15);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('viora_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.autoCompleteAppointments !== undefined) setAutoCompleteAppointments(parsed.autoCompleteAppointments);
        if (parsed.enforceWorkingHours !== undefined) setEnforceWorkingHours(parsed.enforceWorkingHours);
        if (parsed.autoGenerateInvoice !== undefined) setAutoGenerateInvoice(parsed.autoGenerateInvoice);
        if (parsed.defaultSlotDuration !== undefined) setDefaultSlotDuration(parsed.defaultSlotDuration);
      }
    } catch (e) {
      console.error('Failed to load local admin preferences', e);
    }
  }, []);

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      localStorage.setItem('viora_admin_settings', JSON.stringify({
        autoCompleteAppointments,
        enforceWorkingHours,
        autoGenerateInvoice,
        defaultSlotDuration
      }));
      showToast('VIORA system preferences saved successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* HEADER */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              System Preferences & Settings
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Configure clinical workflows, appointment scheduling policies, and system preferences.
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn btn-admin"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* SECTION 1: FRONT DESK & CLINICAL RULES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--role-admin-primary)',
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
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--role-admin-primary)', margin: 0 }}>
                Front Desk & Clinical Rules
              </h3>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Auto-mark appointment Completed on consultation save</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Automatically update patient queue status to "Completed" when doctor saves consultation RX
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoCompleteAppointments}
                onChange={(e) => setAutoCompleteAppointments(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enforce strict doctor working hours</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Prevent front desk staff from booking appointments outside configured shift hours or during breaks
                </div>
              </div>
              <input
                type="checkbox"
                checked={enforceWorkingHours}
                onChange={(e) => setEnforceWorkingHours(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Auto-generate final invoice upon visit completion</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Instantly compute consultation and procedure charges and create tax invoice when ending visit
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoGenerateInvoice}
                onChange={(e) => setAutoGenerateInvoice(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)' }}
              />
            </div>

            <div className="form-grid-2">
              <FormInput
                label="Default Consultation Slot Duration (Minutes)"
                name="defaultSlotDuration"
                type="number"
                min="5"
                max="60"
                step="5"
                value={defaultSlotDuration}
                onChange={(e) => setDefaultSlotDuration(Number(e.target.value))}
                helperText="Standard appointment booking slot size used for calendar grids"
                required
              />
            </div>
          </div>

          {/* SECTION 2: BACKEND INTEGRATION & WHATSAPP ARCHITECTURE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--role-admin-primary)',
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
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--role-admin-primary)', margin: 0 }}>
                Backend WhatsApp & Security Architecture
              </h3>
            </div>

            <div
              style={{
                padding: '16px',
                backgroundColor: '#F0FDF4',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #BBF7D0',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <Server size={22} color="#16A34A" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>
                  WhatsApp Handled Server-Side
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#15803D', lineHeight: 1.5 }}>
                  Meta WhatsApp Business API credentials (API URL, Phone Number ID, Access Token, and Webhook verification) are managed directly on the backend server environment (<code style={{ backgroundColor: '#DCFCE7', padding: '2px 4px', borderRadius: '4px' }}>.env</code>). WhatsApp message dispatches, cryptographic UUID bill links, retry mechanisms, and delivery status tracking execute seamlessly server-side without exposing API credentials to client browsers.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'var(--role-admin-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #C7D2FE',
                fontSize: '0.82rem',
                color: 'var(--role-admin-primary)',
                lineHeight: 1.6
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} /> Active Security & RBAC Enforcement Policies:
              </div>
              <div>&bull; <strong>JWT Token Security:</strong> Cryptographic token verification enforced across all internal API endpoints.</div>
              <div>&bull; <strong>Data Privacy & Isolation:</strong> Doctor Clinical Remarks & Private Notes are strictly hidden from Front Desk / Staff APIs.</div>
              <div>&bull; <strong>Zero-Trust Bill Links:</strong> Patient bills utilize 128-bit UUID v4 tokens with automated expiry and zero account credential requirements.</div>
              <div>&bull; <strong>System Audit Trail:</strong> High-priority clinical events (registrations, visit completions, link access, and retries) are logged with secret redaction.</div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AdminSettingsPage;