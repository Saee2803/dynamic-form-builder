import { useState } from 'react'
import { downloadPublicSubmissionPdf, submitPublicForm } from '../../services/formsApi'
import PublicField from './PublicField'
import SubmissionConfirmation from './SubmissionConfirmation'

function fieldKey(field, index) {
  return String(field.name || field.id || field.fieldId || `field_${index + 1}`)
}

function initialFieldValue(field) {
  const defaultValue = field.defaultValue
  if (field.type === 'file') return null
  if (field.type === 'multiselect' || (field.type === 'checkbox' && field.options?.length)) {
    if (Array.isArray(defaultValue)) return defaultValue.map(String)
    return defaultValue === undefined || defaultValue === null || defaultValue === '' ? [] : [String(defaultValue)]
  }
  if (field.type === 'checkbox') {
    return defaultValue === true || defaultValue === 'true' || defaultValue === '1' || defaultValue === 'on'
  }
  return defaultValue ?? ''
}

function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === false
}

function validateFields(fields, values) {
  const nextErrors = {}

  fields.forEach(({ field, key }) => {
    const value = values[key]
    const validation = field.validation || {}
    const textValue = value == null ? '' : String(value)

    if (field.required && isEmpty(value)) {
      nextErrors[key] = 'This field is required.'
      return
    }
    if (isEmpty(value)) return

    if (validation.minLength !== undefined && textValue.length < Number(validation.minLength)) {
      nextErrors[key] = `Minimum length is ${validation.minLength}.`
    } else if (validation.maxLength !== undefined && textValue.length > Number(validation.maxLength)) {
      nextErrors[key] = `Maximum length is ${validation.maxLength}.`
    } else if (field.type === 'number' && validation.min !== undefined && Number(value) < Number(validation.min)) {
      nextErrors[key] = `Value must be at least ${validation.min}.`
    } else if (field.type === 'number' && validation.max !== undefined && Number(value) > Number(validation.max)) {
      nextErrors[key] = `Value must be at most ${validation.max}.`
    }
  })

  return nextErrors
}

function submittedFieldName(field, index) {
  return String(field.name || field.id || field.fieldId || `field_${index + 1}`)
}

export default function PublicForm({ form, slug }) {
  const fields = (form.form_config?.fields || [])
    .filter((field) => field.active ?? field.isActive ?? true)
    .map((field, index) => ({ field, index, key: fieldKey(field, index) }))
    .sort((first, second) => (Number(first.field.order) || first.index + 1) - (Number(second.field.order) || second.index + 1))

  const [values, setValues] = useState(() => Object.fromEntries(
    fields.map(({ field, key }) => [key, initialFieldValue(field)]),
  ))
  const [errors, setErrors] = useState({})
  const [submitMessage, setSubmitMessage] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setSubmitMessage('')
    setSubmissionError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || confirmation) return
    const nextErrors = validateFields(fields, values)
    setErrors(nextErrors)
    setSubmitMessage('')
    setSubmissionError('')
    if (Object.keys(nextErrors).length > 0) return

    const submissionData = Object.fromEntries(fields.flatMap(({ field, index, key }) => {
      if (['heading', 'paragraph', 'file'].includes(field.type)) return []
      return [[submittedFieldName(field, index), values[key]]]
    }))

    setSubmitting(true)
    try {
      const result = await submitPublicForm(slug, submissionData)
      setConfirmation(result)
    } catch (error) {
      if (error.status === 404) setSubmissionError('This form is no longer available.')
      else if (error.status === 400) setSubmissionError('Please review the form entries and try again.')
      else if (error.status === 422) setSubmissionError('Please check your entries and try again.')
      else setSubmissionError('Unable to submit the form. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPdf() {
    if (!confirmation || downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const pdf = await downloadPublicSubmissionPdf(slug, confirmation.submission_id)
      const downloadUrl = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${form.form_slug}-submission-${confirmation.submission_id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch {
      setDownloadError('Unable to download the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <form className="public-form" onSubmit={handleSubmit} noValidate>
      {fields.map(({ field, index, key }) => {
        const fieldId = `public-${String(field.id || field.fieldId || key).replace(/[^a-zA-Z0-9_-]/g, '-')}-${index}`
        return (
          <PublicField
            key={fieldId}
            field={field}
            fieldId={fieldId}
            value={values[key]}
            error={errors[key]}
            onChange={(value) => updateValue(key, value)}
          />
        )
      })}
      <div className="public-form-actions">
        <button className="button button-primary" type="submit" disabled={submitting || Boolean(confirmation)}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        {submitMessage && <p className="public-submit-message" role="status">{submitMessage}</p>}
        {submissionError && <p className="public-field-error" role="alert">{submissionError}</p>}
      </div>
      {confirmation && (
        <SubmissionConfirmation
          form={form}
          submission={confirmation}
          downloading={downloading}
          error={downloadError}
          onDownload={handleDownloadPdf}
          onClose={() => setConfirmation(null)}
        />
      )}
    </form>
  )
}