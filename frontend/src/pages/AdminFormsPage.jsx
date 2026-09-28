import { useEffect, useState } from 'react'
import { deactivateForm, deleteForm, getForms, logoutAdmin, publishForm } from '../services/formsApi'

function publicUrl(slug) {
  return new URL(`/forms/${encodeURIComponent(slug)}`, window.location.origin).toString()
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export default function AdminFormsPage({ onCreate, onEdit }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [pendingTransition, setPendingTransition] = useState(null)
  const [transitioningId, setTransitioningId] = useState(null)
  const [success, setSuccess] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function loadForms() {
    setLoading(true)
    setError('')
    try {
      setForms(await getForms())
    } catch (loadError) {
      setError(loadError.message || 'Could not load forms.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCurrent = true
    getForms()
      .then((result) => {
        if (isCurrent) setForms(result)
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || 'Could not load forms.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => { isCurrent = false }
  }, [])

  async function handleDelete(form) {
    if (!window.confirm(`Delete “${form.form_name}”? This action cannot be undone.`)) return
    setDeletingId(form.form_id)
    setError('')
    try {
      await deleteForm(form.form_id)
      setForms((currentForms) => currentForms.filter((item) => item.form_id !== form.form_id))
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this form.')
    } finally {
      setDeletingId(null)
    }
  }

  async function confirmStatusTransition() {
    if (!pendingTransition) return
    const { form, action } = pendingTransition
    setTransitioningId(form.form_id)
    setError('')
    setSuccess(null)
    try {
      const result = action === 'publish'
        ? await publishForm(form.form_id)
        : await deactivateForm(form.form_id)
      setForms((currentForms) => currentForms.map((item) => item.form_id === form.form_id
        ? { ...item, status: result.status, form_slug: result.slug || item.form_slug, updated_at: result.updated_at }
        : item))
      setSuccess(action === 'publish'
        ? { message: 'Form published successfully.', url: publicUrl(result.slug) }
        : { message: 'Form deactivated. Its public URL is no longer available.' })
      setPendingTransition(null)
    } catch (transitionError) {
      setError(transitionError.message || `Could not ${action} this form.`)
    } finally {
      setTransitioningId(null)
    }
  }

  async function handleCopyUrl(form) {
    try {
      await navigator.clipboard.writeText(publicUrl(form.form_slug))
      setError('')
      setSuccess({ message: 'Public URL copied.' })
    } catch {
      setError('Could not copy the public URL. Check clipboard permissions and try again.')
      setSuccess(null)
    }
  }

  async function handleLogout() {
    await logoutAdmin().catch(() => null)
    window.location.assign('/admin/login')
  }

  const filteredForms = forms.filter((form) => {
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch = !search || [form.form_name, form.form_description, form.form_slug]
      .some((value) => String(value || '').toLowerCase().includes(search))
    const matchesStatus = statusFilter === 'all' || form.status.toUpperCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand" href="#forms" aria-label="Fieldwork home">
          <span className="brand-mark">F</span>
          <span>Fieldwork</span>
        </a>
        <div className="topbar-meta"><span className="topbar-dot" /> Admin workspace <button className="topbar-action" type="button" onClick={handleLogout}>Log out</button></div>
      </header>

      <section className="page-content" id="forms">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Forms</p>
            <h1>Forms</h1>
            <p className="page-intro">Create and manage the forms your team needs.</p>
          </div>
          <button className="button button-primary" onClick={onCreate}>
            <span aria-hidden="true">＋</span> New form
          </button>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {success && (
          <div className="notice notice-success" role="status">
            <span>{success.message}</span>
            {success.url && <a href={success.url} target="_blank" rel="noreferrer">{success.url}</a>}
          </div>
        )}

        <section className="list-panel" aria-label="Existing forms">
          <div className="panel-heading">
            <div>
              <h2>All forms</h2>
              <p>{loading ? 'Loading forms…' : `${forms.length} ${forms.length === 1 ? 'form' : 'forms'}`}</p>
            </div>
            <div className="forms-toolbar-actions">
              <label className="filter-control"><span>Search</span><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name, description, or slug" /></label>
              <label className="filter-control"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="INACTIVE">Inactive</option></select></label>
              <button className="button button-quiet" onClick={loadForms} disabled={loading} aria-label="Refresh forms">↻ <span>Refresh</span></button>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><span className="spinner" /> Loading your forms</div>
          ) : forms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-symbol" aria-hidden="true">＋</div>
              <h3>Your workspace is ready</h3>
              <p>Start with a blank form and add the fields you need.</p>
              <button className="button button-primary" onClick={onCreate}>Create your first form</button>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="forms-no-match">No forms match these filters.</div>
          ) : (
            <div className="table-scroll">
              <table className="forms-table">
                <thead>
                  <tr><th>Form name</th><th>Status</th><th>Slug</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {filteredForms.map((form) => (
                    (() => {
                      const normalizedStatus = form.status.toUpperCase()
                      const isPublished = normalizedStatus === 'PUBLISHED'
                      const isTransitioning = transitioningId === form.form_id
                      return (
                    <tr key={form.form_id}>
                      <td>
                        <button className="form-title-button" onClick={() => onEdit(form.form_id)}>{form.form_name}</button>
                        <span className="form-description">{form.form_description || 'No description'}</span>
                      </td>
                      <td><span className={`status-pill status-${normalizedStatus.toLowerCase()}`}>{normalizedStatus}</span></td>
                      <td><code className="slug-value">{form.form_slug}</code></td>
                      <td className="date-cell">{formatDate(form.created_at)}</td>
                      <td className="row-actions">
                        <button className="button button-quiet" onClick={() => onEdit(form.form_id)}>Edit</button>
                        <a className="button button-quiet" href={`/admin/forms/${form.form_id}/submissions`}>Submissions</a>
                        {isPublished ? (
                          <>
                            <a className="button button-quiet" href={`/forms/${encodeURIComponent(form.form_slug)}`} target="_blank" rel="noreferrer">Open public URL</a>
                            <button className="button button-quiet" onClick={() => handleCopyUrl(form)}>Copy URL</button>
                            <button className="button button-danger-quiet" onClick={() => setPendingTransition({ form, action: 'deactivate' })} disabled={isTransitioning}>Deactivate</button>
                          </>
                        ) : (
                          <>
                            <button className="button button-publish" onClick={() => setPendingTransition({ form, action: 'publish' })} disabled={isTransitioning}>Publish</button>
                            <button className="button button-danger-quiet" onClick={() => handleDelete(form)} disabled={deletingId === form.form_id}>{deletingId === form.form_id ? 'Deleting…' : 'Delete'}</button>
                          </>
                        )}
                      </td>
                    </tr>
                      )
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <footer className="page-footer">Fieldwork <span>·</span> Admin</footer>
      </section>
      {pendingTransition && (
        <div className="modal-backdrop">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="transition-title">
            <p className="eyebrow">Confirm action</p>
            <h2 id="transition-title">{pendingTransition.action === 'publish' ? 'Publish this form?' : 'Deactivate this form?'}</h2>
            <p>{pendingTransition.action === 'publish'
              ? 'The form will become publicly accessible.'
              : 'The public URL will no longer be accessible.'}</p>
            <div className="confirm-actions">
              <button className="button button-quiet" onClick={() => setPendingTransition(null)}>Cancel</button>
              <button className="button button-primary" onClick={confirmStatusTransition} disabled={transitioningId === pendingTransition.form.form_id}>
                {transitioningId === pendingTransition.form.form_id ? 'Saving…' : pendingTransition.action === 'publish' ? 'Publish' : 'Deactivate'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}