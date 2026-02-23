import React, { useMemo } from 'react'
import { Card, Col, Row, Typography, Space, Tag, Grid, List } from 'antd'
import { EnvironmentOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons'
import LocationTracker from '../../ui/components/tracking/LocationTracker'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

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

export default function MyLocationPage() {
  const screens = useBreakpoint()
  const isMobile = !!screens.xs || !!screens.sm

  const wrapStyle = useMemo(() => ({
    padding: isMobile ? 12 : 16,
  }), [isMobile])

  const cardStyle = useMemo(() => ({
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.08)',
    overflow: 'hidden',
  }), [])

  const heroStyle = useMemo(() => ({
    padding: isMobile ? 14 : 16,
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(16,185,129,0.08))',
  }), [isMobile])

  const softCard = useMemo(() => ({
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.08)',
    background: 'rgba(255,255,255,0.02)',
  }), [])

  const tips = [
    {
      icon: <SafetyCertificateOutlined />,
      title: 'Autoriser la géolocalisation',
      desc: 'Dans le navigateur, accepte la permission “Localisation” pour ce site.',
    },
    {
      icon: <ThunderboltOutlined />,
      title: 'Garder l’onglet ouvert',
      desc: 'Le tracking web dépend souvent de l’onglet (surtout sur mobile).',
    },
    {
      icon: <EnvironmentOutlined />,
      title: 'Désactiver si batterie faible',
      desc: 'Coupe le suivi si tu as besoin d’économiser la batterie.',
    },
  ]

  return (
    <div style={wrapStyle}>
      <Row gutter={[16, 16]}>
        {/* LEFT */}
        <Col xs={24} lg={14}>
          <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
            {/* Hero */}
            <div style={heroStyle}>
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
                      Ma localisation
                    </Title>
                    <Text type="secondary" style={{ display: 'block', ...textSafeStyle(true) }}>
                      Active le suivi pour que l’admin/manager voie ta dernière position.
                    </Text>

                    <div style={{ marginTop: 10 }}>
                      <Space wrap>
                        <Tag color="blue" style={{ borderRadius: 999 }}>
                          Tracking web
                        </Tag>
                        <Tag color="gold" style={{ borderRadius: 999 }}>
                          Intervalle: 30s
                        </Tag>
                      </Space>
                    </div>
                  </div>
                </Space>
              </Space>
            </div>

            {/* Body */}
            <div style={{ padding: isMobile ? 12 : 16 }}>
              <Card style={softCard} bodyStyle={{ padding: isMobile ? 12 : 14 }}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Text style={{ fontWeight: 800, ...textSafeStyle(false) }}>
                    Démarrer le suivi
                  </Text>
                  <Text type="secondary" style={{ ...textSafeStyle(true) }}>
                    Le navigateur enverra ta position au serveur à intervalle régulier.
                  </Text>

                  <div style={{ marginTop: 6 }}>
                    <LocationTracker intervalMs={30000} />
                  </div>
                </Space>
              </Card>
            </div>
          </Card>
        </Col>

        {/* RIGHT */}
        <Col xs={24} lg={10}>
          <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
            <div
              style={{
                padding: isMobile ? 14 : 16,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <Title level={isMobile ? 5 : 4} style={{ margin: 0, ...textSafeStyle(false) }}>
                Bonnes pratiques
              </Title>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, ...textSafeStyle(true) }}>
                Pour un suivi fiable pendant la tournée.
              </Text>
            </div>

            <div style={{ padding: isMobile ? 12 : 16 }}>
              <List
                dataSource={tips}
                renderItem={(t) => (
                  <List.Item style={{ paddingLeft: 0, paddingRight: 0, alignItems: 'flex-start' }}>
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
                      <Space align="start" size={12} style={{ width: '100%' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            display: 'grid',
                            placeItems: 'center',
                            background: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            flex: '0 0 auto',
                          }}
                        >
                          {t.icon}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <Text style={{ fontWeight: 900, display: 'block', ...textSafeStyle(false) }}>
                            {t.title}
                          </Text>
                          <Text type="secondary" style={{ display: 'block', ...textSafeStyle(true) }}>
                            {t.desc}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}