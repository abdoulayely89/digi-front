// src/pages/dashboard/AdminDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Empty,
  Grid,
  Input,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  DollarOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function money(v) {
  const n = safeNum(v)
  return n.toLocaleString('fr-FR')
}
function safeStr(v) { return String(v ?? '').trim() }
function unwrap(res) { return res?.data ?? res }

// ✅ FIX: helpers manquants
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function isEmptyObject(v) { return isObj(v) && Object.keys(v).length === 0 }

// safe call helper (ne casse pas si fn n’existe pas)
async function safeCall(fn, args, fallbackValue) {
  try {
    if (typeof fn !== 'function') return fallbackValue
    const r = await fn(args)
    return unwrap(r)
  } catch {
    return fallbackValue
  }
}

/**
 * ✅ Fallback HTTP robuste :
 * - si api.reports.* n’existe pas => tente api.get('/reports/...', { params })
 * - sinon api.request({ url, method:'GET', params })
 */
async function httpGet(path, params, fallbackValue) {
  try {
    if (typeof api?.get === 'function') {
      const r = await api.get(path, { params })
      return unwrap(r)
    }
    if (typeof api?.request === 'function') {
      const r = await api.request({ url: path, method: 'GET', params })
      return unwrap(r)
    }
    return fallbackValue
  } catch {
    return fallbackValue
  }
}

// ✅ wrapper reports : utilise api.reports si dispo, sinon httpGet
const reports = {
  overview: (params) =>
    (api?.reports?.overview ? safeCall(api.reports.overview, params, {}) : httpGet('/reports/overview', params, {})),

  invoicesRecentPaid: (params) =>
    (api?.reports?.invoices?.recentPaid
      ? safeCall(api.reports.invoices.recentPaid, params, { items: [] })
      : httpGet('/reports/invoices/recent-paid', params, { items: [] })),

  quotesPending: (params) =>
    (api?.reports?.quotes?.pending
      ? safeCall(api.reports.quotes.pending, params, { items: [] })
      : httpGet('/reports/quotes/pending', params, { items: [] })),

  contractsActive: (params) =>
    (api?.reports?.contracts?.active
      ? safeCall(api.reports.contracts.active, params, { items: [] })
      : httpGet('/reports/contracts/active', params, { items: [] })),

  leadsTimeseries: (params) =>
    (api?.reports?.leads?.timeseries
      ? safeCall(api.reports.leads.timeseries, params, { items: [] })
      : httpGet('/reports/leads/timeseries', params, { items: [] })),

  docsTimeseries: (params) =>
    (api?.reports?.docs?.timeseries
      ? safeCall(api.reports.docs.timeseries, params, { items: [] })
      : httpGet('/reports/docs/timeseries', params, { items: [] })),

  leadsList: (params) =>
    (api?.reports?.leads?.list
      ? safeCall(api.reports.leads.list, params, { items: [], total: 0 })
      : httpGet('/reports/leads/list', params, { items: [], total: 0 })),
}

function statusTag(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'PAID') return <Tag color="green">Payée</Tag>
  if (v === 'SENT') return <Tag color="blue">Envoyée</Tag>
  if (v === 'OVERDUE') return <Tag color="red">En retard</Tag>
  if (v === 'DRAFT') return <Tag>Draft</Tag>
  return <Tag>{v || '—'}</Tag>
}

/**
 * Smooth sparkline (no deps)
 */
function SmoothSparkLine({ data, height = 96, formatValue }) {
  const w = 560
  const h = height
  const pad = 10

  const raw = Array.isArray(data) ? data : []
  const pts0 = raw
    .map((d, i) => ({
      i,
      value: safeNum(d?.value ?? d?.amount ?? 0),
      label: safeStr(d?.label ?? d?.date ?? ''),
    }))
    .filter((p) => Number.isFinite(p.value))

  if (pts0.length === 0) {
    return (
      <div style={{ height: h, display: 'flex', alignItems: 'center' }}>
        <Text style={{ opacity: 0.7 }}>—</Text>
      </div>
    )
  }

  const allSame = pts0.every((p) => p.value === pts0[0].value)
  if (pts0.length === 1 || allSame) {
    const v0 = pts0[0].value
    return (
      <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
        <Text style={{ opacity: 0.7, minWidth: 0 }}>
          Valeur: <Text strong>{formatValue ? formatValue(v0) : v0.toLocaleString('fr-FR')}</Text>
        </Text>
        <div style={{ width: 170, height: 3, background: 'currentColor', opacity: 0.18, borderRadius: 999 }} />
      </div>
    )
  }

  const values = pts0.map((p) => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const n = pts0.length
  const dx = (w - pad * 2) / Math.max(1, n - 1)

  function x(i) { return pad + i * dx }
  function y(v) {
    const denom = (max - min) || 1
    const t = (v - min) / denom
    return h - pad - t * (h - pad * 2)
  }

  const pts = pts0.map((p, i) => ({ ...p, x: x(i), y: y(p.value) }))
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const m = mid(p0, p1)
    d += ` Q ${p0.x} ${p0.y} ${m.x} ${m.y}`
    d += ` Q ${p1.x} ${p1.y} ${p1.x} ${p1.y}`
  }
  const area = `${d} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <path d={area} fill="currentColor" opacity="0.08" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.8" opacity="0.92" />
      {pts.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r="3.3" fill="currentColor" opacity="0.68">
          <title>
            {p.label ? `${p.label} · ` : ''}{formatValue ? formatValue(p.value) : p.value}
          </title>
        </circle>
      ))}
    </svg>
  )
}

/**
 * Fill missing days between range
 */
function fillDailySeries(range, items, pickValue, labelKey = 'date') {
  const start = range?.[0] ? dayjs(range[0]) : dayjs().subtract(30, 'day')
  const end = range?.[1] ? dayjs(range[1]) : dayjs()
  const days = Math.max(1, end.startOf('day').diff(start.startOf('day'), 'day') + 1)

  const map = new Map()
  ;(Array.isArray(items) ? items : []).forEach((r) => {
    const d = safeStr(r?.date)
    if (d) map.set(d, r)
  })

  const out = []
  for (let i = 0; i < days; i++) {
    const d = start.add(i, 'day').format('YYYY-MM-DD')
    const row = map.get(d)
    out.push({
      [labelKey]: d,
      value: row ? safeNum(pickValue(row)) : 0,
    })
  }
  return out
}

export default function AdminDashboard() {
  const screens = useBreakpoint()
  const isMobile = !screens?.md

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()])

  const params = useMemo(() => {
    if (!range?.[0] || !range?.[1]) return {}
    const from = range[0].toDate ? range[0].toDate() : new Date(range[0])
    const to = range[1].toDate ? range[1].toDate() : new Date(range[1])
    return { from: from.toISOString(), to: to.toISOString() }
  }, [range])

  const [data, setData] = useState(null)

  const [recentPaid, setRecentPaid] = useState([])
  const [pendingQuotes, setPendingQuotes] = useState([])
  const [activeContracts, setActiveContracts] = useState([])

  const [tsLeads, setTsLeads] = useState([])
  const [tsDocs, setTsDocs] = useState([])

  // Drawer details (KPI click)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerKey, setDrawerKey] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [drawerPayload, setDrawerPayload] = useState(null)

  // Prospects list + selected detail
  const [leadQ, setLeadQ] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)

  // --------- styles anti superposition ----------
  const shrink0 = { minWidth: 0 }
  const ellipsis1 = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }
  const wrapSafe = { overflowWrap: 'anywhere', wordBreak: 'break-word' }

  // Drawer responsive
  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 1080 }

  // Tables: évite le wrap vertical lettre-par-lettre
  const tableScrollX = { x: 'max-content' }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [overview, paidRes, quotesRes, contractsRes, leadsTsRes, docsTsRes] = await Promise.all([
          reports.overview(params),

          reports.invoicesRecentPaid({ ...params, limit: 8 }),
          reports.quotesPending({ ...params, limit: 8 }),
          reports.contractsActive({ ...params, limit: 8 }),

          reports.leadsTimeseries({ ...params, groupBy: 'day' }),
          reports.docsTimeseries({ ...params, groupBy: 'day' }),
        ])

        if (!mounted) return

        // ✅ FIX: overview doit être un objet non vide
        setData(isObj(overview) && !isEmptyObject(overview) ? overview : null)

        const paid = paidRes
        const quotes = quotesRes
        const contracts = contractsRes

        setRecentPaid(Array.isArray(paid?.items) ? paid.items : (Array.isArray(paid) ? paid : []))
        setPendingQuotes(Array.isArray(quotes?.items) ? quotes.items : (Array.isArray(quotes) ? quotes : []))
        setActiveContracts(Array.isArray(contracts?.items) ? contracts.items : (Array.isArray(contracts) ? contracts : []))

        setTsLeads(Array.isArray(leadsTsRes?.items) ? leadsTsRes.items : [])
        setTsDocs(Array.isArray(docsTsRes?.items) ? docsTsRes.items : [])
      } catch (e) {
        if (!mounted) return
        setError(e?.response?.data?.error || e?.message || 'Erreur chargement dashboard')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [params])

  const k = data?.kpis || {}
  const invoiceBreakdown = data?.breakdown?.invoices || {}
  const contractBreakdown = data?.breakdown?.contracts || {}
  const sales = Array.isArray(data?.sales) ? data.sales : []

  const paidAmt = safeNum(invoiceBreakdown?.PAID?.amount)
  const paidCnt = safeNum(invoiceBreakdown?.PAID?.count)
  const outstandingAmt = safeNum(k.outstanding)
  const collectedAmt = safeNum(k.revenueCollected)
  const maxCollected = Math.max(1, ...sales.map((r) => safeNum(r.collected)))

  // curves from endpoints
  const leadsSeries = useMemo(() => (
    fillDailySeries(range, tsLeads, (r) => r.created, 'date')
  ), [range, tsLeads])

  const quotesSentSeries = useMemo(() => (
    fillDailySeries(range, tsDocs, (r) => r.quotesSent, 'date')
  ), [range, tsDocs])

  const contractsSignedSeries = useMemo(() => (
    fillDailySeries(range, tsDocs, (r) => r.contractsSigned, 'date')
  ), [range, tsDocs])

  const invoicesPaidAmountSeries = useMemo(() => (
    fillDailySeries(range, tsDocs, (r) => r.revenueCollected, 'date')
  ), [range, tsDocs])

  const openKpiDetails = useCallback(async (key) => {
    setDrawerKey(key)
    setDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerError('')
    setDrawerPayload(null)
    setSelectedLead(null)

    try {
      if (key === 'leads') {
        const list = await reports.leadsList({ ...params, q: leadQ, page: 1, limit: 50 })
        setDrawerPayload({ list })
      }

      if (key === 'quotes') setDrawerPayload({ pendingQuotes })
      if (key === 'contracts') setDrawerPayload({ activeContracts })
      if (key === 'cash') setDrawerPayload({ recentPaid })
    } catch (e) {
      setDrawerError(e?.response?.data?.error || e?.message || 'Erreur chargement détails')
    } finally {
      setDrawerLoading(false)
    }
  }, [params, pendingQuotes, activeContracts, recentPaid, leadQ])

  // reload list inside drawer when searching
  useEffect(() => {
    if (!drawerOpen || drawerKey !== 'leads') return
    const t = setTimeout(() => {
      openKpiDetails('leads')
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadQ])

  // KPI clickable card
  const kpiCardStyle = {
    cursor: 'pointer',
    transition: 'transform .08s ease',
  }

  // -------- columns helpers ----------
  const prospectColumns = isMobile
    ? [
        {
          title: 'Prospects',
          render: (_, r) => (
            <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
              <Text strong style={wrapSafe}>{r?.contact?.name || r?.name || '—'}</Text>
              <Text style={{ opacity: 0.75, ...wrapSafe }}>
                {(r?.contact?.company ? `${r.contact.company} · ` : '')}{r?.contact?.email || '—'}
              </Text>
              <Space wrap size={6}>
                <Tag>{String(r?.status || '—')}</Tag>
                <Text style={{ opacity: 0.75 }}>
                  {r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'}
                </Text>
              </Space>
            </Space>
          ),
        },
      ]
    : [
        {
          title: 'Nom',
          render: (_, r) => (
            <div style={shrink0}>
              <Text strong style={{ display: 'block', ...ellipsis1 }}>{r?.contact?.name || r?.name || '—'}</Text>
              <Text style={{ display: 'block', opacity: 0.75, ...ellipsis1 }}>{r?.contact?.company || ''}</Text>
            </div>
          ),
          ellipsis: true,
        },
        {
          title: 'Contact',
          render: (_, r) => (
            <div style={shrink0}>
              <Text style={{ display: 'block', ...ellipsis1 }}>{r?.contact?.email || '—'}</Text>
              <Text style={{ display: 'block', opacity: 0.75, ...ellipsis1 }}>{r?.contact?.phone || ''}</Text>
            </div>
          ),
          ellipsis: true,
        },
        { title: 'Statut', dataIndex: 'status', render: (v) => <Tag>{String(v || '—')}</Tag>, width: 120 },
        { title: 'Commercial', render: (_, r) => r?.ownerId?.name || '—', width: 200, ellipsis: true },
        { title: 'Créé', render: (_, r) => (r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'), width: 130 },
      ]

  const compactTableColumns = (type) => {
    if (type === 'quotes') {
      return isMobile
        ? [
            {
              title: 'Devis',
              render: (_, r) => (
                <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
                  <Text strong style={wrapSafe}>{r?.quoteNumber || '—'}</Text>
                  <Text style={{ opacity: 0.75, ...wrapSafe }}>{r?.ownerId?.name || '—'}</Text>
                  <Text style={wrapSafe}>{money(r?.totals?.total ?? r?.amount ?? 0)} FCFA</Text>
                </Space>
              ),
            },
          ]
        : [
            { title: 'Devis', dataIndex: 'quoteNumber', render: (v) => <Text strong>{v}</Text>, width: 160, ellipsis: true },
            { title: 'Commercial', render: (_, r) => r?.ownerId?.name || '—', width: 220, ellipsis: true },
            { title: 'Total', align: 'right', render: (_, r) => `${money(r?.totals?.total ?? r?.amount ?? 0)} FCFA`, width: 170 },
          ]
    }

    if (type === 'contracts') {
      return isMobile
        ? [
            {
              title: 'Contrats',
              render: (_, r) => (
                <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
                  <Text strong style={wrapSafe}>{r?.contractNumber || '—'}</Text>
                  <Space wrap size={6}>
                    <Tag>{String(r?.status || '').toUpperCase()}</Tag>
                    <Text style={{ opacity: 0.75, ...wrapSafe }}>{r?.ownerId?.name || '—'}</Text>
                  </Space>
                </Space>
              ),
            },
          ]
        : [
            { title: 'Contrat', dataIndex: 'contractNumber', render: (v) => <Text strong>{v}</Text>, width: 160, ellipsis: true },
            { title: 'Statut', dataIndex: 'status', render: (v) => <Tag>{String(v || '').toUpperCase()}</Tag>, width: 120 },
            { title: 'Commercial', render: (_, r) => r?.ownerId?.name || '—', width: 220, ellipsis: true },
          ]
    }

    // invoices
    return isMobile
      ? [
          {
            title: 'Factures payées',
            render: (_, r) => (
              <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
                <Text strong style={wrapSafe}>{r?.invoiceNumber || '—'}</Text>
                <Text style={{ opacity: 0.75, ...wrapSafe }}>{r?.ownerId?.name || '—'}</Text>
                <Space wrap size={10}>
                  <Text style={wrapSafe}>{money(r?.amount ?? 0)} FCFA</Text>
                  <Text style={{ opacity: 0.75 }}>
                    {r?.paidAt ? dayjs(r.paidAt).format('YYYY-MM-DD') : '—'}
                  </Text>
                </Space>
              </Space>
            ),
          },
        ]
      : [
          { title: 'Facture', dataIndex: 'invoiceNumber', render: (v) => <Text strong>{v}</Text>, width: 160, ellipsis: true },
          { title: 'Commercial', render: (_, r) => r?.ownerId?.name || '—', width: 220, ellipsis: true },
          { title: 'Montant', align: 'right', render: (_, r) => `${money(r?.amount ?? 0)} FCFA`, width: 170 },
        ]
  }

  return (
    <PageFrame
      title="Admin"
      subtitle="Pilotage business: pipeline commercial, contrats, facturation et encaissements."
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {error ? <Alert type="error" showIcon message={error} /> : null}

        {/* TOP BAR (période) */}
        <Card>
          <Row gutter={[12, 12]} align="middle" wrap>
            <Col xs={24} md={18} style={shrink0}>
              <Space wrap align="center" size={10} style={{ width: '100%', ...shrink0 }}>
                <Text strong style={ellipsis1}>Période</Text>
                <DatePicker.RangePicker value={range} onChange={setRange} style={{ maxWidth: '100%' }} />
                {!isMobile ? (
                  <Text style={{ opacity: 0.75, ...ellipsis1 }}>
                    Source: <Text code>/reports/*</Text>
                  </Text>
                ) : null}
              </Space>
            </Col>
            <Col xs={24} md={6} style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              <Space wrap size={8} style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                <Tag icon={<RiseOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>KPI</Tag>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* KPI row */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} style={kpiCardStyle} onClick={() => openKpiDetails('leads')}>
              <Space direction="vertical" size={2} style={wrapSafe}>
                <Space align="center" style={shrink0}>
                  <TeamOutlined />
                  <Text style={ellipsis1}>Prospects</Text>
                </Space>
                <Statistic value={safeNum(k.leadsNew)} />
                <Text style={{ opacity: 0.75 }}>Clique pour voir la liste</Text>
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} style={kpiCardStyle} onClick={() => openKpiDetails('quotes')}>
              <Space direction="vertical" size={2} style={wrapSafe}>
                <Space align="center" style={shrink0}>
                  <FileTextOutlined />
                  <Text style={ellipsis1}>Devis envoyés</Text>
                </Space>
                <Statistic value={safeNum(k.quotesSent)} />
                <Text style={{ opacity: 0.75 }}>SENT / VIEWED</Text>
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} style={kpiCardStyle} onClick={() => openKpiDetails('contracts')}>
              <Space direction="vertical" size={2} style={wrapSafe}>
                <Space align="center" style={shrink0}>
                  <SafetyCertificateOutlined />
                  <Text style={ellipsis1}>Contrats signés</Text>
                </Space>
                <Statistic value={safeNum(k.contractsSigned)} />
                <Text style={{ opacity: 0.75 }}>
                  En cours: {safeNum(contractBreakdown?.ACTIVE?.count)} · Terminés: {safeNum(contractBreakdown?.DONE?.count)}
                </Text>
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} style={kpiCardStyle} onClick={() => openKpiDetails('cash')}>
              <Space direction="vertical" size={2} style={wrapSafe}>
                <Space align="center" style={shrink0}>
                  <DollarOutlined />
                  <Text style={ellipsis1}>Encaissements</Text>
                </Space>
                <Statistic value={money(collectedAmt)} suffix="FCFA" />
                <Text style={{ opacity: 0.75 }}>{paidCnt} factures payées</Text>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Breakdown + Trends */}
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card loading={loading} title={<span style={ellipsis1}>Facturation (répartition statuts)</span>}>
              <Row gutter={[12, 12]}>
                {Object.keys(invoiceBreakdown).length === 0 ? (
                  <Col xs={24}><Text style={{ opacity: 0.75 }}>Aucune facture sur la période</Text></Col>
                ) : (
                  Object.entries(invoiceBreakdown).map(([status, v]) => (
                    <Col xs={24} sm={12} key={status}>
                      <Card size="small" bodyStyle={{ padding: 12 }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between', ...shrink0 }}>
                          <Space direction="vertical" size={2} style={shrink0}>
                            {statusTag(status)}
                            <Text style={{ opacity: 0.75, ...ellipsis1 }}>{safeNum(v.count)} factures</Text>
                          </Space>
                          <Text strong style={ellipsis1}>{money(v.amount)} FCFA</Text>
                        </Space>
                      </Card>
                    </Col>
                  ))
                )}
              </Row>

              <Divider />
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <Card size="small" bodyStyle={{ padding: 12 }}>
                    <Text style={{ opacity: 0.75 }}>Total encaissé (PAID)</Text>
                    <Title level={4} style={{ margin: 0, ...wrapSafe }}>{money(paidAmt)} FCFA</Title>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small" bodyStyle={{ padding: 12 }}>
                    <Text style={{ opacity: 0.75 }}>Encours (non payé)</Text>
                    <Title level={4} style={{ margin: 0, ...wrapSafe }}>{money(outstandingAmt)} FCFA</Title>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card loading={loading} title={<span style={ellipsis1}>Tendances (courbes)</span>}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Card size="small" title="Leads / jour" bodyStyle={{ padding: 12 }}>
                    <div style={{ color: 'currentColor' }}>
                      <SmoothSparkLine data={leadsSeries.map((d) => ({ value: d.value, date: d.date, label: d.date }))} />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card size="small" title="Devis envoyés / jour" bodyStyle={{ padding: 12 }}>
                    <div style={{ color: 'currentColor' }}>
                      <SmoothSparkLine data={quotesSentSeries.map((d) => ({ value: d.value, date: d.date, label: d.date }))} />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card size="small" title="Contrats signés / jour" bodyStyle={{ padding: 12 }}>
                    <div style={{ color: 'currentColor' }}>
                      <SmoothSparkLine data={contractsSignedSeries.map((d) => ({ value: d.value, date: d.date, label: d.date }))} />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card size="small" title="Encaissements / jour" bodyStyle={{ padding: 12 }}>
                    <div style={{ color: 'currentColor' }}>
                      <SmoothSparkLine
                        data={invoicesPaidAmountSeries.map((d) => ({ value: d.value, date: d.date, label: d.date }))}
                        formatValue={(v) => `${money(v)} FCFA`}
                      />
                    </div>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Ops tables */}
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={8}>
            <Card loading={loading} title={<span style={ellipsis1}>Devis en attente</span>}>
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={false}
                dataSource={pendingQuotes}
                locale={{ emptyText: <Empty description="Aucun devis" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={compactTableColumns('quotes')}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card loading={loading} title={<span style={ellipsis1}>Contrats actifs</span>}>
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={false}
                dataSource={activeContracts}
                locale={{ emptyText: <Empty description="Aucun contrat" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={compactTableColumns('contracts')}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card loading={loading} title={<span style={ellipsis1}>Factures payées</span>}>
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={false}
                dataSource={recentPaid}
                locale={{ emptyText: <Empty description="Aucune facture payée" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={compactTableColumns('invoices')}
              />
            </Card>
          </Col>
        </Row>

        {/* Sales leaderboard */}
        <Row gutter={[12, 12]}>
          <Col xs={24}>
            <Card loading={loading} title={<span style={ellipsis1}>Performance par commercial</span>}>
              <Table
                rowKey={(r) => r.ownerId}
                pagination={{ pageSize: 8 }}
                dataSource={sales}
                locale={{ emptyText: <Empty description="Aucune donnée" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={[
                  {
                    title: 'Commercial',
                    render: (_, r) => (
                      <div style={shrink0}>
                        <Text strong style={{ display: 'block', ...ellipsis1 }}>
                          {r.owner?.name || (r.ownerId === 'unassigned' ? 'Non assigné' : '—')}
                        </Text>
                        <Text style={{ display: 'block', opacity: 0.75, ...ellipsis1 }}>
                          {r.owner?.email || ''}
                        </Text>
                      </div>
                    ),
                    width: isMobile ? 240 : 340,
                  },
                  {
                    title: 'Pipeline',
                    responsive: ['md'],
                    render: (_, r) => (
                      <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
                        <Text>Leads: <Text strong>{safeNum(r.leads)}</Text></Text>
                        <Text>Devis envoyés: <Text strong>{safeNum(r.quotesSent)}</Text></Text>
                        <Text>
                          Contrats: <Text strong>{safeNum(r.contracts)}</Text>
                          {' '} (signés {safeNum(r.signed)} · en cours {safeNum(r.active)} · terminés {safeNum(r.done)})
                        </Text>
                      </Space>
                    ),
                  },
                  {
                    title: 'Finance',
                    align: 'right',
                    render: (_, r) => (
                      <Space direction="vertical" size={2} style={{ width: isMobile ? 220 : 280, ...shrink0 }}>
                        <Text>Encaissé: <Text strong>{money(r.collected)} FCFA</Text></Text>
                        <Progress percent={Math.round((safeNum(r.collected) / maxCollected) * 100)} showInfo={false} />
                        <Text style={{ opacity: 0.75 }}>
                          Factures payées: <Text strong>{safeNum(r.invoicesPaid)}</Text>
                        </Text>
                      </Space>
                    ),
                    width: isMobile ? 240 : 300,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* KPI Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement={drawerPlacement}
          {...drawerSizeProps}
          title={
            <Space wrap style={{ ...shrink0, ...wrapSafe }}>
              <Text strong style={ellipsis1}>Détails KPI</Text>
              {drawerKey ? <Tag style={{ marginInlineEnd: 0 }}>{drawerKey}</Tag> : null}
              {!isMobile ? (
                <Text style={{ opacity: 0.75, ...ellipsis1 }}>
                  {range?.[0]?.format?.('YYYY-MM-DD')} → {range?.[1]?.format?.('YYYY-MM-DD')}
                </Text>
              ) : null}
            </Space>
          }
        >
          {drawerError ? <Alert type="error" showIcon message={drawerError} style={{ marginBottom: 12 }} /> : null}
          {drawerLoading ? <Text style={{ opacity: 0.75 }}>Chargement…</Text> : null}

          {!drawerLoading && drawerKey === 'leads' ? (
            <Row gutter={[12, 12]} wrap>
              <Col xs={24} lg={15}>
                <Card
                  size="small"
                  title="Prospects"
                  extra={
                    <Input
                      value={leadQ}
                      onChange={(e) => setLeadQ(e.target.value)}
                      placeholder="Rechercher…"
                      allowClear
                      style={{ width: isMobile ? '100%' : 360, maxWidth: '100%' }}
                    />
                  }
                >
                  <Table
                    size="small"
                    rowKey={(r) => r._id}
                    pagination={{ pageSize: 10 }}
                    dataSource={drawerPayload?.list?.items || []}
                    locale={{ emptyText: <Empty description="Aucun prospect" /> }}
                    scroll={tableScrollX}
                    tableLayout="fixed"
                    onRow={(r) => ({
                      onClick: () => setSelectedLead(r),
                      style: { cursor: 'pointer' },
                    })}
                    columns={prospectColumns}
                  />
                </Card>
              </Col>

              <Col xs={24} lg={9}>
                <Card size="small" title="Détails">
                  {!selectedLead ? (
                    <Empty description="Clique sur un prospect pour voir ses infos" />
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: '100%', ...wrapSafe }}>
                      <div>
                        <Text style={{ opacity: 0.75 }}>Nom</Text>
                        <div><Text strong style={wrapSafe}>{selectedLead?.contact?.name || selectedLead?.name || '—'}</Text></div>
                      </div>
                      <div>
                        <Text style={{ opacity: 0.75 }}>Société</Text>
                        <div><Text strong style={wrapSafe}>{selectedLead?.contact?.company || '—'}</Text></div>
                      </div>
                      <div>
                        <Text style={{ opacity: 0.75 }}>Email</Text>
                        <div><Text strong style={wrapSafe}>{selectedLead?.contact?.email || '—'}</Text></div>
                      </div>
                      <div>
                        <Text style={{ opacity: 0.75 }}>Téléphone</Text>
                        <div><Text strong style={wrapSafe}>{selectedLead?.contact?.phone || '—'}</Text></div>
                      </div>
                      <Divider style={{ margin: '8px 0' }} />
                      <Space wrap size={8}>
                        <Tag style={{ marginInlineEnd: 0 }}>{String(selectedLead?.status || '—')}</Tag>
                        <Text style={{ opacity: 0.75 }}>{selectedLead?.ownerId?.name || '—'}</Text>
                      </Space>
                      <div>
                        <Text style={{ opacity: 0.75 }}>Dernière action</Text>
                        <div>
                          <Text strong style={wrapSafe}>
                            {selectedLead?.nextActionAt ? dayjs(selectedLead.nextActionAt).format('YYYY-MM-DD HH:mm') : '—'}
                          </Text>
                        </div>
                      </div>
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>
          ) : null}

          {!drawerLoading && drawerKey === 'quotes' ? (
            <Card size="small" title="Devis en attente">
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={{ pageSize: 10 }}
                dataSource={drawerPayload?.pendingQuotes || []}
                locale={{ emptyText: <Empty description="Aucun devis" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={[
                  { title: 'Devis', dataIndex: 'quoteNumber', render: (v) => <Text strong>{v}</Text>, ellipsis: true },
                  { title: 'Commercial', responsive: ['md'], render: (_, r) => r?.ownerId?.name || '—', ellipsis: true },
                  { title: 'Total', align: 'right', render: (_, r) => `${money(r?.totals?.total ?? r?.amount ?? 0)} FCFA` },
                  { title: 'Statut', responsive: ['md'], dataIndex: 'status', render: (v) => <Tag>{String(v || '').toUpperCase()}</Tag> },
                ]}
              />
            </Card>
          ) : null}

          {!drawerLoading && drawerKey === 'contracts' ? (
            <Card size="small" title="Contrats actifs">
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={{ pageSize: 10 }}
                dataSource={drawerPayload?.activeContracts || []}
                locale={{ emptyText: <Empty description="Aucun contrat" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={[
                  { title: 'Contrat', dataIndex: 'contractNumber', render: (v) => <Text strong>{v}</Text>, ellipsis: true },
                  { title: 'Commercial', responsive: ['md'], render: (_, r) => r?.ownerId?.name || '—', ellipsis: true },
                  { title: 'Statut', dataIndex: 'status', render: (v) => <Tag>{String(v || '').toUpperCase()}</Tag> },
                ]}
              />
            </Card>
          ) : null}

          {!drawerLoading && drawerKey === 'cash' ? (
            <Card size="small" title="Factures payées">
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={{ pageSize: 10 }}
                dataSource={drawerPayload?.recentPaid || []}
                locale={{ emptyText: <Empty description="Aucune facture payée" /> }}
                scroll={tableScrollX}
                tableLayout="fixed"
                columns={[
                  { title: 'Facture', dataIndex: 'invoiceNumber', render: (v) => <Text strong>{v}</Text>, ellipsis: true },
                  { title: 'Commercial', responsive: ['md'], render: (_, r) => r?.ownerId?.name || '—', ellipsis: true },
                  { title: 'Montant', align: 'right', render: (_, r) => `${money(r?.amount ?? 0)} FCFA` },
                  { title: 'Payée le', responsive: ['md'], render: (_, r) => (r?.paidAt ? dayjs(r.paidAt).format('YYYY-MM-DD') : '—') },
                ]}
              />
            </Card>
          ) : null}
        </Drawer>
      </Space>
    </PageFrame>
  )
}