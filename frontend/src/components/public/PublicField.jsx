function getOptions(options) {
  return (Array.isArray(options) ? options : []).map((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return { label: String(option), value: String(option) }
    }
    const value = String(option?.value ?? option?.label ?? '')
    return { label: String(option?.label ?? option?.value ?? ''), value }
  })
}

function FieldLabel({ field, htmlFor, required }) {
  return (
    <label className="public-field-label" htmlFor={htmlFor}>
      {field.label}
      {required && <span className="public-required" aria-hidden="true"> *</span>}
    </label>
  )
}

export default function PublicField({ field, fieldId, value, error, onChange }) {
  const options = getOptions(field.options)
  const required = Boolean(field.required)
  const describedBy = [field.helpText ? `${fieldId}-help` : '', error ? `${fieldId}-error` : ''].filter(Boolean).join(' ') || undefined
  const commonProps = {
    id: fieldId,
    name: field.name || field.id || field.fieldId,
    'aria-required': required || undefined,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
  }
  const inputTypes = { text: 'text', number: 'number', email: 'email', mobile: 'tel', date: 'date' }

  if (field.type === 'heading') return <h2 className="public-field-heading">{field.label || field.defaultValue}</h2>
  if (field.type === 'paragraph') return <p className="public-field-paragraph">{field.label || field.defaultValue}</p>

  let control
  if (field.type === 'textarea') {
    control = (
      <textarea
        {...commonProps}
        className="public-field-control public-textarea"
        value={value ?? ''}
        placeholder={field.placeholder || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else if (inputTypes[field.type]) {
    control = (
      <input
        {...commonProps}
        className="public-field-control"
        type={inputTypes[field.type]}
        value={value ?? ''}
        placeholder={field.placeholder || ''}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        min={field.validation?.min}
        max={field.validation?.max}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else if (field.type === 'radio') {
    control = (
      <fieldset className="public-choice-group" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
        <legend className="public-field-label">
          {field.label}{required && <span className="public-required" aria-hidden="true"> *</span>}
        </legend>
        <div className="public-choice-options">
          {options.map((option, index) => (
            <label className="public-choice-option" key={`${option.value}-${index}`}>
              <input
                type="radio"
                name={commonProps.name}
                value={option.value}
                checked={value === option.value}
                aria-required={required || undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={describedBy}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  } else if (field.type === 'select') {
    control = (
      <select {...commonProps} className="public-field-control" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an option</option>
        {options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}
      </select>
    )
  } else if (field.type === 'multiselect') {
    control = (
      <select
        {...commonProps}
        className="public-field-control public-multiselect"
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
      >
        {options.map((option, index) => <option value={option.value} key={`${option.value}-${index}`}>{option.label}</option>)}
      </select>
    )
  } else if (field.type === 'checkbox' && options.length > 0) {
    control = (
      <fieldset className="public-choice-group" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
        <legend className="public-field-label">
          {field.label}{required && <span className="public-required" aria-hidden="true"> *</span>}
        </legend>
        <div className="public-choice-options">
          {options.map((option, index) => (
            <label className="public-choice-option" key={`${option.value}-${index}`}>
              <input
                type="checkbox"
                name={commonProps.name}
                value={option.value}
                checked={Array.isArray(value) && value.includes(option.value)}
                aria-required={required || undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={describedBy}
                onChange={(event) => {
                  const selected = Array.isArray(value) ? value : []
                  onChange(event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value))
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  } else if (field.type === 'checkbox') {
    control = (
      <label className="public-choice-option public-single-checkbox" htmlFor={fieldId}>
        <input {...commonProps} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}{required && <span className="public-required" aria-hidden="true"> *</span>}</span>
      </label>
    )
  } else if (field.type === 'file') {
    control = (
      <input
        {...commonProps}
        className="public-field-control public-file-control"
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    )
  } else {
    return null
  }

  return (
    <div className={`public-field${error ? ' public-field-invalid' : ''}`}>
      {field.type !== 'radio' && !(field.type === 'checkbox' && (!options.length)) && (
        <FieldLabel field={field} htmlFor={fieldId} required={required} />
      )}
      {control}
      {field.helpText && <p className="public-help-text" id={`${fieldId}-help`}>{field.helpText}</p>}
      {error && <p className="public-field-error" id={`${fieldId}-error`} role="alert">{error}</p>}
    </div>
  )
}