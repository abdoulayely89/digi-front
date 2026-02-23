// src/pages/public/PublicQuotePage.jsx
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Button, Card, Divider, Space, Spin, Tag, Typography } from 'antd'
import { api } from '../../api/api'

const { Title, Text } = Typography

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }

function statusTag(v) {
  const s = upper(v || 'DRAFT')
  if (s === 'ACCEPTED') return <Tag color="green">ACCEPTÉ</Tag>
  if (s === 'SENT') return <Tag color="blue">ENVOYÉ</Tag>
  if (s === 'VIEWED') return <Tag color="cyan">VU</Tag>
  if (s === 'REJECTED') return <Tag color="red">REJETÉ</Tag>
  if (s === 'EXPIRED') return <Tag color="orange">EXPIRÉ</Tag>
  if (s === 'CONVERTED') return <Tag color="purple">CONVERTI</Tag>
  return <Tag>BROUILLON</Tag>
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

export default function PublicQuotePage() {
  const { tenantSlug, token } = useParams()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [quote, setQuote] = useState(null)

  async function load() {
    try {
      setLoading(true)
      setErr('')
      const data = await api.public.quoteByToken(tenantSlug, token)
      setQuote(data?.quote || data)
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || 'Devis introuvable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantSlug, token]) // eslint-disable-line

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Space><Spin /> <Text>Chargement du devis...</Text></Space>
      </div>
    )
  }

  if (err) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
        <Alert
          type="error"
          showIcon
          message="Impossible d’afficher le devis"
          description={
            <div>
              <div style={{ marginBottom: 8 }}>{err}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                tenantSlug: <b>{tenantSlug}</b> · token: <b>{token}</b>
              </div>
            </div>
          }
        />
        <Divider />
        <Button onClick={load}>Réessayer</Button>
      </div>
    )
  }

  if (!quote) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="warning" showIcon message="Aucun devis" />
      </div>
    )
  }

  const companyName = safeStr(quote?.renderSnapshot?.company?.name) || safeStr(quote?.renderSnapshot?.company?.legalName) || 'Entreprise'
  const clientName = safeStr(quote?.client?.name) || safeStr(quote?.leadId?.contact?.name) || 'Client'

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <Title level={3} style={{ marginTop: 0 }}>
        Devis {safeStr(quote?.quoteNumber) ? `· ${safeStr(quote.quoteNumber)}` : ''}
      </Title>

      <Card>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>Entreprise:</Text> <Text>{companyName}</Text>
          </Space>
          <Space wrap>
            <Text strong>Client:</Text> <Text>{clientName}</Text>
          </Space>
          <Space wrap>
            <Text strong>Statut:</Text> {statusTag(quote?.status)}
          </Space>
          <Space wrap>
            <Text strong>Total:</Text> <Text>{fmtMoney(quote?.totals?.total, quote?.currency)}</Text>
          </Space>
        </Space>

        <Divider />

        <Title level={5} style={{ marginTop: 0 }}>Lignes</Title>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Array.isArray(quote?.items) ? quote.items : []).map((it, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <Text>{safeStr(it?.label) || `Ligne ${idx + 1}`}</Text>
              <Text>
                {Number(it?.qty || 0)} × {fmtMoney(it?.unitPrice, quote?.currency)}
              </Text>
            </div>
          ))}
        </div>

        <Divider />

        <Title level={5} style={{ marginTop: 0 }}>Notes</Title>
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {safeStr(quote?.notes) || '—'}
        </div>
      </Card>
    </div>
  )
}