import { useEffect, useState } from 'react'
import PublicForm from '../components/public/PublicForm'
import { getPublicForm } from '../services/formsApi'

export default function PublicFormPage({ slug }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    getPublicForm(slug)
      .then((result) => {
        if (isCurrent) setForm(result)
      })
      .catch((loadError) => {
        if (!isCurrent) return
        if (loadError.message === 'Form not available') setUnavailable(true)
        else setError(loadError.message || 'Could not load this form.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => { isCurrent = false }
  }, [slug])

  return (
    <main className="public-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fieldwork home">
          <span className="brand-mark">F</span>
          <span>Fieldwork</span>
        </a>
        <div className="topbar-meta"><span className="topbar-dot" /> Public form</div>
      </header>
      <section className="public-content">
        {loading ? (
          <div className="public-state"><span className="spinner" /> Loading form...</div>
        ) : unavailable ? (
          <div className="public-state public-unavailable">
            <span className="public-state-mark" aria-hidden="true">!</span>
            <p className="eyebrow">Unavailable</p>
            <h1>Form not available</h1>
            <p>This form may be unpublished or no longer active.</p>
            <a className="public-back-link" href="/">Back to forms</a>
          </div>
        ) : error ? (
          <div className="public-state public-unavailable" role="alert">
            <p className="eyebrow">Connection issue</p>
            <h1>We could not load this form.</h1>
            <p>Please try again later.</p>
          </div>
        ) : (
          <article className="public-form-summary">
            <p className="eyebrow">Registration form</p>
            <h1>{form.form_name}</h1>
            {form.form_description && <p className="public-description">{form.form_description}</p>}
            <PublicForm form={form} slug={slug} />
          </article>
        )}
      </section>
    </main>
  )
}