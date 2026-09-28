import { useEffect, useState } from 'react'
import AdminFormsPage from './pages/AdminFormsPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminSubmissionsPage from './pages/AdminSubmissionsPage'
import FormBuilderPage from './pages/FormBuilderPage'
import PublicFormPage from './pages/PublicFormPage'
import { getAdminSession } from './services/formsApi'
import './App.css'

function App() {
  const pathname = window.location.pathname
  const publicRoute = pathname.match(/^\/forms\/([^/]+)\/?$/)
  const isPublicRoute = Boolean(publicRoute)
  const loginRoute = /^\/admin\/login\/?$/.test(pathname)
  const submissionsRoute = pathname.match(/^\/admin\/forms\/(\d+)\/submissions\/?$/)
  const [building, setBuilding] = useState(false)
  const [formId, setFormId] = useState(null)
  const [authState, setAuthState] = useState('checking')

  useEffect(() => {
    if (isPublicRoute || loginRoute) return undefined
    let isCurrent = true
    getAdminSession()
      .then(() => { if (isCurrent) setAuthState('authenticated') })
      .catch(() => { if (isCurrent) setAuthState('anonymous') })
    return () => { isCurrent = false }
  }, [pathname, isPublicRoute, loginRoute])

  if (publicRoute) {
    return <PublicFormPage slug={decodeURIComponent(publicRoute[1])} />
  }
  if (loginRoute) {
    const nextPath = new URLSearchParams(window.location.search).get('next') || '/'
    const redirectTo = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'
    return <AdminLoginPage redirectTo={redirectTo} />
  }
  if (authState === 'checking') return <main className="builder-loading"><span className="spinner" /> Checking admin session</main>
  if (authState !== 'authenticated') {
    const redirectTo = `${pathname}${window.location.search}`
    return <AdminLoginPage redirectTo={redirectTo} />
  }

  if (submissionsRoute) {
    return <AdminSubmissionsPage formId={Number(submissionsRoute[1])} onBack={() => window.location.assign('/')} />
  }

  function createForm() {
    setFormId(null)
    setBuilding(true)
  }

  function editForm(selectedFormId) {
    setFormId(selectedFormId)
    setBuilding(true)
  }

  function returnToForms() {
    setBuilding(false)
    setFormId(null)
  }

  return building
    ? <FormBuilderPage key={formId || 'new'} formId={formId} onBack={returnToForms} />
    : <AdminFormsPage onCreate={createForm} onEdit={editForm} />
}

export default App
