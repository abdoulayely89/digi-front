// src/pages/public/PublicProfilePage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  App as AntApp,
  Alert,
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
} from 'antd'
import {
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  IdcardOutlined,
  BankOutlined,
  HomeOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { api } from '../../api/api'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

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
      <Text style={{ ...textSafeStyle(isMobile), minWidth: 0 }}>{v}</Text>
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
        style={{ ...textSafeStyle(isMobile), minWidth: 0, display: 'block' }}
      >
        {u}
      </a>
    </div>
  )
}

export default function PublicProfilePage() {
  const { message } = AntApp.useApp()
  const { tenantSlug, userSlug } = useParams()
  const screens = useBreakpoint()
  const isMobile = !!screens?.xs

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [data, setData] = useState(null)

  const debug = useMemo(() => {
    const v = safeStr(import.meta?.env?.VITE_DEBUG_PUBLIC_PROFILE)
    return v === '1' || v.toLowerCase() === 'true'
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setErr('')
        setLoading(true)

        // ⚠️ si tenantSlug/userSlug sont vides => route React pas correcte
        if (!tenantSlug || !userSlug) {
          throw new Error('Route publique invalide: tenantSlug/userSlug manquants')
        }

        const res = await api.public.profile(tenantSlug, userSlug)
        if (mounted) setData(res || null)

        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[PublicProfilePage] profile ok', { tenantSlug, userSlug, res })
        }
      } catch (e) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          'Erreur'

        if (mounted) setErr(String(msg))

        if (debug) {
          // eslint-disable-next-line no-console
          console.warn('[PublicProfilePage] profile failed', {
            tenantSlug,
            userSlug,
            apiBase: getApiBase(),
            status: e?.response?.status,
            data: e?.response?.data,
            message: e?.message,
          })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [tenantSlug, userSlug, debug])

  const tenant = data?.tenant || {}
  const user = data?.user || {}
  const profile = data?.profile || {}

  const p = useMemo(() => {
    const up = user?.profile || {}
    const pub = profile || {}
    return { ...up, ...pub }
  }, [user?.profile, profile])

  const name = safeStr(user?.name) || safeStr(p?.name) || '—'
  const title = pick(p, ['title', 'jobTitle', 'position', 'headline'])
  const email = safeStr(p?.email) || safeStr(user?.email)

  const personalPhone = pick(p, ['phone', 'mobile', 'tel', 'whatsapp'])
  const companyPhone = getTenantPhone(tenant)
  const displayPhone = personalPhone || companyPhone

  const website = pick(p, ['website', 'site', 'url'])
  const company = pick(p, ['company', 'organization', 'org', 'employer'])
  const department = pick(p, ['department', 'service', 'team'])
  const bio = pick(p, ['bio', 'about', 'description', 'summary'])

  // ✅ AVATAR : ton backend doit remplir user.profile.avatarSignedUrl
  // Dans ton JSON tu as profile.avatarUrl = "tenants/.../avatar.jpg"
  // => si backend ne re-signe pas, on ne peut pas afficher directement ce path.
  const avatarResolved = useMemo(() => {
    const signed =
      safeStr(user?.profile?.avatarSignedUrl) ||
      safeStr(p?.avatarSignedUrl) ||
      safeStr(profile?.avatarSignedUrl) ||
      safeStr(profile?.profile?.avatarSignedUrl)

    if (signed && isHttpUrl(signed)) return { url: signed, reason: 'signedUrl' }

    // si on a une URL directe http(s)
    const direct = safeStr(pick(p, ['avatarUrl', 'photoUrl', 'pictureUrl', 'imageUrl']))
    if (direct && isHttpUrl(direct)) return { url: direct, reason: 'directHttpUrl' }

    // ⚠️ si "avatarUrl" est un objectPath (tenants/...):
    // on ne peut pas l'afficher sans signed url => on tente fallback /users/:id/avatar
    const uid = safeStr(user?._id || user?.id)
    if (uid) return { url: apiAssetUrl(`/users/${encodeURIComponent(uid)}/avatar`), reason: 'fallback/users/:id/avatar' }

    return { url: '', reason: 'none' }
  }, [user, p, profile])

  const avatarUrl = avatarResolved.url
  const avatarKey = useMemo(() => safeStr(avatarUrl) || 'no-avatar', [avatarUrl])

  const tenantName = safeStr(tenant?.tradeName || tenant?.legalName || tenant?.name) || 'Entreprise'
  const tenantLegal = safeStr(tenant?.legalName)
  const tenantLogo = normalizeAssetUrl(safeStr(tenant?.logoUrl || tenant?.branding?.logoUrl))
  const tEmail = getTenantEmail(tenant)
  const tWebsite = getTenantWebsite(tenant)
  const tAddress = buildTenantAddress(tenant)

  const rccm = safeStr(tenant?.ids?.rccm)
  const ninea = safeStr(tenant?.ids?.ninea)
  const vatNumber = safeStr(tenant?.ids?.vatNumber)

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

  // ✅ vCard:
  // - desktop: download (attachment)
  // - mobile: inline (meilleur comportement "Ajouter au contact")
  const vcardHref = useMemo(() => {
    if (!tenantSlug || !userSlug) return ''
    try {
      return api.public.vcardUrl(tenantSlug, userSlug)
    } catch {
      return apiAssetUrl(`/public/t/${encodeURIComponent(tenantSlug)}/u/${encodeURIComponent(userSlug)}/vcard`)
    }
  }, [tenantSlug, userSlug])

  const vcardHrefInline = useMemo(() => {
    const base = safeStr(vcardHref)
    if (!base) return ''
    const sep = base.includes('?') ? '&' : '?'
    // mode=inline + download=0 (renforce sur certains navigateurs)
    return `${base}${sep}mode=inline&download=0`
  }, [vcardHref])

  const containerStyle = {
    minHeight: '100vh',
    padding: screens.xs ? 12 : 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(800px 500px at 20% 10%, rgba(59,130,246,0.16), transparent 60%),' +
      'radial-gradient(800px 500px at 80% 20%, rgba(16,185,129,0.14), transparent 60%),' +
      'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.00))',
    writingMode: 'horizontal-tb',
    textOrientation: 'mixed',
  }

  const cardStyle = { borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }
  const heroStyle = {
    padding: screens.xs ? 14 : 18,
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.10))',
  }
  const sectionCard = { borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.02)' }
  const actionBtnStyle = { borderRadius: 12 }

  const debugUi = useMemo(() => {
    if (!debug) return null
    return (
      <div style={{ marginTop: 10 }}>
        <Tag color="geekblue" style={{ borderRadius: 999 }}>DEBUG</Tag>
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 12,
            border: '1px dashed rgba(0,0,0,0.20)',
            background: 'rgba(0,0,0,0.02)',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            ...textSafeStyle(true),
          }}
        >
          <div><b>apiBase</b>: {getApiBase()}</div>
          <div><b>tenantSlug</b>: {safeStr(tenantSlug) || '—'}</div>
          <div><b>userSlug</b>: {safeStr(userSlug) || '—'}</div>
          <div><b>avatar.reason</b>: {avatarResolved.reason}</div>
          <div><b>avatar.url</b>: {safeStr(avatarUrl) || '—'}</div>
          <div><b>user._id</b>: {safeStr(user?._id || user?.id) || '—'}</div>
          <div><b>user.profile.avatarSignedUrl</b>: {safeStr(user?.profile?.avatarSignedUrl) || '—'}</div>
          <div><b>tenant.logoUrl</b>: {safeStr(tenant?.logoUrl || tenant?.branding?.logoUrl) || '—'}</div>
          <div><b>vcard.download</b>: {safeStr(vcardHref) || '—'}</div>
          <div><b>vcard.inline</b>: {safeStr(vcardHrefInline) || '—'}</div>
        </div>
      </div>
    )
  }, [debug, tenantSlug, userSlug, avatarResolved, avatarUrl, user, tenant, vcardHref, vcardHrefInline])

  return (
    <div style={containerStyle}>
      <Row gutter={[16, 16]} style={{ width: '100%', maxWidth: 1020 }}>
        <Col xs={24}>
          <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
            {/* Hero */}
            <div style={heroStyle}>
              <Space
                align="center"
                size={12}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  rowGap: 10,
                }}
              >
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
                      Carte digitale • Publique
                    </Text>
                  </div>
                </Space>

                <Space wrap>
                  <Tag icon={<GlobalOutlined />} color="blue">Public</Tag>
                  {debug ? <Tag color="geekblue">DEBUG</Tag> : null}
                </Space>
              </Space>
            </div>

            {/* Body */}
            <div style={{ padding: screens.xs ? 14 : 18 }}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 10 }} />
              ) : err ? (
                <Alert
                  type="error"
                  showIcon
                  message="Impossible de charger la page publique"
                  description={
                    <div style={textSafeStyle(true)}>
                      <div style={{ marginBottom: 8 }}>{err}</div>
                      <div>
                        <b>Vérifie la route React :</b> <code>/t/:tenantSlug/u/:userSlug</code>
                      </div>
                      <div>
                        <b>Vérifie l’API :</b> <code>{getApiBase()}</code>
                      </div>
                      {debugUi}
                    </div>
                  }
                />
              ) : !data ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Aucune donnée"
                  description={
                    <div style={textSafeStyle(true)}>
                      Réponse vide. <b>API</b>: <code>{getApiBase()}</code>
                      {debugUi}
                    </div>
                  }
                />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {/* Identity */}
                  <Row gutter={[14, 14]} align="middle">
                    <Col flex="none">
                      <Avatar
                        key={avatarKey}
                        size={screens.xs ? 76 : 90}
                        src={avatarUrl || undefined}
                        style={{ background: 'rgba(0,0,0,0.08)' }}
                      >
                        {(name || 'U').slice(0, 1).toUpperCase()}
                      </Avatar>
                    </Col>

                    <Col flex="auto" style={{ minWidth: 0 }}>
                      <Title
                        level={screens.xs ? 3 : 2}
                        style={{ margin: 0, lineHeight: 1.12, ...textSafeStyle(false) }}
                      >
                        {name}
                      </Title>

                      {title ? (
                        <Text type="secondary" style={{ display: 'block', ...textSafeStyle(false) }}>
                          {title}
                        </Text>
                      ) : null}

                      {debugUi}

                      {bio ? <Divider style={{ margin: '10px 0' }} /> : null}

                      {bio ? (
                        <Text
                          type="secondary"
                          style={{ display: 'block', whiteSpace: 'pre-wrap', ...textSafeStyle(isMobile) }}
                        >
                          {bio}
                        </Text>
                      ) : null}

                      {(email || displayPhone) ? <Divider style={{ margin: '10px 0' }} /> : null}

                      <Space wrap>
                        {email ? <Tag style={{ borderRadius: 999, margin: 0 }}>{email}</Tag> : null}
                        {displayPhone ? <Tag style={{ borderRadius: 999, margin: 0 }}>{displayPhone}</Tag> : null}
                      </Space>

                      {!avatarUrl ? (
                        <div style={{ marginTop: 10 }}>
                          <Text type="secondary" style={{ fontSize: 12, ...textSafeStyle(true) }}>
                            Avatar indisponible : le backend public doit renvoyer <b>user.profile.avatarSignedUrl</b>
                          </Text>
                        </div>
                      ) : null}
                    </Col>
                  </Row>

                  {/* Actions (public) */}
                  <Divider style={{ margin: '12px 0' }} />
                  <Space wrap>
                    {displayPhone ? (
                      <Button icon={<PhoneOutlined />} href={`tel:${displayPhone}`} style={actionBtnStyle}>
                        Appeler
                      </Button>
                    ) : null}

                    {email ? (
                      <Button icon={<MailOutlined />} href={`mailto:${email}`} style={actionBtnStyle}>
                        Email
                      </Button>
                    ) : null}

                    <Button
                      type="primary"
                      icon={<IdcardOutlined />}
                      onClick={() => {
                        if (!vcardHref) return message.error('vCard indisponible')

                        const targetUrl = isMobile ? vcardHrefInline : vcardHref

                        try {
                          // iOS/Safari: location.assign marche mieux pour inline
                          window.location.assign(targetUrl)
                        } catch {
                          const w = window.open(targetUrl, '_blank', 'noopener,noreferrer')
                          if (!w) message.warning('Pop-up bloquée : autorise les pop-ups pour ouvrir la vCard')
                        }
                      }}
                      style={actionBtnStyle}
                      disabled={!vcardHref}
                    >
                      Ajouter au contact
                    </Button>
                  </Space>

                  {/* ENTREPRISE */}
                  <Divider style={{ margin: '12px 0' }} />
                  <Card
                    size="small"
                    style={sectionCard}
                    title={
                      <Space size={8}>
                        <BankOutlined />
                        <Text strong>Entreprise</Text>
                      </Space>
                    }
                    bodyStyle={{ padding: 12 }}
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {kv('Nom commercial', tenantName, screens)}
                      {tenantLegal ? kv('Raison sociale', tenantLegal, screens) : null}

                      {(companyPhone || tEmail || tWebsite) ? (
                        <>
                          {companyPhone ? kv('Téléphone (entreprise)', companyPhone, screens) : null}
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
                          <div style={{ marginTop: 8 }}>
                            {rccm ? kv('RCCM', rccm, screens) : null}
                            {ninea ? kv('NINEA', ninea, screens) : null}
                            {vatNumber ? kv('TVA', vatNumber, screens) : null}
                          </div>
                        </div>
                      ) : null}
                    </Space>
                  </Card>

                  {/* PROFIL */}
                  <Divider style={{ margin: '12px 0' }} />
                  <Card
                    size="small"
                    style={sectionCard}
                    title={
                      <Space size={8}>
                        <LinkOutlined />
                        <Text strong>Profil</Text>
                      </Space>
                    }
                    bodyStyle={{ padding: 12 }}
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {kv('Email', email, screens)}
                      {kv('Organisation', company, screens)}
                      {kv('Département', department, screens)}
                      {website ? kvLink('Site web', website, screens) : null}
                    </Space>
                  </Card>

                  {/* Liens */}
                  <Divider style={{ margin: '12px 0' }} />
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
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}