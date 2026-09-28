import { useEffect, useState } from 'react'
import {
  downloadAdminSubmissionPdf,
  getForm,
  getFormSubmission,
  getFormSubmissions,
  logoutAdmin,
} from '../services/formsApi'
import { formatSubmissionTimestamp, submissionDateInIndia } from '../services/submissionDateTime'

function formatDate(value) {
  return formatSubmissionTimestamp(value)
}

function valueForField(field, value) {
  if (Array.isArray(value)) return value.map((item) => valueForField(field, item)).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (['radio', 'select', 'multiselect', 'checkbox'].includes(field.type)) {
    const option = (field.options || []).find((item) => {
      const optionValue = typeof item === 'object' ? item.value ?? item.label : item
      return String(optionValue) === String(value)
    })
    if (option !== undefined) return String(typeof option === 'object' ? option.label ?? option.value : option)
  }
  return String(value)
}

function fieldName(field, index) {
  return String(field.name || field.id || field.fieldId || `field_${index + 1}`)
}

function SubmissionDetailDialog({ form, submission, onClose }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const fields = (form.form_config?.fields || [])
    .filter((field) => (field.active ?? field.isActive ?? true) && !['heading', 'paragraph', 'file'].includes(field.type))
    .map((field, index) => ({ field, index }))
    .sort((first, second) => (Number(first.field.order) || first.index + 1) - (Number(second.field.order) || second.index + 1))
  const rows = fields.flatMap(({ field, index }) => {
    const name = fieldName(field, index)
    const value = submission.submission_data?.[name]
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return []
    return [{ key: name, label: field.label || name, value: valueForField(field, value) }]
  })

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    setError('')
    try {
      const pdf = await downloadAdminSubmissionPdf(form.form_id, submission.submission_id)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `${form.form_slug}-submission-${submission.submission_id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Unable to download the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop submission-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="confirm-dialog submission-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-submission-title">
        <button className="icon-button submission-close" type="button" aria-label="Close submission details" onClick={onClose}>×</button>
        <p className="eyebrow">{form.form_name}</p>
        <h2 id="admin-submission-title">Submission #{submission.submission_id}</h2>
        <div className="submission-meta">
          <span>Submitted</span><strong>{formatDate(submission.submitted_at)}</strong>
          <span>Status</span><strong><span className="status-pill status-submitted">{submission.status}</span></strong>
        </div>
        <dl className="submission-details">
          {rows.length ? rows.map((row) => (
            <div className="submission-row" key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          )) : <p className="submission-empty">No field values were provided.</p>}
        </dl>
        {error && <p className="public-field-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Close</button>
          <button className="button button-primary" type="button" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function AdminSubmissionsPage({ formId, onBack }) {
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [viewingId, setViewingId] = useState(null)

  async function handleLogout() {
    await logoutAdmin().catch(() => null)
    window.location.assign('/admin/login')
  }

  useEffect(() => {
    let isCurrent = true
    Promise.all([getForm(formId), getFormSubmissions(formId)])
      .then(([formResult, submissionsResult]) => {
        if (!isCurrent) return
        setForm(formResult)
        setSubmissions(submissionsResult)
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.status === 404 ? 'Form not found.' : 'Unable to load submissions.')
      })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [formId])

  async function viewSubmission(submissionId) {
    setViewingId(submissionId)
    setError('')
    try {
      setSelectedSubmission(await getFormSubmission(formId, submissionId))
    } catch (loadError) {
      setError(loadError.status === 404 ? 'Submission not found.' : 'Unable to load submission details.')
    } finally {
      setViewingId(null)
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesId = !query || String(submission.submission_id).includes(query.trim())
    const matchesStatus = statusFilter === 'all' || submission.status.toUpperCase() === statusFilter
    const submissionDate = submissionDateInIndia(submission.submitted_at)
    const matchesDate = !dateFilter || submissionDate === dateFilter
    return matchesId && matchesStatus && matchesDate
  })

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fieldwork home"><span className="brand-mark">F</span><span>Fieldwork</span></a>
        <div className="topbar-meta">Admin workspace <button className="topbar-action" type="button" onClick={handleLogout}>Log out</button></div>
      </header>
      <section className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow"><button className="breadcrumb-button" type="button" onClick={onBack}>Forms</button> / Submissions</p>
            <h1>{form?.form_name || 'Submissions'}</h1>
            <p className="page-intro">{loading ? 'Loading submissions…' : `${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}`}</p>
          </div>
          <button className="button button-quiet" type="button" onClick={onBack}>Back to forms</button>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? (
          <div className="loading-state"><span className="spinner" /> Loading submissions</div>
        ) : !form ? null : submissions.length === 0 ? (
          <div className="empty-state submissions-empty-state">
            <h3>No submissions yet.</h3>
            <p>Submissions for this form will appear here.</p>
          </div>
        ) : (
          <section className="list-panel" aria-label="Form submissions">
            <div className="panel-heading submissions-toolbar">
              <div><h2>Submissions</h2><p>Review registrations for this form.</p></div>
              <div className="submission-filters">
                <label className="filter-control"><span>Submission ID</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID" /></label>
                <label className="filter-control"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="SUBMITTED">Submitted</option></select></label>
                <label className="filter-control"><span>Date</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
              </div>
            </div>
            <div className="table-scroll">
              <table className="forms-table submissions-table">
                <thead><tr><th>ID</th><th>Submitted</th><th>Status</th><th>Summary</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.submission_id}>
                      <td><strong>#{submission.submission_id}</strong></td>
                      <td className="date-cell">{formatDate(submission.submitted_at)}</td>
                      <td><span className="status-pill status-submitted">{submission.status}</span></td>
                      <td className="submission-summary-cell">{submission.summary}</td>
                      <td className="row-actions"><button className="button button-quiet" type="button" onClick={() => viewSubmission(submission.submission_id)} disabled={viewingId === submission.submission_id}>{viewingId === submission.submission_id ? 'Loading…' : 'View'}</button></td>
                    </tr>
                  ))}
                  {filteredSubmissions.length === 0 && <tr><td className="submissions-no-match" colSpan="5">No submissions match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
      {selectedSubmission && form && <SubmissionDetailDialog form={form} submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />}
    </main>
  )
}