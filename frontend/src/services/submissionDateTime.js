const INDIA_TIME_ZONE = 'Asia/Kolkata'
const UTC_SUFFIX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

export function parseSubmissionTimestamp(value) {
  if (!value) return null
  const timestamp = String(value)
  const explicitTimeZone = UTC_SUFFIX.test(timestamp)
  const date = new Date(explicitTimeZone ? timestamp : `${timestamp}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSubmissionTimestamp(value) {
  const date = parseSubmissionTimestamp(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function submissionDateInIndia(value) {
  const date = parseSubmissionTimestamp(value)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${values.year}-${values.month}-${values.day}`
}