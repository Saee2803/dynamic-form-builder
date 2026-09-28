const choiceTypes = new Set(['radio', 'select', 'multiselect', 'checkbox'])
const lengthTypes = new Set(['text', 'textarea', 'email', 'mobile'])

function TextControl({ label, value, onChange, placeholder = '', multiline = false }) {
  const Control = multiline ? 'textarea' : 'input'
  return (
    <label className="control-label">
      <span>{label}</span>
      <Control value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={multiline ? 3 : undefined} />
    </label>
  )
}

export default function FieldEditor({ field, onChange }) {
  if (!field) {
    return <aside className="builder-sidebar properties-sidebar"><div className="properties-empty"><span>↖</span><h2>Field properties</h2><p>Select a field on the canvas to edit its details.</p></div></aside>
  }

  function updateValidation(key, value) {
    const validation = { ...field.validation }
    if (value === '') delete validation[key]
    else validation[key] = Number(value)
    onChange({ validation })
  }

  return (
    <aside className="builder-sidebar properties-sidebar" aria-label="Field properties">
      <div className="sidebar-heading properties-title">
        <div><p className="eyebrow">Properties</p><h2>{field.type}</h2></div>
        <span className="property-type-mark">Aa</span>
      </div>
      <div className="properties-form">
        <TextControl label="Field label" value={field.label} onChange={(label) => onChange({ label })} />
        <TextControl label="Field name" value={field.name} onChange={(name) => onChange({ name })} />
        <TextControl label="Placeholder" value={field.placeholder} onChange={(placeholder) => onChange({ placeholder })} />
        <label className="control-label">
          <span>Default value</span>
          <input value={field.defaultValue ?? ''} onChange={(event) => onChange({ defaultValue: event.target.value })} />
        </label>
        <TextControl label="Help text" value={field.helpText} onChange={(helpText) => onChange({ helpText })} multiline />

        {choiceTypes.has(field.type) && (
          <fieldset className="options-fieldset">
            <legend>Options</legend>
            <div className="option-list">
              {field.options.map((option, index) => (
                <div className="option-row" key={`${field.id}-option-${index}`}>
                  <input aria-label={`Option ${index + 1}`} value={option} onChange={(event) => onChange({ options: field.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
                  <button className="icon-button icon-danger" aria-label={`Remove option ${index + 1}`} onClick={() => onChange({ options: field.options.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                </div>
              ))}
            </div>
            <button className="text-button" onClick={() => onChange({ options: [...field.options, `Option ${field.options.length + 1}`] })}>＋ Add option</button>
          </fieldset>
        )}

        {(lengthTypes.has(field.type) || field.type === 'number') && (
          <fieldset className="validation-fieldset">
            <legend>Validation</legend>
            <div className="validation-grid">
              {lengthTypes.has(field.type) ? (
                <>
                  <label className="control-label"><span>Min length</span><input type="number" min="0" value={field.validation.minLength ?? ''} onChange={(event) => updateValidation('minLength', event.target.value)} /></label>
                  <label className="control-label"><span>Max length</span><input type="number" min="0" value={field.validation.maxLength ?? ''} onChange={(event) => updateValidation('maxLength', event.target.value)} /></label>
                </>
              ) : (
                <>
                  <label className="control-label"><span>Minimum</span><input type="number" value={field.validation.min ?? ''} onChange={(event) => updateValidation('min', event.target.value)} /></label>
                  <label className="control-label"><span>Maximum</span><input type="number" value={field.validation.max ?? ''} onChange={(event) => updateValidation('max', event.target.value)} /></label>
                </>
              )}
            </div>
          </fieldset>
        )}

        <div className="property-toggles">
          <label className="toggle-row"><span><b>Required</b><small>Must be completed</small></span><input type="checkbox" checked={field.required} onChange={(event) => onChange({ required: event.target.checked })} /></label>
          <label className="toggle-row"><span><b>Active</b><small>Include in this form</small></span><input type="checkbox" checked={field.active} onChange={(event) => onChange({ active: event.target.checked })} /></label>
        </div>
      </div>
    </aside>
  )
}