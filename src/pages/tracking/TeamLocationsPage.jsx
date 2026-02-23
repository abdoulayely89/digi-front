// src/pages/tracking/TeamLocationsPage.jsx
import React, { useEffect, useMemo, useState, useContext, useCallback } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Grid,
  List,
  Collapse,
  Divider,
  Empty,
} from 'antd'
import { ReloadOutlined, EnvironmentOutlined, HistoryOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../../api/api'
import { AuthContext } from '../../context/AuthContext'

// ✅ Leaflet
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function roleStr(v) { return String(v || '').toLowerCase().trim() }

function minutesAgo(d) {
  if (!d) return null
  const x = dayjs(d)
  if (!x.isValid()) return null
  return Math.max(0, dayjs().diff(x, 'minute'))
}

function textSafeStyle(isMobile) {
  return {
    writingMode: 'horizontal-tb',
    textOrientation: 'mixed',
    direction: 'ltr',
    unicodeBidi: 'plaintext',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.45,
    fontSize: isMobile ? 12 : undefined,
  }
}

function statusTagFromMinutes(m) {
  if (m == null) return { color: 'default', label: '—' }
  if (m <= 5) return { color: 'green', label: `${m} min` }
  if (m <= 10) return { color: 'gold', label: `${m} min` }
  return { color: 'orange', label: `${m} min` }
}

function fmtTs(v) {
  if (!v) return '—'
  const x = dayjs(v)
  if (!x.isValid()) return '—'
  return x.format('YYYY-MM-DD HH:mm:ss')
}

// ✅ Affichage humain du commercial (fallback sur email puis id)
function displayUser(r) {
  const name = safeStr(r?.userName)
  const email = safeStr(r?.userEmail)
  const id = safeStr(r?.userId)
  return name || email || id || '—'
}

function displayUserSub(r) {
  const email = safeStr(r?.userEmail)
  const role = safeStr(r?.userRole)
  const status = safeStr(r?.userStatus)
  const bits = []
  if (email) bits.push(email)
  if (role) bits.push(role)
  if (status) bits.push(status)
  return bits.join(' • ')
}

function isNum(v) {
  const x = Number(v)
  return Number.isFinite(x)
}

function toLatLng(r) {
  const lat = Number(r?.lat)
  const lng = Number(r?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

function boundsFromPoints(points) {
  const pts = (points || []).map(toLatLng).filter(Boolean)
  if (!pts.length) return null
  return L.latLngBounds(pts.map(([lat, lng]) => L.latLng(lat, lng)))
}

function MapBox({ height, children }) {
  return (
    <div
      style={{
        height,
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      {children}
    </div>
  )
}

export default function TeamLocationsPage() {
  const { message } = AntApp.useApp()
  const { user, tenant } = useContext(AuthContext)
  const screens = useBreakpoint()
  const isMobile = !!screens.xs || !!screens.sm

  const role = roleStr(user?.role)
  const canViewTeam =
    role === 'tenant_admin' ||
    role === 'manager' ||
    role === 'admin' ||
    role === 'superadmin'

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [lastOkAt, setLastOkAt] = useState(null)
  const [lastErr, setLastErr] = useState('')
  const [lastStatus, setLastStatus] = useState('idle') // idle | ok | empty | error

  // cache history par userId
  const [historyLoading, setHistoryLoading] = useState({})
  const [historyErr, setHistoryErr] = useState({})
  const [historyMap, setHistoryMap] = useState({})
  const [activeKeys, setActiveKeys] = useState([])

  const load = useCallback(async () => {
    if (!canViewTeam) return
    try {
      setLoading(true)
      setLastErr('')
      const res = await api.locations.live()
      const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
      setItems(arr)
      setLastOkAt(new Date().toISOString())
      setLastStatus(arr.length ? 'ok' : 'empty')
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Erreur chargement positions'
      setLastErr(String(msg))
      setLastStatus('error')
      message.error(String(msg))
    } finally {
      setLoading(false)
    }
  }, [canViewTeam, message])

  useEffect(() => {
    if (!canViewTeam) return
    load()
    const t = setInterval(() => load(), 15000)
    return () => clearInterval(t)
  }, [canViewTeam, load])

  const loadHistory = useCallback(async (userId) => {
    const uid = safeStr(userId)
    if (!uid) return
    if (historyMap[uid]?.length) return
    try {
      setHistoryLoading((s) => ({ ...s, [uid]: true }))
      setHistoryErr((s) => ({ ...s, [uid]: '' }))

      const res = await api.locations.history(uid, { limit: 200 })
      const arr = Array.isArray(res?.items) ? res.items : []
      setHistoryMap((s) => ({ ...s, [uid]: arr }))
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Erreur chargement historique'
      setHistoryErr((s) => ({ ...s, [uid]: String(msg) }))
      message.error(String(msg))
    } finally {
      setHistoryLoading((s) => ({ ...s, [uid]: false }))
    }
  }, [historyMap, message])

  // ✅ Table: colonne "Commercial" => nom/email/id
  const columns = useMemo(() => ([
    {
      title: 'Commercial',
      key: 'user',
      fixed: isMobile ? undefined : 'left',
      width: isMobile ? 240 : 320,
      render: (_, r) => (
        <div style={{ minWidth: 0 }}>
          <Text
            strong
            style={{
              ...textSafeStyle(isMobile),
              display: 'block',
              maxWidth: isMobile ? 220 : 300,
            }}
            ellipsis
          >
            {displayUser(r)}
          </Text>

          <Text
            type="secondary"
            style={{
              ...textSafeStyle(true),
              display: 'block',
              fontSize: 12,
              maxWidth: isMobile ? 220 : 300,
            }}
            ellipsis
          >
            {displayUserSub(r) || safeStr(r?.userId)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Coordonnées',
      key: 'coords',
      render: (_, r) => (
        <Space direction="vertical" size={2} style={{ minWidth: 0 }}>
          <Text style={{ ...textSafeStyle(isMobile) }}>
            Lat: <Text code>{r.lat}</Text> • Lng: <Text code>{r.lng}</Text>
          </Text>
          {r.accuracy != null ? (
            <Text type="secondary" style={{ ...textSafeStyle(isMobile) }}>
              Précision: {r.accuracy} m
            </Text>
          ) : null}
        </Space>
      ),
      width: isMobile ? 260 : 360,
    },
    {
      title: 'Dernier ping',
      dataIndex: 'capturedAt',
      key: 'capturedAt',
      render: (v) => {
        const m = minutesAgo(v)
        const st = statusTagFromMinutes(m)
        return (
          <Space direction="vertical" size={2}>
            <Text style={{ ...textSafeStyle(isMobile) }}>
              {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'}
            </Text>
            <Tag color={st.color} style={{ width: 'fit-content', borderRadius: 999 }}>
              {st.label}
            </Tag>
          </Space>
        )
      },
      width: isMobile ? 220 : 240,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (v) => (
        <Tag style={{ borderRadius: 999 }}>
          {safeStr(v) || 'web'}
        </Tag>
      ),
    },
  ]), [isMobile])

  if (!canViewTeam) {
    return (
      <div style={{ padding: isMobile ? 12 : 16 }}>
        <Alert
          type="warning"
          showIcon
          message="Accès refusé"
          description="Cette page est réservée aux managers / admins."
        />
      </div>
    )
  }

  const pageWrapStyle = { padding: isMobile ? 12 : 16 }
  const cardStyle = { borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }
  const headerStyle = {
    padding: isMobile ? 14 : 16,
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(16,185,129,0.08))',
  }

  const statusBadge =
    lastStatus === 'ok' ? <Tag color="green" style={{ borderRadius: 999 }}>OK</Tag> :
    lastStatus === 'empty' ? <Tag color="gold" style={{ borderRadius: 999 }}>Aucune donnée</Tag> :
    lastStatus === 'error' ? <Tag color="red" style={{ borderRadius: 999 }}>Erreur</Tag> :
    <Tag style={{ borderRadius: 999 }}>…</Tag>

  // ===== Carte globale (dernières positions)
  const globalPoints = useMemo(() => {
    return items
      .map((r) => {
        const ll = toLatLng(r)
        if (!ll) return null
        return { ll, r }
      })
      .filter(Boolean)
  }, [items])

  const globalBounds = useMemo(() => boundsFromPoints(items), [items])
  const globalCenter = useMemo(() => {
    // fallback Dakar
    if (!globalPoints.length) return [14.7167, -17.4677]
    return globalPoints[0].ll
  }, [globalPoints])

  // ✅ Collapse: label => nom/email/id
  const collapseItems = useMemo(() => {
    return items.map((r) => {
      const uid = safeStr(r?.userId)
      const m = minutesAgo(r?.capturedAt)
      const st = statusTagFromMinutes(m)
      const h = historyMap[uid] || []
      const hLoading = !!historyLoading[uid]
      const hErr = safeStr(historyErr[uid])

      const title = displayUser(r)
      const sub = displayUserSub(r)

      const historyLine = h
        .map((p) => toLatLng(p))
        .filter(Boolean)

      const allForBounds = [
        r, // last
        ...(h || []),
      ]
      const b = boundsFromPoints(allForBounds)
      const center = toLatLng(r) || (historyLine[0] || [14.7167, -17.4677])

      return {
        key: uid,
        label: (
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space direction="vertical" size={0} style={{ minWidth: 0, maxWidth: isMobile ? '100%' : 520 }}>
              <Space wrap style={{ minWidth: 0 }}>
                <Text strong style={{ ...textSafeStyle(true) }} ellipsis>
                  {title}
                </Text>
                <Tag color={st.color} style={{ borderRadius: 999 }}>{st.label}</Tag>
                <Tag style={{ borderRadius: 999 }}>{safeStr(r?.source) || 'web'}</Tag>
              </Space>

              {sub ? (
                <Text type="secondary" style={{ fontSize: 12, ...textSafeStyle(true) }} ellipsis>
                  {sub}
                </Text>
              ) : null}
            </Space>

            <Tag color="blue" style={{ borderRadius: 999 }}>
              {h.length ? `${h.length} points` : '0 point'}
            </Tag>
          </Space>
        ),
        children: (
          <div style={{ ...textSafeStyle(true) }}>
            <Space wrap style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
              <Space wrap>
                <Text type="secondary">Dernier:</Text>
                <Text>{fmtTs(r?.capturedAt)}</Text>
                {r?.lat != null && r?.lng != null && isNum(r.lat) && isNum(r.lng) ? (
                  <Tag color="blue" style={{ borderRadius: 999 }}>
                    {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}
                  </Tag>
                ) : null}
              </Space>

              <Button
                icon={<HistoryOutlined />}
                onClick={() => loadHistory(uid)}
                loading={hLoading}
                style={{ borderRadius: 12 }}
              >
                Charger historique
              </Button>
            </Space>

            {/* ✅ Carte (dernier + historique) */}
            <div style={{ marginBottom: 12 }}>
              <MapBox height={isMobile ? 260 : 320}>
                <MapContainer
                  center={center}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  whenReady={(m) => {
                    try {
                      if (b) m.target.fitBounds(b, { padding: [20, 20] })
                    } catch {}
                  }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Dernier point */}
                  {toLatLng(r) ? (
                    <Marker position={toLatLng(r)}>
                      <Popup>
                        <div style={{ minWidth: 220 }}>
                          <div style={{ fontWeight: 900 }}>{title}</div>
                          <div style={{ marginTop: 4 }}>Dernier ping: {fmtTs(r?.capturedAt)}</div>
                          <div style={{ marginTop: 6 }}>
                            Lat: {Number(r.lat).toFixed(6)}<br />
                            Lng: {Number(r.lng).toFixed(6)}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null}

                  {/* Historique */}
                  {historyLine.length >= 2 ? (
                    <Polyline positions={historyLine} />
                  ) : null}

                  {/* Points historiques (optionnel) */}
                  {historyLine.length ? (
                    historyLine.map((pos, idx) => (
                      <Marker key={`${uid}-p-${idx}`} position={pos}>
                        <Popup>
                          <div style={{ minWidth: 220 }}>
                            <div style={{ fontWeight: 900 }}>{title}</div>
                            <div style={{ marginTop: 4 }}>
                              Point #{idx + 1} / {historyLine.length}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ))
                  ) : null}
                </MapContainer>
              </MapBox>
              <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12, ...textSafeStyle(true) }}>
                Astuce: ouvre “Charger historique” pour afficher la trace (polyline).
              </Text>
            </div>

            {hErr ? (
              <Alert
                type="error"
                showIcon
                message="Erreur historique"
                description={<span style={textSafeStyle(true)}>{hErr}</span>}
                style={{ borderRadius: 14, marginBottom: 10 }}
              />
            ) : null}

            {!hLoading && !h.length ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Aucun historique (le commercial n’a pas encore ping ou la collecte est coupée)."
              />
            ) : null}

            {h.length ? (
              isMobile ? (
                <List
                  size="small"
                  dataSource={h}
                  renderItem={(p) => (
                    <List.Item style={{ paddingLeft: 0, paddingRight: 0 }}>
                      <Card
                        size="small"
                        style={{
                          width: '100%',
                          borderRadius: 14,
                          border: '1px solid rgba(0,0,0,0.08)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                        bodyStyle={{ padding: 12 }}
                      >
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                            <Text strong>{fmtTs(p?.capturedAt)}</Text>
                            <Tag style={{ borderRadius: 999 }}>{safeStr(p?.source) || 'web'}</Tag>
                          </Space>

                          <Text>
                            Lat: <Text code>{p?.lat}</Text> • Lng: <Text code>{p?.lng}</Text>
                          </Text>

                          {p?.accuracy != null ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Précision: {p.accuracy} m
                            </Text>
                          ) : null}
                        </Space>
                      </Card>
                    </List.Item>
                  )}
                />
              ) : (
                <Table
                  size="small"
                  rowKey={(p, idx) => String(p?._id || `${uid}-${idx}`)}
                  dataSource={h}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 720 }}
                  columns={[
                    { title: 'Date/heure', dataIndex: 'capturedAt', key: 'capturedAt', width: 200, render: (v) => <Text>{fmtTs(v)}</Text> },
                    { title: 'Lat', dataIndex: 'lat', key: 'lat', width: 170, render: (v) => <Text code>{safeStr(v)}</Text> },
                    { title: 'Lng', dataIndex: 'lng', key: 'lng', width: 170, render: (v) => <Text code>{safeStr(v)}</Text> },
                    { title: 'Précision', dataIndex: 'accuracy', key: 'accuracy', width: 140, render: (v) => (v != null ? `${v} m` : '—') },
                    { title: 'Source', dataIndex: 'source', key: 'source', width: 120, render: (v) => <Tag style={{ borderRadius: 999 }}>{safeStr(v) || 'web'}</Tag> },
                  ]}
                />
              )
            ) : null}
          </div>
        ),
      }
    })
  }, [items, historyMap, historyLoading, historyErr, isMobile, loadHistory])

  const onCollapseChange = useCallback((keys) => {
    const arr = Array.isArray(keys) ? keys : [keys].filter(Boolean)
    setActiveKeys(arr)
    arr.forEach((k) => {
      const uid = safeStr(k)
      if (uid && !historyMap[uid]?.length) loadHistory(uid)
    })
  }, [historyMap, loadHistory])

  return (
    <div style={pageWrapStyle}>
      <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
        <div style={headerStyle}>
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Space align="start" size={12} style={{ minWidth: 0 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  flex: '0 0 auto',
                }}
              >
                <EnvironmentOutlined />
              </div>

              <div style={{ minWidth: 0 }}>
                <Title level={isMobile ? 4 : 3} style={{ margin: 0, ...textSafeStyle(false) }}>
                  Positions (équipe)
                </Title>
                <Text type="secondary" style={{ display: 'block', ...textSafeStyle(true) }}>
                  Live + historique par commercial + carte.
                </Text>

                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    {statusBadge}
                    <Tag color="blue" style={{ borderRadius: 999 }}>{items.length} commerciaux</Tag>
                    {loading ? <Tag color="gold" style={{ borderRadius: 999 }}>Chargement…</Tag> : null}
                    {lastOkAt ? <Tag style={{ borderRadius: 999 }}>Maj: {dayjs(lastOkAt).format('HH:mm:ss')}</Tag> : null}
                  </Space>
                </div>
              </div>
            </Space>

            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} style={{ borderRadius: 12 }}>
              Rafraîchir
            </Button>
          </Space>
        </div>

        <div style={{ padding: isMobile ? 12 : 16 }}>
          {lastErr ? (
            <Alert
              type="error"
              showIcon
              message="Erreur API"
              description={<span style={textSafeStyle(true)}>{lastErr}</span>}
              style={{ marginBottom: 12, borderRadius: 14 }}
            />
          ) : null}

          {/* ✅ Carte globale */}
          <div style={{ marginBottom: 12 }}>
            <Card
              size="small"
              style={{
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
              bodyStyle={{ padding: 12 }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <Text strong style={{ ...textSafeStyle(false) }}>Vue globale</Text>
                    <Tag style={{ borderRadius: 999 }}>{globalPoints.length} marqueurs</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, ...textSafeStyle(true) }}>
                    Dernière position par commercial
                  </Text>
                </Space>

                <MapBox height={isMobile ? 280 : 380}>
                  <MapContainer
                    center={globalCenter}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    whenReady={(m) => {
                      try {
                        if (globalBounds) m.target.fitBounds(globalBounds, { padding: [20, 20] })
                      } catch {}
                    }}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {globalPoints.map(({ ll, r }) => {
                      const m = minutesAgo(r?.capturedAt)
                      const st = statusTagFromMinutes(m)
                      return (
                        <Marker key={safeStr(r?._id || r?.userId)} position={ll}>
                          <Popup>
                            <div style={{ minWidth: 240 }}>
                              <div style={{ fontWeight: 900 }}>{displayUser(r)}</div>
                              {displayUserSub(r) ? (
                                <div style={{ marginTop: 4, opacity: 0.8 }}>{displayUserSub(r)}</div>
                              ) : null}
                              <div style={{ marginTop: 8 }}>
                                Ping: {fmtTs(r?.capturedAt)}<br />
                                Statut: <b>{st.label}</b>
                              </div>
                              <div style={{ marginTop: 8 }}>
                                Lat: {Number(ll[0]).toFixed(6)}<br />
                                Lng: {Number(ll[1]).toFixed(6)}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      )
                    })}
                  </MapContainer>
                </MapBox>
              </Space>
            </Card>
          </div>

          {!isMobile ? (
            <>
              <Table
                rowKey={(r) => String(r._id || r.userId)}
                loading={loading}
                dataSource={items}
                columns={columns}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 980 }}
                style={{ ...textSafeStyle(false) }}
                locale={{ emptyText: 'Aucune position (vérifie /locations/ping côté commerciaux)' }}
              />

              <Divider style={{ margin: '14px 0' }} />

              <Title level={4} style={{ margin: 0, ...textSafeStyle(false) }}>
                Historique par commercial
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 10, ...textSafeStyle(true) }}>
                Ouvre un commercial pour voir sa carte + ses derniers points.
              </Text>

              <Collapse accordion={false} activeKey={activeKeys} onChange={onCollapseChange} items={collapseItems} />
            </>
          ) : (
            <>
              <Title level={5} style={{ margin: 0, ...textSafeStyle(false) }}>
                Historique par commercial
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 10, ...textSafeStyle(true) }}>
                Tape sur un commercial pour voir sa carte + ses derniers points.
              </Text>

              <Collapse accordion={false} activeKey={activeKeys} onChange={onCollapseChange} items={collapseItems} />
            </>
          )}
        </div>
      </Card>
    </div>
  )
}