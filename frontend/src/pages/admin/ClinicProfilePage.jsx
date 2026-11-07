import React, { useState, useEffect, useRef } from 'react';
import { Building2, Save, Upload, Trash2, Image, CheckCircle2, Globe, Phone, Mail, FileText, RotateCcw } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useToast } from '../../context/ToastContext';
import { FormInput } from '../../components/common/FormInput';

const ClinicProfilePage = () => {
  const { clinic, updateClinic } = useClinic();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    clinicName: clinic?.clinicName || 'VIORA',
    tagline: clinic?.tagline || '',
    logoUrl: clinic?.logoUrl || '',
    address: clinic?.address || '',
    city: clinic?.city || '',
    state: clinic?.state || '',
    pinCode: clinic?.pinCode || '',
    contactNumber: clinic?.contactNumber || '',
    email: clinic?.email || '',
    website: clinic?.website || '',
    registrationNumber: clinic?.registrationNumber || '',
    gstNumber: clinic?.gstNumber || '',
    openingTime: clinic?.openingTime || '08:00 AM',
    closingTime: clinic?.closingTime || '08:00 PM',
    currency: clinic?.currency || '₹'
  });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Sync state whenever clinic profile loads/updates from backend
  useEffect(() => {
    if (clinic) {
      setFormData({
        clinicName: clinic.clinicName || 'VIORA',
        tagline: clinic.tagline || '',
        logoUrl: clinic.logoUrl || '',
        address: clinic.address || '',
        city: clinic.city || '',
        state: clinic.state || '',
        pinCode: clinic.pinCode || '',
        contactNumber: clinic.contactNumber || '',
        email: clinic.email || '',
        website: clinic.website || '',
        registrationNumber: clinic.registrationNumber || '',
        gstNumber: clinic.gstNumber || '',
        openingTime: clinic.openingTime || '08:00 AM',
        closingTime: clinic.closingTime || '08:00 PM',
        currency: clinic.currency || '₹'
      });
    }
  }, [clinic]);

  // Handle local image file upload & convert to base64 Data URL
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const processImageFile = (file) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result;
      setFormData((prev) => ({ ...prev, logoUrl: base64Url }));
      showToast('Image uploaded successfully! Click Save to apply.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Image removed. Default brand badge will be used.', 'info');
  };

  const handleCancel = () => {
    if (clinic) {
      setFormData({
        clinicName: clinic.clinicName || 'VIORA',
        tagline: clinic.tagline || '',
        logoUrl: clinic.logoUrl || '',
        address: clinic.address || '',
        city: clinic.city || '',
        state: clinic.state || '',
        pinCode: clinic.pinCode || '',
        contactNumber: clinic.contactNumber || '',
        email: clinic.email || '',
        website: clinic.website || '',
        registrationNumber: clinic.registrationNumber || '',
        gstNumber: clinic.gstNumber || '',
        openingTime: clinic.openingTime || '08:00 AM',
        closingTime: clinic.closingTime || '08:00 PM',
        currency: clinic.currency || '₹'
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      showToast('Unsaved changes discarded', 'info');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateClinic(formData);
      showToast('VIORA clinic profile and logo picture updated successfully across all workspaces, invoices & RX.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update clinic profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div className="v-card">
        {/* HEADER (Informational only — action buttons placed at bottom of form) */}
        <div className="v-card-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={22} color="var(--role-admin-primary)" />
              VIORA Clinic Profile & Official Brand Identity
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Configure your clinic branding, contact points, location, and regulatory details. Saved changes update invoices, prescriptions, and navigation headers.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* SECTION 1: PROFILE INFORMATION */}
          <div>
            <h4 className="form-section-title">
              1. Profile Information & Brand Identity
            </h4>

            <div className="grid-two-column" style={{ marginBottom: '16px' }}>
              {/* DRAG & DROP UPLOAD BOX */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--role-admin-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '24px 20px',
                  textAlign: 'center',
                  backgroundColor: dragOver ? 'var(--role-admin-bg)' : 'var(--bg-app)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--role-admin-bg)',
                    color: 'var(--role-admin-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Upload size={22} />
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Click to upload picture or drag and drop
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    PNG, JPG, SVG, WebP (Max 5MB)
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Image size={14} /> Browse Image File
                </button>
              </div>

              {/* LIVE BRANDING PREVIEW CARD */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Live Preview in System
                  </span>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      <Trash2 size={12} /> Remove Picture
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Uploaded VIORA Logo"
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        border: '2px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-sidebar)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '2rem',
                        flexShrink: 0
                      }}
                    >
                      V
                    </div>
                  )}

                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      VIORA
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 4px 0' }}>
                      {formData.tagline || 'Clinic Tagline'}
                    </p>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: formData.logoUrl ? 'var(--status-available-text)' : 'var(--text-muted)',
                        backgroundColor: formData.logoUrl ? 'var(--status-available-bg)' : '#F1F5F9',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {formData.logoUrl ? 'Custom Picture Active' : 'Default Brand Symbol'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <FormInput
                label="Clinic Name"
                name="clinicName"
                value="VIORA"
                disabled
                helperText="Brand name fixed as VIORA across system"
              />
              <FormInput
                label="Tagline / Department"
                name="tagline"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="Enter clinic tagline"
              />
            </div>
          </div>

          {/* SECTION 2: CONTACT INFORMATION */}
          <div>
            <h4 className="form-section-title">
              2. Contact Information
            </h4>
            <div className="form-grid-3">
              <FormInput
                label="Contact Phone"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="Enter contact phone"
              />
              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter clinic email"
              />
              <FormInput
                label="Website URL"
                name="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="Enter website URL"
              />
            </div>
          </div>

          {/* SECTION 3: PHYSICAL LOCATION */}
          <div>
            <h4 className="form-section-title">
              3. Physical Location
            </h4>
            <div className="form-group">
              <label className="form-label" htmlFor="clinic-address">Street Address</label>
              <input
                id="clinic-address"
                className="form-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter clinic street address"
              />
            </div>

            <div className="form-grid-3">
              <FormInput
                label="City"
                name="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Enter city"
              />
              <FormInput
                label="State"
                name="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Enter state"
              />
              <FormInput
                label="Postal PIN Code"
                name="pinCode"
                value={formData.pinCode}
                onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                placeholder="Enter PIN code"
              />
            </div>
          </div>

          {/* SECTION 4: OTHER PROFILE SETTINGS */}
          <div>
            <h4 className="form-section-title">
              4. Other Profile Settings & Compliance
            </h4>
            <div className="form-grid-4">
              <FormInput
                label="Medical Registration No."
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                placeholder="Enter registration number"
              />
              <FormInput
                label="GSTIN Number"
                name="gstNumber"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="Enter GSTIN number"
              />
              <FormInput
                label="Clinic Opening Time"
                name="openingTime"
                value={formData.openingTime}
                onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                placeholder="e.g. 08:00 AM"
              />
              <FormInput
                label="Clinic Closing Time"
                name="closingTime"
                value={formData.closingTime}
                onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                placeholder="e.g. 08:00 PM"
              />
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
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              disabled={saving}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClinicProfilePage;
