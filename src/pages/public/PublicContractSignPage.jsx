// src/pages/public/PublicContractSignPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { App as AntApp, Alert, Button, Card, Divider, Form, Input, Space, Spin, Tag, Typography } from 'antd'
import { api } from '../../api/api'

const { Title, Text } = Typography

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }

function statusTag(v) {
  const s = upper(v || 'DRAFT')
  if (s === 'SIGNED') return <Tag color="green">SIGNÉ</Tag>
  if (s === 'SENT') return <Tag color="blue">ENVOYÉ</Tag>
  if (s === 'VIEWED') return <Tag color="cyan">VU</Tag>
  if (s === 'DECLINED') return <Tag color="red">REFUSÉ</Tag>
  if (s === 'EXPIRED') return <Tag color="orange">EXPIRÉ</Tag>
  return <Tag>BROUILLON</Tag>
}

function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('fr-FR') } catch { return '—' }
}

function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

export default function PublicContractSignPage() {
  const { message } = AntApp.useApp()
  const { tenantSlug, token } = useParams()

  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [doc, setDoc] = useState(null)

  const [form] = Form.useForm()

  // ---------------------------
  // Canvas signature (finger)
  // ---------------------------
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })

  const isFinal = useMemo(() => {
    const st = upper(doc?.status)
    return st === 'SIGNED' || st === 'DECLINED' || st === 'EXPIRED'
  }, [doc])

  function canvasSize() {
    const c = canvasRef.current
    if (!c) return

    const cssW = c.parentElement ? Math.min(c.parentElement.clientWidth, 720) : 720
    const cssH = 220
    const dpr = window.devicePixelRatio || 1

    c.style.width = `${cssW}px`
    c.style.height = `${cssH}px`
    c.width = Math.floor(cssW * dpr)
    c.height = Math.floor(cssH * dpr)

    const ctx = c.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
  }

  function clearCanvas() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const w = parseFloat(c.style.width) || 720
    const h = parseFloat(c.style.height) || 220
    ctx.clearRect(0, 0, w, h)
  }

  function getPointFromEvent(e) {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0 }
    const rect = c.getBoundingClientRect()
    const isTouch = !!e.touches?.[0]
    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function startDraw(e) {
    if (isFinal) return
    drawingRef.current = true
    const p = getPointFromEvent(e)
    lastRef.current = p
  }

  function moveDraw(e) {
    if (!drawingRef.current || isFinal) return
    e.preventDefault?.()
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const p = getPointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
  }

  function endDraw() {
    drawingRef.current = false
  }

  function signatureDataUrl() {
    const c = canvasRef.current
    if (!c) return ''
    return c.toDataURL('image/png')
  }

  // ---------------------------
  // Load
  // ---------------------------
  async function load() {
    setErr('')
    setLoading(true)

    const t = safeStr(tenantSlug)
    const tok = safeStr(token)

    if (!t || !tok) {
      setErr('Lien invalide (tenantSlug ou token manquant).')
      setLoading(false)
      return
    }

    try {
      const data = await api.public.contractByToken(t, tok)
      setDoc(data)

      // mark viewed best-effort (ne doit jamais bloquer)
      api.public.contracts.markViewed(t, tok).catch(() => {})
    } catch (e) {
      setErr(e?.response?.data?.error || e?.response?.data?.message || 'Contrat introuvable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantSlug, token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => { canvasSize() }, 0)
    function onResize() { canvasSize() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [doc, isFinal])

  // ---------------------------
  // PDF helpers (critical fix)
  // ---------------------------
  function getPdfUrl(d) {
    const raw =
      safeStr(d?.pdf?.finalUrl) ||
      safeStr(d?.pdf?.url) ||
      safeStr(d?.pdfUrl) ||
      safeStr(d?.signedPdfUrl) ||
      safeStr(d?.pdf?.publicUrl) ||
      safeStr(d?.pdf?.downloadUrl)

    // api.public.contractByToken normalise déjà -> souvent ABS.
    // On garde quand même un fallback: si URL relative => ouvre via l'API (proxy) ou ça cassera.
    if (!raw) return ''
    if (isHttpUrl(raw)) return raw

    // Fallback: si le backend renvoie "/uploads/..." ou "/api/..." etc.
    // Ici on n'a pas apiAssetUrl exporté, donc on fait le strict minimum:
    // - si raw commence par "/api/" => même origin que l'API
    // - sinon: origin du site (dernier recours)
    try {
      const base = safeStr(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '')
      const origin = base ? new URL(base).origin : window.location.origin
      if (raw.startsWith('/')) return `${origin}${raw}`
      return `${origin}/${raw}`
    } catch {
      if (raw.startsWith('/')) return `${window.location.origin}${raw}`
      return `${window.location.origin}/${raw}`
    }
  }

  async function ensureSignedPdf() {
    const t = safeStr(tenantSlug)
    const tok = safeStr(token)
    if (!t || !tok) return null

    // 1) si on l'a déjà
    const existing = getPdfUrl(doc)
    if (existing) return existing

    // 2) essayer de forcer la génération côté backend (nouveau endpoint public)
    //    /public/t/:tenantSlug/c/:token/generate-pdf
    try {
      setPdfGenerating(true)
      const updated = await api.public.contracts.generatePdf(t, tok)
      setDoc(updated)
      const url = getPdfUrl(updated)
      if (!url) {
        // 3) recharger au cas où le backend ait juste mis à jour en DB
        await load()
        const u2 = getPdfUrl(doc)
        return u2 || ''
      }
      return url
    } catch (e) {
      // si endpoint pas encore branché côté backend, on tombe en fallback: reload
      await load()
      const u2 = getPdfUrl(doc)
      return u2 || ''
    } finally {
      setPdfGenerating(false)
    }
  }

  async function onOpenSignedPdf() {
    const url = await ensureSignedPdf()
    if (!url) return message.warning('PDF signé indisponible pour le moment (génération non faite ou URL absente).')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // ---------------------------
  // Sign
  // ---------------------------
  async function onSign(values) {
    const t = safeStr(tenantSlug)
    const tok = safeStr(token)

    const signedName = safeStr(values.signedName)
    const sig = signatureDataUrl()

    if (!sig || sig.length < 2000) {
      return message.warning('Merci de signer dans le cadre avant de valider.')
    }

    try {
      setSigning(true)
      await api.public.contracts.sign(t, tok, { signedName, signatureData: sig })
      message.success('Contrat signé. Génération du PDF en cours…')

      // ✅ IMPORTANT: on force la génération PDF juste après signature, puis reload
      await ensureSignedPdf()
      await load()
    } catch (e) {
      message.error(e?.response?.data?.error || e?.response?.data?.message || 'Signature impossible')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (err) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
        <Alert type="error" message="Erreur" description={err} showIcon />
      </div>
    )
  }

  const st = upper(doc?.status || 'DRAFT')
  const signedName =
    safeStr(doc?.signature?.signedName) ||
    safeStr(doc?.signature?.fullName) ||
    safeStr(doc?.signature?.signer?.name) ||
    ''
  const signedAt = doc?.signature?.signedAt || doc?.signedAt || null

  const pdfUrl = getPdfUrl(doc)

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Title level={3} style={{ margin: 0 }}>
              {safeStr(doc?.title) || 'Contrat'}
            </Title>

            <Space wrap>
              {statusTag(doc?.status)}
              <Text type="secondary">N° {safeStr(doc?.contractNumber) || '—'}</Text>

              <Button
                size="small"
                onClick={onOpenSignedPdf}
                loading={pdfGenerating}
                disabled={st !== 'SIGNED' && !pdfUrl}
              >
                Télécharger PDF {st === 'SIGNED' ? 'signé' : ''}
              </Button>
            </Space>

            <Divider style={{ margin: '12px 0' }} />

            <Text strong>Contenu</Text>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {safeStr(doc?.templateSnapshot?.bodyMarkdown) ||
                safeStr(doc?.renderSnapshot?.bodyMarkdown) ||
                '—'}
            </div>
          </Space>
        </Card>

        <Card>
          <Title level={5} style={{ marginTop: 0 }}>Signature électronique</Title>

          {st === 'SIGNED' ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Alert
                type="success"
                showIcon
                message="Contrat signé"
                description={
                  <div>
                    <div><Text>Signé par : {signedName || '—'}</Text></div>
                    <div><Text type="secondary">Date : {fmtDate(signedAt)}</Text></div>
                    {doc?.signature?.proofHash ? (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Preuve : {safeStr(doc.signature.proofHash)}
                        </Text>
                      </div>
                    ) : null}
                  </div>
                }
              />

              {/* ✅ Aperçu PDF signé */}
              {pdfUrl ? (
                <div style={{ width: '100%', height: 560, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <iframe title="PDF signé" src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="PDF signé non disponible"
                  description={
                    <Space direction="vertical" size={8}>
                      <Text type="secondary">
                        Le contrat est signé mais le PDF n’a pas encore été généré ou l’URL n’est pas exposée.
                      </Text>
                      <Button onClick={onOpenSignedPdf} loading={pdfGenerating}>
                        Générer / ouvrir le PDF
                      </Button>
                    </Space>
                  }
                />
              )}
            </Space>
          ) : (
            <Form layout="vertical" form={form} onFinish={onSign} requiredMark={false}>
              <Form.Item
                name="signedName"
                label="Nom complet"
                rules={[{ required: true, message: 'Votre nom est requis' }]}
              >
                <Input placeholder="Ex: Jean Dupont" disabled={isFinal} />
              </Form.Item>

              <div style={{ marginBottom: 10 }}>
                <Text type="secondary">Signez dans le cadre (doigt / souris)</Text>
                <div
                  style={{
                    marginTop: 8,
                    border: '1px solid rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    padding: 10,
                    background: 'rgba(0,0,0,0.02)',
                    touchAction: 'none',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={moveDraw}
                    onTouchEnd={endDraw}
                  />
                </div>

                <Space style={{ marginTop: 10 }}>
                  <Button onClick={clearCanvas}>Effacer</Button>
                </Space>
              </div>

              <Space>
                <Button type="primary" htmlType="submit" loading={signing}>
                  Signer le contrat
                </Button>
              </Space>

              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  La signature enregistre une preuve (nom + horodatage + IP/User-Agent si le backend le stocke).
                </Text>
              </div>
            </Form>
          )}
        </Card>
      </Space>
    </div>
  )
}