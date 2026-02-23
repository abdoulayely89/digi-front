// src/pages/settings/TenantSettingsPage.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  Typography,
  Upload,
  Divider,
  Card,
  Row,
  Col,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import PageFrame from '../../ui/components/PageFrame'
import { AuthContext } from '../../context/AuthContext'
import { api } from '../../api/api'
import { http } from '../../api/http' // ✅ fallback direct call

const { Text } = Typography

function safeStr(v) { return String(v ?? '').trim() }
function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

function getApiBase() {
  // ✅ ton env: VITE_API_URL=http://localhost:8080/api
  const a = safeStr(import.meta?.env?.VITE_API_URL)
  const b = safeStr(import.meta?.env?.VITE_API_BASE_URL)
  return a || b || ''
}

function getApiOriginAndApiPrefix() {
  const apiBase = getApiBase()
  if (!apiBase) return { origin: '', apiPrefix: '' }

  try {
    const u = new URL(apiBase)
    const origin = u.origin
    const path = safeStr(u.pathname).replace(/\/+$/, '')
    const apiPrefix = path || '' // ex: "/api"
    return { origin, apiPrefix }
  } catch {
    const cleaned = apiBase.replace(/\/+$/, '')
    const m = cleaned.match(/^(https?:\/\/[^/]+)(\/.*)?$/)
    if (!m) return { origin: cleaned.replace(/\/api$/, ''), apiPrefix: '' }
    const origin = m[1]
    const path = safeStr(m[2] || '').replace(/\/+$/, '')
    const apiPrefix = path || ''
    return { origin, apiPrefix }
  }
}

/**
 * ✅ Styles UI (anti overflow/superposition, layout premium)
 * + ✅ empêche le Divider de couper "Identité" / "Adresse" en 2 lignes
 */
function UiEnhancers() {
  useEffect(() => {
    const id = 'tenant-settings-ui-enhancers'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      .tenant-settings-page :is(.ant-typography, .ant-btn, .ant-card, .ant-form, .ant-upload){
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
      }
      .tenant-settings-page :is(p, span, a, div, li, label, .ant-typography, .ant-card-head-title){
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      /* ✅ Ne pas couper le libellé des sections ("Identité", "Adresse", etc.) */
      .tenant-settings-page .ant-divider-inner-text{
        white-space: nowrap !important;
      }
      @media (max-width: 768px){
        .tenant-settings-page .ant-divider-inner-text{
          font-size: 12px !important;
        }
      }

      /* cards premium */
      .tenant-settings-page .ts-card{
        border-radius: 16px !important;
        border: 1px solid rgba(17,24,39,0.08) !important;
        box-shadow: 0 10px 26px rgba(17,24,39,0.06) !important;
        overflow: hidden;
      }
      .tenant-settings-page .ts-card .ant-card-head{
        border-bottom: 1px solid rgba(17,24,39,0.06) !important;
      }

      /* section spacing */
      .tenant-settings-page .ts-section{
        padding: 6px 0 2px 0;
      }

      /* ✅ rows/cols: éviter que les inputs “poussent” et chevauchent */
      .tenant-settings-page .ant-row{
        align-items: flex-start;
      }

      /* ✅ helpers: flex containers must allow shrink */
      .tenant-settings-page .ts-flex{
        min-width: 0;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .tenant-settings-page .ts-flex .ts-flex-text{
        min-width: 0;
        flex: 1 1 260px;
      }

      /* ✅ logo preview */
      .tenant-settings-page .ts-logo{
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        min-width: 0;
      }
      .tenant-settings-page .ts-logo img{
        max-width: 220px;
        height: 44px;
        width: auto;
        object-fit: contain;
        border-radius: 10px;
        border: 1px solid rgba(17,24,39,0.12);
        background: #fff;
      }

      /* ✅ upload/actions: boutons ne se superposent pas */
      .tenant-settings-page .ts-actions{
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        min-width: 0;
      }
      .tenant-settings-page .ts-actions .ant-btn{
        flex: 0 0 auto;
      }

      /* ✅ input file fallback: visuel propre */
      .tenant-settings-page .ts-file{
        width: 100%;
        max-width: 520px;
      }

      /* ✅ footer sticky save bar (évite overlap sur mobile) */
      .tenant-settings-page .ts-sticky{
        position: sticky;
        bottom: 0;
        background: #fff;
        padding: 12px 0;
        border-top: 1px solid rgba(17,24,39,0.08);
        z-index: 5;
      }

      @media (max-width: 768px){
        .tenant-settings-page .ts-actions .ant-btn{
          width: 100%;
        }
      }
    `
    document.head.appendChild(style)
  }, [])
  return null
}

export default function TenantSettingsPage() {
  const { message } = AntApp.useApp()
  const { tenant, setAuthSession, token, user } = useContext(AuthContext)
  const [loading, setLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [form] = Form.useForm()

  // ✅ IMPORTANT: on privilégie une URL logo STABLE (backend) plutôt qu'une signed URL
  const stableLogoUrl = useMemo(() => {
    const slug = safeStr(tenant?.slug)
    if (!slug) return ''
    const { origin, apiPrefix } = getApiOriginAndApiPrefix()
    if (!origin) return '' // VITE_API_URL pas chargé => pas de stable url
    const prefix = apiPrefix || '/api'
    return `${origin}${prefix}/public/t/${encodeURIComponent(slug)}/logo`
  }, [tenant?.slug])

  // fallback si jamais (dev), mais on évite car ça expire
  const logoUrl = useMemo(() => {
    return stableLogoUrl || safeStr(tenant?.logoUrl) || ''
  }, [stableLogoUrl, tenant?.logoUrl])

  useEffect(() => {
    if (!tenant) return

    form.setFieldsValue({
      // identité
      name: tenant.name,
      legalName: tenant.legalName,
      tradeName: tenant.tradeName,

      // adresse
      address: {
        street: tenant.address?.street,
        city: tenant.address?.city,
        country: tenant.address?.country,
        zip: tenant.address?.zip,
      },

      // ids
      ids: {
        rccm: tenant.ids?.rccm,
        ninea: tenant.ids?.ninea,
        vatNumber: tenant.ids?.vatNumber,
      },

      // contacts
      contacts: {
        email: tenant.contacts?.email,
        phone: tenant.contacts?.phone,
        website: tenant.contacts?.website,
      },

      // branding
      branding: {
        primaryColor: tenant.branding?.primaryColor,
        secondaryColor: tenant.branding?.secondaryColor,
        stampUrl: tenant.branding?.stampUrl,
      },

      // doc settings
      docSettings: {
        currency: tenant.docSettings?.currency,
        taxEnabled: !!tenant.docSettings?.taxEnabled,
        defaultTaxRate: tenant.docSettings?.defaultTaxRate,
        footerText: tenant.docSettings?.footerText,
        paymentTerms: tenant.docSettings?.paymentTerms,
        quoteValidityDays: tenant.docSettings?.quoteValidityDays,
        numbering: {
          quotePrefix: tenant.docSettings?.numbering?.quotePrefix,
          contractPrefix: tenant.docSettings?.numbering?.contractPrefix,
          invoicePrefix: tenant.docSettings?.numbering?.invoicePrefix,
        },
      },
    })
  }, [tenant, form])

  // ✅ upload logo: api.tenant.uploadLogo(File) sinon fallback http(FormData)
  async function uploadTenantLogo(file) {
    if (!file) throw new Error('Missing file')

    if (api?.tenant?.uploadLogo) {
      return await api.tenant.uploadLogo(file)
    }

    const fd = new FormData()
    fd.append('logo', file)

    const { data } = await http.post('/tenants/me/logo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  async function onSave(values) {
    try {
      setLoading(true)

      const payload = {
        name: safeStr(values?.name) || undefined,
        legalName: safeStr(values?.legalName) || undefined,
        tradeName: safeStr(values?.tradeName) || undefined,

        address: {
          street: safeStr(values?.address?.street) || undefined,
          city: safeStr(values?.address?.city) || undefined,
          country: safeStr(values?.address?.country) || undefined,
          zip: safeStr(values?.address?.zip) || undefined,
        },

        ids: {
          rccm: safeStr(values?.ids?.rccm) || undefined,
          ninea: safeStr(values?.ids?.ninea) || undefined,
          vatNumber: safeStr(values?.ids?.vatNumber) || undefined,
        },

        contacts: {
          email: safeStr(values?.contacts?.email) || undefined,
          phone: safeStr(values?.contacts?.phone) || undefined,
          website: safeStr(values?.contacts?.website) || undefined,
        },

        branding: {
          primaryColor: safeStr(values?.branding?.primaryColor) || undefined,
          secondaryColor: safeStr(values?.branding?.secondaryColor) || undefined,
          stampUrl: safeStr(values?.branding?.stampUrl) || undefined,
        },

        docSettings: {
          currency: safeStr(values?.docSettings?.currency) || undefined,
          taxEnabled: !!values?.docSettings?.taxEnabled,
          defaultTaxRate: n(values?.docSettings?.defaultTaxRate, 0),
          footerText: safeStr(values?.docSettings?.footerText) || '',
          paymentTerms: safeStr(values?.docSettings?.paymentTerms) || '',
          quoteValidityDays: n(values?.docSettings?.quoteValidityDays, 15),
          numbering: {
            quotePrefix: safeStr(values?.docSettings?.numbering?.quotePrefix) || undefined,
            contractPrefix: safeStr(values?.docSettings?.numbering?.contractPrefix) || undefined,
            invoicePrefix: safeStr(values?.docSettings?.numbering?.invoicePrefix) || undefined,
          },
        },
      }

      const updated = await api.tenant.update(payload)
      setAuthSession({ token, user, tenant: updated.tenant })
      message.success('Entreprise mise à jour')
    } catch (e) {
      message.error(e?.response?.data?.message || 'Erreur de mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tenant-settings-page">
      <UiEnhancers />

      <PageFrame title="Entreprise" subtitle="Branding + identité + documents (multi-tenant).">
        <Form layout="vertical" form={form} onFinish={onSave} requiredMark={false}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div className="ts-section">
              <Divider orientation="left">Identité</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="name" label="Nom (commercial)" rules={[{ required: true }]}>
                      <Input placeholder="Ex: PMA, CareLytics, ..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="tradeName" label="Trade name (optionnel)">
                      <Input placeholder="Nom de marque / enseigne" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="legalName" label="Raison sociale (legal name)">
                      <Input placeholder="Ex: PMA Hôpital Mère-Enfant ..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Adresse</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item name={['address', 'street']} label="Rue">
                      <Input placeholder="Ex: 09 rue ..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name={['address', 'city']} label="Ville">
                      <Input placeholder="Ex: Abidjan / Dakar" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name={['address', 'country']} label="Pays">
                      <Input placeholder="Ex: Côte d'Ivoire" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name={['address', 'zip']} label="Code postal">
                      <Input placeholder="Ex: 00000" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Identifiants</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item name={['ids', 'rccm']} label="RCCM">
                      <Input placeholder="RCCM..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['ids', 'ninea']} label="NINEA">
                      <Input placeholder="NINEA..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['ids', 'vatNumber']} label="N° TVA">
                      <Input placeholder="TVA..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Contacts</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item name={['contacts', 'email']} label="Email">
                      <Input placeholder="contact@..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['contacts', 'phone']} label="Téléphone">
                      <Input placeholder="+221..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['contacts', 'website']} label="Site web">
                      <Input placeholder="https://..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Logo</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {logoUrl ? (
                    <div className="ts-logo">
                      <img
                        src={logoUrl}
                        alt="logo"
                        onError={() => console.warn('[TenantSettings] logo preview error')}
                      />
                      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                        <Text type="secondary">
                          Logo actuel {stableLogoUrl ? '(URL stable backend)' : '(fallback)'}
                        </Text>
                        {stableLogoUrl ? (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              URL: <span style={{ opacity: 0.85 }}>{stableLogoUrl}</span>
                            </Text>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <Text type="secondary">
                      Aucun logo. {getApiBase() ? null : '⚠️ VITE_API_URL non chargé (relance Vite).'}
                    </Text>
                  )}

                  <div className="ts-actions">
                    <Upload
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      showUploadList={false}
                      disabled={logoUploading}
                      beforeUpload={() => false}
                      customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          setLogoUploading(true)
                          const f = file?.originFileObj || file
                          const updated = await uploadTenantLogo(f)

                          if (updated?.tenant) {
                            setAuthSession({ token, user, tenant: updated.tenant })
                          }

                          message.success('Logo mis à jour')
                          onSuccess?.(updated, f)
                        } catch (e) {
                          console.error('[TenantSettings] uploadLogo FAILED', e)
                          message.error(e?.response?.data?.message || 'Erreur upload logo')
                          onError?.(e)
                        } finally {
                          setLogoUploading(false)
                        }
                      }}
                    >
                      <Button icon={<UploadOutlined />} loading={logoUploading}>
                        {logoUrl ? 'Remplacer le logo' : 'Uploader un logo'}
                      </Button>
                    </Upload>

                    {logoUrl && isHttpUrl(logoUrl) ? (
                      <Button onClick={() => window.open(logoUrl, '_blank')}>
                        Voir
                      </Button>
                    ) : null}
                  </div>

                  {/* fallback natif */}
                  <input
                    className="ts-file"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        setLogoUploading(true)
                        const updated = await uploadTenantLogo(f)
                        if (updated?.tenant) setAuthSession({ token, user, tenant: updated.tenant })
                        message.success('Logo mis à jour (fallback)')
                      } catch (err) {
                        console.error('[TenantSettings] fallback upload FAILED', err)
                        message.error(err?.response?.data?.message || 'Erreur upload logo')
                      } finally {
                        setLogoUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </Space>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Branding</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item name={['branding', 'primaryColor']} label="Couleur primaire">
                      <Input placeholder="#1f6feb" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['branding', 'secondaryColor']} label="Couleur secondaire">
                      <Input placeholder="#111827" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['branding', 'stampUrl']} label="URL tampon (optionnel)">
                      <Input placeholder="https://..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Paramètres documents</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={6}>
                    <Form.Item name={['docSettings', 'currency']} label="Devise">
                      <Input placeholder="XOF" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name={['docSettings', 'taxEnabled']} label="TVA activée" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name={['docSettings', 'defaultTaxRate']} label="Taux TVA (%)">
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name={['docSettings', 'quoteValidityDays']} label="Validité devis (jours)">
                      <InputNumber min={1} max={365} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item name={['docSettings', 'paymentTerms']} label="Conditions de paiement">
                      <Input placeholder="Ex: Paiement à réception / 30 jours fin de mois..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name={['docSettings', 'footerText']} label="Pied de page (mentions légales)">
                      <Input placeholder="Mentions légales, loi applicable, juridiction..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            <div className="ts-section">
              <Divider orientation="left">Numérotation</Divider>

              <Card className="ts-card" bodyStyle={{ padding: 14 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item name={['docSettings', 'numbering', 'quotePrefix']} label="Préfixe Devis">
                      <Input placeholder="DV" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['docSettings', 'numbering', 'contractPrefix']} label="Préfixe Contrat">
                      <Input placeholder="CT" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name={['docSettings', 'numbering', 'invoicePrefix']} label="Préfixe Facture">
                      <Input placeholder="FA" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </div>

            {/* ✅ barre d’action stable, évite overlap sur mobile */}
            <div className="ts-sticky">
              <Space className="ts-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Enregistrer
                </Button>
              </Space>
            </div>
          </Space>
        </Form>
      </PageFrame>
    </div>
  )
}