const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const { responseType, ...requestOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...requestOptions.headers,
    },
  })

  if (response.status === 204) return null

  if (!response.ok) {
    const result = await response.json().catch(() => null)
    const detail = result?.detail
    const error = new Error(typeof detail === 'string' ? detail : `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  if (responseType === 'blob') return response.blob()
  return response.json().catch(() => null)
}

export function createForm(form) {
  return request('/forms', { method: 'POST', body: JSON.stringify(form) })
}

export function getForms() {
  return request('/forms')
}

export function getForm(formId) {
  return request(`/forms/${formId}`)
}

export function updateForm(formId, form) {
  return request(`/forms/${formId}`, { method: 'PUT', body: JSON.stringify(form) })
}

export function deleteForm(formId) {
  return request(`/forms/${formId}`, { method: 'DELETE' })
}

export function publishForm(formId) {
  return request(`/forms/${formId}/publish`, { method: 'POST' })
}

export function deactivateForm(formId) {
  return request(`/forms/${formId}/deactivate`, { method: 'POST' })
}

export function getPublicForm(slug) {
  return request(`/public/forms/${encodeURIComponent(slug)}`)
}

export function submitPublicForm(slug, submissionData) {
  return request(`/public/forms/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ submission_data: submissionData }),
  })
}

export function downloadPublicSubmissionPdf(slug, submissionId) {
  return request(`/public/forms/${encodeURIComponent(slug)}/submissions/${submissionId}/pdf`, { responseType: 'blob' })
}

export function loginAdmin(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function getAdminSession() {
  return request('/auth/session')
}

export function logoutAdmin() {
  return request('/auth/logout', { method: 'POST' })
}

export function getFormSubmissions(formId) {
  return request(`/forms/${formId}/submissions`)
}

export function getFormSubmission(formId, submissionId) {
  return request(`/forms/${formId}/submissions/${submissionId}`)
}

export function downloadAdminSubmissionPdf(formId, submissionId) {
  return request(`/forms/${formId}/submissions/${submissionId}/pdf`, { responseType: 'blob' })
}