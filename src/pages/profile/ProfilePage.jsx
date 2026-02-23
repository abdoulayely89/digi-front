// src/pages/profile/ProfilePage.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Row,
  Space,
  Typography,
  Avatar,
  Divider,
  Grid,
  Skeleton,
  Tag,
  List,
  Empty,
} from 'antd'
import {
  QrcodeOutlined,
  CopyOutlined,
  LinkOutlined,
  IdcardOutlined,
  BankOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { AuthContext } from '../../context/AuthContext'
import { QRCodeCanvas } from 'qrcode.react'
import { api } from '../../api/api'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

function getApiBase() {
  const env = safeStr(import.meta?.env?.VITE_API_URL) || safeStr(import.meta?.env?.VITE_API_BASE_URL)
  return env || 'https://digi-337307224016.europe-west1.run.app/api'
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

function normalizeAssetUrl(u) {
  const s = safeStr(u)
  if (!s) return ''
  if (isHttpUrl(s)) return s
  const { origin } = splitOriginAndPrefix()
  if (!origin) return s
  if (s.startsWith('/uploads/')) return `${origin}${s}`
  if (s.startsWith('/api/')) return `${origin}${s}`
  if (s.startsWith('/')) return `${origin}${s}`
  return s
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (safeStr(v)) return safeStr(v)
  }
  return ''
}

function asArray(v) {
  if (!v) return []
  if (Array.isArray(v)) return v.filter(Boolean)
  return [v].filter(Boolean)
}

function toHref(u) {
  const s = safeStr(u)
  if (!s) return ''
  return s.startsWith('http') ? s : `https://${s}`
}

function buildTenantAddress(t) {
  const parts = [
    safeStr(t?.address?.street),
    safeStr(t?.address?.city),
    safeStr(t?.address?.zip),
    safeStr(t?.address?.country),
  ].filter(Boolean)
  return parts.join(', ')
}

function getTenantEmail(t) {
  return safeStr(t?.contacts?.email) || safeStr(t?.contactEmail) || safeStr(t?.email) || safeStr(t?.billingEmail) || ''
}
function getTenantPhone(t) {
  return safeStr(t?.contacts?.phone) || safeStr(t?.phone) || safeStr(t?.contactPhone) || ''
}
function getTenantWebsite(t) {
  return safeStr(t?.contacts?.website) || safeStr(t?.website) || safeStr(t?.url) || ''
}

function textSafeStyle(isMobile) {
  return {
    writingMode: 'horizontal-tb',
    textOrientation: 'mixed',
    whiteSpace: 'normal',
    wordBreak: isMobile ? 'break-word' : 'normal',
    overflowWrap: isMobile ? 'anywhere' : 'normal',
    lineHeight: 1.45,
    minWidth: 0,
  }
}

function kv(label, value, screens) {
  const v = safeStr(value)
  if (!v) return null
  const isMobile = !!screens?.xs
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '170px minmax(0, 1fr)',
        columnGap: 12,
        rowGap: isMobile ? 4 : 0,
        alignItems: 'start',
        minWidth: 0,
      }}
    >
      <Text
        type="secondary"
        style={{
          ...textSafeStyle(false),
          fontSize: 12,
          whiteSpace: isMobile ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Text>
      <Text style={{ ...textSafeStyle(isMobile) }}>{v}</Text>
    </div>
  )
}

function kvLink(label, url, screens) {
  const u = safeStr(url)
  if (!u) return null
  const href = u.startsWith('http') ? u : `https://${u}`
  const isMobile = !!screens?.xs
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '170px minmax(0, 1fr)',
        columnGap: 12,
        rowGap: isMobile ? 4 : 0,
        alignItems: 'start',
        minWidth: 0,
      }}
    >
      <Text
        type="secondary"
        style={{
          ...textSafeStyle(false),
          fontSize: 12,
          whiteSpace: isMobile ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Text>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...textSafeStyle(isMobile), display: 'block' }}
      >
        {u}
      </a>
    </div>
  )
}

function pickFromMany(objs, keys) {
  for (const o of objs) {
    const v = pick(o, keys)
    if (safeStr(v)) return v
  }
  return ''
}

function getUserIdFromContext(user) {
  return (
    safeStr(user?._id) ||
    safeStr(user?.id) ||
    safeStr(user?.user?._id) ||
    safeStr(user?.user?.id) ||
    safeStr(user?.account?._id) ||
    safeStr(user?.account?.id)
  )
}

export default function ProfilePage() {
  const { message } = AntApp.useApp()
  const { user, tenant: tenantCtx } = useContext(AuthContext)
  const screens = useBreakpoint()
  const isMobile = !!screens?.xs

  const [profileLoading, setProfileLoading] = useState(false)
  const [profile, setProfile] = useState(null)

  const [tenantLoading, setTenantLoading] = useState(false)
  const [tenantFresh, setTenantFresh] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setTenantLoading(true)
        const data = await api.tenant.me()
        const t = data?.tenant || data
        if (mounted) setTenantFresh(t || null)
      } catch (e) {
        console.warn('[ProfilePage] tenant.me failed', e?.response?.data || e?.message || e)
      } finally {
        if (mounted) setTenantLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setProfileLoading(true)
        const data = await api.profiles.me()
        const p0 = data?.profile || data
        if (mounted) setProfile(p0 || null)
      } catch (e) {
        console.warn('[ProfilePage] profiles.me failed', e?.response?.data || e?.message || e)
      } finally {
        if (mounted) setProfileLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const p = useMemo(() => {
    const up = user?.profile || user?.user?.profile || {}
    const ap = profile || {}
    return { ...up, ...ap }
  }, [user, profile])

  const tenant = tenantFresh || tenantCtx || {}

  const tenantSlug = safeStr(tenant?.slug)
  const userSlug =
    safeStr(p?.publicSlug) ||
    safeStr(user?.publicSlug) ||
    safeStr(user?.user?.publicSlug) ||
    safeStr(p?.slug) ||
    safeStr(user?.slug) ||
    safeStr(user?.user?.slug)

  const originFront = useMemo(() => {
    try { return window.location.origin } catch { return '' }
  }, [])

  const publicUrl = useMemo(() => {
    if (!originFront || !tenantSlug || !userSlug) return ''
    return `${originFront}/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}`
  }, [originFront, tenantSlug, userSlug])

  const vcardUrl = useMemo(() => {
    const { origin, apiPrefix } = splitOriginAndPrefix()
    if (!origin || !tenantSlug || !userSlug) return ''
    const prefix = apiPrefix || '/api'
    return `${origin}${prefix}/public/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}/vcard`
  }, [tenantSlug, userSlug])

  function downloadVcard() {
    if (!vcardUrl) return message.error('vCard indisponible')
    try { window.location.assign(vcardUrl) } catch { window.open(vcardUrl, '_blank', 'noopener,noreferrer') }
  }

  const name = safeStr(user?.name) || safeStr(user?.user?.name) || safeStr(p?.name) || '—'
  const email = safeStr(user?.email) || safeStr(user?.user?.email) || safeStr(p?.email)
  const title = pick(p, ['title', 'jobTitle', 'position'])

  const userId = useMemo(() => getUserIdFromContext(user), [user])

  // ✅ AVATAR: uniquement affichage direct (PAS de XHR -> pas de CORS)
  const avatarUrl = useMemo(() => {
    // 1) signed URL du backend
    const signed =
      safeStr(user?.profile?.avatarSignedUrl) ||
      safeStr(user?.user?.profile?.avatarSignedUrl) ||
      safeStr(profile?.profile?.avatarSignedUrl) ||
      safeStr(profile?.avatarSignedUrl) ||
      safeStr(p?.profile?.avatarSignedUrl) ||
      safeStr(p?.avatarSignedUrl)

    if (signed && isHttpUrl(signed)) return signed

    // 2) url absolue directe (si un jour)
    const direct = safeStr(pick(p, ['avatarUrl', 'photoUrl', 'pictureUrl', 'imageUrl']))
    if (direct && isHttpUrl(direct)) return direct

    // 3) fallback public endpoint /api/users/:id/avatar (302 -> signed url)
    if (userId) {
      const { origin, apiPrefix } = splitOriginAndPrefix()
      const prefix = apiPrefix || '/api'
      return `${origin}${prefix}/users/${encodeURIComponent(userId)}/avatar`
    }

    return ''
  }, [user, profile, p, userId])

  const tenantName = safeStr(tenant?.tradeName || tenant?.legalName || tenant?.name) || 'Entreprise'
  const tenantLegal = safeStr(tenant?.legalName)
  const tenantLogo = normalizeAssetUrl(safeStr(tenant?.logoUrl || tenant?.branding?.logoUrl))

  const tEmail = getTenantEmail(tenant)
  const tPhone = getTenantPhone(tenant)
  const tWebsite = getTenantWebsite(tenant)
  const tAddress = buildTenantAddress(tenant)

  const rccm = safeStr(tenant?.ids?.rccm)
  const ninea = safeStr(tenant?.ids?.ninea)
  const vatNumber = safeStr(tenant?.ids?.vatNumber)

  const personalPhone = pickFromMany([user?.profile, user?.user?.profile, profile, p], ['phone', 'mobile', 'tel', 'whatsapp'])
  const headerPrimaryContact = personalPhone || tPhone || ''

  const website = pick(p, ['website', 'site', 'url'])
  const company = pick(p, ['company', 'organization', 'org', 'employer'])
  const department = pick(p, ['department', 'service', 'team'])
  const bio = pick(p, ['bio', 'about', 'description', 'summary'])

  const links = useMemo(() => {
    const list = []
    const push = (label, value) => {
      const v = safeStr(value)
      if (!v) return
      list.push({ label, value: v, href: toHref(v) })
    }
    const s = p?.socials || p?.social || {}
    push('LinkedIn', s.linkedin || p.linkedin)
    push('X / Twitter', s.twitter || s.x || p.twitter || p.x)
    push('Facebook', s.facebook || p.facebook)
    push('Instagram', s.instagram || p.instagram)
    push('YouTube', s.youtube || p.youtube)
    push('TikTok', s.tiktok || p.tiktok)
    push('GitHub', s.github || p.github)

    asArray(p?.links).forEach((l, idx) => {
      if (typeof l === 'string') return push(`Lien ${idx + 1}`, l)
      if (l && typeof l === 'object') {
        const url = safeStr(l.url) || safeStr(l.href) || safeStr(l.link) || safeStr(l.value) || ''
        const label = safeStr(l.label) || safeStr(l.title) || safeStr(l.name) || `Lien ${idx + 1}`
        if (url) push(label, url)
      }
    })
    return list
  }, [p])

  const containerStyle = {
    minHeight: 'calc(100vh - 32px)',
    padding: screens.xs ? 12 : 18,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background:
      'radial-gradient(900px 520px at 20% 10%, rgba(59,130,246,0.16), transparent 60%),' +
      'radial-gradient(900px 520px at 80% 20%, rgba(16,185,129,0.14), transparent 60%),' +
      'radial-gradient(900px 520px at 55% 95%, rgba(245,158,11,0.12), transparent 60%),' +
      'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.00))',
  }

  const cardStyle = {
    borderRadius: 18,
    border: '1px solid rgba(0,0,0,0.08)',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  }

  const heroStyle = {
    padding: screens.xs ? 14 : 18,
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.10))',
  }

  const sectionCard = {
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.08)',
    background: 'rgba(255,255,255,0.02)',
  }

  const actionBtnStyle = { borderRadius: 12, height: 40 }
  const loadingAny = tenantLoading || profileLoading

  async function copyToClipboard(text) {
    const t = safeStr(text)
    if (!t) return message.warning('Rien à copier')
    try {
      await navigator.clipboard.writeText(t)
      message.success('Copié')
    } catch {
      message.warning('Copie impossible — copie manuelle : ' + t)
    }
  }

  return (
    <div style={containerStyle}>
      <Row gutter={[16, 16]} style={{ width: '100%', maxWidth: 1100 }}>
        <Col xs={24}>
          <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
            {/* HERO */}
            <div style={heroStyle}>
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={14}>
                  <Space align="center" size={12} style={{ minWidth: 0 }}>
                    <img
                      src={tenantLogo || '/icons/icon-192.png'}
                      alt="logo"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.75)',
                        padding: 6,
                        objectFit: 'contain',
                        flex: '0 0 auto',
                      }}
                      onError={(e) => {
                        if (e.currentTarget.dataset.fallback) return
                        e.currentTarget.dataset.fallback = '1'
                        e.currentTarget.src = '/icons/icon-192.png'
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <Text style={{ display: 'block', fontWeight: 900, fontSize: 16, ...textSafeStyle(false) }}>
                        {tenantName}
                      </Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12, ...textSafeStyle(false) }}>
                        Mon profil • Carte digitale (privé)
                      </Text>
                    </div>
                  </Space>
                </Col>

                <Col xs={24} md={10}>
                  <Space wrap style={{ width: '100%', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                    {tenantLoading ? <Tag color="gold">Entreprise…</Tag> : null}
                    {profileLoading ? <Tag color="gold">Profil…</Tag> : null}
                    {!userSlug ? <Tag color="red">publicSlug manquant</Tag> : null}
                    {!userId ? <Tag color="red">userId manquant</Tag> : null}
                    {!personalPhone && tPhone ? <Tag color="orange">Tel perso absent (fallback entreprise)</Tag> : null}
                    <Tag color="blue" style={{ borderRadius: 999 }}>Privé</Tag>
                  </Space>
                </Col>
              </Row>
            </div>

            {/* BODY */}
            <div style={{ padding: screens.xs ? 14 : 18 }}>
              {loadingAny ? (
                <Skeleton active paragraph={{ rows: 9 }} />
              ) : (
                <Row gutter={[16, 16]}>
                  {/* LEFT */}
                  <Col xs={24} lg={15}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {/* Identity */}
                      <Row gutter={[14, 14]} align="middle">
                        <Col flex="none">
                          <Avatar
                            size={screens.xs ? 76 : 92}
                            src={avatarUrl || undefined}
                            style={{ background: 'rgba(0,0,0,0.08)' }}
                          >
                            {(name || 'U').slice(0, 1).toUpperCase()}
                          </Avatar>
                        </Col>

                        <Col flex="auto" style={{ minWidth: 0 }}>
                          <Title level={screens.xs ? 3 : 2} style={{ margin: 0, lineHeight: 1.12, ...textSafeStyle(false) }}>
                            {name}
                          </Title>

                          {title ? (
                            <Text type="secondary" style={{ display: 'block', ...textSafeStyle(false) }}>
                              {title}
                            </Text>
                          ) : null}

                          {headerPrimaryContact ? (
                            <div style={{ marginTop: 10 }}>
                              <Tag style={{ borderRadius: 999, margin: 0 }}>
                                {headerPrimaryContact}
                              </Tag>
                            </div>
                          ) : null}

                          {email ? (
                            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12, ...textSafeStyle(true) }}>
                              {email}
                            </Text>
                          ) : null}

                          {(personalPhone && tPhone && personalPhone !== tPhone) ? (
                            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12, ...textSafeStyle(true) }}>
                              Tel perso : <b>{personalPhone}</b> • Tel entreprise : <b>{tPhone}</b>
                            </Text>
                          ) : null}

                          {bio ? (
                            <Text
                              type="secondary"
                              style={{ display: 'block', marginTop: 10, whiteSpace: 'pre-wrap', ...textSafeStyle(isMobile) }}
                            >
                              {bio}
                            </Text>
                          ) : null}

                          {!avatarUrl ? (
                            <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12, ...textSafeStyle(true) }}>
                              Avatar indisponible : vérifie que le backend renvoie <b>profile.avatarSignedUrl</b> ou que
                              <b> profile.avatarUrl</b> est bien défini.
                            </Text>
                          ) : null}
                        </Col>
                      </Row>

                      {/* Actions */}
                      <Divider style={{ margin: '12px 0' }} />
                      <Row gutter={[10, 10]}>
                        <Col xs={24} sm={12}>
                          <Button
                            icon={<CopyOutlined />}
                            style={{ ...actionBtnStyle, width: '100%' }}
                            disabled={!publicUrl}
                            onClick={() => copyToClipboard(publicUrl)}
                          >
                            Copier lien public
                          </Button>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Button
                            type="primary"
                            icon={<LinkOutlined />}
                            style={{ ...actionBtnStyle, width: '100%' }}
                            disabled={!publicUrl}
                            href={publicUrl || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ouvrir page publique
                          </Button>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Button
                            icon={<IdcardOutlined />}
                            style={{ ...actionBtnStyle, width: '100%' }}
                            disabled={!vcardUrl}
                            onClick={downloadVcard}
                          >
                            Ajouter au contact (vCard)
                          </Button>
                        </Col>
                      </Row>

                      {/* Entreprise */}
                      <Card
                        size="small"
                        style={sectionCard}
                        title={<Space size={8}><BankOutlined /><Text strong>Entreprise</Text></Space>}
                        bodyStyle={{ padding: 12 }}
                      >
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          {kv('Nom commercial', tenantName, screens)}
                          {tenantLegal ? kv('Raison sociale', tenantLegal, screens) : null}

                          {(tPhone || tEmail || tWebsite) ? (
                            <>
                              {tPhone ? kv('Téléphone entreprise', tPhone, screens) : null}
                              {tEmail ? kv('Email', tEmail, screens) : null}
                              {tWebsite ? kvLink('Site web', tWebsite, screens) : null}
                            </>
                          ) : (
                            <Text type="secondary" style={{ ...textSafeStyle(true) }}>
                              Aucun contact entreprise renseigné.
                            </Text>
                          )}

                          {tAddress ? (
                            <div>
                              <Space size={8} style={{ marginBottom: 6 }}>
                                <HomeOutlined />
                                <Text strong>Adresse</Text>
                              </Space>
                              <Text type="secondary" style={{ display: 'block', ...textSafeStyle(isMobile) }}>
                                {tAddress}
                              </Text>
                            </div>
                          ) : null}

                          {(rccm || ninea || vatNumber) ? (
                            <div style={{ marginTop: 6 }}>
                              <Text strong>Identifiants</Text>
                              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                                {rccm ? kv('RCCM', rccm, screens) : null}
                                {ninea ? kv('NINEA', ninea, screens) : null}
                                {vatNumber ? kv('TVA', vatNumber, screens) : null}
                              </div>
                            </div>
                          ) : null}
                        </Space>
                      </Card>

                      {/* Profil */}
                      <Card size="small" style={sectionCard} title={<Text strong>Profil</Text>} bodyStyle={{ padding: 12 }}>
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          {personalPhone ? kv('Téléphone personnel', personalPhone, screens) : null}
                          {!personalPhone && tPhone ? kv('Téléphone (fallback entreprise)', tPhone, screens) : null}
                          {email ? kv('Email', email, screens) : null}
                          {company ? kv('Organisation', company, screens) : null}
                          {department ? kv('Département', department, screens) : null}
                          {website ? kvLink('Site web', website, screens) : null}
                        </Space>
                      </Card>

                      {/* Liens */}
                      <Card size="small" style={sectionCard} title={<Text strong>Réseaux & liens</Text>} bodyStyle={{ padding: 0 }}>
                        {links?.length ? (
                          <List
                            size="small"
                            dataSource={links}
                            renderItem={(it) => (
                              <List.Item
                                style={{ paddingLeft: 12, paddingRight: 12, alignItems: 'flex-start' }}
                                actions={[
                                  <a key="open" href={it.href} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                                    Ouvrir
                                  </a>,
                                ]}
                              >
                                <List.Item.Meta
                                  title={<span style={{ fontWeight: 900, ...textSafeStyle(false) }}>{it.label}</span>}
                                  description={<span style={{ opacity: 0.75, ...textSafeStyle(true) }}>{it.value}</span>}
                                />
                              </List.Item>
                            )}
                          />
                        ) : (
                          <div style={{ padding: 12 }}>
                            <Text type="secondary">Aucun lien renseigné.</Text>
                          </div>
                        )}
                      </Card>
                    </Space>
                  </Col>

                  {/* RIGHT : QR */}
                  <Col xs={24} lg={9}>
                    <Card style={sectionCard} bodyStyle={{ padding: 14 }}>
                      <Space direction="vertical" size={10} style={{ width: '100%', alignItems: 'center' }}>
                        <Space align="center" size={8}>
                          <QrcodeOutlined />
                          <Text strong>QR Code</Text>
                        </Space>

                        <Text type="secondary" style={{ textAlign: 'center', ...textSafeStyle(true) }}>
                          Scannez pour ouvrir la page publique.
                        </Text>

                        <div style={{ background: '#fff', padding: 14, borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)' }}>
                          <QRCodeCanvas value={publicUrl || ' '} size={screens.xs ? 210 : 240} includeMargin />
                        </div>

                        <Divider style={{ margin: '10px 0', width: '100%' }} />

                        <div style={{ width: '100%' }}>
                          <Text strong>Route publique</Text>
                          <div
                            style={{
                              marginTop: 8,
                              padding: 12,
                              borderRadius: 14,
                              border: '1px dashed rgba(0,0,0,0.18)',
                              background: 'rgba(0,0,0,0.02)',
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: 12,
                              ...textSafeStyle(true),
                            }}
                          >
                            {`/t/${tenantSlug || ':tenantSlug'}/u/${userSlug || ':userSlug(publicSlug)'}`}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <Space wrap>
                              <Button
                                icon={<CopyOutlined />}
                                style={{ borderRadius: 12 }}
                                disabled={!publicUrl}
                                onClick={() => copyToClipboard(publicUrl)}
                              >
                                Copier
                              </Button>
                              <Button
                                icon={<LinkOutlined />}
                                style={{ borderRadius: 12 }}
                                disabled={!publicUrl}
                                href={publicUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Ouvrir
                              </Button>
                            </Space>
                          </div>
                        </div>

                        {!publicUrl ? (
                          <div style={{ width: '100%' }}>
                            <Divider style={{ margin: '10px 0' }} />
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={
                                <Text type="secondary" style={{ ...textSafeStyle(true) }}>
                                  Lien public indisponible : vérifie <b>tenant.slug</b> et <b>user.publicSlug</b>.
                                </Text>
                              }
                            />
                          </div>
                        ) : null}
                      </Space>
                    </Card>
                  </Col>
                </Row>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}