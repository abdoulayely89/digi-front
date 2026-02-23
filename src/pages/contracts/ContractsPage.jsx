// src/pages/contracts/ContractsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Drawer,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  Divider,
  Empty,
  Select,
  Popconfirm,
  Tooltip,
  Card,
  Grid,
  Row,
  Col,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  CopyOutlined,
  PlusOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  SearchOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }
function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

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
  if (s === 'SIGNED') return softTag('SIGNÉ', 'rgba(22,163,74,0.12)', '#166534', 'rgba(22,163,74,0.25)')
  if (s === 'SENT') return softTag('ENVOYÉ', 'rgba(2,132,199,0.10)', '#075985', 'rgba(2,132,199,0.22)')
  if (s === 'VIEWED') return softTag('VU', 'rgba(245,158,11,0.12)', '#92400e', 'rgba(245,158,11,0.25)')
  if (s === 'DECLINED') return softTag('REFUSÉ', 'rgba(239,68,68,0.10)', '#991b1b', 'rgba(239,68,68,0.22)')
  if (s === 'EXPIRED') return softTag('EXPIRÉ', 'rgba(107,114,128,0.10)', '#374151', 'rgba(107,114,128,0.22)')
  return softTag('BROUILLON', 'rgba(17,24,39,0.06)', '#111827', 'rgba(17,24,39,0.12)')
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('fr-FR')
  } catch {
    return '—'
  }
}

function money(n, cur) {
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

/**
 * 🔒 Anti-401 (window.open / iframe) :
 * - Ces contexts n'envoient PAS Authorization.
 * - Donc on utilise l’URL générée par api.contracts.openPdfUrl(id) (qui inclut ?token=...).
 * - Fallback: si api.js pas à jour, on ajoute nous-mêmes ?token=...
 */
function getAuthTokenFallback() {
  return safeStr(localStorage.getItem('token')) || safeStr(sessionStorage.getItem('token')) || ''
}

function ensureUrlHasToken(u) {
  const url = safeStr(u)
  if (!url) return ''
  if (url.includes('token=')) return url
  const t = getAuthTokenFallback()
  if (!t) return url
  return url + (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(t)}`
}

function contractOpenPdfEndpoint(id) {
  const cid = safeStr(id)
  if (!cid) return ''
  if (api?.contracts?.openPdfUrl) return safeStr(api.contracts.openPdfUrl(cid))
  // fallback si api.js pas à jour (sera complété par token via ensureUrlHasToken)
  return `/contracts/${encodeURIComponent(cid)}/pdf/open`
}

function contractOpenPdfUrlForOpen(rowOrId) {
  const id = typeof rowOrId === 'string' ? rowOrId : safeStr(rowOrId?._id)
  const base = contractOpenPdfEndpoint(id)
  return ensureUrlHasToken(base) // ✅ garantit pas de 401 si token dispo
}

function contractOpenPdfUrlForCopy(rowOrId) {
  // lien stable SANS token (ne pas exposer JWT au copier-coller)
  const id = typeof rowOrId === 'string' ? rowOrId : safeStr(rowOrId?._id)
  return contractOpenPdfEndpoint(id)
}

/**
 * Fallback “best effort” pour lecture d'une ancienne URL déjà stockée.
 * (pas pour partager)
 */
function getLegacyPdfUrl(row) {
  const raw =
    safeStr(row?.pdf?.url) ||
    safeStr(row?.pdf?.finalUrl) ||
    safeStr(row?.pdfUrl) ||
    safeStr(row?.signedPdfUrl) ||
    safeStr(row?.pdf?.publicUrl) ||
    safeStr(row?.pdf?.downloadUrl)

  if (!raw) return ''
  if (isHttpUrl(raw)) return raw
  return raw.startsWith('/') ? `${window.location.origin}${raw}` : `${window.location.origin}/${raw}`
}

/**
 * On force regen quand SIGNED et (hash vide OU url vide) => PDF probablement non régénéré après signature.
 */
function shouldForceSignedRegen(row) {
  const st = upper(row?.status || 'DRAFT')
  if (st !== 'SIGNED') return false
  const url = safeStr(row?.pdf?.url) || safeStr(row?.pdf?.finalUrl) || safeStr(row?.pdfUrl)
  const h = safeStr(row?.pdf?.hash) || safeStr(row?.pdf?.finalHash)
  return !url || !h
}

export default function ContractsPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens?.md

  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const [statusEditing, setStatusEditing] = useState('DRAFT')
  const [statusSaving, setStatusSaving] = useState(false)

  const [sendingId, setSendingId] = useState(null)
  const [removing, setRemoving] = useState(false)

  // ✅ PDF generation loading per row
  const [pdfGeneratingId, setPdfGeneratingId] = useState(null)

  // UI anti texte vertical
  const noVerticalText = {
    minWidth: 0,
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  }

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

  async function load() {
    try {
      setLoading(true)
      const data = await api.contracts.list({ q: q || undefined })
      setRows(Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []))
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible de charger les contrats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openDrawer(row) {
    setCurrent(row)
    setStatusEditing(upper(row?.status || 'DRAFT'))
    setOpen(true)
  }

  function closeDrawer() {
    setOpen(false)
    setCurrent(null)
    setStatusEditing('DRAFT')
  }

  function publicUrl(row) {
    const token = safeStr(row?.publicToken)
    if (!token) return ''
    const tenantSlug = safeStr(row?.renderSnapshot?.company?.slug) || ''
    if (!tenantSlug) return ''
    return `${window.location.origin}/t/${encodeURIComponent(tenantSlug)}/c/${encodeURIComponent(token)}`
  }

  async function copyLink(row) {
    const url = publicUrl(row)
    if (!url) return message.warning('Aucun lien public (publicToken ou tenant slug manquant)')
    await copyText(message, url)
  }

  /**
   * ✅ ensurePdf:
   * - si PDF semble OK -> on ouvre via /pdf/open (lien stable, signedUrl fraîche côté backend)
   * - si SIGNED et pdf/hash manquants -> regen FORCE (pour embarquer la signature) puis /pdf/open
   * - si pas de pdf -> regen puis /pdf/open
   */
  async function ensurePdf(row) {
    if (!row?._id) return null

    const mustForce = shouldForceSignedRegen(row)

    // si on a déjà un pdf “legacy” et pas besoin de force, on s'épargne regen
    const legacy = getLegacyPdfUrl(row)
    if (legacy && !mustForce) {
      return { updated: row }
    }

    try {
      setPdfGeneratingId(row._id)

      // on tente force si backend le supporte
      let updated = null
      try {
        updated = await api.contracts.generatePdf(row._id, mustForce ? { force: true } : undefined)
      } catch {
        updated = await api.contracts.generatePdf(row._id)
      }

      if (current && current._id === row._id) setCurrent(updated)
      await load()
      return { updated: updated || row }
    } catch (e) {
      message.error(e?.response?.data?.error || e?.response?.data?.message || 'Génération PDF impossible')
      return null
    } finally {
      setPdfGeneratingId(null)
    }
  }

  async function openOrGeneratePdf(row) {
    if (!row?._id) return
    await ensurePdf(row)
    // ✅ anti-401 : URL avec token (via api.js ou fallback)
    openUrl(contractOpenPdfUrlForOpen(row))
  }

  async function copyPdfLink(row) {
    if (!row?._id) return
    await ensurePdf(row)
    // ✅ copie lien stable SANS token
    await copyText(message, contractOpenPdfUrlForCopy(row))
  }

  function sendDisabledReason(status) {
    const st = upper(status || 'DRAFT')
    if (st === 'SIGNED') return 'Contrat déjà signé'
    if (st === 'DECLINED') return 'Contrat refusé'
    if (st === 'EXPIRED') return 'Contrat expiré'
    return ''
  }

  async function onSend(row) {
    if (!row?._id) return
    try {
      setSendingId(row._id)
      const data = await api.contracts.send(row._id, { origin: window.location.origin })
      message.success('Contrat envoyé au client')
      await load()

      if (current && current._id === row._id) {
        const updated = data?.contract || data
        setCurrent((prev) => ({ ...(prev || {}), ...(updated || {}) }))
        setStatusEditing(upper(updated?.status || statusEditing))
      }
    } catch (e) {
      message.error(e?.response?.data?.error || e?.response?.data?.message || 'Envoi impossible')
    } finally {
      setSendingId(null)
    }
  }

  /**
   * ✅ UPDATE STATUS :
   * - patch status
   * - si SIGNED -> regen FORCE du PDF (pour embarquer signature)
   */
  async function onUpdateStatus() {
    if (!current?._id) return
    try {
      setStatusSaving(true)
      const nextStatus = upper(statusEditing)
      const updated = await api.contracts.update(current._id, { status: nextStatus })
      message.success('Statut mis à jour')

      if (nextStatus === 'SIGNED') {
        try {
          setPdfGeneratingId(current._id)
          let regenerated = null
          try {
            regenerated = await api.contracts.generatePdf(current._id, { force: true })
          } catch {
            regenerated = await api.contracts.generatePdf(current._id)
          }
          setCurrent(regenerated || updated)
          message.success('PDF signé régénéré')
        } catch {
          message.warning('Statut SIGNÉ appliqué, mais régénération PDF non confirmée (essaie le bouton PDF).')
          setCurrent(updated)
        } finally {
          setPdfGeneratingId(null)
        }
      } else {
        setCurrent(updated)
      }

      await load()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.response?.data?.message || 'Mise à jour impossible')
    } finally {
      setStatusSaving(false)
    }
  }

  async function onRemove(row) {
    try {
      setRemoving(true)
      await api.contracts.remove(row._id)
      message.success('Contrat supprimé')
      closeDrawer()
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Suppression impossible')
    } finally {
      setRemoving(false)
    }
  }

  const kpis = useMemo(() => {
    const list = Array.isArray(rows) ? rows : []
    const total = list.length
    const signed = list.filter(r => upper(r?.status) === 'SIGNED').length
    const pending = list.filter(r => ['DRAFT', 'SENT', 'VIEWED'].includes(upper(r?.status))).length
    const declined = list.filter(r => upper(r?.status) === 'DECLINED').length
    return { total, signed, pending, declined }
  }, [rows])

  const columns = useMemo(() => {
    if (isMobile) {
      return [
        {
          title: 'Contrats',
          render: (_, row) => {
            const st = upper(row?.status || 'DRAFT')
            const disabledSend = (st === 'SIGNED' || st === 'DECLINED' || st === 'EXPIRED')
            const reason = sendDisabledReason(st)
            const isSending = sendingId === row._id
            const isPdfGen = pdfGeneratingId === row._id

            const sendBtn = (
              <Button
                icon={<SendOutlined />}
                onClick={() => onSend(row)}
                disabled={disabledSend}
                loading={isSending}
              >
                Envoyer
              </Button>
            )

            return (
              <Space direction="vertical" size={6} style={noVerticalText}>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={noVerticalText}>{safeStr(row?.contractNumber) || '—'}</Text>
                  {statusTag(st)}
                </Space>

                <Text style={{ color: 'var(--muted)', fontSize: 12, ...noVerticalText }}>
                  {safeStr(row?.client?.name) || '—'} {safeStr(row?.client?.phone) ? `· ${safeStr(row.client.phone)}` : ''}
                </Text>

                <Text style={{ fontWeight: 900 }}>
                  {money(row?.totals?.total ?? row?.amount ?? 0, row?.currency)}
                </Text>

                <Space wrap size={8}>
                  <Button icon={<EyeOutlined />} onClick={() => openDrawer(row)}>Voir</Button>
                  <Button icon={<CopyOutlined />} onClick={() => copyLink(row)}>Lien</Button>

                  <Tooltip title="Ouvrir PDF (anti 401 + anti-expiration)">
                    <span>
                      <Button
                        icon={<FilePdfOutlined />}
                        onClick={() => openOrGeneratePdf(row)}
                        loading={isPdfGen}
                      >
                        PDF
                      </Button>
                    </span>
                  </Tooltip>

                  {disabledSend ? (
                    <Tooltip title={reason || 'Envoi désactivé'}>
                      <span>{sendBtn}</span>
                    </Tooltip>
                  ) : (
                    sendBtn
                  )}
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
        dataIndex: 'contractNumber',
        key: 'contractNumber',
        width: 190,
        ellipsis: true,
        render: (v) => <Text style={{ fontWeight: 900 }}>{safeStr(v) || '—'}</Text>,
      },
      {
        title: 'Client',
        dataIndex: ['client', 'name'],
        key: 'client',
        ellipsis: true,
        render: (v, row) => (
          <div style={{ minWidth: 0 }}>
            <Text style={{ fontWeight: 800 }}>{safeStr(v) || '—'}</Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {safeStr(row?.client?.phone) || safeStr(row?.client?.email) || '—'}
              </Text>
            </div>
          </div>
        ),
      },
      {
        title: 'Montant',
        key: 'amount',
        width: 190,
        align: 'right',
        render: (_, row) => (
          <Text style={{ fontWeight: 900 }}>
            {money(row?.totals?.total ?? row?.amount ?? 0, row?.currency)}
          </Text>
        ),
      },
      {
        title: 'Statut',
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: statusTag,
      },
      {
        title: 'Signé',
        dataIndex: 'signedAt',
        key: 'signedAt',
        width: 180,
        render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
      },
      {
        title: 'PDF',
        key: 'pdf',
        width: 110,
        align: 'center',
        render: (_, row) => {
          const isPdfGen = pdfGeneratingId === row._id
          return (
            <Tooltip title="Ouvrir PDF (anti 401 + anti-expiration)">
              <span>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => openOrGeneratePdf(row)}
                  loading={isPdfGen}
                />
              </span>
            </Tooltip>
          )
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 360,
        fixed: 'right',
        render: (_, row) => {
          const st = upper(row?.status || 'DRAFT')
          const disabledSend = (st === 'SIGNED' || st === 'DECLINED' || st === 'EXPIRED')
          const reason = sendDisabledReason(st)
          const isSending = sendingId === row._id
          const isPdfGen = pdfGeneratingId === row._id

          const sendBtn = (
            <Button
              icon={<SendOutlined />}
              onClick={() => onSend(row)}
              disabled={disabledSend}
              loading={isSending}
            >
              Envoyer
            </Button>
          )

          return (
            <Space wrap size={8}>
              <Button icon={<EyeOutlined />} onClick={() => openDrawer(row)}>
                Voir
              </Button>

              <Tooltip title="Copier lien public">
                <Button icon={<CopyOutlined />} onClick={() => copyLink(row)} />
              </Tooltip>

              <Tooltip title="Copier lien PDF stable (sans token)">
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => copyPdfLink(row)}
                  loading={isPdfGen}
                />
              </Tooltip>

              {disabledSend ? (
                <Tooltip title={reason || 'Envoi désactivé'}>
                  <span>{sendBtn}</span>
                </Tooltip>
              ) : (
                sendBtn
              )}
            </Space>
          )
        },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendingId, pdfGeneratingId, isMobile, rows])

  const emptyNode = (
    <Empty
      description={
        <div style={{ color: 'var(--muted)' }}>
          Aucun contrat pour le moment.<br />
          <span style={{ fontSize: 12 }}>
            Un contrat se crée généralement en convertissant un devis.
          </span>
        </div>
      }
    >
      <Space wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotes')} style={{ borderRadius: 14 }}>
          Créer depuis devis
        </Button>
        <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 14 }}>
          Rafraîchir
        </Button>
      </Space>
    </Empty>
  )

  const softPanel = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
  }

  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 980 }
  const tableScrollX = { x: 'max-content' }

  const headerRightActions = (
    <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => navigate('/quotes')}
        style={{ borderRadius: 14 }}
      >
        Créer depuis devis
      </Button>
      <Button icon={<ReloadOutlined />} onClick={load} loading={loading} style={{ borderRadius: 14 }}>
        Rafraîchir
      </Button>
    </Space>
  )

  return (
    <PageFrame title="Contrats" subtitle="Contrats (conversion depuis devis + envoi + signature digitale).">
      <div style={pageBg}>
        <Space direction="vertical" size={14} style={{ width: '100%', ...noVerticalText }}>
          {/* Header premium */}
          <Card bordered={false} style={headerCardStyle} styles={{ body: { padding: isMobile ? 12 : 14 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={14}>
                <Space align="center" style={noVerticalText}>
                  <div style={iconBadge('linear-gradient(135deg, rgba(22,163,74,0.92), rgba(255,255,255,0.06))')}>
                    <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div style={noVerticalText}>
                    <Title level={4} style={{ margin: 0, ...noVerticalText }}>Contrats</Title>
                    <Text style={{ color: 'var(--muted)', ...noVerticalText }}>
                      Envoi, suivi, PDF et lien public.
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col xs={24} md={10}>
                {headerRightActions}
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
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
                  <Tag style={{ borderRadius: 999, background: 'rgba(22,163,74,0.12)', borderColor: 'rgba(22,163,74,0.25)' }}>
                    Signés: {kpis.signed}
                  </Tag>
                  <Tag style={{ borderRadius: 999, background: 'rgba(2,132,199,0.10)', borderColor: 'rgba(2,132,199,0.22)' }}>
                    En cours: {kpis.pending}
                  </Tag>
                  <Tag style={{ borderRadius: 999, background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.22)' }}>
                    Refusés: {kpis.declined}
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
              scroll={tableScrollX}
              tableLayout="fixed"
              locale={{ emptyText: emptyNode }}
              onRow={(row) => ({
                onClick: () => openDrawer(row),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>

          {/* =========================
              DETAIL DRAWER
             ========================= */}
          <Drawer
            open={open}
            onClose={closeDrawer}
            placement={drawerPlacement}
            {...drawerSizeProps}
            title={
              <Space wrap style={noVerticalText}>
                <Text strong>Détails contrat</Text>
                {current?.status ? statusTag(current.status) : null}
                {current?.contractNumber ? <Tag style={{ borderRadius: 999 }}>{safeStr(current.contractNumber)}</Tag> : null}
              </Space>
            }
          >
            {!current ? <Empty description="Aucun contrat sélectionné" /> : (() => {
              const st = upper(current?.status || 'DRAFT')
              const pub = publicUrl(current)
              const pdfStableForCopy = contractOpenPdfUrlForCopy(current) // ✅ stable anti-expiration (sans token)
              const totals = current?.totals || {}
              const client = current?.client || {}

              const disabledSend = (!current?._id || ['SIGNED', 'DECLINED', 'EXPIRED'].includes(st))
              const reason = sendDisabledReason(st)
              const isSending = sendingId === current?._id
              const isPdfGen = pdfGeneratingId === current?._id

              const sendBtn = (
                <Button
                  icon={<SendOutlined />}
                  onClick={() => current?._id && onSend(current)}
                  disabled={disabledSend}
                  loading={isSending}
                  style={{ borderRadius: 14 }}
                >
                  Envoyer
                </Button>
              )

              return (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {/* Actions */}
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Row gutter={[10, 10]} align="middle">
                      <Col flex="auto" style={{ minWidth: 0 }}>
                        <Space direction="vertical" size={2} style={noVerticalText}>
                          <Text style={{ fontWeight: 900, fontSize: 16, ...noVerticalText }}>
                            {safeStr(current?.title) || 'Contrat'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, ...noVerticalText }}>
                            {safeStr(client?.name) || '—'} {safeStr(client?.phone) ? `· ${safeStr(client.phone)}` : ''}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Montant : <span style={{ fontWeight: 900 }}>{money(totals?.total ?? current?.amount ?? 0, current?.currency)}</span>
                          </Text>
                        </Space>
                      </Col>

                      <Col flex="none">
                        <Space wrap>
                          <Button icon={<CopyOutlined />} onClick={() => copyLink(current)} disabled={!pub} style={{ borderRadius: 14 }}>
                            Lien
                          </Button>

                          <Tooltip title="Ouvrir PDF (anti 401 + anti-expiration)">
                            <span>
                              <Button
                                icon={<FilePdfOutlined />}
                                onClick={() => openOrGeneratePdf(current)}
                                loading={isPdfGen}
                                style={{ borderRadius: 14 }}
                              >
                                PDF
                              </Button>
                            </span>
                          </Tooltip>

                          {disabledSend ? (
                            <Tooltip title={reason || 'Envoi désactivé'}>
                              <span>{sendBtn}</span>
                            </Tooltip>
                          ) : (
                            sendBtn
                          )}
                        </Space>
                      </Col>
                    </Row>
                  </Card>

                  {/* Infos */}
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={14}>
                      <Card size="small" style={{ borderRadius: 14 }} title="Client">
                        <Space direction="vertical" size={8} style={{ width: '100%', ...noVerticalText }}>
                          <div>
                            <Text type="secondary">Nom</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.name) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Société</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.company) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Téléphone</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.phone) || '—'}</Text></div>
                          </div>
                          <div>
                            <Text type="secondary">Email</Text>
                            <div><Text strong style={noVerticalText}>{safeStr(client?.email) || '—'}</Text></div>
                          </div>
                        </Space>

                        <Divider style={{ margin: '12px 0' }} />

                        <Text style={{ fontWeight: 900, fontSize: 13 }}>Liens & documents</Text>
                        <Divider style={{ margin: '10px 0' }} />

                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <div
                            style={{
                              borderRadius: 14,
                              border: '1px solid rgba(17,24,39,0.08)',
                              background: 'rgba(17,24,39,0.02)',
                              padding: 12,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Lien public</Text>
                            <Text style={{ fontSize: 12, ...noVerticalText }}>{pub || '—'}</Text>
                            <div style={{ marginTop: 10 }}>
                              <Space wrap>
                                <Button icon={<CopyOutlined />} onClick={() => copyLink(current)} disabled={!pub} style={{ borderRadius: 14 }}>
                                  Copier
                                </Button>
                                {pub ? (
                                  <Button icon={<EyeOutlined />} onClick={() => openUrl(pub)} style={{ borderRadius: 14 }}>
                                    Ouvrir
                                  </Button>
                                ) : null}
                              </Space>
                            </div>
                          </div>

                          <div
                            style={{
                              borderRadius: 14,
                              border: '1px solid rgba(17,24,39,0.08)',
                              background: 'rgba(17,24,39,0.02)',
                              padding: 12,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>PDF (stable)</Text>
                            <Text style={{ fontSize: 12, ...noVerticalText }}>{pdfStableForCopy || '—'}</Text>
                            <div style={{ marginTop: 10 }}>
                              <Space wrap>
                                <Button
                                  icon={<FilePdfOutlined />}
                                  onClick={() => openOrGeneratePdf(current)}
                                  loading={isPdfGen}
                                  style={{ borderRadius: 14 }}
                                >
                                  Ouvrir
                                </Button>
                                <Button
                                  onClick={() => copyPdfLink(current)}
                                  loading={isPdfGen}
                                  style={{ borderRadius: 14 }}
                                >
                                  Copier lien
                                </Button>
                              </Space>
                            </div>
                          </div>
                        </Space>
                      </Card>
                    </Col>

                    <Col xs={24} lg={10}>
                      <Card size="small" style={{ borderRadius: 14 }} title="Résumé & statut">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <Text type="secondary">Statut</Text>
                            {statusTag(current.status)}
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
                                { value: 'SIGNED', label: 'SIGNÉ' },
                                { value: 'DECLINED', label: 'REFUSÉ' },
                                { value: 'EXPIRED', label: 'EXPIRÉ' },
                              ]}
                            />
                            <Button
                              icon={<EditOutlined />}
                              onClick={onUpdateStatus}
                              loading={statusSaving}
                              disabled={!current?._id}
                              style={{ borderRadius: 14 }}
                            >
                              Appliquer
                            </Button>
                          </Space>

                          <Divider style={{ margin: '8px 0' }} />

                          <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <Text type="secondary">Envoyé</Text>
                              <Text style={{ fontWeight: 800 }}>{fmtDate(current?.sentAt)}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <Text type="secondary">Vu</Text>
                              <Text style={{ fontWeight: 800 }}>{fmtDate(current?.viewedAt)}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <Text type="secondary">Signé</Text>
                              <Text style={{ fontWeight: 900 }}>{fmtDate(current?.signedAt)}</Text>
                            </div>
                          </div>

                          <Divider style={{ margin: '8px 0' }} />

                          <Space wrap>
                            {disabledSend ? (
                              <Tooltip title={reason || 'Envoi désactivé'}>
                                <span>{sendBtn}</span>
                              </Tooltip>
                            ) : (
                              sendBtn
                            )}

                            <Popconfirm
                              title="Supprimer ce contrat ?"
                              okText="Supprimer"
                              cancelText="Annuler"
                              onConfirm={() => onRemove(current)}
                            >
                              <Button danger icon={<DeleteOutlined />} loading={removing} style={{ borderRadius: 14 }}>
                                Supprimer
                              </Button>
                            </Popconfirm>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  {/* Aperçu PDF */}
                  <Card size="small" style={{ borderRadius: 14 }} title="Aperçu PDF">
                    {current?._id ? (
                      <div style={{ width: '100%', height: isMobile ? 420 : 560, borderRadius: 12, overflow: 'hidden' }}>
                        {/* ✅ anti-401 : src inclut token */}
                        <iframe
                          title="PDF"
                          src={contractOpenPdfUrlForOpen(current)}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    ) : (
                      <Empty description="Aucun PDF pour le moment.">
                        <Button
                          icon={<FilePdfOutlined />}
                          onClick={() => openOrGeneratePdf(current)}
                          loading={isPdfGen}
                          style={{ borderRadius: 14 }}
                        >
                          Générer le PDF
                        </Button>
                      </Empty>
                    )}

                    <Divider style={{ margin: '12px 0' }} />

                    <Space wrap>
                      <Button icon={<FileTextOutlined />} onClick={() => openUrl(pub)} disabled={!pub} style={{ borderRadius: 14 }}>
                        Ouvrir lien public
                      </Button>
                      <Button icon={<FilePdfOutlined />} onClick={() => openOrGeneratePdf(current)} loading={isPdfGen} style={{ borderRadius: 14 }}>
                        Ouvrir PDF
                      </Button>
                    </Space>

                    <div style={{ marginTop: 10 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Si tu as encore un 401 ici, c’est que le backend ne lit pas `req.query.token` (requireAuth à patch).
                      </Text>
                    </div>
                  </Card>

                  <style>{`
                    .ant-table-thead > tr > th {
                      background: rgba(17,24,39,0.02) !important;
                    }
                  `}</style>
                </Space>
              )
            })()}
          </Drawer>
        </Space>
      </div>
    </PageFrame>
  )
}