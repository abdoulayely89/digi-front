import React, { useContext, useState } from 'react'
import { App as AntApp, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { api } from '../../api/api'

const { Title, Text } = Typography

export default function LoginPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const { setAuthSession } = useContext(AuthContext)
  const [loading, setLoading] = useState(false)

  async function onFinish(values) {
    setLoading(true)
    try {
      const data = await api.auth.login(values)
      setAuthSession(data)
      navigate('/dashboard')
    } catch (e) {
      message.error(e?.response?.data?.message || 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 980, display: 'grid', gap: 16, gridTemplateColumns: '1.1fr 0.9fr' }}>
        <Card
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'var(--shadow)',
            borderRadius: 18,
          }}
          bodyStyle={{ padding: 28 }}
        >
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <img src="/icons/icon-192.png" alt="logo" style={{ width: 44, height: 44, borderRadius: 14 }} />
            <Title level={2} style={{ margin: 0, color: 'var(--text)' }}>
              DigiSuite
            </Title>
            <Text style={{ color: 'var(--muted)' }}>
              Plateforme multi-tenant pour cartes digitales, CRM, devis, contrats et signature.
            </Text>
            <div
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(0,0,0,0.20)',
              }}
            >
              <Text style={{ color: 'var(--muted)' }}>
                Astuce: en dev, lance le backend puis utilise le seed pour créer un tenant + un admin.
              </Text>
            </div>
          </Space>
        </Card>

        <Card
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'var(--shadow)',
            borderRadius: 18,
          }}
          bodyStyle={{ padding: 28 }}
        >
          <Title level={4} style={{ marginTop: 0, marginBottom: 18, color: 'var(--text)' }}>
            Connexion
          </Title>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              label={<span style={{ color: 'var(--muted)' }}>Entreprise (slug)</span>}
              name="tenantSlug"
              rules={[{ required: true, message: 'Saisis le slug de l’entreprise' }]}
            >
              <Input placeholder="ex: pma-ci" autoComplete="organization" />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: 'var(--muted)' }}>Email</span>}
              name="email"
              rules={[{ required: true, type: 'email', message: 'Email invalide' }]}
            >
              <Input placeholder="ex: admin@pma.ci" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: 'var(--muted)' }}>Mot de passe</span>}
              name="password"
              rules={[{ required: true, message: 'Mot de passe requis' }]}
            >
              <Input.Password placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Se connecter
            </Button>

            <div style={{ marginTop: 14 }}>
              <Text style={{ color: 'var(--muted)', fontSize: 12 }}>
                Sécurité: tenant scoping via JWT + audit trail (backend).
              </Text>
            </div>
          </Form>
        </Card>
      </div>

      <style>{`
        @media (max-width: 980px) {
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
