// src/pages/quotes/QuotesPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  App as AntApp,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Divider,
  Popconfirm,
  Tooltip,
  Card,
  Empty,
  Grid,
  Row,
  Col,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  PlusOutlined,
  SendOutlined,
  SwapOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FilePdfOutlined,
  SearchOutlined,
  RiseOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }
function unwrap(res) { return res?.data ?? res }

function softTag(label, bg, fg, border) {
  return (
    <Tag
      style={{
        borderRadius: 999,
        padding: '2px 10px',
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        fontWeight: 800,
        letterSpacing: 0.2,
        marginInlineEnd: 0,
      }}
    >
      {label}
    </Tag>
  )
}

function statusTag(v) {
  const s = upper(v || 'DRAFT')
  if (s === 'ACCEPTED') return softTag('ACCEPTÉ', 'rgba(22,163,74,0.12)', '#166534', 'rgba(22,163,74,0.25)')
  if (s === 'SENT') return softTag('ENVOYÉ', 'rgba(245,158,11,0.12)', '#92400e', 'rgba(245,158,11,0.25)')
  if (s === 'VIEWED') return softTag('VU', 'rgba(2,132,199,0.10)', '#075985', 'rgba(2,132,199,0.22)')
  if (s === 'REJECTED') return softTag('REJETÉ', 'rgba(239,68,68,0.10)', '#991b1b', 'rgba(239,68,68,0.22)')
  if (s === 'EXPIRED') return softTag('EXPIRÉ', 'rgba(107,114,128,0.10)', '#374151', 'rgba(107,114,128,0.22)')
  if (s === 'CONVERTED') return softTag('CONVERTI', 'rgba(139,92,246,0.10)', '#5b21b6', 'rgba(139,92,246,0.22)')
  return softTag('BROUILLON', 'rgba(17,24,39,0.06)', '#111827', 'rgba(17,24,39,0.12)')
}

function fmtMoney(n, cur) {
  const x = Number(n || 0)
  const c = safeStr(cur || 'XOF') || 'XOF'
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(x)
  } catch {
    return `${x.toLocaleString('fr-FR')} ${c}`
  }
}

function openUrl(url) {
  const u = safeStr(url)
  if (!u) return
  window.open(u, '_blank', 'noopener,noreferrer')
}

async function copyText(messageApi, text) {
  const t = safeStr(text)
  if (!t) return messageApi.warning('Rien à copier')
  try {
    await navigator.clipboard.writeText(t)
    messageApi.success('Copié')
  } catch {
    messageApi.warning('Copie impossible — copie manuelle : ' + t)
  }
}

function getPdfUrl(row) {
  return safeStr(row?.pdf?.url) || safeStr(row?.pdf?.finalUrl) || ''
}

function publicQuoteUrl(row) {
  const token = safeStr(row?.publicToken)
  if (!token) return ''
  const tenantSlug =
    safeStr(row?.renderSnapshot?.company?.slug) ||
    safeStr(row?.tenantSlug) ||
    ''
  if (!tenantSlug) return ''
  return `${window.location.origin}/t/${encodeURIComponent(tenantSlug)}/q/${encodeURIComponent(token)}`
}

/**
 * ✅ IMPORTANT (anti ExpiredToken)
 * Si tu as un endpoint backend du type:
 *   GET /quotes/:id/pdf/open  -> 302 -> signed URL fraîche
 * tu peux l’exploiter ici via api.quotes.openPdfUrl(id).
 * Sinon on retombe sur l’URL stockée dans le doc (qui peut expirer).
 */
function openQuotePdfUrl(row) {
  const id = safeStr(row?._id || row?.id)
  if (!id) return ''
  if (api?.quotes?.openPdfUrl) return api.quotes.openPdfUrl(id)
  return getPdfUrl(row) || '' // fallback
}

function computeTotals(items = []) {
  let subtotal = 0
  let taxTotal = 0
  for (const it of items) {
    const qty = Number(it?.qty || 0)
    const unit = Number(it?.unitPrice || 0)
    const discount = Number(it?.discount || 0)
    const rate = Number(it?.taxRate || 0)
    const line = Math.max(0, qty * unit - discount)
    subtotal += line
    taxTotal += line * (rate / 100)
  }
  const total = subtotal + taxTotal
  return { subtotal, taxTotal, total }
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon ? <span style={{ opacity: 0.8 }}>{icon}</span> : null}
          <Text style={{ fontWeight: 900, fontSize: 14 }}>{title}</Text>
        </div>
        {subtitle ? (
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
    </div>
  )
}

function stop(e) {
  if (!e) return
  e.preventDefault?.()
  e.stopPropagation?.()
}

export default function QuotesPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens?.md

  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])

  // create drawer
  const [createOpen, setCreateOpen] = useState(false)

  // detail/edit drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(false)

  // lead select
  const [leadOptions, setLeadOptions] = useState([])
  const [leadLoading, setLeadLoading] = useState(false)

  // status update
  const [statusEditing, setStatusEditing] = useState('DRAFT')
  const [statusSaving, setStatusSaving] = useState(false)

  // saving edit
  const [editSaving, setEditSaving] = useState(false)

  // per-row sending + removing + pdf
  const [sendingId, setSendingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [pdfingId, setPdfingId] = useState(null)

  const [editForm] = Form.useForm()
  const [createForm] = Form.useForm()

  // UI anti texte vertical
  const noVerticalText = {
    minWidth: 0,
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  }

  const pageBg = {
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(24,144,255,0.22), transparent 55%),' +
      'radial-gradient(1200px 600px at 85% 10%, rgba(139,92,246,0.18), transparent 55%),' +
      'radial-gradient(1200px 600px at 60% 100%, rgba(250,84,28,0.16), transparent 60%)',
    borderRadius: 20,
    padding: isMobile ? 10 : 14,
  }

  const headerCardStyle = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      'linear-gradient(135deg, rgba(24,144,255,0.18), rgba(139,92,246,0.10) 55%, rgba(250,84,28,0.10))',
  }

  const softPanel = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
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

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.quotes.list({ q: q || undefined })
      const d = unwrap(data)
      setRows(Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []))
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible de charger les devis')
    } finally {
      setLoading(false)
    }
  }, [message, q])

  const loadLeads = useCallback(async () => {
    try {
      setLeadLoading(true)
      const data = await api.leads.list()
      const d = unwrap(data)
      const list = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : [])
      setLeadOptions(list.map(l => ({
        value: l._id,
        label: `${safeStr(l?.contact?.name) || '—'} ${safeStr(l?.contact?.phone) ? '· ' + safeStr(l.contact.phone) : ''}`.trim(),
      })))
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible de charger les prospects')
    } finally {
      setLeadLoading(false)
    }
  }, [message])

  useEffect(() => { load() }, []) // eslint-disable-line

  function openDetail(row, forceEdit = false) {
    setCurrent(row)
    setStatusEditing(upper(row?.status || 'DRAFT'))
    setEditing(!!forceEdit)
    setDetailOpen(true)

    const items = Array.isArray(row?.items) ? row.items : []
    editForm.setFieldsValue({
      title: safeStr(row?.title) || 'Devis',
      currency: safeStr(row?.currency) || 'XOF',
      notes: safeStr(row?.notes) || '',
      items: items.length
        ? items.map(it => ({
          label: safeStr(it?.label),
          qty: Number(it?.qty || 1),
          unitPrice: Number(it?.unitPrice || 0),
          discount: Number(it?.discount || 0),
          taxRate: Number(it?.taxRate || 0),
        }))
        : [{ label: 'Prestation', qty: 1, unitPrice: 100000, discount: 0, taxRate: 0 }],
    })
  }

  function closeDetail() {
    setDetailOpen(false)
    setCurrent(null)
    setEditing(false)
    editForm.resetFields()
  }

  async function markSent(row) {
    if (!row?._id) return
    try {
      setSendingId(row._id)
      if (api?.quotes?.send) {
        const res = await api.quotes.send(row._id, { origin: window.location.origin })
        const updated = res?.quote || res
        message.success('Devis envoyé par email')
        if (current && current._id === row._id && updated) {
          setCurrent(updated)
          setStatusEditing(upper(updated?.status || statusEditing))
        }
      } else {
        const updated = await api.quotes.markSent(row._id)
        message.success('Devis marqué comme envoyé')
        if (current && current._id === row._id) {
          setCurrent(updated)
          setStatusEditing(upper(updated?.status || statusEditing))
        }
      }
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible d’envoyer le devis')
    } finally {
      setSendingId(null)
    }
  }

  async function convertToContract(row) {
    if (!row?._id) return
    try {
      const res = await api.quotes.convertToContract(row._id)
      message.success('Contrat créé')
      await load()
      navigate('/contracts')
      return res
    } catch (e) {
      message.error(e?.response?.data?.message || 'Conversion impossible')
    }
  }

  async function onUpdateStatus() {
    if (!current?._id) return
    try {
      setStatusSaving(true)
      const updated = await api.quotes.update(current._id, { status: upper(statusEditing) })
      message.success('Statut mis à jour')
      setCurrent(updated)
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Mise à jour impossible')
    } finally {
      setStatusSaving(false)
    }
  }

  async function onSaveEdit() {
    if (!current?._id) return
    try {
      setEditSaving(true)
      const values = await editForm.validateFields()

      const payload = {
        title: values.title || 'Devis',
        currency: values.currency || 'XOF',
        notes: values.notes || '',
        items: (values.items || []).map(it => ({
          label: it.label,
          qty: Number(it.qty || 1),
          unitPrice: Number(it.unitPrice || 0),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
        })),
      }

      payload.totals = computeTotals(payload.items)

      const updated = await api.quotes.update(current._id, payload)
      message.success('Devis mis à jour')
      setCurrent(updated)
      setEditing(false)
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Sauvegarde impossible')
    } finally {
      setEditSaving(false)
    }
  }

  async function onRemove(row) {
    if (!row?._id) return
    try {
      setRemovingId(row._id)
      await api.quotes.remove(row._id)
      message.success('Devis supprimé')
      if (current && current._id === row._id) closeDetail()
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Suppression impossible')
    } finally {
      setRemovingId(null)
    }
  }

  async function onGeneratePdf(row) {
    if (!row?._id) return
    try {
      setPdfingId(row._id)
      if (!api?.quotes?.generatePdf) {
        return message.error('API generatePdf manquante côté front (api.quotes.generatePdf)')
      }
      const res = await api.quotes.generatePdf(row._id)
      const updated = res?.quote || res
      message.success('PDF généré')
      if (current && current._id === row._id && updated) setCurrent(updated)
      await load()

      const stable = openQuotePdfUrl(updated || row)
      if (stable) openUrl(stable)
    } catch (e) {
      message.error(e?.response?.data?.message || 'Génération PDF impossible')
    } finally {
      setPdfingId(null)
    }
  }

  async function copyLink(row) {
    const url = publicQuoteUrl(row)
    if (!url) return message.warning('Aucun lien public (publicToken ou tenant slug manquant)')
    await copyText(message, url)
  }

  async function copyPdfLink(row) {
    const url = openQuotePdfUrl(row) || getPdfUrl(row)
    if (!url) return message.warning('Aucun PDF disponible pour ce devis')
    await copyText(message, url)
  }

  const kpis = useMemo(() => {
    const list = Array.isArray(rows) ? rows : []
    const total = list.length
    const draft = list.filter(r => upper(r?.status) === 'DRAFT').length
    const inflight = list.filter(r => ['SENT', 'VIEWED'].includes(upper(r?.status))).length
    const accepted = list.filter(r => upper(r?.status) === 'ACCEPTED').length
    return { total, draft, inflight, accepted }
  }, [rows])

  const columns = useMemo(() => {
    if (isMobile) {
      return [
        {
          title: 'Devis',
          render: (_, row) => {
            const st = upper(row?.status || 'DRAFT')
            const isSending = sendingId === row._id
            const isRemoving = removingId === row._id
            const isPdfing = pdfingId === row._id
            const pdf = openQuotePdfUrl(row)

            return (
              <Space direction="vertical" size={6} style={noVerticalText}>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={noVerticalText}>{safeStr(row?.quoteNumber) || '—'}</Text>
                  {statusTag(st)}
                </Space>

                <Text style={{ color: 'var(--muted)', fontSize: 12, ...noVerticalText }}>
                  {safeStr(row?.client?.name) || '—'} {safeStr(row?.client?.phone) ? `· ${safeStr(row.client.phone)}` : ''}
                </Text>

                <Text style={{ fontWeight: 900 }}>
                  {fmtMoney(row?.totals?.total ?? 0, row?.currency)}
                </Text>

                <Space wrap size={8}>
                  <Button icon={<EyeOutlined />} onClick={(e) => { stop(e); openDetail(row, false) }}>Voir</Button>
                  <Button icon={<EditOutlined />} onClick={(e) => { stop(e); openDetail(row, true) }}>Éditer</Button>

                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={(e) => {
                      stop(e)
                      const url = pdf || getPdfUrl(row)
                      if (url) return openUrl(url)
                      return onGeneratePdf(row)
                    }}
                    loading={isPdfing}
                  >
                    PDF
                  </Button>

                  <Button
                    icon={<SendOutlined />}
                    onClick={(e) => { stop(e); markSent(row) }}
                    disabled={st !== 'DRAFT'}
                    loading={isSending}
                  >
                    Envoyer
                  </Button>

                  <Button
                    type="primary"
                    icon={<SwapOutlined />}
                    onClick={(e) => { stop(e); convertToContract(row) }}
                    disabled={st === 'CONVERTED'}
                  >
                    Contrat
                  </Button>

                  <Popconfirm
                    title="Supprimer ce devis ?"
                    okText="Supprimer"
                    cancelText="Annuler"
                    onConfirm={() => onRemove(row)}
                  >
                    <Button danger icon={<DeleteOutlined />} loading={isRemoving} onClick={stop}>
                      Suppr.
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            )
          },
        },
      ]
    }

    return [
      {
        title: 'N°',
        dataIndex: 'quoteNumber',
        key: 'quoteNumber',
        width: 180,
        ellipsis: true,
        render: (v) => <Text style={{ fontWeight: 900 }}>{safeStr(v) || '—'}</Text>,
      },
      {
        title: 'Client',
        key: 'client',
        ellipsis: true,
        render: (_, row) => (
          <div style={{ minWidth: 0 }}>
            <Text style={{ fontWeight: 800 }}>{safeStr(row?.client?.name) || '—'}</Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {safeStr(row?.client?.phone) || safeStr(row?.client?.email) || '—'}
              </Text>
            </div>
          </div>
        ),
      },
      {
        title: 'Statut',
        dataIndex: 'status',
        key: 'status',
        width: 160,
        render: statusTag,
      },
      {
        title: 'Total',
        dataIndex: ['totals', 'total'],
        key: 'total',
        width: 190,
        align: 'right',
        render: (v, row) => <Text style={{ fontWeight: 900 }}>{fmtMoney(v, row?.currency)}</Text>,
      },
      {
        title: 'Docs',
        key: 'docs',
        width: 160,
        align: 'center',
        render: (_, row) => {
          const url = openQuotePdfUrl(row) || getPdfUrl(row)
          const isPdfing = pdfingId === row._id
          return (
            <Space size={8} onClick={stop}>
              <Tooltip title={url ? 'Ouvrir PDF' : 'Générer le PDF'}>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => (url ? openUrl(url) : onGeneratePdf(row))}
                  loading={isPdfing}
                />
              </Tooltip>
              <Tooltip title="Copier lien PDF">
                <Button icon={<CopyOutlined />} onClick={() => copyPdfLink(row)} disabled={!url} />
              </Tooltip>
            </Space>
          )
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 340,
        fixed: 'right',
        render: (_, row) => {
          const st = upper(row?.status || 'DRAFT')
          const isSending = sendingId === row._id
          const isRemoving = removingId === row._id

          return (
            <Space wrap size={8} onClick={stop}>
              <Tooltip title="Voir">
                <Button icon={<EyeOutlined />} onClick={() => openDetail(row, false)} />
              </Tooltip>

              <Tooltip title="Modifier">
                <Button icon={<EditOutlined />} onClick={() => openDetail(row, true)} />
              </Tooltip>

              <Tooltip title={st === 'DRAFT' ? 'Envoyer le devis' : 'Envoyable uniquement en brouillon'}>
                <Button
                  icon={<SendOutlined />}
                  onClick={() => markSent(row)}
                  disabled={st !== 'DRAFT'}
                  loading={isSending}
                />
              </Tooltip>

              <Tooltip title="Copier lien public">
                <Button icon={<CopyOutlined />} onClick={() => copyLink(row)} />
              </Tooltip>

              <Tooltip title={st !== 'CONVERTED' ? 'Convertir en contrat' : 'Déjà converti'}>
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={() => convertToContract(row)}
                  disabled={st === 'CONVERTED'}
                />
              </Tooltip>

              <Popconfirm
                title="Supprimer ce devis ?"
                okText="Supprimer"
                cancelText="Annuler"
                onConfirm={() => onRemove(row)}
              >
                <Button danger icon={<DeleteOutlined />} loading={isRemoving} />
              </Popconfirm>
            </Space>
          )
        },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendingId, removingId, pdfingId, isMobile, rows])

  const emptyNode = (
    <Empty
      description={
        <div style={{ color: 'var(--muted)' }}>
          Aucun devis pour le moment.<br />
          <span style={{ fontSize: 12 }}>
            Crée un devis pour un prospect, puis envoie-le ou convertis-le en contrat.
          </span>
        </div>
      }
    >
      <Space wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setCreateOpen(true); loadLeads() }}
          style={{ borderRadius: 14 }}
        >
          Nouveau devis
        </Button>
        <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 14 }}>
          Rafraîchir
        </Button>
      </Space>
    </Empty>
  )

  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 980 }

  return (
    <PageFrame title="Devis" subtitle="Création, envoi email, PDF et conversion en contrat.">
      <div style={pageBg}>
        <Space direction="vertical" size={14} style={{ width: '100%', ...noVerticalText }}>
          {/* Header premium */}
          <Card bordered={false} style={headerCardStyle} styles={{ body: { padding: isMobile ? 12 : 14 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={14}>
                <Space align="center" style={noVerticalText}>
                  <div style={iconBadge('linear-gradient(135deg, rgba(24,144,255,0.95), rgba(255,255,255,0.06))')}>
                    <FileTextOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div style={noVerticalText}>
                    <Title level={4} style={{ margin: 0, ...noVerticalText }}>Devis</Title>
                    <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
                      Recherche, actions rapides, PDF, et conversion en contrat.
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col xs={24} md={10}>
                <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setCreateOpen(true); loadLeads() }}
                    style={{ borderRadius: 14 }}
                  >
                    Nouveau devis
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={load} loading={loading} style={{ borderRadius: 14 }}>
                    Rafraîchir
                  </Button>
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 10 }} align="middle">
              <Col xs={24} md={16}>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher (N°, client, email, statut...)"
                  allowClear
                  onPressEnter={load}
                  prefix={<SearchOutlined style={{ opacity: 0.55 }} />}
                  style={{ borderRadius: 14 }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  <Tag icon={<RiseOutlined />} style={{ borderRadius: 999 }}>Total: {kpis.total}</Tag>
                  <Tag style={{ borderRadius: 999 }}>Brouillons: {kpis.draft}</Tag>
                  <Tag style={{ borderRadius: 999 }}>En cours: {kpis.inflight}</Tag>
                  <Tag
                    style={{
                      borderRadius: 999,
                      background: 'rgba(22,163,74,0.12)',
                      borderColor: 'rgba(22,163,74,0.25)',
                      color: '#166534',
                      fontWeight: 800,
                    }}
                  >
                    Acceptés: {kpis.accepted}
                  </Tag>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Table */}
          <Card bordered={false} style={softPanel} styles={{ body: { padding: isMobile ? 10 : 12 } }}>
            <Table
              rowKey={(r) => r._id}
              loading={loading}
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: isMobile ? 'max-content' : 1200 }}
              tableLayout="fixed"
              locale={{ emptyText: emptyNode }}
              onRow={(row) => ({
                onClick: () => openDetail(row, false),
                style: { cursor: 'pointer' },
              })}
            />
            <style>{`
              .ant-table-thead > tr > th {
                background: rgba(17,24,39,0.02) !important;
              }
            `}</style>
          </Card>

          {/* =========================
              CREATE DRAWER
             ========================= */}
          <Drawer
            title="Créer un devis"
            open={createOpen}
            onClose={() => { setCreateOpen(false); createForm.resetFields() }}
            placement={drawerPlacement}
            width={isMobile ? undefined : 820}
            height={isMobile ? '92vh' : undefined}
            destroyOnClose
            styles={{
              header: { borderBottom: '1px solid rgba(255,255,255,0.10)' },
              body: { paddingBottom: 92 },
            }}
            extra={
              <Space>
                <Button onClick={() => { setCreateOpen(false); createForm.resetFields() }} style={{ borderRadius: 14 }}>
                  Annuler
                </Button>
                <Button type="primary" onClick={() => createForm.submit()} style={{ borderRadius: 14 }}>
                  Créer
                </Button>
              </Space>
            }
          >
            <Form
              form={createForm}
              layout="vertical"
              onFinish={async (values) => {
                try {
                  const payload = {
                    leadId: values.leadId,
                    title: values.title || 'Devis',
                    currency: values.currency || 'XOF',
                    notes: values.notes || '',
                    items: (values.items || []).map(it => ({
                      label: it.label,
                      qty: Number(it.qty || 1),
                      unitPrice: Number(it.unitPrice || 0),
                      discount: Number(it.discount || 0),
                      taxRate: Number(it.taxRate || 0),
                    })),
                  }
                  payload.totals = computeTotals(payload.items)

                  await api.quotes.create(payload)
                  message.success('Devis créé')
                  setCreateOpen(false)
                  createForm.resetFields()
                  await load()
                } catch (e) {
                  message.error(e?.response?.data?.message || 'Création impossible')
                }
              }}
              initialValues={{
                currency: 'XOF',
                items: [{ label: 'Prestation', qty: 1, unitPrice: 100000, discount: 0, taxRate: 0 }],
              }}
            >
              <Card size="small" style={{ borderRadius: 14 }}>
                <SectionTitle title="Informations" subtitle="Choisis un prospect et renseigne les infos de base." />
                <Divider style={{ margin: '12px 0' }} />

                <Form.Item label="Prospect" name="leadId" rules={[{ required: true, message: 'Choisis un prospect' }]}>
                  <Select
                    loading={leadLoading}
                    options={leadOptions}
                    showSearch
                    optionFilterProp="label"
                    placeholder="Choisir un prospect"
                    onDropdownVisibleChange={(open) => { if (open && !leadOptions.length) loadLeads() }}
                  />
                </Form.Item>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={16}>
                    <Form.Item label="Titre" name="title">
                      <Input placeholder="Ex: Devis - Abonnement DigiSuite" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Devise" name="currency">
                      <Select options={[{ value: 'XOF', label: 'XOF' }, { value: 'EUR', label: 'EUR' }]} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <div style={{ height: 12 }} />

              <Card size="small" style={{ borderRadius: 14 }}>
                <SectionTitle title="Lignes" subtitle="Ajoute les prestations et ajuste remises/TVA." />
                <Divider style={{ margin: '12px 0' }} />

                <Form.List name="items">
                  {(fields, { add, remove }) => (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {fields.map((field) => (
                        <div
                          key={field.key}
                          style={{
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: 12,
                          }}
                        >
                          <Row gutter={[12, 12]}>
                            <Col xs={24} md={10}>
                              <Form.Item
                                {...field}
                                label="Libellé"
                                name={[field.name, 'label']}
                                rules={[{ required: true, message: 'Libellé requis' }]}
                              >
                                <Input placeholder="Ex: Mise en place + paramétrage" />
                              </Form.Item>
                            </Col>

                            <Col xs={12} md={3}>
                              <Form.Item {...field} label="Qté" name={[field.name, 'qty']}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>

                            <Col xs={12} md={4}>
                              <Form.Item {...field} label="PU" name={[field.name, 'unitPrice']}>
                                <InputNumber min={0} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>

                            <Col xs={12} md={3}>
                              <Form.Item {...field} label="Remise" name={[field.name, 'discount']}>
                                <InputNumber min={0} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>

                            <Col xs={12} md={2}>
                              <Form.Item {...field} label="TVA %" name={[field.name, 'taxRate']}>
                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>

                            <Col xs={24} md={2} style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                              <Button danger onClick={() => remove(field.name)} style={{ borderRadius: 14 }}>
                                Supprimer
                              </Button>
                            </Col>
                          </Row>
                        </div>
                      ))}

                      <Button
                        onClick={() => add({ label: '', qty: 1, unitPrice: 0, discount: 0, taxRate: 0 })}
                        style={{ borderRadius: 14 }}
                      >
                        + Ajouter une ligne
                      </Button>
                    </div>
                  )}
                </Form.List>
              </Card>

              <div style={{ height: 12 }} />

              <Card size="small" style={{ borderRadius: 14 }}>
                <SectionTitle title="Notes" subtitle="Conditions, délais, périmètre, informations utiles…" />
                <Divider style={{ margin: '12px 0' }} />
                <Form.Item name="notes">
                  <Input.TextArea rows={4} placeholder="Ex: Validité 15 jours. Délai de livraison 7 jours…" />
                </Form.Item>
              </Card>
            </Form>
          </Drawer>

          {/* =========================
              DETAIL / EDIT DRAWER
             ========================= */}
          <Drawer
            open={detailOpen}
            onClose={closeDetail}
            placement={drawerPlacement}
            {...drawerSizeProps}
            destroyOnClose
            title={
              <Space wrap style={noVerticalText}>
                <Text strong>Détails devis</Text>
                {current?.status ? statusTag(current.status) : null}
                {current?.quoteNumber ? <Tag style={{ borderRadius: 999 }}>{safeStr(current.quoteNumber)}</Tag> : null}
              </Space>
            }
          >
            {!current ? <Empty description="Aucun devis sélectionné" /> : (() => {
              const st = upper(current?.status || 'DRAFT')
              const pub = publicQuoteUrl(current)
              const pdf = openQuotePdfUrl(current) || getPdfUrl(current)
              const totals = current?.totals || computeTotals(Array.isArray(current?.items) ? current.items : [])
              const items = Array.isArray(current?.items) ? current.items : []
              const client = current?.client || {}

              return (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {/* Actions top */}
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Row gutter={[10, 10]} align="middle">
                      <Col flex="auto" style={{ minWidth: 0 }}>
                        <Space direction="vertical" size={2} style={noVerticalText}>
                          <Text style={{ fontWeight: 900, fontSize: 16, ...noVerticalText }}>
                            {safeStr(current?.title) || 'Devis'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, ...noVerticalText }}>
                            {safeStr(client?.name) || '—'} {safeStr(client?.phone) ? `· ${safeStr(client.phone)}` : ''}
                          </Text>
                        </Space>
                      </Col>
                      <Col flex="none">
                        <Space wrap>
                          <Button icon={<CopyOutlined />} onClick={() => copyLink(current)} disabled={!pub} style={{ borderRadius: 14 }}>
                            Lien
                          </Button>
                          <Button
                            icon={<FilePdfOutlined />}
                            onClick={() => (pdf ? openUrl(pdf) : onGeneratePdf(current))}
                            loading={pdfingId === current?._id}
                            style={{ borderRadius: 14 }}
                          >
                            PDF
                          </Button>
                          <Button
                            icon={<SendOutlined />}
                            onClick={() => markSent(current)}
                            disabled={st !== 'DRAFT'}
                            loading={sendingId === current?._id}
                            style={{ borderRadius: 14 }}
                          >
                            Envoyer
                          </Button>
                          <Button
                            type="primary"
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => convertToContract(current)}
                            disabled={st === 'CONVERTED'}
                            style={{ borderRadius: 14 }}
                          >
                            Contrat
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  </Card>

                  {/* Infos + Totaux */}
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={14}>
                      <Card size="small" style={{ borderRadius: 14 }} title="Client">
                        <Space direction="vertical" size={8} style={{ width: '100%', ...noVerticalText }}>
                          <div>
                            <Text type="secondary">Nom</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.name) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Téléphone</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.phone) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Email</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.email) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Société</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.company) || '—'}</Text></div>
                          </div>
                        </Space>
                      </Card>
                    </Col>

                    <Col xs={24} lg={10}>
                      <Card size="small" style={{ borderRadius: 14 }} title="Résumé">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <Text type="secondary">Statut</Text>
                            {statusTag(current.status)}
                          </div>

                          <Divider style={{ margin: '8px 0' }} />

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <Text type="secondary">Sous-total</Text>
                            <Text strong>{fmtMoney(totals.subtotal, current.currency)}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <Text type="secondary">TVA</Text>
                            <Text strong>{fmtMoney(totals.taxTotal, current.currency)}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <Text>Net à payer</Text>
                            <Text style={{ fontWeight: 1000, fontSize: 16 }}>
                              {fmtMoney(totals.total, current.currency)}
                            </Text>
                          </div>

                          <Divider style={{ margin: '8px 0' }} />

                          <Space wrap>
                            <Select
                              value={statusEditing}
                              onChange={setStatusEditing}
                              style={{ width: isMobile ? '100%' : 220 }}
                              options={[
                                { value: 'DRAFT', label: 'BROUILLON' },
                                { value: 'SENT', label: 'ENVOYÉ' },
                                { value: 'VIEWED', label: 'VU' },
                                { value: 'ACCEPTED', label: 'ACCEPTÉ' },
                                { value: 'REJECTED', label: 'REJETÉ' },
                                { value: 'EXPIRED', label: 'EXPIRÉ' },
                                { value: 'CONVERTED', label: 'CONVERTI' },
                              ]}
                            />
                            <Button icon={<EditOutlined />} onClick={onUpdateStatus} loading={statusSaving} style={{ borderRadius: 14 }}>
                              Appliquer
                            </Button>
                          </Space>

                          <Space wrap>
                            <Button onClick={() => setEditing(true)} style={{ borderRadius: 14 }}>
                              Modifier
                            </Button>

                            <Popconfirm
                              title="Supprimer ce devis ?"
                              okText="Supprimer"
                              cancelText="Annuler"
                              onConfirm={() => onRemove(current)}
                            >
                              <Button danger icon={<DeleteOutlined />} loading={removingId === current?._id} style={{ borderRadius: 14 }}>
                                Supprimer
                              </Button>
                            </Popconfirm>

                            <Button
                              icon={<CopyOutlined />}
                              onClick={() => copyPdfLink(current)}
                              disabled={!pdf}
                              style={{ borderRadius: 14 }}
                            >
                              Copier lien PDF
                            </Button>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  {/* Lines */}
                  <Card size="small" style={{ borderRadius: 14 }} title={`Lignes (${items.length})`}>
                    <Table
                      rowKey={(r, idx) => String(idx)}
                      size="small"
                      pagination={false}
                      dataSource={items}
                      columns={[
                        { title: 'Libellé', dataIndex: 'label', key: 'label', ellipsis: true },
                        { title: 'Qté', dataIndex: 'qty', key: 'qty', width: 90, align: 'center' },
                        { title: 'PU', dataIndex: 'unitPrice', key: 'unitPrice', width: 170, align: 'right', render: (v) => fmtMoney(v, current.currency) },
                        { title: 'Remise', dataIndex: 'discount', key: 'discount', width: 140, align: 'right', render: (v) => fmtMoney(v, current.currency) },
                        { title: 'TVA %', dataIndex: 'taxRate', key: 'taxRate', width: 110, align: 'right', render: (v) => <Text>{Number(v || 0)}%</Text> },
                      ]}
                      scroll={{ x: 900 }}
                      tableLayout="fixed"
                    />
                  </Card>

                  {/* Edit mode */}
                  {editing ? (
                    <Card size="small" style={{ borderRadius: 14 }} title="Édition">
                      <Form form={editForm} layout="vertical" onFinish={onSaveEdit}>
                        <Row gutter={[12, 12]}>
                          <Col xs={24} md={16}>
                            <Form.Item label="Titre" name="title" rules={[{ required: true, message: 'Titre requis' }]}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item label="Devise" name="currency">
                              <Select options={[{ value: 'XOF', label: 'XOF' }, { value: 'EUR', label: 'EUR' }]} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Divider />

                        <Form.List name="items">
                          {(fields, { add, remove }) => (
                            <div style={{ display: 'grid', gap: 12 }}>
                              {fields.map((field) => (
                                <div
                                  key={field.key}
                                  style={{
                                    borderRadius: 14,
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    background: 'rgba(255,255,255,0.04)',
                                    padding: 12,
                                  }}
                                >
                                  <Row gutter={[12, 12]}>
                                    <Col xs={24} md={10}>
                                      <Form.Item
                                        {...field}
                                        label="Libellé"
                                        name={[field.name, 'label']}
                                        rules={[{ required: true, message: 'Libellé requis' }]}
                                      >
                                        <Input />
                                      </Form.Item>
                                    </Col>

                                    <Col xs={12} md={3}>
                                      <Form.Item {...field} label="Qté" name={[field.name, 'qty']}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>

                                    <Col xs={12} md={4}>
                                      <Form.Item {...field} label="PU" name={[field.name, 'unitPrice']}>
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>

                                    <Col xs={12} md={3}>
                                      <Form.Item {...field} label="Remise" name={[field.name, 'discount']}>
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>

                                    <Col xs={12} md={2}>
                                      <Form.Item {...field} label="TVA %" name={[field.name, 'taxRate']}>
                                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>

                                    <Col xs={24} md={2} style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                                      <Button danger onClick={() => remove(field.name)} style={{ borderRadius: 14 }}>
                                        Supprimer
                                      </Button>
                                    </Col>
                                  </Row>
                                </div>
                              ))}

                              <Button
                                onClick={() => add({ label: '', qty: 1, unitPrice: 0, discount: 0, taxRate: 0 })}
                                style={{ borderRadius: 14 }}
                              >
                                + Ajouter une ligne
                              </Button>
                            </div>
                          )}
                        </Form.List>

                        <Divider />

                        <Form.Item label="Notes" name="notes">
                          <Input.TextArea rows={4} />
                        </Form.Item>

                        <Space wrap>
                          <Button onClick={() => setEditing(false)} style={{ borderRadius: 14 }}>
                            Annuler
                          </Button>
                          <Button type="primary" htmlType="submit" loading={editSaving} style={{ borderRadius: 14 }}>
                            Enregistrer
                          </Button>
                        </Space>
                      </Form>
                    </Card>
                  ) : (
                    <Card size="small" style={{ borderRadius: 14 }} title="Notes">
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          borderRadius: 14,
                          border: '1px solid rgba(255,255,255,0.10)',
                          background: 'rgba(255,255,255,0.04)',
                          padding: 12,
                        }}
                      >
                        {safeStr(current?.notes) || '—'}
                      </div>
                    </Card>
                  )}
                </Space>
              )
            })()}
          </Drawer>
        </Space>
      </div>
    </PageFrame>
  )
}