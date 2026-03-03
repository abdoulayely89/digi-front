// src/pages/invoices/InvoicesPage.jsx
import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
  Popconfirm,
  Alert,
  Grid,
  Divider,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  MailOutlined,
  CheckOutlined,
  DollarOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'
import { AuthContext } from '../../context/AuthContext'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }
function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
function unwrap(res) { return res?.data ?? res } // ✅ robust: axios response or plain json

function moneyFmt(amount, currency) {
  const x = n(amount)
  const cur = safeStr(currency || 'XOF') || 'XOF'
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(x)
  } catch {
    return `${x.toLocaleString('fr-FR')} ${cur}`
  }
}

function statusColor(st) {
  const s = upper(st)
  if (s === 'PAID') return 'green'
  if (s === 'SENT') return 'blue'
  if (s === 'OVERDUE') return 'red'
  return 'gold'
}

function statusLabel(st) {
  const s = upper(st)
  if (s === 'PAID') return 'Payée'
  if (s === 'SENT') return 'Envoyée'
  if (s === 'OVERDUE') return 'En retard'
  return 'Brouillon'
}

function openUrl(u) {
  const url = safeStr(u)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * ✅ IMPORTANT (anti ExpiredToken)
 * On ouvre toujours le PDF via l’endpoint backend:
 *   GET /invoices/:id/pdf/open  -> 302 -> signed URL fraîche (GCS)
 * => lien stable, pas d’URL expirante copiée côté UI
 */
function openInvoicePdfUrl(inv) {
  const id = safeStr(inv?._id || inv?.id)
  if (!id) return ''
  if (api?.invoices?.openPdfUrl) return api.invoices.openPdfUrl(id)
  return `/invoices/${encodeURIComponent(id)}/pdf/open` // fallback safe
}

export default function InvoicesPage() {
  const { message } = AntApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens?.md

  const auth = useContext(AuthContext)
  const hasAuth = !!auth?.token && !!auth?.isAuthed

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [q, setQ] = useState('')

  const [form] = Form.useForm()

  const [contractsLoading, setContractsLoading] = useState(false)
  const [contracts, setContracts] = useState([])

  // Anti “vertical text”
  const noVerticalText = {
    minWidth: 0,
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  }

  const cellEllipsis = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }

  const canCreateInvoice = hasAuth

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.invoices.list()
      const data = unwrap(res)
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      setItems(list)
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Erreur chargement factures')
    } finally {
      setLoading(false)
    }
  }, [message])

  const loadContractsForPicker = useCallback(async () => {
    if (!hasAuth) {
      message.error("Non autorisé. Connecte-toi pour charger les contrats.")
      return
    }

    setContractsLoading(true)
    try {
      if (!api?.contracts?.list) {
        message.error("api.contracts.list(...) n'existe pas dans src/api/api.js")
        return
      }

      const res = await api.contracts.list({ limit: 200 })
      const data = unwrap(res)
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      setContracts(list)

      if (!list.length) {
        // petit hint UX : pas d’erreur, mais pas de contrats trouvés
        message.info("Aucun contrat disponible (ou filtre côté backend).")
      }
    } catch (e) {
      const st = e?.response?.status
      if (st === 401 || st === 403) {
        message.error("Non autorisé. Connecte-toi pour accéder aux contrats.")
      } else {
        message.error(e?.response?.data?.error || e?.message || 'Erreur chargement contrats')
      }
    } finally {
      setContractsLoading(false)
    }
  }, [hasAuth, message])

  const loadContractsForListSilent = useCallback(async () => {
    // ✅ ne pas spammer l’API si pas connecté
    if (!hasAuth) return
    try {
      if (!api?.contracts?.list) return
      const res = await api.contracts.list({ limit: 200 })
      const data = unwrap(res)
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      setContracts(list)
    } catch {
      // silent
    }
  }, [hasAuth])

  useEffect(() => {
    loadInvoices()
    loadContractsForListSilent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ si l’utilisateur se connecte après coup, on recharge les contrats
  useEffect(() => {
    if (hasAuth) loadContractsForListSilent()
  }, [hasAuth, loadContractsForListSilent])

  const contractsById = useMemo(() => {
    const m = new Map()
    for (const c of (contracts || [])) {
      const id = safeStr(c?._id || c?.id)
      if (id) m.set(id, c)
    }
    return m
  }, [contracts])

  function resolveContractForInvoice(inv) {
    const contractId =
      safeStr(inv?.contractId?._id || inv?.contractId?.id) ||
      safeStr(inv?.contractId) ||
      safeStr(inv?.renderSnapshot?.contract?._id) ||
      safeStr(inv?.renderSnapshot?.contract?.id) ||
      ''
    if (!contractId) return null
    return contractsById.get(contractId) || null
  }

  const contractOptions = useMemo(() => {
    return (contracts || []).map((c) => {
      const id = safeStr(c?._id || c?.id)
      const number = safeStr(c?.contractNumber)
      const title = safeStr(c?.title)
      const clientName = safeStr(c?.client?.name || c?.renderSnapshot?.client?.name)
      const total = n(c?.totals?.total ?? c?.amount ?? 0)
      const cur = safeStr(c?.currency || 'XOF') || 'XOF'

      if (isMobile) {
        const compact = [number || title || 'Contrat', clientName || 'Client', moneyFmt(total, cur)].filter(Boolean)
        return { value: id, label: compact.join(' • ') }
      }

      const full = []
      if (number) full.push(number)
      if (title) full.push(title)
      if (clientName) full.push(clientName)
      full.push(moneyFmt(total, cur))

      return { value: id, label: full.join(' — ') }
    })
  }, [contracts, isMobile])

  function resetContractDerivedFields(contractId) {
    form.setFieldsValue({
      contractId: contractId || undefined,
      clientName: '',
      clientCompany: '',
      contractTitle: '',
      contractNumber: '',
      currency: 'XOF',
      amount: 0,
    })
  }

  function findContractById(id) {
    const sid = safeStr(id)
    if (!sid) return null
    return (contracts || []).find((c) => safeStr(c?._id || c?.id) === sid) || null
  }

  async function onContractChange(raw) {
    const contractId = safeStr(raw?.value ?? raw)
    if (!contractId) {
      resetContractDerivedFields()
      return
    }

    let c = findContractById(contractId)
    if (!c) {
      try {
        const res = await api.contracts.get(contractId)
        c = unwrap(res)
      } catch (e) {
        resetContractDerivedFields(contractId)
        message.error(e?.response?.data?.error || e?.message || 'Impossible de charger le contrat')
        return
      }
    }

    const client = c?.client || c?.renderSnapshot?.client || {}
    form.setFieldsValue({
      contractId,
      clientName: safeStr(client?.name),
      clientCompany: safeStr(client?.company),
      contractTitle: safeStr(c?.title),
      contractNumber: safeStr(c?.contractNumber),
      currency: safeStr(c?.currency || 'XOF') || 'XOF',
      amount: n(c?.totals?.total ?? c?.amount ?? 0),
    })
  }

  function onOpenCreate() {
    setDrawerOpen(true)
    form.resetFields()
    resetContractDerivedFields()

    // ✅ ne tente pas de charger si non connecté
    if (hasAuth && !contracts?.length) loadContractsForPicker()
  }

  function onCloseCreate() {
    setDrawerOpen(false)
    form.resetFields()
  }

  async function submitCreate() {
    try {
      if (!canCreateInvoice) {
        return message.error("Non autorisé. Connecte-toi pour créer des factures.")
      }

      const v = await form.validateFields()
      const contractId = safeStr(v.contractId)
      if (!contractId) return message.error('Veuillez sélectionner un contrat')

      setActionLoading(true)
      const res = await api.invoices.create({ contractId, status: 'DRAFT' })
      const created = unwrap(res)

      message.success('Facture créée')
      setDrawerOpen(false)
      form.resetFields()

      await loadInvoices()

      // ✅ on ouvre via URL stable (anti ExpiredToken)
      const stable = openInvoicePdfUrl(created)
      if (stable) openUrl(stable)
    } catch (e) {
      if (e?.errorFields) return

      const status = e?.response?.status
      if (status === 401 || status === 403) {
        return message.error("Non autorisé. Connecte-toi pour créer des factures.")
      }

      message.error(e?.response?.data?.error || e?.message || 'Création facture impossible')
    } finally {
      setActionLoading(false)
    }
  }

  async function actGeneratePdf(inv) {
    const id = safeStr(inv?._id || inv?.id)
    if (!id) return
    setActionLoading(true)
    try {
      await api.invoices.generatePdf(id)
      message.success('PDF généré')
      openUrl(openInvoicePdfUrl({ _id: id }))
      await loadInvoices()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Erreur génération PDF')
    } finally {
      setActionLoading(false)
    }
  }

  async function actSend(inv) {
    const id = safeStr(inv?._id || inv?.id)
    if (!id) return
    setActionLoading(true)
    try {
      if (!api?.invoices?.send) return message.error("api.invoices.send(...) n'existe pas dans src/api/api.js")
      await api.invoices.send(id, {})
      message.success('Email envoyé')
      openUrl(openInvoicePdfUrl({ _id: id }))
      await loadInvoices()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Erreur envoi email')
    } finally {
      setActionLoading(false)
    }
  }

  async function actMarkSent(inv) {
    const id = safeStr(inv?._id || inv?.id)
    if (!id) return
    setActionLoading(true)
    try {
      await api.invoices.markSent(id)
      message.success('Facture marquée envoyée')
      await loadInvoices()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Erreur mark sent')
    } finally {
      setActionLoading(false)
    }
  }

  async function actMarkPaid(inv) {
    const id = safeStr(inv?._id || inv?.id)
    if (!id) return
    setActionLoading(true)
    try {
      await api.invoices.markPaid(id)
      message.success('Facture marquée payée')
      await loadInvoices()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Erreur mark paid')
    } finally {
      setActionLoading(false)
    }
  }

  // ---------- UI Premium ----------
  const pageBg = {
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(22,163,74,0.18), transparent 55%),' +
      'radial-gradient(1200px 600px at 85% 10%, rgba(2,132,199,0.16), transparent 55%),' +
      'radial-gradient(1200px 600px at 60% 100%, rgba(245,158,11,0.14), transparent 60%)',
    borderRadius: 20,
    padding: isMobile ? 10 : 14,
  }

  const headerCardStyle = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      'linear-gradient(135deg, rgba(22,163,74,0.14), rgba(2,132,199,0.10) 55%, rgba(245,158,11,0.10))',
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

  const kpis = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    const total = list.length
    const paid = list.filter(x => upper(x?.status) === 'PAID').length
    const sent = list.filter(x => upper(x?.status) === 'SENT').length
    const overdue = list.filter(x => upper(x?.status) === 'OVERDUE').length
    return { total, paid, sent, overdue }
  }, [items])

  const dataSource = useMemo(() => {
    const list = (items || []).map((it) => ({ ...it, key: safeStr(it?._id || it?.id) }))
    const qq = safeStr(q).toLowerCase()
    if (!qq) return list

    return list.filter((r) => {
      const invNo = safeStr(r?.invoiceNumber).toLowerCase()
      const st = safeStr(r?.status).toLowerCase()

      const linkedContract = resolveContractForInvoice(r)
      const snapClient = r?.renderSnapshot?.client || r?.client || null
      const contractClient = linkedContract?.client || linkedContract?.renderSnapshot?.client || null
      const c = snapClient || contractClient || {}
      const name = safeStr(c?.name).toLowerCase()
      const company = safeStr(c?.company).toLowerCase()

      const snapContract = r?.renderSnapshot?.contract || {}
      const cn = (safeStr(snapContract?.contractNumber) || safeStr(linkedContract?.contractNumber)).toLowerCase()
      const title = (safeStr(snapContract?.title) || safeStr(linkedContract?.title)).toLowerCase()

      return (
        invNo.includes(qq) ||
        st.includes(qq) ||
        name.includes(qq) ||
        company.includes(qq) ||
        cn.includes(qq) ||
        title.includes(qq)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, contractsById])

  const columns = useMemo(() => {
    if (isMobile) {
      return [
        {
          title: 'Factures',
          render: (_, r) => {
            const st = upper(r?.status)
            const linkedContract = resolveContractForInvoice(r)
            const snapClient = r?.renderSnapshot?.client || r?.client || null
            const contractClient = linkedContract?.client || linkedContract?.renderSnapshot?.client || null
            const c = snapClient || contractClient || {}
            const name = safeStr(c?.name) || '—'
            const company = safeStr(c?.company)

            const snapContract = r?.renderSnapshot?.contract || {}
            const cn = safeStr(snapContract?.contractNumber) || safeStr(linkedContract?.contractNumber)
            const title = safeStr(snapContract?.title) || safeStr(linkedContract?.title)

            const cur = safeStr(r?.currency || linkedContract?.currency || 'XOF') || 'XOF'
            const amt = n(r?.amount ?? linkedContract?.totals?.total ?? linkedContract?.amount ?? 0)

            return (
              <Space direction="vertical" size={6} style={{ width: '100%', ...noVerticalText }}>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={noVerticalText}>{safeStr(r?.invoiceNumber) || '—'}</Text>
                  <Tag color={statusColor(st)} style={{ borderRadius: 999 }}>{statusLabel(st)}</Tag>
                </Space>

                <Text type="secondary" style={{ fontSize: 12, ...noVerticalText }}>
                  {name}{company ? ` · ${company}` : ''}
                </Text>

                <Text type="secondary" style={{ fontSize: 12, ...noVerticalText }}>
                  {cn || title ? `${cn || 'Contrat'}${title ? ` · ${title}` : ''}` : '—'}
                </Text>

                <Text style={{ fontWeight: 900 }}>{moneyFmt(amt, cur)}</Text>

                <Space wrap size={8}>
                  <Tooltip title="Ouvrir PDF (lien stable anti-expiration)">
                    <Button size="small" icon={<FilePdfOutlined />} onClick={() => openUrl(openInvoicePdfUrl(r))}>
                      PDF
                    </Button>
                  </Tooltip>

                  <Button size="small" icon={<FilePdfOutlined />} onClick={() => actGeneratePdf(r)} loading={actionLoading}>
                    Générer
                  </Button>

                  <Button size="small" icon={<MailOutlined />} onClick={() => actSend(r)} loading={actionLoading}>
                    Email
                  </Button>

                  <Popconfirm
                    title="Marquer cette facture comme payée ?"
                    okText="Oui"
                    cancelText="Non"
                    onConfirm={() => actMarkPaid(r)}
                  >
                    <Button size="small" icon={<DollarOutlined />} disabled={st === 'PAID'} loading={actionLoading}>
                      Payée
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
        dataIndex: 'invoiceNumber',
        key: 'invoiceNumber',
        width: 190,
        render: (v) => <Text strong style={cellEllipsis}>{safeStr(v) || '—'}</Text>,
      },
      {
        title: 'Statut',
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (v) => <Tag color={statusColor(v)} style={{ borderRadius: 999 }}>{statusLabel(v)}</Tag>,
      },
      {
        title: 'Client',
        key: 'client',
        width: 260,
        render: (_, r) => {
          const snapClient = r?.renderSnapshot?.client || r?.client || null
          const linkedContract = resolveContractForInvoice(r)
          const contractClient = linkedContract?.client || linkedContract?.renderSnapshot?.client || null
          const c = snapClient || contractClient || {}
          const name = safeStr(c?.name)
          const company = safeStr(c?.company)
          if (!name && !company) return '—'
          return (
            <div style={{ lineHeight: 1.15, maxWidth: '100%' }}>
              <div style={{ fontWeight: 700, ...cellEllipsis }}>{name || '—'}</div>
              {company ? <Text type="secondary" style={cellEllipsis}>{company}</Text> : null}
            </div>
          )
        },
      },
      {
        title: 'Contrat',
        key: 'contract',
        width: 270,
        render: (_, r) => {
          const snap = r?.renderSnapshot?.contract || {}
          const linkedContract = resolveContractForInvoice(r)
          const cn = safeStr(snap?.contractNumber) || safeStr(linkedContract?.contractNumber)
          const title = safeStr(snap?.title) || safeStr(linkedContract?.title)
          if (!cn && !title) return '—'
          return (
            <div style={{ lineHeight: 1.15, maxWidth: '100%' }}>
              <div style={{ fontWeight: 700, ...cellEllipsis }}>{cn || '—'}</div>
              {title ? <Text type="secondary" style={cellEllipsis}>{title}</Text> : null}
            </div>
          )
        },
      },
      {
        title: 'Montant',
        key: 'amount',
        width: 170,
        align: 'right',
        render: (_, r) => {
          const linkedContract = resolveContractForInvoice(r)
          const cur = safeStr(r?.currency || linkedContract?.currency || 'XOF') || 'XOF'
          const amt = n(r?.amount ?? linkedContract?.totals?.total ?? linkedContract?.amount ?? 0)
          return <Text style={{ fontWeight: 900 }}>{moneyFmt(amt, cur)}</Text>
        },
      },
      {
        title: 'Créée',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 170,
        render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 320,
        fixed: 'right',
        render: (_, r) => {
          const st = upper(r?.status)
          return (
            <Space size="small" wrap>
              <Tooltip title="Ouvrir PDF (lien stable anti-expiration)">
                <Button icon={<FilePdfOutlined />} onClick={() => openUrl(openInvoicePdfUrl(r))} />
              </Tooltip>

              <Tooltip title="Générer PDF">
                <Button icon={<FilePdfOutlined />} onClick={() => actGeneratePdf(r)} loading={actionLoading} />
              </Tooltip>

              <Tooltip title="Envoyer par email">
                <Button icon={<MailOutlined />} onClick={() => actSend(r)} loading={actionLoading} />
              </Tooltip>

              <Tooltip title="Marquer envoyée">
                <Button
                  icon={<CheckOutlined />}
                  disabled={st === 'SENT' || st === 'PAID'}
                  onClick={() => actMarkSent(r)}
                  loading={actionLoading}
                />
              </Tooltip>

              <Popconfirm
                title="Marquer cette facture comme payée ?"
                okText="Oui"
                cancelText="Non"
                onConfirm={() => actMarkPaid(r)}
              >
                <Tooltip title="Marquer payée">
                  <Button icon={<DollarOutlined />} disabled={st === 'PAID'} loading={actionLoading} />
                </Tooltip>
              </Popconfirm>
            </Space>
          )
        },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionLoading, isMobile, contractsById])

  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 620 }

  return (
    <PageFrame title="Factures" subtitle="Gestion des factures (PDF stable, email, statuts).">
      <div style={pageBg}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          {/* Header premium */}
          <Card bordered={false} style={headerCardStyle} styles={{ body: { padding: isMobile ? 12 : 14 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={14}>
                <Space align="center" style={noVerticalText}>
                  <div style={iconBadge('linear-gradient(135deg, rgba(22,163,74,0.92), rgba(255,255,255,0.06))')}>
                    <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div style={noVerticalText}>
                    <Title level={4} style={{ margin: 0, ...noVerticalText }}>Factures</Title>
                    <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
                      PDF, envoi email, et suivi du statut (brouillon → envoyée → payée).
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col xs={24} md={10}>
                <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => { loadInvoices(); loadContractsForListSilent() }}
                    loading={loading}
                    style={{ borderRadius: 14 }}
                  >
                    Actualiser
                  </Button>

                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onOpenCreate}
                    style={{ borderRadius: 14 }}
                    disabled={!canCreateInvoice}
                  >
                    Nouvelle facture
                  </Button>
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 10 }} align="middle">
              <Col xs={24} md={16}>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher (N°, client, contrat, statut...)"
                  allowClear
                  prefix={<SearchOutlined style={{ opacity: 0.55 }} />}
                  style={{ borderRadius: 14 }}
                />
              </Col>

              <Col xs={24} md={8}>
                <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  <Tag icon={<RiseOutlined />} style={{ borderRadius: 999 }}>Total: {kpis.total}</Tag>
                  <Tag color="green" style={{ borderRadius: 999 }}>Payées: {kpis.paid}</Tag>
                  <Tag color="blue" style={{ borderRadius: 999 }}>Envoyées: {kpis.sent}</Tag>
                  <Tag color="red" style={{ borderRadius: 999 }}>En retard: {kpis.overdue}</Tag>
                </Space>
              </Col>
            </Row>
          </Card>

          {!hasAuth ? (
            <Alert
              type="warning"
              showIcon
              style={{ borderRadius: 14 }}
              message="Authentification"
              description="Session inactive (ds_token/ds_user manquants). Connecte-toi pour créer / envoyer des factures."
            />
          ) : null}

          {/* Table */}
          <Card bordered={false} style={softPanel} styles={{ body: { padding: isMobile ? 10 : 12 } }}>
            <Table
              loading={loading}
              columns={columns}
              dataSource={dataSource}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size={isMobile ? 'small' : 'middle'}
              tableLayout="fixed"
              scroll={{ x: isMobile ? 980 : 1200 }}
              locale={{
                emptyText: (
                  <div style={{ padding: 16 }}>
                    <Empty
                      description={
                        <div style={{ color: 'var(--muted)' }}>
                          Aucune facture pour le moment.<br />
                          <span style={{ fontSize: 12 }}>
                            Crée une facture depuis un contrat, puis génère le PDF et envoie-la.
                          </span>
                        </div>
                      }
                    >
                      <Space wrap>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={onOpenCreate}
                          style={{ borderRadius: 14 }}
                          disabled={!canCreateInvoice}
                        >
                          Nouvelle facture
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={loadInvoices} style={{ borderRadius: 14 }}>
                          Rafraîchir
                        </Button>
                      </Space>
                    </Empty>
                  </div>
                ),
              }}
            />
            <style>{`
              .ant-table-thead > tr > th {
                background: rgba(17,24,39,0.02) !important;
              }
            `}</style>
          </Card>

          {/* Drawer create */}
          <Drawer
            title="Nouvelle facture"
            open={drawerOpen}
            onClose={onCloseCreate}
            placement={drawerPlacement}
            {...drawerSizeProps}
            destroyOnClose
            extra={
              <Space>
                <Button onClick={onCloseCreate} style={{ borderRadius: 14 }}>Annuler</Button>
                <Button type="primary" onClick={submitCreate} loading={actionLoading} style={{ borderRadius: 14 }} disabled={!canCreateInvoice}>
                  Créer
                </Button>
              </Space>
            }
          >
            {!hasAuth ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12, borderRadius: 14 }}
                message="Non connecté"
                description="Connecte-toi pour charger les contrats et créer une facture."
              />
            ) : (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12, borderRadius: 14 }}
                message="Contrat → Facture"
                description="Sélectionne un contrat : client + devise + total seront remplis automatiquement."
              />
            )}

            <Form layout="vertical" form={form} initialValues={{ currency: 'XOF', amount: 0 }}>
              <Card size="small" style={{ borderRadius: 14 }}>
                <Text strong style={{ display: 'block' }}>Informations</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Choisis le contrat à facturer.
                </Text>
                <Divider style={{ margin: '12px 0' }} />

                <Form.Item
                  label="Contrat"
                  name="contractId"
                  rules={[{ required: true, message: 'Sélectionner un contrat' }]}
                >
                  <Select
                    placeholder={hasAuth ? 'Choisir un contrat' : 'Connecte-toi pour voir les contrats'}
                    loading={contractsLoading}
                    options={contractOptions}
                    showSearch
                    disabled={!hasAuth}
                    filterOption={(input, option) =>
                      String(option?.label || '').toLowerCase().includes(String(input || '').toLowerCase())
                    }
                    onDropdownVisibleChange={(open) => {
                      if (!hasAuth) return
                      if (open && !contracts?.length) loadContractsForPicker()
                    }}
                    onChange={onContractChange}
                  />
                </Form.Item>

                {!contractsLoading && hasAuth && !contracts?.length ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12, borderRadius: 14 }}
                    message="Aucun contrat"
                    description="Aucun contrat n’a été trouvé. Vérifie que des contrats existent et que l’API /contracts les renvoie pour ton rôle/tenant."
                  />
                ) : null}

                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Item label="Client (auto)" name="clientName">
                      <Input disabled placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item label="Société (auto)" name="clientCompany">
                      <Input disabled placeholder="—" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="N° Contrat (auto)" name="contractNumber">
                      <Input disabled placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Titre contrat (auto)" name="contractTitle">
                      <Input disabled placeholder="—" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col span={10}>
                    <Form.Item label="Devise (auto)" name="currency">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col span={14}>
                    <Form.Item label="Total (auto)" name="amount">
                      <InputNumber
                        style={{ width: '100%' }}
                        disabled
                        readOnly
                        controls={false}
                        formatter={(v) => {
                          const cur = form.getFieldValue('currency') || 'XOF'
                          return moneyFmt(v, cur)
                        }}
                        parser={(v) => String(v || '').replace(/[^\d.-]/g, '')}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Form>
          </Drawer>
        </Space>
      </div>
    </PageFrame>
  )
}