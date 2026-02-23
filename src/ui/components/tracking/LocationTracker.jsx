import React, { useEffect, useRef, useState } from 'react'
import { App as AntApp, Button, Space, Tag, Typography } from 'antd'
import { AimOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../../../api/api'

const { Text } = Typography

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null }

export default function LocationTracker({ intervalMs = 30000 }) {
  const { message } = AntApp.useApp()

  const [running, setRunning] = useState(false)
  const [lastPingAt, setLastPingAt] = useState(null)
  const [lastCoords, setLastCoords] = useState(null)
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)

  const timerRef = useRef(null)
  const inFlightRef = useRef(false)

  async function sendPing(payload) {
    // évite double ping concurrent (mobile / tab throttling)
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSending(true)

    try {
      const res = await api.locations.ping(payload)
      setLastPingAt(new Date().toISOString())
      setErr('')
      return res
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Ping impossible'
      setErr(String(msg))
      message.error(String(msg))
      throw e
    } finally {
      inFlightRef.current = false
      setSending(false)
    }
  }

  async function pingOnce() {
    if (!navigator.geolocation) {
      setErr('Géolocalisation non supportée')
      return
    }

    setErr('')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = n(pos?.coords?.latitude)
          const lng = n(pos?.coords?.longitude)
          const accuracy = n(pos?.coords?.accuracy)

          if (lat == null || lng == null) throw new Error('Coordonnées invalides')

          setLastCoords({ lat, lng, accuracy })

          await sendPing({
            lat,
            lng,
            accuracy: accuracy ?? undefined,
            capturedAt: new Date().toISOString(),
            source: 'web',
            meta: {
              ua: navigator.userAgent,
              // utile si tu veux différencier desktop/mobile
              platform: navigator.platform,
            },
          })
        } catch (e) {
          // déjà géré dans sendPing
        }
      },
      (e) => {
        const msg = e?.message || 'Permission refusée'
        setErr(String(msg))
        message.error(String(msg))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  function start() {
    if (running) return
    setRunning(true)
    pingOnce()
    timerRef.current = setInterval(pingOnce, intervalMs)
  }

  function stop() {
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  // ⚠️ Web: quand onglet devient hidden, certains navigateurs throttlent.
  // On force un ping au retour sur l’onglet.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible' && running) {
        pingOnce()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => () => stop(), [])

  return (
    <div style={{ width: '100%' }}>
      <Space wrap>
        <Button
          type={running ? 'default' : 'primary'}
          icon={running ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={running ? stop : start}
          style={{ borderRadius: 12 }}
          loading={sending}
        >
          {running ? 'Arrêter' : 'Démarrer'}
        </Button>

        <Button
          icon={<AimOutlined />}
          onClick={pingOnce}
          style={{ borderRadius: 12 }}
          loading={sending}
        >
          Ping maintenant
        </Button>

        {running ? <Tag color="green" style={{ borderRadius: 999 }}>Actif</Tag> : <Tag style={{ borderRadius: 999 }}>Inactif</Tag>}

        {lastPingAt ? (
          <Tag style={{ borderRadius: 999 }}>
            Dernier ping: {dayjs(lastPingAt).format('HH:mm:ss')}
          </Tag>
        ) : null}

        {lastCoords ? (
          <Tag color="blue" style={{ borderRadius: 999 }}>
            {lastCoords.lat.toFixed(5)}, {lastCoords.lng.toFixed(5)} {lastCoords.accuracy ? `±${Math.round(lastCoords.accuracy)}m` : ''}
          </Tag>
        ) : null}
      </Space>

      {err ? (
        <div style={{ marginTop: 10 }}>
          <Text type="danger">{err}</Text>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <Text type="secondary">
            Astuce: ouvre DevTools → Network et vérifie que <b>POST /api/locations/ping</b> passe bien en 200.
          </Text>
        </div>
      )}
    </div>
  )
}