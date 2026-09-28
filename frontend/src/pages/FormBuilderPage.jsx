import { useEffect, useState } from 'react'
import FieldEditor from '../components/forms/FieldEditor'
import FieldItem from '../components/forms/FieldItem'
import FieldPalette from '../components/forms/FieldPalette'
import PublicField from '../components/public/PublicField'
import { createForm, getForm, updateForm } from '../services/formsApi'

const fieldLabels = {
  text: 'Text Field',
  textarea: 'Textarea Field',
  number: 'Number Field',
  email: 'Email Field',
  mobile: 'Mobile Field',
  date: 'Date Field',
  radio: 'Radio Field',
  select: 'Select Field',
  multiselect: 'Multiselect Field',
  checkbox: 'Checkbox Field',
  heading: 'Heading',
  paragraph: 'Paragraph',
  file: 'File Field',
}

function normalizeField(field, index) {
  const label = field.label || fieldLabels[field.type] || 'Text Field'
  return {
    id: field.id || field.fieldId || `field_${index + 1}`,
    type: field.type || 'text',
    label,
    name: field.name || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${index + 1}`,
    placeholder: field.placeholder || '',
    required: Boolean(field.required),
    defaultValue: field.defaultValue ?? '',
    helpText: field.helpText || '',
    options: (field.options || []).map((option) => typeof option === 'string' ? option : option.value ?? option.label ?? ''),
    validation: field.validation || {},
    order: Number(field.order) || index + 1,
    active: field.active ?? field.isActive ?? true,
  }
}

function orderedFields(fields) {
  return [...fields].sort((first, second) => first.order - second.order)
}

function previewValue(field) {
  const value = field.defaultValue
  if (field.type === 'multiselect' || (field.type === 'checkbox' && field.options?.length)) {
    return Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
  }
  if (field.type === 'checkbox') return value === true || value === 'true' || value === '1' || value === 'on'
  return value ?? ''
}

export default function FormBuilderPage({ formId, onBack }) {
  const [savedFormId, setSavedFormId] = useState(formId)
  const [form, setForm] = useState({ form_name: '', form_description: '', form_config: { fields: [] } })
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(Boolean(formId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewValues, setPreviewValues] = useState({})

  useEffect(() => {
    if (!formId) return undefined
    let isCurrent = true
    getForm(formId)
      .then((result) => {
        if (!isCurrent) return
        const fields = orderedFields((result.form_config?.fields || []).map(normalizeField))
          .map((field, index) => ({ ...field, order: index + 1 }))
        setForm({
          form_name: result.form_name,
          form_description: result.form_description || '',
          form_config: { ...result.form_config, fields },
        })
        setSelectedId(fields[0]?.id || null)
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || 'Could not load this form.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => { isCurrent = false }
  }, [formId])

  const fields = orderedFields(form.form_config.fields)
  const selectedField = fields.find((field) => field.id === selectedId) || null

  function updateField(fieldId, changes) {
    setForm((current) => ({
      ...current,
      form_config: {
        ...current.form_config,
        fields: current.form_config.fields.map((field) => field.id === fieldId ? { ...field, ...changes } : field),
      },
    }))
    setSaveMessage('')
  }

  function addField(type) {
    const label = fieldLabels[type] || 'Text Field'
    const baseName = type.replace(/[^a-z0-9]+/g, '_')
    let suffix = fields.filter((field) => field.type === type).length + 1
    let name = `${baseName}_${suffix}`
    while (fields.some((field) => field.name === name)) {
      suffix += 1
      name = `${baseName}_${suffix}`
    }
    let fieldIndex = fields.length + 1
    let id = `field_${fieldIndex}`
    while (fields.some((field) => field.id === id)) {
      fieldIndex += 1
      id = `field_${fieldIndex}`
    }
    const field = {
      id,
      type,
      label,
      name,
      placeholder: '',
      required: false,
      defaultValue: '',
      helpText: '',
      options: ['radio', 'select', 'multiselect', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : [],
      validation: {},
      order: fields.length + 1,
      active: true,
    }
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: [...current.form_config.fields, field] } }))
    setSelectedId(field.id)
    setSaveMessage('')
  }

  function moveField(fieldId, direction) {
    const index = fields.findIndex((field) => field.id === fieldId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) return
    const reordered = [...fields]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    setForm((current) => ({
      ...current,
      form_config: { ...current.form_config, fields: reordered.map((field, fieldIndex) => ({ ...field, order: fieldIndex + 1 })) },
    }))
  }

  function removeField(fieldId) {
    const remaining = fields.filter((field) => field.id !== fieldId).map((field, index) => ({ ...field, order: index + 1 }))
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: remaining } }))
    if (selectedId === fieldId) setSelectedId(null)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaveMessage('')
    const payload = {
      form_name: form.form_name.trim(),
      form_description: form.form_description.trim() || null,
      form_config: { ...form.form_config, fields: fields.map((field, index) => ({ ...field, order: index + 1 })) },
    }
    try {
      const result = savedFormId ? await updateForm(savedFormId, payload) : await createForm(payload)
      setSavedFormId(result.form_id)
      setSaveMessage(`Saved ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(result.updated_at))}`)
    } catch (saveError) {
      setError(saveError.message || 'Could not save this form.')
    } finally {
      setSaving(false)
    }
  }

  function openPreview() {
    setPreviewValues(Object.fromEntries(fields.map((field) => [field.id, previewValue(field)])))
    setPreviewOpen(true)
  }

  if (loading) return <main className="builder-loading"><span className="spinner" /> Loading form</main>

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <button className="back-button" onClick={onBack} aria-label="Back to forms">← <span>All forms</span></button>
        <div className="builder-topbar-title"><span className="brand-mark">F</span><span>Form builder</span>{savedFormId && <span className="builder-status">DRAFT</span>}</div>
        <div className="builder-save-area">
          {saveMessage && <span className="save-message" role="status">{saveMessage}</span>}
          <button className="button button-quiet builder-preview-button" type="button" onClick={openPreview}>Preview</button>
          <button className="button button-primary" onClick={handleSave} disabled={saving || !form.form_name.trim()}>
            {saving ? 'Saving…' : 'Save form'}
          </button>
        </div>
      </header>

      {error && <div className="notice notice-error builder-notice" role="alert">{error}</div>}

      <form className="builder-meta" onSubmit={handleSave}>
        <div className="builder-meta-fields">
          <input className="builder-description-input" value={form.form_description} onChange={(event) => { setForm((current) => ({ ...current, form_description: event.target.value })); setSaveMessage('') }} placeholder="Add a short description (optional)" aria-label="Form description" />
        </div>
        <div className="builder-count"><strong>{fields.length.toString().padStart(2, '0')}</strong><span>fields</span></div>
      </form>

      <div className="builder-workspace">
        <FieldPalette onAdd={addField} />

        <section className="builder-canvas" aria-label="Form fields">
          <div className="canvas-heading">
            <div className="canvas-title-editor">
              <label className="eyebrow" htmlFor="form-name">Form name</label>
              <input
                id="form-name"
                className="canvas-title-input"
                value={form.form_name}
                onChange={(event) => { setForm((current) => ({ ...current, form_name: event.target.value })); setSaveMessage('') }}
                placeholder="Untitled form"
                aria-label="Form name"
                maxLength={255}
              />
            </div>
            <span className="canvas-draft">Draft</span>
          </div>
          {fields.length === 0 ? (
            <div className="canvas-empty">
              <span className="empty-symbol" aria-hidden="true">＋</span>
              <h2>Your form starts here</h2>
              <p>Choose a field from the left to begin building.</p>
            </div>
          ) : (
            <div className="field-stack">
              {fields.map((field, index) => (
                <FieldItem
                  key={field.id}
                  field={field}
                  index={index}
                  count={fields.length}
                  selected={field.id === selectedId}
                  onSelect={() => setSelectedId(field.id)}
                  onMove={(direction) => moveField(field.id, direction)}
                  onDelete={() => removeField(field.id)}
                />
              ))}
            </div>
          )}
          <button className="canvas-add-button" onClick={() => addField('text')} type="button">＋ Add text field</button>
        </section>

        <FieldEditor field={selectedField} onChange={(changes) => selectedField && updateField(selectedField.id, changes)} />
      </div>
      {previewOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
          <section className="confirm-dialog builder-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <button className="icon-button submission-close" type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>×</button>
            <p className="eyebrow">Form preview</p>
            <h2 id="preview-title">{form.form_name || 'Untitled form'}</h2>
            {form.form_description && <p className="public-description">{form.form_description}</p>}
            <div className="builder-preview-fields">
              {fields.map((field) => (
                <PublicField
                  key={field.id}
                  field={field}
                  fieldId={`preview-${field.id}`}
                  value={previewValues[field.id]}
                  onChange={(value) => setPreviewValues((current) => ({ ...current, [field.id]: value }))}
                />
              ))}
            </div>
            <div className="confirm-actions"><button className="button button-quiet" type="button" onClick={() => setPreviewOpen(false)}>Close preview</button></div>
          </section>
        </div>
      )}
    </main>
  )
}