import { useState } from 'react'
import { loginAdmin } from '../services/formsApi'

export default function AdminLoginPage({ redirectTo = '/' }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await loginAdmin(username, password)
      window.location.assign(redirectTo)
    } catch (loginError) {
      if (loginError.status === 401) setError('Invalid username or password.')
      else if (loginError.status === 503) setError('Admin login is not configured. Set the admin environment variables in backend/.env.')
      else setError('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-shell login-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fieldwork home"><span className="brand-mark">F</span><span>Fieldwork</span></a>
        <div className="topbar-meta">Admin sign in</div>
      </header>
      <section className="login-content">
        <div className="login-panel">
          <p className="eyebrow">Admin workspace</p>
          <h1>Welcome back</h1>
          <p className="login-description">Sign in to manage forms and registrations.</p>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="control-label" htmlFor="admin-username">
              <span>Username</span>
              <input id="admin-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label className="control-label" htmlFor="admin-password">
              <span>Password</span>
              <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}