import { forwardRef } from 'react';

const Input = forwardRef(({
  className = '',
  label,
  error,
  id,
  ...props
}, ref) => {
  const inputClasses = `form-group input ${error ? 'error' : ''} ${className}`.trim();
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={inputClasses}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className="form-input"
        {...props}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;