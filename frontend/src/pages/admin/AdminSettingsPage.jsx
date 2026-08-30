import React, { useState } from 'react';
import { Settings, Shield, Bell, Database, Lock, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const AdminSettingsPage = () => {
  const { showToast } = useToast();
  const [currency, setCurrency] = useState('₹');
  const [taxRate, setTaxRate] = useState(0);
  const [autoCompleteAppointments, setAutoCompleteAppointments] = useState(true);
  const [allowOverbooking, setAllowOverbooking] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    showToast('VIORA system preferences saved successfully', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              System Preferences & Security Settings
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Configure appointment booking policies, billing defaults, and access controls.
            </p>
          </div>
          <button onClick={handleSave} className="btn btn-admin">
            <Save size={16} /> Save Settings
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)' }}>
              1. Front Desk & Billing Rules
            </h4>
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
                  Automatically update patient queue status from "Waiting" / "In Consultation" to "Completed" when doctor saves RX
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoCompleteAppointments}
                onChange={(e) => setAutoCompleteAppointments(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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
                checked={!allowOverbooking}
                onChange={(e) => setAllowOverbooking(!e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px' }}>
              2. Branding & Clinic Visual Identity
            </h4>
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
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Upload Brand Picture / Logo</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Upload a custom image file to replace the default VIORA badge in Header, Sidebar, Invoices, and Prescriptions.
                </div>
              </div>
              <a
                href="/admin/clinic-profile"
                className="btn btn-admin btn-sm"
              >
                Upload Picture
              </a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--role-admin-primary)', marginBottom: '12px' }}>
              3. Security & RBAC Enforcement Status
            </h4>
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
              <div>&bull; Backend JWT token authentication active.</div>
              <div>&bull; Doctor Private Notes are strictly hidden from Front Desk / Staff role APIs.</div>
              <div>&bull; Financial analytics & staff salaries accessible exclusively by Admin role.</div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
