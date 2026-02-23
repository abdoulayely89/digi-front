// src/api/http.js
import axios from 'axios'

function safeStr(v) { return String(v ?? '').trim() }

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'VITE_API_URL=https://digi-337307224016.europe-west1.run.app/api',
  // ✅ si un jour tu passes auth cookies, laisse ça prêt
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
    // axios peut avoir headers comme object, ou AxiosHeaders-like
    if (typeof headers.delete === 'function') {
      headers.delete('Content-Type')
      headers.delete('content-type')
      return
    }
  } catch {
    // ignore
  }

  // object classique
  delete headers['Content-Type']
  delete headers['content-type']
}

http.interceptors.request.use((config) => {
  const token = resolveToken()
  const tenantId = resolveTenantId()

  config.headers = config.headers || {}

  // ✅ IMPORTANT: si multipart/form-data, ne JAMAIS fixer Content-Type ici
  // => on supprime toutes les variantes possibles
  if (isFormDataPayload(config.data)) {
    deleteContentTypeEverywhere(config.headers)

    // ⚠️ certains projets ont aussi un default global
    // on neutralise si quelqu’un a fait http.defaults.headers.common['Content-Type']=...
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

/**
 * ✅ NEW: permet de récupérer le token EXACTEMENT comme Axios le fait,
 * pour construire des URLs (iframe/window.open) qui ne peuvent pas envoyer les headers.
 */
export function getResolvedAuthToken() {
  const t =
    safeStr(tokenGetter?.()) ||
    safeStr(localStorage.getItem('token')) ||
    safeStr(sessionStorage.getItem('token')) ||
    ''

  if (!t) return ''
  return t.toLowerCase().startsWith('bearer ') ? t.slice(7).trim() : t
}