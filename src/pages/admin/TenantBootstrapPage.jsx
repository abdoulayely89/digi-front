import React, { useMemo, useState } from 'react'
import { App as AntApp, Button, Card, Col, Divider, Form, Input, Row, Select, Space, Typography } from 'antd'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Title, Text } = Typography

function safeStr(v) { return String(v ?? '').trim() }

export default function TenantBootstrapPage() {
  const { message } = AntApp.useApp()
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [loadingAdmin, setLoadingAdmin] = useState(false)
  const [tenant, setTenant] = useState(null)

  const initialTenant = useMemo(() => ({
    name: 'Mind-Ai',
    slug: 'demo',
    status: 'active',
    legalName: 'Mind-Ai SAS',
    tradeName: 'Mind-Ai',
    contacts: { email: 'contact@mindai.com', phone: '+221 77 911 04 04' },
    ids: { ninea: '011901594', rccm: 'SN.DKR.2025.B.4331' },
    docSettings: { currency: 'XOF', taxEnabled: false, defaultTaxRate: 20, quoteValidityDays: 7, numbering: { quotePrefix: 'DV', contractPrefix: 'CT', invoicePrefix: 'FA' } },
  }), [])

  async function onCreateTenant(values) {
    setLoadingTenant(true)
    try {
      const payload = {
        ...values,
        name: safeStr(values.name),
        slug: safeStr(values.slug),
        status: safeStr(values.status || 'active'),
      }
      const res = await api.admin.tenants.upsert(payload)
      setTenant(res?.tenant || null)
      message.success(res?.mode === 'created' ? 'Tenant créé ✅' : 'Tenant mis à jour ✅')
    } catch (e) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'Erreur création tenant')
    } finally {
      setLoadingTenant(false)
    }
  }

  async function onCreateAdmin(values) {
    if (!tenant?._id) {
      message.error('Crée d’abord le tenant.')
      return
    }
    setLoadingAdmin(true)
    try {
      const payload = {
        email: safeStr(values.email).toLowerCase(),
        name: safeStr(values.name),
        password: safeStr(values.password),
        role: safeStr(values.role || 'tenant_admin'),
        status: safeStr(values.status || 'active'),
      }
      const res = await api.admin.tenants.upsertAdmin(tenant._id, payload)
      message.success(res?.mode === 'created' ? 'Admin créé ✅' : 'Admin mis à jour ✅')
    } catch (e) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'Erreur création admin')
    } finally {
      setLoadingAdmin(false)
    }
  }

  return (
    <PageFrame>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card>
            <Title level={4} style={{ marginTop: 0 }}>Créer / Mettre à jour un Tenant</Title>
            <Text type="secondary">Upsert par slug (comme ton script).</Text>
            <Divider />
            <Form layout="vertical" initialValues={initialTenant} onFinish={onCreateTenant}>
              <Form.Item label="Nom" name="name" rules={[{ required: true, message: 'Nom requis' }]}>
                <Input placeholder="ex: Mind-Ai" />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true, message: 'Slug requis' }]}>
                <Input placeholder="ex: demo" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Statut" name="status">
                    <Select options={[
                      { value: 'active', label: 'active' },
                      { value: 'inactive', label: 'inactive' },
                      { value: 'archived', label: 'archived' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Devise" name={['docSettings', 'currency']}>
                    <Select options={[{ value: 'XOF', label: 'XOF' }, { value: 'EUR', label: 'EUR' }]} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Contacts</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Email" name={['contacts', 'email']}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Téléphone" name={['contacts', 'phone']}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">Identifiants</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="NINEA" name={['ids', 'ninea']}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="RCCM" name={['ids', 'rccm']}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Space>
                <Button type="primary" htmlType="submit" loading={loadingTenant}>Enregistrer</Button>
                {tenant?._id ? <Text type="secondary">tenantId: {tenant._id}</Text> : null}
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card>
            <Title level={4} style={{ marginTop: 0 }}>Créer / Mettre à jour l’Admin du Tenant</Title>
            <Text type="secondary">Nécessite un tenantId (créé à gauche).</Text>
            <Divider />
            <Form layout="vertical" onFinish={onCreateAdmin} initialValues={{ role: 'tenant_admin', status: 'active' }}>
              <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Email requis' }]}>
                <Input placeholder="admin@demo.com" />
              </Form.Item>
              <Form.Item label="Nom" name="name" rules={[{ required: true, message: 'Nom requis' }]}>
                <Input placeholder="Admin" />
              </Form.Item>
              <Form.Item label="Mot de passe" name="password" rules={[{ required: true, message: 'Mot de passe requis' }]}>
                <Input.Password />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Role" name="role">
                    <Select options={[
                      { value: 'tenant_admin', label: 'tenant_admin' },
                      { value: 'admin', label: 'admin' },
                      { value: 'agent', label: 'agent' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Status" name="status">
                    <Select options={[
                      { value: 'active', label: 'active' },
                      { value: 'inactive', label: 'inactive' },
                    ]} />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={loadingAdmin} disabled={!tenant?._id}>
                Créer / Mettre à jour Admin
              </Button>

              {!tenant?._id ? (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">Crée d’abord le tenant (colonne gauche).</Text>
                </div>
              ) : null}
            </Form>
          </Card>
        </Col>
      </Row>
    </PageFrame>
  )
}