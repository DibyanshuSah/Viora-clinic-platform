import React from 'react';

export const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helperText,
  icon: Icon,
  min,
  max,
  step
}) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        {Icon && (
          <Icon
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          />
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value !== undefined && value !== null ? value : ''}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className="form-input"
          style={{
            paddingLeft: Icon ? '36px' : '12px',
            borderColor: error ? 'var(--status-danger-text)' : undefined
          }}
        />
      </div>
      {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger-text)', fontWeight: 500 }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>}
    </div>
  );
};

export const SelectInput = ({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  error,
  helperText,
  placeholder = 'Select option...'
}) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value !== undefined && value !== null ? value : ''}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="form-select"
        style={{
          borderColor: error ? 'var(--status-danger-text)' : undefined
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt, idx) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={idx} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger-text)', fontWeight: 500 }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>}
    </div>
  );
};

export const TextareaInput = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false,
  disabled = false,
  error,
  helperText
}) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        rows={rows}
        value={value !== undefined && value !== null ? value : ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="form-textarea"
        style={{
          borderColor: error ? 'var(--status-danger-text)' : undefined
        }}
      />
      {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger-text)', fontWeight: 500 }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>}
    </div>
  );
};
