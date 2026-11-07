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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={22} color="var(--role-admin-primary)" />
              System Preferences & Rules
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Configure clinical workflows, appointment scheduling policies, and system preferences.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECTION 1: FRONT DESK & CLINICAL RULES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 className="form-section-title">
              1. Front Desk & Clinical Workflow Rules
            </h4>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                gap: '16px'
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
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)', flexShrink: 0 }}
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
                border: '1px solid var(--border-subtle)',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enforce doctor shift hours during booking</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Prevent appointment scheduling outside configured doctor working shifts or scheduled breaks
                </div>
              </div>
              <input
                type="checkbox"
                checked={enforceWorkingHours}
                onChange={(e) => setEnforceWorkingHours(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)', flexShrink: 0 }}
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
                border: '1px solid var(--border-subtle)',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Auto-generate final invoice upon visit completion</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Compute consultation and procedure charges and create tax invoice when ending visit
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoGenerateInvoice}
                onChange={(e) => setAutoGenerateInvoice(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--role-admin-primary)', flexShrink: 0 }}
              />
            </div>

            <div className="form-grid-2">
              <FormInput
                label="Default Slot Duration (Minutes)"
                name="defaultSlotDuration"
                type="number"
                min="5"
                max="60"
                step="5"
                value={defaultSlotDuration}
                onChange={(e) => setDefaultSlotDuration(Number(e.target.value))}
                helperText="Standard appointment slot duration on calendar rosters"
                required
              />
            </div>
          </div>

          {/* SECTION 2: MESSAGING & SECURITY ARCHITECTURE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 className="form-section-title">
              2. Messaging & Security Architecture
            </h4>

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
              <Server size={20} color="#16A34A" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534' }}>
                  Server-Managed WhatsApp Integration
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#15803D', lineHeight: 1.5 }}>
                  Meta WhatsApp Business Cloud API credentials, webhook verifications, and cryptographic bill links are managed server-side. Outbound delivery status tracking and retries execute securely without client credential exposure.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'var(--role-admin-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--role-admin-border)',
                fontSize: '0.82rem',
                color: 'var(--role-admin-primary)',
                lineHeight: 1.6
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} /> Active Access & Data Privacy Safeguards:
              </div>
              <div>&bull; <strong>Role-Based Access Control:</strong> Strict separation between Administrator, Doctor, and Front Desk workflows.</div>
              <div>&bull; <strong>Clinical Privacy:</strong> Physician private notes and clinical remarks remain restricted to attending medical staff.</div>
              <div>&bull; <strong>Secure Bill Links:</strong> Patient access links utilize cryptographic UUID tokens with automatic time expiration.</div>
              <div>&bull; <strong>Audit Logging:</strong> All billing creations, revisions, and status transitions are recorded with user attribution.</div>
            </div>
          </div>

          {/* BOTTOM FORM ACTIONS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => {
                try {
                  const saved = localStorage.getItem('viora_admin_settings');
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.autoCompleteAppointments !== undefined) setAutoCompleteAppointments(parsed.autoCompleteAppointments);
                    if (parsed.enforceWorkingHours !== undefined) setEnforceWorkingHours(parsed.enforceWorkingHours);
                    if (parsed.autoGenerateInvoice !== undefined) setAutoGenerateInvoice(parsed.autoGenerateInvoice);
                    if (parsed.defaultSlotDuration !== undefined) setDefaultSlotDuration(parsed.defaultSlotDuration);
                  }
                  showToast('Settings reset to saved configuration', 'info');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="btn btn-secondary"
              disabled={saving}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              disabled={saving}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
