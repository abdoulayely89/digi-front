// src/api/api.js
import { http, getResolvedAuthToken } from './http'

// ----------------------
// Helpers (normalize + url building)
// ----------------------
function safeStr(v) { return String(v ?? '').trim() }

function getApiBase() {
  const v1 = safeStr(import.meta?.env?.VITE_API_URL)
  const v2 = safeStr(import.meta?.env?.VITE_API_BASE_URL)
  return v1 || v2 || 'https://digi-337307224016.europe-west1.run.app/api'
}

function splitOriginAndPrefix() {
  const apiBase = getApiBase()
  if (!apiBase) return { origin: '', apiPrefix: '' }
  try {
    const u = new URL(apiBase)
    return { origin: u.origin, apiPrefix: safeStr(u.pathname).replace(/\/+$/, '') }
  } catch {
    const cleaned = apiBase.replace(/\/+$/, '')
    const m = cleaned.match(/^(https?:\/\/[^/]+)(\/.*)?$/)
    if (!m) return { origin: '', apiPrefix: '' }
    return { origin: m[1], apiPrefix: safeStr(m[2] || '').replace(/\/+$/, '') }
  }
}

function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

function apiAssetUrl(pathOrUrl) {
  const s = safeStr(pathOrUrl)
  if (!s) return ''
  if (isHttpUrl(s)) return s

  const { origin, apiPrefix } = splitOriginAndPrefix()
  if (!origin) return s

  if (s.startsWith('/api/')) return `${origin}${s}`

  const prefix = apiPrefix || '/api'
  if (s.startsWith('/')) return `${origin}${prefix}${s}`

  return `${origin}${prefix}/${s}`
}

function normalizePdf(pdf) {
  if (!pdf || typeof pdf !== 'object') return null

  const url =
    safeStr(pdf.finalUrl) ||
    safeStr(pdf.url) ||
    safeStr(pdf.publicUrl) ||
    safeStr(pdf.downloadUrl) ||
    ''

  const hash =
    safeStr(pdf.finalHash) ||
    safeStr(pdf.hash) ||
    safeStr(pdf.sha256) ||
    ''

  if (!url) return null

  const abs = isHttpUrl(url) ? url : apiAssetUrl(url)
  return { ...(pdf || {}), url: abs, finalUrl: abs, hash, finalHash: hash }
}

function normalizeContract(c) {
  if (!c || typeof c !== 'object') return c
  return { ...c, pdf: normalizePdf(c.pdf) }
}
function normalizeContractsList(data) {
  if (Array.isArray(data)) return data.map(normalizeContract)
  if (Array.isArray(data?.items)) return { ...data, items: data.items.map(normalizeContract) }
  return data
}

function normalizeQuote(q) {
  if (!q || typeof q !== 'object') return q
  return { ...q, pdf: normalizePdf(q.pdf) }
}
function normalizeQuotesList(data) {
  if (Array.isArray(data)) return data.map(normalizeQuote)
  if (Array.isArray(data?.items)) return { ...data, items: data.items.map(normalizeQuote) }
  return data
}

function normalizeInvoice(i) {
  if (!i || typeof i !== 'object') return i
  return { ...i, pdf: normalizePdf(i.pdf) }
}
function normalizeInvoicesList(data) {
  if (Array.isArray(data)) return data.map(normalizeInvoice)
  if (Array.isArray(data?.items)) return { ...data, items: data.items.map(normalizeInvoice) }
  return data
}

// ✅ helpers anti ExpiredToken (window.open/iframe => pas de headers)
// => on injecte token dans query string
function contractOpenPdfUrl(id) {
  const cid = safeStr(id)
  if (!cid) return ''
  const jwt = getResolvedAuthToken()
  const qs = jwt ? `?token=${encodeURIComponent(jwt)}` : ''
  return apiAssetUrl(`/contracts/${encodeURIComponent(cid)}/pdf/open${qs}`)
}
function invoiceOpenPdfUrl(id) {
  const iid = safeStr(id)
  if (!iid) return ''
  const jwt = getResolvedAuthToken()
  const qs = jwt ? `?token=${encodeURIComponent(jwt)}` : ''
  return apiAssetUrl(`/invoices/${encodeURIComponent(iid)}/pdf/open${qs}`)
}

// ----------------------
// API
// ----------------------
export const api = {
  auth: {
    async login(payload) { const { data } = await http.post('/auth/login', payload); return data },
    async me() { const { data } = await http.get('/auth/me'); return data },
    async logout() { const { data } = await http.post('/auth/logout'); return data },
  },

  tenant: {
    async me() { const { data } = await http.get('/tenants/me'); return data },
    async update(payload) { const { data } = await http.patch('/tenants/me', payload); return data },
    async uploadLogo(fileOrFormData) {
      let fd
      if (fileOrFormData instanceof FormData) fd = fileOrFormData
      else { fd = new FormData(); fd.append('logo', fileOrFormData) }
      const { data } = await http.post('/tenants/me/logo', fd)
      return data
    },
  },

  users: {
    async list(params) { const { data } = await http.get('/users', { params }); return data },
    async get(id) { const { data } = await http.get(`/users/${encodeURIComponent(id)}`); return data },
    async create(payload) { const { data } = await http.post('/users', payload); return data },
    async update(id, payload) { const { data } = await http.patch(`/users/${encodeURIComponent(id)}`, payload); return data },
    async remove(id) { const { data } = await http.delete(`/users/${encodeURIComponent(id)}`); return data },

    async uploadAvatar(id, fileOrFormData) {
      const fd = fileOrFormData instanceof FormData ? fileOrFormData : new FormData()
      if (!(fileOrFormData instanceof FormData)) fd.append('avatar', fileOrFormData)
      const { data } = await http.post(`/users/${encodeURIComponent(id)}/avatar`, fd)
      return data
    },

    publicAvatarUrl(id) {
      const uid = safeStr(id)
      if (!uid) return ''
      return apiAssetUrl(`/users/${encodeURIComponent(uid)}/avatar`)
    },

    async fetchAvatarBlobUrl(id) {
      try {
        const res = await http.get(`/users/${encodeURIComponent(id)}/avatar`, {
          responseType: 'blob',
          maxRedirects: 0,
          validateStatus: (s) => (s >= 200 && s < 300) || s === 302 || s === 301,
        })
        if (res?.status === 302 || res?.status === 301) return ''
        const blob = res?.data
        if (!blob) return ''
        return URL.createObjectURL(blob)
      } catch {
        return ''
      }
    },
  },

  profiles: {
    async me() { const { data } = await http.get('/profiles/me'); return data },
    async upsertMe(payload) { const { data } = await http.patch('/profiles/me', payload); return data },
  },

  locations: {
    async ping(payload) { const { data } = await http.post('/locations/ping', payload || {}); return data },
    async live() { const { data } = await http.get('/locations/live'); return data },
    async history(userId, params) { const { data } = await http.get(`/locations/history/${encodeURIComponent(userId)}`, { params }); return data },
  },

  leads: {
    async list(params) { const { data } = await http.get('/leads', { params }); return data },
    async get(id) { const { data } = await http.get(`/leads/${encodeURIComponent(id)}`); return data },
    async create(payload) { const { data } = await http.post('/leads', payload); return data },
    async update(id, payload) { const { data } = await http.patch(`/leads/${encodeURIComponent(id)}`, payload); return data },
    async remove(id) { const { data } = await http.delete(`/leads/${encodeURIComponent(id)}`); return data },
  },

  quotes: {
    async list(params) { const { data } = await http.get('/quotes', { params }); return normalizeQuotesList(data) },
    async get(id) { const { data } = await http.get(`/quotes/${encodeURIComponent(id)}`); return normalizeQuote(data) },
    async create(payload) { const { data } = await http.post('/quotes', payload); return normalizeQuote(data) },
    async update(id, payload) { const { data } = await http.patch(`/quotes/${encodeURIComponent(id)}`, payload); return normalizeQuote(data) },
    async remove(id) { const { data } = await http.delete(`/quotes/${encodeURIComponent(id)}`); return data },
    async markSent(id) { const { data } = await http.post(`/quotes/${encodeURIComponent(id)}/mark-sent`); return normalizeQuote(data) },
    async generatePdf(id) { const { data } = await http.post(`/quotes/${encodeURIComponent(id)}/generate-pdf`); return normalizeQuote(data) },
    async convertToContract(id) { const { data } = await http.post(`/quotes/${encodeURIComponent(id)}/convert-to-contract`); return data },
    async send(id, payload) {
      const { data } = await http.post(`/quotes/${encodeURIComponent(id)}/send`, payload || {})
      if (data?.quote) return { ...data, quote: normalizeQuote(data.quote) }
      return data
    },
  },

  contracts: {
    async list(params) { const { data } = await http.get('/contracts', { params }); return normalizeContractsList(data) },
    async get(id) { const { data } = await http.get(`/contracts/${encodeURIComponent(id)}`); return normalizeContract(data) },
    async createFromQuote(quoteId) { const { data } = await http.post(`/contracts/from-quote/${encodeURIComponent(quoteId)}`); return normalizeContract(data) },
    async update(id, payload) { const { data } = await http.patch(`/contracts/${encodeURIComponent(id)}`, payload); return normalizeContract(data) },
    async remove(id) { const { data } = await http.delete(`/contracts/${encodeURIComponent(id)}`); return data },

    async send(id, payload) {
      const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/send`, payload || {})
      if (data?.contract) return { ...data, contract: normalizeContract(data.contract) }
      return data
    },

    async markSent(id) { const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/mark-sent`); return normalizeContract(data) },
    async generatePdf(id, opts) {
      const force = !!opts?.force
      const qs = force ? '?force=true' : ''
      const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/generate-pdf${qs}`)
      return normalizeContract(data)
    },

    // ✅ URL ready pour window.open
    openPdfUrl(id) { return contractOpenPdfUrl(id) },

    async markViewed(id) { const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/mark-viewed`); return normalizeContract(data) },
    async markSigned(id, payload) { const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/mark-signed`, payload || {}); return normalizeContract(data) },
    async markDeclined(id, payload) { const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/mark-declined`, payload || {}); return normalizeContract(data) },
    async markExpired(id) { const { data } = await http.post(`/contracts/${encodeURIComponent(id)}/mark-expired`); return normalizeContract(data) },
  },

  invoices: {
    async list(params) { const { data } = await http.get('/invoices', { params }); return normalizeInvoicesList(data) },
    async get(id) { const { data } = await http.get(`/invoices/${encodeURIComponent(id)}`); return normalizeInvoice(data) },
    async create(payload) { const { data } = await http.post('/invoices', payload); return normalizeInvoice(data) },
    async update(id, payload) { const { data } = await http.patch(`/invoices/${encodeURIComponent(id)}`, payload); return normalizeInvoice(data) },
    async remove(id) { const { data } = await http.delete(`/invoices/${encodeURIComponent(id)}`); return data },
    async markSent(id) { const { data } = await http.post(`/invoices/${encodeURIComponent(id)}/mark-sent`); return normalizeInvoice(data) },
    async markPaid(id) { const { data } = await http.post(`/invoices/${encodeURIComponent(id)}/mark-paid`); return normalizeInvoice(data) },
    async generatePdf(id) { const { data } = await http.post(`/invoices/${encodeURIComponent(id)}/generate-pdf`); return normalizeInvoice(data) },

    openPdfUrl(id) { return invoiceOpenPdfUrl(id) },

    async send(id, payload) {
      const { data } = await http.post(`/invoices/${encodeURIComponent(id)}/send`, payload || {})
      if (data?.invoice) return { ...data, invoice: normalizeInvoice(data.invoice) }
      return data
    },
  },

  // ✅ NEW: REPORTS (dashboard)
  reports: {
    async overview(params) {
      const { data } = await http.get('/reports/overview', { params })
      return data
    },
    leads: {
      async timeseries(params) {
        const { data } = await http.get('/reports/leads/timeseries', { params })
        return data
      },
      async list(params) {
        const { data } = await http.get('/reports/leads/list', { params })
        return data
      },
      async funnel(params) {
        const { data } = await http.get('/reports/leads/funnel', { params })
        return data
      },
      async sources(params) {
        const { data } = await http.get('/reports/leads/sources', { params })
        return data
      },
      async performance(params) {
        const { data } = await http.get('/reports/leads/performance', { params })
        return data
      },
      async actions(params) {
        const { data } = await http.get('/reports/leads/actions', { params })
        return data
      },
    },
    docs: {
      async timeseries(params) {
        const { data } = await http.get('/reports/docs/timeseries', { params })
        return data
      },
    },
    invoices: {
      async recentPaid(params) {
        const { data } = await http.get('/reports/invoices/recent-paid', { params })
        return data
      },
    },
    quotes: {
      async pending(params) {
        const { data } = await http.get('/reports/quotes/pending', { params })
        return data
      },
    },
    contracts: {
      async active(params) {
        const { data } = await http.get('/reports/contracts/active', { params })
        return data
      },
      async signed(params) {
        const { data } = await http.get('/reports/contracts/signed', { params })
        return data
      },
    },
    sales: {
      async revenue(params) {
        const { data } = await http.get('/reports/sales/revenue', { params })
        return data
      },
      async docs(params) {
        const { data } = await http.get('/reports/sales/docs', { params })
        return data
      },
    },
  },

  templates: {
    async list(params) { const { data } = await http.get('/templates', { params }); return data },
    async get(id) { const { data } = await http.get(`/templates/${encodeURIComponent(id)}`); return data },
    async create(payload) { const { data } = await http.post('/templates', payload); return data },
    async update(id, payload) { const { data } = await http.patch(`/templates/${encodeURIComponent(id)}`, payload); return data },
    async remove(id) { const { data } = await http.delete(`/templates/${encodeURIComponent(id)}`); return data },
    async activate(id) { const { data } = await http.post(`/templates/${encodeURIComponent(id)}/activate`); return data },
  },

  public: {
    async profile(tenantSlug, userSlug) {
      const { data } = await http.get(`/public/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}`)
      return data
    },
    async createLead(tenantSlug, userSlug, payload) {
      const { data } = await http.post(`/public/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}/leads`, payload)
      return data
    },
    vcardUrl(tenantSlug, userSlug) {
      return apiAssetUrl(`/public/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}/vcard`)
    },
    async quoteByToken(tenantSlug, token) {
      const { data } = await http.get(`/public/t/${encodeURIComponent(tenantSlug)}/q/${encodeURIComponent(token)}`)
      return normalizeQuote(data)
    },
    async contractByToken(tenantSlug, token) {
      const { data } = await http.get(`/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}`)
      return normalizeContract(data)
    },
    contracts: {
      async markViewed(tenantSlug, token) { const { data } = await http.post(`/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}/viewed`); return data },
      async decline(tenantSlug, token, payload) { const { data } = await http.post(`/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}/decline`, payload || {}); return data },
      async sign(tenantSlug, token, payload) { const { data } = await http.post(`/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}/sign`, payload || {}); return data },
      async generatePdf(tenantSlug, token, opts) {
        const force = !!opts?.force
        const qs = force ? '?force=true' : ''
        const { data } = await http.post(`/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}/generate-pdf${qs}`)
        const doc = data?.contract || data
        return normalizeContract(doc)
      },
      openPdfUrl(tenantSlug, token) {
        return apiAssetUrl(`/contracts/public/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}/pdf/open`)
      },
    },
  },

  // ✅ NEW: SUPERADMIN (bootstrap tenants + admins)
  admin: {
    tenants: {
      async upsert(payload) {
        const { data } = await http.post('/admin/tenants', payload)
        return data
      },
      async upsertAdmin(tenantId, payload) {
        const { data } = await http.post(`/admin/tenants/${encodeURIComponent(tenantId)}/admin`, payload)
        return data
      },
    },
  },
}