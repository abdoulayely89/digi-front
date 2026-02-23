// src/pages/dashboard/SalesDashboard.jsx
import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Grid,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  TeamOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageFrame from '../../ui/components/PageFrame'
import { AuthContext } from '../../context/AuthContext'
import { api } from '../../api/api'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function safeStr(v) { return String(v ?? '').trim() }
function unwrap(res) { return res?.data ?? res }

async function safeCall(fn, args, fallbackValue) {
  try {
    if (typeof fn !== 'function') return fallbackValue
    const r = await fn(args)
    return unwrap(r)
  } catch {
    return fallbackValue
  }
}

function money(v) {
  const n = safeNum(v)
  return n.toLocaleString('fr-FR')
}

// ✅ helper client name (ton doc est dans renderSnapshot.client)
function contractClientName(c) {
  return (
    c?.renderSnapshot?.client?.name ||
    c?.leadId?.contact?.name ||
    c?.lead?.contact?.name ||
    '—'
  )
}
function contractClientCompany(c) {
  return (
    c?.renderSnapshot?.client?.company ||
    c?.leadId?.contact?.company ||
    c?.lead?.contact?.company ||
    ''
  )
}

export default function SalesDashboard() {
  const { user, tenant } = useContext(AuthContext)
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

  const [overview, setOverview] = useState(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerKey, setDrawerKey] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [drawerPayload, setDrawerPayload] = useState(null)

  const [leadQ, setLeadQ] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const o = await api.reports.overview(params)
        if (!mounted) return
        setOverview(unwrap(o))
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

  const k = overview?.kpis || {}
  const titleSubtitle = tenant ? `${tenant.name} · ${user?.name || ''}` : '...'

  const openKpiDetails = useCallback(async (key) => {
    setDrawerKey(key)
    setDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerError('')
    setDrawerPayload(null)
    setSelectedLead(null)

    try {
      if (key === 'leads') {
        const list = await safeCall(
          api.reports?.leads?.list,
          { ...params, q: leadQ, page: 1, limit: 50 },
          { items: [], total: 0 }
        )

        const list2 = (Array.isArray(list?.items) && list.items.length > 0)
          ? list
          : await safeCall(api.leads?.list, { ...params, q: leadQ, page: 1, limit: 50 }, { items: [], total: 0 })

        setDrawerPayload({ list: list2 })
      }

      if (key === 'quotes') {
        const pending = await safeCall(api.reports?.quotes?.pending, { ...params, limit: 50 }, { items: [] })
        setDrawerPayload({
          items: Array.isArray(pending?.items) ? pending.items : (Array.isArray(pending) ? pending : []),
        })
      }

      if (key === 'contracts') {
        // ✅ 1) on tente reports.contracts.signed (si tu l’as)
        const signed = await safeCall(api.reports?.contracts?.signed, { ...params, limit: 50 }, null)

        // ✅ 2) fallback solide: /contracts?status=SIGNED&from&to
        const fallback = !signed
          ? await safeCall(api.contracts?.list, { ...params, status: 'SIGNED', limit: 50 }, { items: [] })
          : null

        const src = signed || fallback || { items: [] }
        const items = Array.isArray(src?.items) ? src.items : (Array.isArray(src) ? src : [])
        setDrawerPayload({ items })
      }
    } catch (e) {
      setDrawerError(e?.response?.data?.error || e?.message || 'Erreur chargement détails')
    } finally {
      setDrawerLoading(false)
    }
  }, [params, leadQ])

  useEffect(() => {
    if (!drawerOpen || drawerKey !== 'leads') return
    const t = setTimeout(() => {
      openKpiDetails('leads')
    }, 250)
    return () => clearTimeout(t)
  }, [leadQ]) // eslint-disable-line react-hooks/exhaustive-deps

  // UI anti texte vertical
  const noVerticalText = {
    minWidth: 0,
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  }

  const pageBg = {
    background:
      'radial-gradient(1200px 600px at 20% 0%, rgba(24,144,255,0.22), transparent 55%),' +
      'radial-gradient(1200px 600px at 85% 10%, rgba(82,196,26,0.18), transparent 55%),' +
      'radial-gradient(1200px 600px at 60% 100%, rgba(250,84,28,0.18), transparent 60%)',
    borderRadius: 20,
    padding: isMobile ? 10 : 14,
  }

  const headerCardStyle = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      'linear-gradient(135deg, rgba(24,144,255,0.18), rgba(82,196,26,0.12) 55%, rgba(250,84,28,0.12))',
  }

  function iconBadge(bg) {
    return {
      width: 40,
      height: 40,
      borderRadius: 14,
      display: 'grid',
      placeItems: 'center',
      background: bg,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
      flex: '0 0 auto',
    }
  }

  function kpiCard({ title, value, hint, icon, accent, onClick }) {
    return (
      <Card
        bordered={false}
        loading={loading}
        onClick={onClick}
        style={{
          cursor: 'pointer',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.10)',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
          position: 'relative',
        }}
        styles={{ body: { padding: isMobile ? 14 : 16 } }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -1,
            background: `radial-gradient(520px 220px at 25% 0%, ${accent}, transparent 60%)`,
            opacity: 0.62,
            pointerEvents: 'none',
          }}
        />

        <Space direction="vertical" size={10} style={{ width: '100%', position: 'relative', ...noVerticalText }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between', ...noVerticalText }}>
            <Space align="center" style={noVerticalText}>
              <div style={iconBadge(`linear-gradient(135deg, ${accent}, rgba(255,255,255,0.06))`)}>
                {icon}
              </div>
              <div style={noVerticalText}>
                <Text strong style={{ fontSize: 14, ...noVerticalText }}>{title}</Text>
                <div>
                  <Text style={{ color: 'var(--muted)', fontSize: 12, ...noVerticalText }}>
                    Cliquez pour détails
                  </Text>
                </div>
              </div>
            </Space>

            <Tag icon={<RiseOutlined />} style={{ borderRadius: 999, marginInlineStart: 0 }}>
              KPI
            </Tag>
          </Space>

          <Statistic
            value={value}
            valueStyle={{
              fontSize: isMobile ? 28 : 34,
              fontWeight: 800,
              letterSpacing: -0.5,
              textShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          />

          <Text style={{ color: 'var(--muted)', fontSize: 12, ...noVerticalText }}>
            {hint}
          </Text>
        </Space>
      </Card>
    )
  }

  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 980 }
  const tableScrollX = { x: 'max-content' }

  const prospectsColumns = isMobile
    ? [{
        title: 'Prospects',
        render: (_, r) => (
          <Space direction="vertical" size={2} style={noVerticalText}>
            <Text strong style={noVerticalText}>{r?.contact?.name || '—'}</Text>
            <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
              {(r?.contact?.company ? `${r.contact.company} · ` : '')}{r?.contact?.email || '—'}
            </Text>
            <Space wrap size={6}>
              <Tag style={{ borderRadius: 999 }}>{String(r?.status || '—')}</Tag>
              <Text style={{ color: 'var(--muted)' }}>
                {r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'}
              </Text>
            </Space>
          </Space>
        ),
      }]
    : [
        {
          title: 'Nom',
          render: (_, r) => (
            <Space direction="vertical" size={0} style={noVerticalText}>
              <Text strong style={noVerticalText}>{r?.contact?.name || '—'}</Text>
              <Text style={{ color: 'var(--muted)', ...noVerticalText }}>{r?.contact?.company || ''}</Text>
            </Space>
          ),
          ellipsis: true,
        },
        {
          title: 'Contact',
          render: (_, r) => (
            <Space direction="vertical" size={0} style={noVerticalText}>
              <Text style={noVerticalText}>{r?.contact?.email || '—'}</Text>
              <Text style={{ color: 'var(--muted)', ...noVerticalText }}>{r?.contact?.phone || ''}</Text>
            </Space>
          ),
          ellipsis: true,
        },
        { title: 'Statut', dataIndex: 'status', render: (v) => <Tag style={{ borderRadius: 999 }}>{String(v || '—')}</Tag>, width: 130 },
        { title: 'Créé', render: (_, r) => (r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'), width: 130 },
      ]

  const quoteColumns = isMobile
    ? [{
        title: 'Devis',
        render: (_, r) => (
          <Space direction="vertical" size={2} style={noVerticalText}>
            <Text strong>{r?.quoteNumber || '—'}</Text>
            <Text>{money(r?.totals?.total ?? r?.amount ?? 0)} FCFA</Text>
            <Tag style={{ borderRadius: 999 }}>{String(r?.status || '').toUpperCase() || '—'}</Tag>
          </Space>
        ),
      }]
    : [
        { title: 'Devis', dataIndex: 'quoteNumber', render: (v) => <Text strong>{v}</Text>, width: 180, ellipsis: true },
        { title: 'Statut', dataIndex: 'status', render: (v) => <Tag style={{ borderRadius: 999 }}>{String(v || '').toUpperCase()}</Tag>, width: 140 },
        { title: 'Total', align: 'right', render: (_, r) => `${money(r?.totals?.total ?? r?.amount ?? 0)} FCFA`, width: 180 },
      ]

  const contractSignedColumns = isMobile
    ? [{
        title: 'Contrats signés',
        render: (_, r) => (
          <Space direction="vertical" size={2} style={noVerticalText}>
            <Text strong>{r?.contractNumber || '—'}</Text>
            <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
              {contractClientName(r)} {contractClientCompany(r) ? `· ${contractClientCompany(r)}` : ''}
            </Text>
            <Space wrap size={6}>
              <Tag style={{ borderRadius: 999, background: 'rgba(82,196,26,0.18)', borderColor: 'rgba(82,196,26,0.25)' }}>
                SIGNED
              </Tag>
              <Text style={{ color: 'var(--muted)' }}>
                {r?.signedAt ? dayjs(r.signedAt).format('YYYY-MM-DD') : '—'}
              </Text>
            </Space>
            <Text>{money(r?.totals?.total ?? r?.amount ?? 0)} FCFA</Text>
          </Space>
        ),
      }]
    : [
        { title: 'Contrat', dataIndex: 'contractNumber', render: (v) => <Text strong>{v}</Text>, width: 200, ellipsis: true },
        { title: 'Client', render: (_, r) => contractClientName(r), ellipsis: true },
        { title: 'Société', render: (_, r) => contractClientCompany(r) || '—', ellipsis: true },
        { title: 'Signé le', render: (_, r) => (r?.signedAt ? dayjs(r.signedAt).format('YYYY-MM-DD') : '—'), width: 130 },
        { title: 'Total', align: 'right', render: (_, r) => `${money(r?.totals?.total ?? r?.amount ?? 0)} FCFA`, width: 180 },
        { title: 'Statut', render: () => <Tag style={{ borderRadius: 999, background: 'rgba(82,196,26,0.18)', borderColor: 'rgba(82,196,26,0.25)' }}>SIGNED</Tag>, width: 120 },
      ]

  return (
    <PageFrame title="Dashboard" subtitle={titleSubtitle}>
      <div style={pageBg}>
        <Space direction="vertical" size={14} style={{ width: '100%', ...noVerticalText }}>
          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Card bordered={false} style={headerCardStyle} styles={{ body: { padding: isMobile ? 12 : 14 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={12}>
                <Space direction="vertical" size={2} style={{ width: '100%', ...noVerticalText }}>
                  <Title level={4} style={{ margin: 0, ...noVerticalText }}>
                    Activité commerciale
                  </Title>
                  <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
                    Suivi sur la période (filtré automatiquement pour le commercial connecté)
                  </Text>
                </Space>
              </Col>
              <Col xs={24} md={12}>
                <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  <Tag style={{ borderRadius: 999, paddingInline: 10, paddingBlock: 4 }}>
                    {tenant?.slug || 'tenant'}
                  </Tag>
                  <DatePicker.RangePicker value={range} onChange={setRange} />
                </Space>
              </Col>
            </Row>
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              {kpiCard({
                title: 'Prospects',
                value: safeNum(k.leadsNew),
                hint: 'Leads créés sur la période',
                icon: <TeamOutlined style={{ fontSize: 18 }} />,
                accent: 'rgba(24,144,255,0.95)',
                onClick: () => openKpiDetails('leads'),
              })}
            </Col>

            <Col xs={24} md={8}>
              {kpiCard({
                title: 'Devis en cours',
                value: safeNum(k.quotesSent),
                hint: 'SENT / VIEWED',
                icon: <FileTextOutlined style={{ fontSize: 18 }} />,
                accent: 'rgba(250,84,28,0.92)',
                onClick: () => openKpiDetails('quotes'),
              })}
            </Col>

            <Col xs={24} md={8}>
              {kpiCard({
                title: 'Contrats signés',
                value: safeNum(k.contractsSigned),
                hint: 'SIGNED sur la période',
                icon: <SafetyCertificateOutlined style={{ fontSize: 18 }} />,
                accent: 'rgba(82,196,26,0.92)',
                onClick: () => openKpiDetails('contracts'),
              })}
            </Col>
          </Row>

          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            placement={drawerPlacement}
            {...drawerSizeProps}
            title={
              <Space wrap style={noVerticalText}>
                <Text strong>Détails</Text>
                {drawerKey ? <Tag style={{ borderRadius: 999 }}>{drawerKey}</Tag> : null}
                {!isMobile ? (
                  <Text style={{ color: 'var(--muted)' }}>
                    {range?.[0]?.format?.('YYYY-MM-DD')} → {range?.[1]?.format?.('YYYY-MM-DD')}
                  </Text>
                ) : null}
              </Space>
            }
          >
            {drawerError ? <Alert type="error" showIcon message={drawerError} style={{ marginBottom: 12 }} /> : null}
            {drawerLoading ? <Text style={{ color: 'var(--muted)' }}>Chargement…</Text> : null}

            {!drawerLoading && drawerKey === 'leads' ? (
              <Row gutter={[12, 12]}>
                <Col xs={24} lg={15}>
                  <Card
                    size="small"
                    title="Prospects"
                    extra={
                      <Input
                        value={leadQ}
                        onChange={(e) => setLeadQ(e.target.value)}
                        placeholder="Rechercher: nom, société, email, téléphone…"
                        allowClear
                        style={{ width: isMobile ? '100%' : 380 }}
                      />
                    }
                    style={{ borderRadius: 14 }}
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
                      columns={prospectsColumns}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={9}>
                  <Card size="small" title="Détails du prospect" style={{ borderRadius: 14 }}>
                    {!selectedLead ? (
                      <Empty description="Clique sur un prospect pour voir ses infos" />
                    ) : (
                      <Space direction="vertical" size={10} style={{ width: '100%', ...noVerticalText }}>
                        <div>
                          <Text style={{ color: 'var(--muted)' }}>Nom</Text>
                          <div><Text strong style={noVerticalText}>{selectedLead?.contact?.name || '—'}</Text></div>
                        </div>
                        <div>
                          <Text style={{ color: 'var(--muted)' }}>Société</Text>
                          <div><Text strong style={noVerticalText}>{selectedLead?.contact?.company || '—'}</Text></div>
                        </div>
                        <div>
                          <Text style={{ color: 'var(--muted)' }}>Email</Text>
                          <div><Text strong style={noVerticalText}>{selectedLead?.contact?.email || '—'}</Text></div>
                        </div>
                        <div>
                          <Text style={{ color: 'var(--muted)' }}>Téléphone</Text>
                          <div><Text strong style={noVerticalText}>{selectedLead?.contact?.phone || '—'}</Text></div>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Tag style={{ borderRadius: 999 }}>{String(selectedLead?.status || '—')}</Tag>
                        </div>
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>
            ) : null}

            {!drawerLoading && drawerKey === 'quotes' ? (
              <Card size="small" title="Devis en cours (SENT/VIEWED)" style={{ borderRadius: 14 }}>
                <Table
                  size="small"
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10 }}
                  dataSource={drawerPayload?.items || []}
                  locale={{ emptyText: <Empty description="Aucun devis" /> }}
                  scroll={tableScrollX}
                  tableLayout="fixed"
                  columns={quoteColumns}
                />
              </Card>
            ) : null}

            {!drawerLoading && drawerKey === 'contracts' ? (
              <Card size="small" title="Contrats signés" style={{ borderRadius: 14 }}>
                <Table
                  size="small"
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10 }}
                  dataSource={drawerPayload?.items || []}
                  locale={{
                    emptyText: (
                      <Empty
                        description="Aucun contrat signé sur la période. Si tu sais qu’il y en a, vérifie que /contracts supporte bien status=SIGNED + filtre date (signedAt)."
                      />
                    ),
                  }}
                  scroll={tableScrollX}
                  tableLayout="fixed"
                  columns={contractSignedColumns}
                />
              </Card>
            ) : null}
          </Drawer>
        </Space>
      </div>
    </PageFrame>
  )
}