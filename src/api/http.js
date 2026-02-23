// src/api/http.js
import axios from 'axios'

function safeStr(v) { return String(v ?? '').trim() }

// ✅ si env contient "VITE_API_URL=https://..." on extrait l’URL
function sanitizeApiBase(raw) {
  const s = safeStr(raw)
  if (!s) return ''
  const m = s.match(/^(?:VITE_API_URL|VITE_API_BASE_URL)\s*=\s*(https?:\/\/.+)$/i)
  if (m) return safeStr(m[1]).replace(/\/+$/, '')
  return s.replace(/\/+$/, '')
}

const API_BASE =
  sanitizeApiBase(import.meta.env.VITE_API_URL) ||
  sanitizeApiBase(import.meta.env.VITE_API_BASE_URL) ||
  'https://digi-337307224016.europe-west1.run.app/api'

export const http = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
})

let tokenGetter = () => ''
let tenantIdGetter = () => ''

export function setTokenGetter(fn) {
  tokenGetter = typeof fn === 'function' ? fn : () => ''
}
export function setTenantIdGetter(fn) {
  tenantIdGetter = typeof fn === 'function' ? fn : () => ''
}

function resolveToken() {
  const t = safeStr(tokenGetter?.())
  if (t) return t
  return (
    safeStr(localStorage.getItem('token')) ||
    safeStr(sessionStorage.getItem('token')) ||
    ''
  )
}

function resolveTenantId() {
  const t = safeStr(tenantIdGetter?.())
  if (t) return t
  return (
    safeStr(localStorage.getItem('tenantId')) ||
    safeStr(sessionStorage.getItem('tenantId')) ||
    ''
  )
}

function isFormDataPayload(data) {
  try {
    return typeof FormData !== 'undefined' && data instanceof FormData
  } catch {
    return false
  }
}

function deleteContentTypeEverywhere(headers) {
  if (!headers) return
  try {
    if (typeof headers.delete === 'function') {
      headers.delete('Content-Type')
      headers.delete('content-type')
      return
    }
  } catch {
    // ignore
  }
  delete headers['Content-Type']
  delete headers['content-type']
}

http.interceptors.request.use((config) => {
  const token = resolveToken()
  const tenantId = resolveTenantId()

  config.headers = config.headers || {}

  if (isFormDataPayload(config.data)) {
    deleteContentTypeEverywhere(config.headers)
    try {
      deleteContentTypeEverywhere(http.defaults?.headers?.common)
      deleteContentTypeEverywhere(http.defaults?.headers)
    } catch {
      // ignore
    }
  }

  if (token) {
    config.headers['x-auth-token'] = token
    config.headers.Authorization = `Bearer ${token}`
  }
  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId
  }

  config.headers['x-client'] = 'digi-suite-web'

  return config
})

export function getResolvedAuthToken() {
  const t =
    safeStr(tokenGetter?.()) ||
    safeStr(localStorage.getItem('token')) ||
    safeStr(sessionStorage.getItem('token')) ||
    ''

  if (!t) return ''
  return t.toLowerCase().startsWith('bearer ') ? t.slice(7).trim() : t
}