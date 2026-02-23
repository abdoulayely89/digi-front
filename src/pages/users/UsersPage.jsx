// src/pages/users/UsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Grid,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Empty,
  Divider,
  Upload,
  Avatar,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
  CopyOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function upper(v) { return safeStr(v).toUpperCase() }
function isHttpUrl(u) {
  const s = safeStr(u)
  return s.startsWith('http://') || s.startsWith('https://')
}

function softTag(label, bg, fg, border) {
  return (
    <Tag
      style={{
        borderRadius: 999,
        padding: '2px 10px',
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        fontWeight: 800,
        letterSpacing: 0.2,
        marginInlineEnd: 0,
      }}
    >
      {label}
    </Tag>
  )
}

function roleTag(role) {
  const r = upper(role || 'sales')
  if (r === 'TENANT_ADMIN') return softTag('ADMIN', 'rgba(2,132,199,0.10)', '#075985', 'rgba(2,132,199,0.22)')
  if (r === 'MANAGER') return softTag('MANAGER', 'rgba(139,92,246,0.10)', '#5b21b6', 'rgba(139,92,246,0.22)')
  return softTag('SALES', 'rgba(17,24,39,0.06)', '#111827', 'rgba(17,24,39,0.12)')
}

function statusTag(status) {
  const s = upper(status || 'active')
  if (s === 'DISABLED') return softTag('DÉSACTIVÉ', 'rgba(239,68,68,0.10)', '#991b1b', 'rgba(239,68,68,0.22)')
  return softTag('ACTIF', 'rgba(22,163,74,0.12)', '#166534', 'rgba(22,163,74,0.25)')
}

async function copyText(messageApi, text) {
  const t = safeStr(text)
  if (!t) return messageApi.warning('Rien à copier')
  try {
    await navigator.clipboard.writeText(t)
    messageApi.success('Copié')
  } catch {
    messageApi.warning('Copie impossible — copie manuelle : ' + t)
  }
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('fr-FR')
  } catch {
    return '—'
  }
}

export default function UsersPage() {
  const { message } = AntApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !!screens.xs

  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarBust, setAvatarBust] = useState(Date.now())
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null)

  const [tempPassword, setTempPassword] = useState('')
  const [form] = Form.useForm()

  // fallback (peu recommandé si endpoint protégé),
  // mais on le garde en dernier recours
  function stableAvatarEndpoint(id) {
    if (!id) return ''
    if (api?.users?.avatarUrl) return api.users.avatarUrl(id)
    return `/users/${encodeURIComponent(id)}/avatar`
  }

  // ✅ IMPORTANT: on privilégie la signed URL renvoyée par le backend
  function resolveAvatarUrl(user) {
    if (!user) return ''

    const signed = safeStr(user?.profile?.avatarSignedUrl)
    if (signed) return signed

    // si un jour avatarUrl devient un vrai http(s)
    const direct = safeStr(user?.profile?.avatarUrl)
    if (direct && isHttpUrl(direct)) return direct

    // fallback
    const url = stableAvatarEndpoint(user?._id)
    return url ? `${url}${url.includes('?') ? '&' : '?'}v=${avatarBust}` : ''
  }

  async function load() {
    try {
      setLoading(true)
      const data = await api.users.list({ q: q || undefined })
      const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])
      setRows(list)
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible de charger les utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onCreate() {
    setEditing(null)
    setPendingAvatarFile(null)
    setTempPassword('')
    form.resetFields()
    form.setFieldsValue({ role: 'sales', status: 'active' })
    setOpen(true)
  }

  function onEdit(row) {
    setEditing(row)
    setPendingAvatarFile(null)
    setTempPassword('')
    form.setFieldsValue({
      name: safeStr(row?.name),
      email: safeStr(row?.email),
      role: safeStr(row?.role) || 'sales',
      status: safeStr(row?.status) || 'active',
      publicSlug: safeStr(row?.publicSlug),
      title: safeStr(row?.profile?.title),
      phone: safeStr(row?.profile?.phone),
      whatsapp: safeStr(row?.profile?.socials?.whatsapp),
      linkedin: safeStr(row?.profile?.socials?.linkedin),
      instagram: safeStr(row?.profile?.socials?.instagram),
      facebook: safeStr(row?.profile?.socials?.facebook),
      bio: safeStr(row?.profile?.bio),
      password: '',
    })
    setOpen(true)
  }

  async function onRemove(row) {
    if (!row?._id) return
    try {
      setRemovingId(row._id)
      await api.users.remove(row._id)
      message.success('Utilisateur supprimé')
      setOpen(false)
      setEditing(null)
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Suppression impossible')
    } finally {
      setRemovingId(null)
    }
  }

  async function onToggleStatus(row) {
    if (!row?._id) return
    try {
      setTogglingId(row._id)
      const next = upper(row?.status || 'active') === 'DISABLED' ? 'active' : 'disabled'
      await api.users.update(row._id, { status: next })
      message.success(next === 'active' ? 'Utilisateur activé' : 'Utilisateur désactivé')
      await load()
      if (editing?._id === row._id) {
        setEditing((prev) => ({ ...(prev || {}), status: next }))
        form.setFieldsValue({ status: next })
      }
    } catch (e) {
      message.error(e?.response?.data?.message || 'Action impossible')
    } finally {
      setTogglingId(null)
    }
  }

  async function uploadAvatarById(userId, file) {
    if (!userId) throw new Error('Missing userId for avatar upload')
    if (!api?.users?.uploadAvatar) throw new Error('api.users.uploadAvatar manquant')
    const res = await api.users.uploadAvatar(userId, file)
    return res?.user || res
  }

  async function uploadAvatarForEditing(file) {
    if (!editing?._id) throw new Error("Crée d'abord l'utilisateur, ensuite upload la photo.")
    const updated = await uploadAvatarById(editing._id, file)
    setEditing(updated)
    setAvatarBust(Date.now())
    await load()
    return updated
  }

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      email: values.email,
      role: values.role,
      status: values.status,
      publicSlug: values.publicSlug,
      profile: {
        title: values.title,
        phone: values.phone,
        socials: {
          whatsapp: values.whatsapp,
          linkedin: values.linkedin,
          instagram: values.instagram,
          facebook: values.facebook,
        },
        bio: values.bio,
      },
    }

    if (safeStr(values.password)) payload.password = values.password

    try {
      setSaving(true)

      if (editing?._id) {
        const updated = await api.users.update(editing._id, payload)
        setEditing(updated)
        message.success('Utilisateur mis à jour')

        // si fichier choisi pendant édition -> upload après save (optionnel)
        if (pendingAvatarFile) {
          setAvatarUploading(true)
          try {
            await uploadAvatarForEditing(pendingAvatarFile)
            message.success('Photo uploadée')
            setPendingAvatarFile(null)
          } finally {
            setAvatarUploading(false)
          }
        }

        setOpen(false)
      } else {
        const created = await api.users.create(payload)
        message.success('Utilisateur créé')
        setTempPassword(safeStr(created?.tempPassword))

        if (pendingAvatarFile && created?._id) {
          setAvatarUploading(true)
          try {
            const updated = await uploadAvatarById(created._id, pendingAvatarFile)
            setAvatarBust(Date.now())
            message.success('Photo uploadée')
            setPendingAvatarFile(null)

            // ✅ on garde un editing cohérent si tu veux rester dans le drawer (ici on ferme, mais utile)
            setEditing(updated)
          } catch (e) {
            message.error(e?.response?.data?.message || e?.message || "Utilisateur créé, mais upload photo échoué")
          } finally {
            setAvatarUploading(false)
          }
        }

        setOpen(false)
      }

      form.resetFields()
      await load()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo(() => [
    {
      title: 'Utilisateur',
      key: 'user',
      ellipsis: true,
      render: (_, row) => {
        const avatar = resolveAvatarUrl(row)
        return (
          <Space size={10} style={{ minWidth: 0 }}>
            <Avatar
              size={34}
              src={avatar || undefined}
              style={{
                background: 'rgba(17,24,39,0.06)',
                border: '1px solid rgba(17,24,39,0.08)',
                flex: '0 0 auto',
              }}
            >
              {safeStr(row?.name || '?').slice(0, 1).toUpperCase()}
            </Avatar>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>
                {safeStr(row?.name) || '—'}
              </div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
                {safeStr(row?.email) || '—'}
              </div>
            </div>
          </Space>
        )
      },
    },
    { title: 'Rôle', dataIndex: 'role', key: 'role', width: 140, render: roleTag },
    { title: 'Statut', dataIndex: 'status', key: 'status', width: 140, render: statusTag },
    {
      title: 'Public slug',
      dataIndex: 'publicSlug',
      key: 'publicSlug',
      width: isMobile ? 160 : 200,
      ellipsis: true,
      render: (v) => <Text style={{ fontSize: 12 }}>{safeStr(v) || '—'}</Text>,
    },
    {
      title: 'Créé le',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 200 : 260,
      fixed: 'right',
      render: (_, row) => {
        const st = upper(row?.status || 'active')
        const isToggling = togglingId === row._id
        const isRemoving = removingId === row._id
        return (
          <Space wrap size={8}>
            <Tooltip title="Modifier">
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)} />
            </Tooltip>
            <Tooltip title={st === 'DISABLED' ? 'Activer' : 'Désactiver'}>
              <Button icon={<UserSwitchOutlined />} onClick={() => onToggleStatus(row)} loading={isToggling} />
            </Tooltip>
            <Popconfirm
              title="Supprimer cet utilisateur ?"
              okText="Supprimer"
              cancelText="Annuler"
              onConfirm={() => onRemove(row)}
            >
              <Button danger icon={<DeleteOutlined />} loading={isRemoving} />
            </Popconfirm>
          </Space>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isMobile, removingId, togglingId, editing, avatarBust])

  const softCard = {
    borderRadius: 18,
    border: '1px solid rgba(17,24,39,0.08)',
    boxShadow: '0 10px 30px rgba(17,24,39,0.05)',
  }
  const softPanel = {
    borderRadius: 16,
    border: '1px solid rgba(17,24,39,0.08)',
    background: 'rgba(255,255,255,0.92)',
  }
  const softBox = {
    borderRadius: 14,
    border: '1px solid rgba(17,24,39,0.08)',
    background: 'rgba(17,24,39,0.02)',
    padding: 12,
  }

  const emptyNode = (
    <div style={{ padding: 24 }}>
      <Empty
        description={
          <div style={{ color: 'var(--muted)' }}>
            Aucun utilisateur pour le moment.<br />
            <span style={{ fontSize: 12 }}>Ajoute des managers/sales et gère leur accès.</span>
          </div>
        }
      >
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate} style={{ borderRadius: 14 }}>
            Nouvel utilisateur
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 14 }}>
            Rafraîchir
          </Button>
        </Space>
      </Empty>
    </div>
  )

  const pageExtra = (
    <Row gutter={[12, 12]} align="middle" style={{ width: '100%' }}>
      <Col xs={24} md="auto">
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate} style={{ borderRadius: 14 }}>
            Nouvel utilisateur
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} style={{ borderRadius: 14 }}>
            Rafraîchir
          </Button>
        </Space>
      </Col>

      <Col xs={24} md="auto" style={{ flex: 1 }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (nom, email, slug, rôle...)"
          allowClear
          onPressEnter={load}
          prefix={<SearchOutlined style={{ opacity: 0.55 }} />}
          style={{ width: '100%', maxWidth: 520, borderRadius: 14 }}
        />
      </Col>
    </Row>
  )

  const currentAvatar = editing ? resolveAvatarUrl(editing) : ''

  return (
    <PageFrame title="Utilisateurs" subtitle="Gestion des comptes (rôles, statut, profils publics)." extra={pageExtra}>
      {tempPassword ? (
        <Alert
          type="success"
          showIcon
          message="Mot de passe temporaire généré"
          description={
            <Space wrap>
              <Text strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                {tempPassword}
              </Text>
              <Button icon={<CopyOutlined />} onClick={() => copyText(message, tempPassword)}>
                Copier
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Communique-le à l’utilisateur et demande-lui de le changer.
              </Text>
            </Space>
          }
          style={{ marginBottom: 12, borderRadius: 14 }}
        />
      ) : null}

      <Card style={softCard} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey={(r) => r._id}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: isMobile ? 1100 : 1200 }}
          locale={{ emptyText: emptyNode }}
        />
      </Card>

      <Drawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); setPendingAvatarFile(null); form.resetFields() }}
        width={isMobile ? '100%' : 740}
        closable={false}
        destroyOnClose
        styles={{
          header: { display: 'none' },
          body: { background: 'var(--bg)', padding: isMobile ? 12 : 16, paddingBottom: 96 },
        }}
      >
        <div style={softPanel}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(17,24,39,0.08)' }}>
            <Row gutter={[12, 12]} align="middle">
              <Col flex="auto" style={{ minWidth: 0 }}>
                <Space size={12} align="center">
                  <Avatar
                    size={40}
                    src={editing?._id ? (currentAvatar || undefined) : undefined}
                    style={{
                      background: 'rgba(17,24,39,0.06)',
                      border: '1px solid rgba(17,24,39,0.08)',
                    }}
                  >
                    {safeStr(form.getFieldValue('name') || editing?.name || '?').slice(0, 1).toUpperCase()}
                  </Avatar>

                  <div style={{ minWidth: 0 }}>
                    <Text style={{ fontWeight: 900, fontSize: 16 }}>
                      {editing ? 'Modifier un utilisateur' : 'Créer un utilisateur'}
                    </Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {editing ? 'Mets à jour son profil, rôle, statut et photo.' : 'Crée un compte par tenant.'}
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col flex="none">
                <Space>
                  <Button
                    onClick={() => { setOpen(false); setEditing(null); setPendingAvatarFile(null) }}
                    style={{ borderRadius: 14 }}
                  >
                    Fermer
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>

          <div style={{ padding: 14 }}>
            {/* ✅ Upload visible en création ET en édition */}
            <Card style={softBox} bodyStyle={{ padding: 12, background: 'transparent', border: 'none' }}>
              <Row gutter={[12, 12]} align="middle" justify="space-between">
                <Col flex="auto">
                  <Text style={{ fontWeight: 900, fontSize: 13 }}>Photo de profil</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      JPG/PNG/WebP conseillé, carré, &lt; 2MB.
                    </Text>
                  </div>

                  {pendingAvatarFile ? (
                    <div style={{ marginTop: 6 }}>
                      <Text style={{ fontSize: 12 }}>
                        Fichier sélectionné : <Text strong>{safeStr(pendingAvatarFile?.name)}</Text>
                      </Text>
                      {!editing?._id ? (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Il sera uploadé automatiquement après “Enregistrer”.
                          </Text>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Col>

                <Col flex="none">
                  <Upload
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    showUploadList={false}
                    beforeUpload={() => false}
                    disabled={avatarUploading}
                    component="div"
                    onChange={(info) => {
                      const f = info?.file?.originFileObj || info?.file
                      if (f) setPendingAvatarFile(f)
                    }}
                    customRequest={async ({ file, onSuccess, onError }) => {
                      // création : on met en file d’attente
                      if (!editing?._id) {
                        const f = file?.originFileObj || file
                        setPendingAvatarFile(f || null)
                        message.info('Photo sélectionnée — elle sera uploadée après “Enregistrer”')
                        onSuccess?.({ queued: true }, f)
                        return
                      }

                      // édition : upload immédiat
                      try {
                        setAvatarUploading(true)
                        const f = file?.originFileObj || file
                        await uploadAvatarForEditing(f)
                        message.success('Photo mise à jour')
                        onSuccess?.({ ok: true }, f)
                      } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('[UsersPage] uploadAvatar FAILED', e)
                        message.error(e?.response?.data?.message || e?.message || 'Erreur upload photo')
                        onError?.(e)
                      } finally {
                        setAvatarUploading(false)
                      }
                    }}
                  >
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      loading={avatarUploading}
                      style={{ borderRadius: 14 }}
                    >
                      {editing?._id ? 'Uploader photo' : 'Choisir une photo'}
                    </Button>
                  </Upload>
                </Col>
              </Row>
            </Card>

            <div style={{ height: 12 }} />

            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
              requiredMark={false}
              initialValues={{ role: 'sales', status: 'active' }}
            >
              <Card style={softBox} bodyStyle={{ padding: 12, background: 'transparent', border: 'none' }}>
                <Text style={{ fontWeight: 900, fontSize: 13 }}>Compte</Text>
                <Divider style={{ margin: '10px 0' }} />

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Nom" name="name" rules={[{ required: true, message: 'Nom requis' }]}>
                      <Input placeholder="Ex: Awa Diop" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Email requis' },
                        { type: 'email', message: 'Email invalide' },
                      ]}
                    >
                      <Input placeholder="awa@exemple.com" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item label="Rôle" name="role">
                      <Select
                        options={[
                          { value: 'tenant_admin', label: 'Admin' },
                          { value: 'manager', label: 'Manager' },
                          { value: 'sales', label: 'Sales' },
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item label="Statut" name="status">
                      <Select
                        options={[
                          { value: 'active', label: 'Actif' },
                          { value: 'disabled', label: 'Désactivé' },
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Public slug"
                      name="publicSlug"
                      rules={[{ required: true, message: 'Slug requis' }]}
                      extra={<Text type="secondary" style={{ fontSize: 12 }}>Ex: “awa-diop”. Unique par tenant.</Text>}
                    >
                      <Input placeholder="awa-diop" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label={editing ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe (optionnel)'}
                  name="password"
                  extra={<Text type="secondary" style={{ fontSize: 12 }}>
                    Si vide : le backend génère un mot de passe par défaut (tempPassword).
                  </Text>}
                >
                  <Input.Password placeholder={editing ? 'Laisser vide pour ne pas changer' : 'Laisser vide pour auto'} />
                </Form.Item>
              </Card>

              <div style={{ height: 12 }} />

              <Card style={softBox} bodyStyle={{ padding: 12, background: 'transparent', border: 'none' }}>
                <Text style={{ fontWeight: 900, fontSize: 13 }}>Profil</Text>
                <Divider style={{ margin: '10px 0' }} />

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Titre" name="title">
                      <Input placeholder="Ex: Business Developer" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Téléphone" name="phone">
                      <Input placeholder="Ex: +221 77 000 00 00" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Form.Item label="WhatsApp" name="whatsapp">
                      <Input placeholder="+221..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="LinkedIn" name="linkedin">
                      <Input placeholder="https://linkedin.com/in/..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Instagram" name="instagram">
                      <Input placeholder="https://instagram.com/..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Facebook" name="facebook">
                      <Input placeholder="https://facebook.com/..." />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Bio" name="bio">
                  <Input.TextArea rows={4} placeholder="Courte bio..." />
                </Form.Item>
              </Card>

              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  marginTop: 14,
                  paddingTop: 12,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 24%)',
                }}
              >
                <Card style={softPanel} bodyStyle={{ padding: 12 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      {editing?._id ? (
                        <Popconfirm
                          title="Supprimer cet utilisateur ?"
                          okText="Supprimer"
                          cancelText="Annuler"
                          onConfirm={() => onRemove(editing)}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={removingId === editing?._id}
                            style={{ borderRadius: 14 }}
                          >
                            Supprimer
                          </Button>
                        </Popconfirm>
                      ) : null}
                    </Space>

                    <Space>
                      <Button
                        onClick={() => { setOpen(false); setEditing(null); setPendingAvatarFile(null) }}
                        style={{ borderRadius: 14 }}
                      >
                        Annuler
                      </Button>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={saving || avatarUploading}
                        style={{ borderRadius: 14 }}
                      >
                        Enregistrer
                      </Button>
                    </Space>
                  </Space>
                </Card>
              </div>
            </Form>
          </div>
        </div>

        <style>{`
          .ant-table-thead > tr > th { background: rgba(17,24,39,0.02) !important; }
          .ant-descriptions-item-content, .ant-descriptions-item-label { word-break: break-word; overflow-wrap: anywhere; }

          /* ✅ évite un Upload “invisible” dans certains layouts flex */
          .ant-upload, .ant-upload-wrapper { display: inline-block !important; }
        `}</style>
      </Drawer>
    </PageFrame>
  )
}