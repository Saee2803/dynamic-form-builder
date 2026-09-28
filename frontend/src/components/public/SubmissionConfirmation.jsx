import { useEffect, useRef } from 'react'
import { formatSubmissionTimestamp } from '../../services/submissionDateTime'

function fieldName(field, index) {
  return String(field.name || field.id || field.fieldId || `field_${index + 1}`)
}

function displayValue(field, value) {
  if (Array.isArray(value)) {
    return value.map((item) => displayValue(field, item)).join(', ')
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (['radio', 'select'].includes(field.type)) {
    const option = (field.options || []).find((item) => {
      const optionValue = typeof item === 'object' ? item.value ?? item.label : item
      return String(optionValue) === String(value)
    })
    if (option !== undefined) return typeof option === 'object' ? option.label ?? option.value : option
  }
  if (field.type === 'checkbox' && Array.isArray(field.options)) {
    const option = field.options.find((item) => {
      const optionValue = typeof item === 'object' ? item.value ?? item.label : item
      return String(optionValue) === String(value)
    })
    if (option !== undefined) return typeof option === 'object' ? option.label ?? option.value : option
  }
  return String(value)
}

export default function SubmissionConfirmation({ form, submission, downloading, error, onDownload, onClose }) {
  const closeButton = useRef(null)
  const fields = (form.form_config?.fields || [])
    .filter((field) => (field.active ?? field.isActive ?? true) && !['heading', 'paragraph', 'file'].includes(field.type))
  const rows = fields.flatMap((field, index) => {
    const name = fieldName(field, index)
    const value = submission.submission_data?.[name]
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return []
    return [{ key: name, label: field.label || name, value: displayValue(field, value) }]
  })

  useEffect(() => {
    closeButton.current?.focus()
    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const submittedAt = submission.submitted_at ? formatSubmissionTimestamp(submission.submitted_at) : ''

  return (
    <div className="modal-backdrop submission-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="confirm-dialog submission-dialog" role="dialog" aria-modal="true" aria-labelledby="submission-title">
        <button ref={closeButton} className="icon-button submission-close" type="button" aria-label="Close confirmation" onClick={onClose}>×</button>
        <p className="eyebrow">Submission received</p>
        <h2 id="submission-title">Submission Successful</h2>
        <p className="submission-intro">Your form has been submitted successfully.</p>
        <div className="submission-meta">
          <span>Submission ID</span><strong>#{submission.submission_id}</strong>
          {submittedAt && <><span>Submitted</span><strong>{submittedAt}</strong></>}
        </div>
        <dl className="submission-details">
          {rows.length ? rows.map((row) => (
            <div className="submission-row" key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          )) : <p className="submission-empty">No field values were provided.</p>}
        </dl>
        {error && <p className="public-field-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Close</button>
          <button className="button button-primary" type="button" onClick={onDownload} disabled={downloading}>
            {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </section>
    </div>
  )
}