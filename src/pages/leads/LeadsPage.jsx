// src/pages/leads/LeadsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Grid,
  Input,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Form,
  Select,
  DatePicker,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  RiseOutlined,
  MailOutlined,
  PhoneOutlined,
  ApartmentOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Text, Title } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function unwrap(res) { return res?.data ?? res }

function leadName(l) {
  return l?.contact?.name || l?.renderSnapshot?.client?.name || l?.name || '—'
}
function leadCompany(l) {
  return l?.contact?.company || l?.renderSnapshot?.client?.company || ''
}
function leadEmail(l) {
  return l?.contact?.email || l?.email || ''
}
function leadPhone(l) {
  return l?.contact?.phone || l?.phone || ''
}
function leadAddress(l) {
  return l?.contact?.address || l?.address || ''
}

function statusPill(status) {
  const v = String(status || '').toUpperCase()
  const base = { borderRadius: 999, marginInlineEnd: 0 }
  if (v === 'NEW') return <Tag style={{ ...base, background: 'rgba(24,144,255,0.16)', borderColor: 'rgba(24,144,255,0.30)' }}>NEW</Tag>
  if (v === 'QUALIFIED') return <Tag style={{ ...base, background: 'rgba(82,196,26,0.18)', borderColor: 'rgba(82,196,26,0.30)' }}>QUALIFIED</Tag>
  if (v === 'WON') return <Tag style={{ ...base, background: 'rgba(82,196,26,0.22)', borderColor: 'rgba(82,196,26,0.34)' }}>WON</Tag>
  if (v === 'LOST') return <Tag style={{ ...base, background: 'rgba(245,34,45,0.16)', borderColor: 'rgba(245,34,45,0.28)' }}>LOST</Tag>
  if (v === 'CONTACTED') return <Tag style={{ ...base, background: 'rgba(250,84,28,0.16)', borderColor: 'rgba(250,84,28,0.30)' }}>CONTACTED</Tag>
  if (v === 'PROPOSAL') return <Tag style={{ ...base, background: 'rgba(114,46,209,0.16)', borderColor: 'rgba(114,46,209,0.30)' }}>PROPOSAL</Tag>
  return <Tag style={base}>{v || '—'}</Tag>
}

function toDayjsOrNull(d) {
  if (!d) return null
  const x = dayjs(d)
  return x.isValid() ? x : null
}

export default function LeadsPage() {
  const screens = useBreakpoint()
  const isMobile = !screens?.md

  const [msgApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // VIEW | CREATE | EDIT
  const [mode, setMode] = useState('VIEW')

  // Helpers anti chevauchement
  const shrink0 = { minWidth: 0 }
  const ellipsis1 = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }
  const wrapSafe = {
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  }

  const pageBg = {
    background:
      'radial-gradient(1100px 520px at 18% 0%, rgba(24,144,255,0.24), transparent 58%),' +
      'radial-gradient(1100px 520px at 88% 12%, rgba(82,196,26,0.20), transparent 58%),' +
      'radial-gradient(900px 520px at 55% 100%, rgba(250,84,28,0.18), transparent 62%)',
    borderRadius: 22,
    padding: isMobile ? 10 : 14,
    border: '1px solid rgba(255,255,255,0.06)',
  }

  const headerCardStyle = {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'linear-gradient(135deg, rgba(24,144,255,0.18), rgba(82,196,26,0.12) 55%, rgba(250,84,28,0.12))',
    boxShadow: '0 16px 50px rgba(0,0,0,0.18)',
  }

  function iconBadge(bg) {
    return {
      width: 42,
      height: 42,
      borderRadius: 14,
      display: 'grid',
      placeItems: 'center',
      background: bg,
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
      flex: '0 0 auto',
    }
  }

  const params = useMemo(() => {
    const out = { page, limit }
    const qq = safeStr(q)
    if (qq) out.q = qq
    const st = safeStr(status)
    if (st) out.status = st
    return out
  }, [q, status, page, limit])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.leads.list(params)
      const data = unwrap(res)
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      setItems(list)
      setTotal(safeNum(data?.total ?? list.length))
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur chargement prospects')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => { load() }, [load])

  function seedFormFromLead(lead) {
    const c = lead?.contact || {}
    form.setFieldsValue({
      status: safeStr(lead?.status) || 'NEW',
      source: safeStr(lead?.source) || 'manual',
      name: safeStr(c?.name),
      company: safeStr(c?.company),
      email: safeStr(c?.email),
      phone: safeStr(c?.phone),
      address: safeStr(c?.address),
      tags: Array.isArray(lead?.tags) ? lead.tags : [],
      notes: safeStr(lead?.notes),
      nextActionAt: toDayjsOrNull(lead?.nextActionAt),
    })
  }

  const openLead = useCallback(async (row) => {
    setDrawerOpen(true)
    setDrawerLoading(true)
    setSelected(null)
    setMode('VIEW')
    try {
      const res = row?._id ? await api.leads.get(row._id) : row
      const lead = unwrap(res) || row
      setSelected(lead)
      seedFormFromLead(lead)
    } catch {
      setSelected(row)
      seedFormFromLead(row)
    } finally {
      setDrawerLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = useCallback(async (row) => {
    setDrawerOpen(true)
    setDrawerLoading(true)
    setSelected(null)
    setMode('EDIT')
    try {
      const res = row?._id ? await api.leads.get(row._id) : row
      const lead = unwrap(res) || row
      setSelected(lead)
      seedFormFromLead(lead)
    } catch {
      setSelected(row)
      seedFormFromLead(row)
    } finally {
      setDrawerLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onCreate = useCallback(() => {
    setDrawerOpen(true)
    setDrawerLoading(false)
    setSelected({ __mode: 'CREATE' })
    setMode('CREATE')
    form.resetFields()
    form.setFieldsValue({
      status: 'NEW',
      source: 'manual',
      tags: [],
      notes: '',
      nextActionAt: null,
    })
  }, [form])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setSelected(null)
    setDrawerLoading(false)
    setSaving(false)
    setMode('VIEW')
    form.resetFields()
  }, [form])

  const removeLead = useCallback(async (id) => {
    try {
      await api.leads.remove(id)
      msgApi.success('Prospect supprimé')
      closeDrawer()
      if (items.length === 1 && page > 1) setPage(page - 1)
      else load()
    } catch (e) {
      msgApi.error(e?.response?.data?.error || e?.message || 'Suppression impossible')
    }
  }, [closeDrawer, items.length, load, msgApi, page])

  function buildPayloadFromForm(values) {
    return {
      source: safeStr(values?.source) || 'manual',
      status: safeStr(values?.status) || 'NEW',
      contact: {
        name: safeStr(values?.name) || undefined,
        company: safeStr(values?.company) || undefined,
        email: safeStr(values?.email) || undefined,
        phone: safeStr(values?.phone) || undefined,
        address: safeStr(values?.address) || undefined,
      },
      tags: Array.isArray(values?.tags) ? values.tags.map((t) => safeStr(t)).filter(Boolean) : [],
      notes: safeStr(values?.notes) || '',
      nextActionAt: values?.nextActionAt ? dayjs(values.nextActionAt).toDate() : undefined,
    }
  }

  const submitCreate = useCallback(async (values) => {
    try {
      setSaving(true)
      const payload = buildPayloadFromForm(values)

      if (!api?.leads?.create) {
        throw new Error("api.leads.create indisponible (branche l'endpoint create)")
      }

      await api.leads.create(payload)
      msgApi.success('Prospect créé')
      closeDrawer()
      setPage(1)
      load()
    } catch (e) {
      msgApi.error(e?.response?.data?.error || e?.message || 'Création impossible')
    } finally {
      setSaving(false)
    }
  }, [closeDrawer, load, msgApi])

  const submitEdit = useCallback(async (values) => {
    try {
      setSaving(true)
      const payload = buildPayloadFromForm(values)

      const id = selected?._id
      if (!id) throw new Error('Prospect invalide (id manquant)')

      if (!api?.leads?.update) {
        throw new Error("api.leads.update indisponible (branche l'endpoint update)")
      }

      await api.leads.update(id, payload)
      msgApi.success('Prospect mis à jour')
      // recharge détail + liste
      try {
        const res = await api.leads.get(id)
        const lead = unwrap(res)
        setSelected(lead)
        seedFormFromLead(lead)
      } catch {}
      setMode('VIEW')
      load()
    } catch (e) {
      msgApi.error(e?.response?.data?.error || e?.message || 'Mise à jour impossible')
    } finally {
      setSaving(false)
    }
  }, [load, msgApi, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------
  // Columns responsive
  // -------------------------
  const tableScrollX = { x: 'max-content' }

  const columnsMobile = [
    {
      title: 'Prospects',
      render: (_, r) => (
        <Space direction="vertical" size={2} style={{ ...shrink0, ...wrapSafe }}>
          <Text strong style={{ ...wrapSafe }}>{leadName(r)}</Text>
          <Text style={{ opacity: 0.75, ...wrapSafe }}>
            {leadCompany(r) ? `${leadCompany(r)} · ` : ''}{leadEmail(r) || '—'}
          </Text>
          <Space wrap size={6}>
            {statusPill(r?.status)}
            <Text style={{ opacity: 0.75 }}>
              {r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'}
            </Text>
          </Space>

          <Space wrap size={8} style={{ marginTop: 4 }}>
            <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); openLead(r) }}>
              Voir
            </Button>
            <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(r) }}>
              Modifier
            </Button>
            <Popconfirm
              title="Supprimer ce prospect ?"
              okText="Supprimer"
              cancelText="Annuler"
              onConfirm={(e) => { e?.stopPropagation?.(); removeLead(r._id) }}
            >
              <Button danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>
                Suppr.
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      ),
    },
  ]

  const columnsDesktop = [
    {
      title: 'Nom',
      render: (_, r) => (
        <div style={{ ...shrink0 }}>
          <Text strong style={{ display: 'block', ...ellipsis1 }}>{leadName(r)}</Text>
          <Text style={{ display: 'block', opacity: 0.75, ...ellipsis1 }}>{leadCompany(r) || ''}</Text>
        </div>
      ),
      ellipsis: true,
    },
    {
      title: 'Contact',
      render: (_, r) => (
        <div style={{ ...shrink0 }}>
          <Text style={{ display: 'block', ...ellipsis1 }}>{leadEmail(r) || '—'}</Text>
          <Text style={{ display: 'block', opacity: 0.75, ...ellipsis1 }}>{leadPhone(r) || ''}</Text>
        </div>
      ),
      ellipsis: true,
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      render: (v) => statusPill(v),
      width: 150,
    },
    {
      title: 'Créé',
      render: (_, r) => (r?.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD') : '—'),
      width: 130,
    },
    {
      title: '',
      width: 260,
      align: 'right',
      render: (_, r) => (
        <Space wrap size={8} style={{ justifyContent: 'flex-end' }}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openLead(r)}>
            Voir
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            Modifier
          </Button>
          <Popconfirm
            title="Supprimer ce prospect ?"
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={() => removeLead(r._id)}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Suppr.
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const drawerPlacement = isMobile ? 'bottom' : 'right'
  const drawerSizeProps = isMobile ? { height: '92vh' } : { width: 980 }

  const statusOptions = [
    { value: 'NEW', label: 'NEW' },
    { value: 'CONTACTED', label: 'CONTACTED' },
    { value: 'QUALIFIED', label: 'QUALIFIED' },
    { value: 'PROPOSAL', label: 'PROPOSAL' },
    { value: 'WON', label: 'WON' },
    { value: 'LOST', label: 'LOST' },
  ]

  return (
    <PageFrame title="Prospects" subtitle="Pipeline CRM: gestion des leads, contacts et conversions.">
      {contextHolder}

      <div style={pageBg}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          {error ? <Alert type="error" showIcon message={error} /> : null}

          {/* Header */}
          <Card bordered={false} style={headerCardStyle} styles={{ body: { padding: isMobile ? 12 : 14 } }}>
            <Row gutter={[12, 12]} align="middle" wrap>
              {/* LEFT */}
              <Col xs={24} md={16} style={{ ...shrink0 }}>
                <Space align="center" size={12} style={{ width: '100%', ...shrink0 }}>
                  <div style={iconBadge('linear-gradient(135deg, rgba(24,144,255,0.95), rgba(255,255,255,0.06))')}>
                    <TeamOutlined style={{ fontSize: 18 }} />
                  </div>

                  <div style={{ ...shrink0, overflow: 'hidden' }}>
                    <Title level={4} style={{ margin: 0, ...ellipsis1 }}>
                      Prospects
                    </Title>
                    <Text style={{ opacity: 0.75, display: 'block', ...ellipsis1 }}>
                      Recherche, liste, détail (drawer) — responsive mobile.
                    </Text>
                  </div>
                </Space>
              </Col>

              {/* RIGHT */}
              <Col xs={24} md={8} style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                <Space
                  size={8}
                  wrap
                  style={{
                    width: '100%',
                    justifyContent: isMobile ? 'flex-start' : 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  <Tag icon={<RiseOutlined />} style={{ borderRadius: 999, paddingInline: 10, paddingBlock: 4, marginInlineEnd: 0 }}>
                    {total} prospects
                  </Tag>

                  <Button icon={<ReloadOutlined />} onClick={load}>
                    Recharger
                  </Button>

                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onCreate}
                    style={isMobile ? { width: '100%' } : undefined}
                  >
                    Nouveau prospect
                  </Button>
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 10 }} wrap>
              <Col xs={24} lg={14}>
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1) }}
                  allowClear
                  placeholder="Rechercher: nom, société, email, téléphone…"
                />
              </Col>
              <Col xs={24} lg={10}>
                <Input
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                  allowClear
                  placeholder="Filtrer statut (ex: NEW, CONTACTED, QUALIFIED...)"
                />
              </Col>
            </Row>
          </Card>

          {/* Table */}
          <Card
            bordered={false}
            style={{
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
              boxShadow: '0 12px 38px rgba(0,0,0,0.16)',
            }}
            styles={{ body: { padding: isMobile ? 10 : 12 } }}
          >
            <Table
              loading={loading}
              size="small"
              rowKey={(r) => r._id}
              dataSource={items}
              locale={{ emptyText: <Empty description="Aucun prospect" /> }}
              onRow={(r) => ({
                onClick: () => openLead(r),
                style: { cursor: 'pointer' },
              })}
              columns={isMobile ? columnsMobile : columnsDesktop}
              scroll={tableScrollX}
              tableLayout="fixed"
              pagination={{
                current: page,
                pageSize: limit,
                total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                onChange: (p, ps) => {
                  setPage(p)
                  setLimit(ps)
                },
              }}
            />
          </Card>

          {/* Drawer */}
          <Drawer
            open={drawerOpen}
            onClose={closeDrawer}
            placement={drawerPlacement}
            {...drawerSizeProps}
            title={
              <Space wrap style={{ ...wrapSafe }}>
                <Text strong>
                  {mode === 'CREATE' ? 'Nouveau prospect' : mode === 'EDIT' ? 'Modifier prospect' : 'Détails prospect'}
                </Text>
                {mode !== 'CREATE' && selected?.status ? statusPill(selected.status) : null}
              </Space>
            }
            extra={
              mode === 'VIEW' && selected?._id ? (
                <Space>
                  <Button icon={<EditOutlined />} onClick={() => setMode('EDIT')}>
                    Modifier
                  </Button>
                  <Popconfirm
                    title="Supprimer ce prospect ?"
                    okText="Supprimer"
                    cancelText="Annuler"
                    onConfirm={() => removeLead(selected._id)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Supprimer
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null
            }
          >
            {drawerLoading ? <Text style={{ opacity: 0.75 }}>Chargement…</Text> : null}

            {!drawerLoading && mode !== 'CREATE' && !selected ? <Empty description="Aucun prospect sélectionné" /> : null}

            {!drawerLoading ? (
              <Form
                layout="vertical"
                form={form}
                onFinish={mode === 'CREATE' ? submitCreate : submitEdit}
                requiredMark={false}
                disabled={mode === 'VIEW'}
              >
                <Card size="small" style={{ borderRadius: 14 }}>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} md={12}>
                      <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
                        <Input placeholder="Nom du prospect" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item name="company" label="Société">
                        <Input placeholder="Entreprise (optionnel)" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item name="email" label="Email">
                        <Input placeholder="email@..." />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item name="phone" label="Téléphone">
                        <Input placeholder="+221 / +225 ..." />
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item name="address" label="Adresse">
                        <Input placeholder="Adresse (optionnel)" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item name="status" label="Statut" initialValue="NEW">
                        <Select options={statusOptions} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item name="nextActionAt" label="Prochaine action (date)">
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item name="tags" label="Tags">
                        <Select mode="tags" placeholder="Ex: hot, retail, urgent..." />
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={4} placeholder="Notes internes..." />
                      </Form.Item>
                    </Col>
                  </Row>

                  {mode === 'VIEW' && selected ? (
                    <div style={{ marginTop: 10 }}>
                      <Row gutter={[10, 10]}>
                        <Col xs={24} md={12}>
                          <Space align="center" style={{ ...wrapSafe }}>
                            <ApartmentOutlined />
                            <div style={{ ...wrapSafe }}>
                              <Text style={{ opacity: 0.75 }}>Société</Text>
                              <div><Text strong style={wrapSafe}>{leadCompany(selected) || '—'}</Text></div>
                            </div>
                          </Space>
                        </Col>
                        <Col xs={24} md={12}>
                          <Space align="center" style={{ ...wrapSafe }}>
                            <MailOutlined />
                            <div style={{ ...wrapSafe }}>
                              <Text style={{ opacity: 0.75 }}>Email</Text>
                              <div><Text strong style={wrapSafe}>{leadEmail(selected) || '—'}</Text></div>
                            </div>
                          </Space>
                        </Col>
                        <Col xs={24} md={12}>
                          <Space align="center" style={{ ...wrapSafe }}>
                            <PhoneOutlined />
                            <div style={{ ...wrapSafe }}>
                              <Text style={{ opacity: 0.75 }}>Téléphone</Text>
                              <div><Text strong style={wrapSafe}>{leadPhone(selected) || '—'}</Text></div>
                            </div>
                          </Space>
                        </Col>
                        <Col xs={24} md={12}>
                          <Space align="center" style={{ ...wrapSafe }}>
                            <RiseOutlined />
                            <div style={{ ...wrapSafe }}>
                              <Text style={{ opacity: 0.75 }}>Créé</Text>
                              <div>
                                <Text strong style={wrapSafe}>
                                  {selected?.createdAt ? dayjs(selected.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
                                </Text>
                              </div>
                            </div>
                          </Space>
                        </Col>
                      </Row>

                      <div style={{ marginTop: 10 }}>
                        <Text style={{ opacity: 0.75 }}>Adresse</Text>
                        <div><Text strong style={wrapSafe}>{leadAddress(selected) || '—'}</Text></div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <Text style={{ opacity: 0.75 }}>Statut</Text>
                        <div>{statusPill(selected?.status)}</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Actions */}
                  {mode === 'CREATE' ? (
                    <Space wrap style={{ justifyContent: 'flex-end', width: '100%', marginTop: 10 }}>
                      <Button icon={<CloseOutlined />} onClick={closeDrawer}>Annuler</Button>
                      <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                        Créer
                      </Button>
                    </Space>
                  ) : null}

                  {mode === 'EDIT' ? (
                    <Space wrap style={{ justifyContent: 'flex-end', width: '100%', marginTop: 10 }}>
                      <Button
                        icon={<CloseOutlined />}
                        onClick={() => {
                          // revert form to selected snapshot
                          if (selected) seedFormFromLead(selected)
                          setMode('VIEW')
                        }}
                      >
                        Annuler
                      </Button>
                      <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                        Enregistrer
                      </Button>
                    </Space>
                  ) : null}
                </Card>
              </Form>
            ) : null}
          </Drawer>
        </Space>
      </div>
    </PageFrame>
  )
}