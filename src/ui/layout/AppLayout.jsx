import React, { useContext, useMemo, useState, useEffect } from 'react'
import { Layout, Menu, Grid, Button, Space, Typography, Avatar, Dropdown } from 'antd'
import {
  AppstoreOutlined,
  TeamOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
  IdcardOutlined,
  UserOutlined,
  EnvironmentOutlined, // ✅ NEW: localisation
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid
const { Text } = Typography

function item(label, key, icon) {
  return { key, icon, label }
}

/**
 * ✅ Fix GLOBAL anti “texte vertical”
 */
function GlobalAntiVertical() {
  useEffect(() => {
    const id = 'global-anti-vertical-style'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      html, body {
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        unicode-bidi: plaintext !important;
      }

      :is(
        p, span, a, div, li, td, th, label,
        h1, h2, h3, h4, h5, h6,
        small, strong, em, code, pre,
        button, input, textarea, select,
        .ant-typography, .ant-tag, .ant-btn,
        .ant-card-head-title, .ant-card,
        .ant-menu, .ant-menu-title-content,
        .ant-list-item-meta-title, .ant-list-item-meta-description,
        .ant-dropdown, .ant-tooltip, .ant-popover,
        .ant-select-dropdown, .ant-picker-dropdown
      ) {
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        unicode-bidi: plaintext !important;
      }

      :is(
        p, span, a, div, li, td, th, label,
        h1, h2, h3, h4, h5, h6,
        small, strong, em, code, pre,
        .ant-typography, .ant-tag, .ant-btn,
        .ant-card-head-title,
        .ant-menu-title-content,
        .ant-list-item-meta-title, .ant-list-item-meta-description
      ) {
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        hyphens: auto;
      }
    `
    document.head.appendChild(style)
  }, [])
  return null
}

/**
 * ✅ Thème clair PREMIUM + suppression du bleu AntD
 */
function LightPremiumTheme() {
  useEffect(() => {
    const id = 'digisuite-light-premium'
    if (document.getElementById(id)) return

    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      :root{
        --bg: #f7f8fb;
        --panel: #ffffff;
        --panel-soft: #fcfcff;
        --text: #111827;
        --muted: #6b7280;
        --border: rgba(17,24,39,0.10);
        --border2: rgba(17,24,39,0.07);

        /* Accent pro (pas bleu foncé) */
        --primary: #16a34a;
        --primary-soft: rgba(22,163,74,0.14);
        --primary-soft2: rgba(22,163,74,0.10);

        --shadow: 0 10px 30px rgba(17,24,39,0.06);
      }

      body{
        background: var(--bg) !important;
        color: var(--text) !important;
      }

      /* ✅ Anti “bleu AntD” global (focus ring + primary) */
      .ant-btn:focus,
      .ant-btn:focus-visible,
      .ant-input:focus,
      .ant-input-focused,
      .ant-select-focused .ant-select-selector,
      .ant-picker-focused,
      .ant-dropdown-trigger:focus,
      .ant-dropdown-trigger:focus-visible{
        box-shadow: 0 0 0 3px var(--primary-soft) !important;
        border-color: rgba(22,163,74,0.55) !important;
        outline: none !important;
      }

      /* ✅ SIDER clair */
      .digisuite-sider{
        background: var(--panel) !important;
        border-right: 1px solid var(--border2) !important;
      }
      .digisuite-sider .ant-layout-sider-children{
        background: var(--panel) !important;
      }

      /* ✅ Trigger (la flèche) : enlever le bleu */
      .digisuite-sider .ant-layout-sider-trigger{
        background: var(--panel) !important;
        color: var(--muted) !important;
        border-top: 1px solid var(--border2) !important;
      }
      .digisuite-sider .ant-layout-sider-trigger:hover{
        color: var(--text) !important;
        background: rgba(17,24,39,0.03) !important;
      }
      .digisuite-sider .ant-layout-sider-trigger .anticon{
        color: inherit !important;
      }

      /* ✅ MENU : premium (pas de theme dark, pas de bleu) */
      .digisuite-sider .ant-menu{
        background: transparent !important;
        color: var(--text) !important;
        border-inline-end: none !important;
        padding: 6px 8px 10px 8px !important;
      }

      .digisuite-sider .ant-menu-item{
        border-radius: 14px !important;
        margin: 6px 8px !important;
        height: 46px !important;
        line-height: 46px !important;
      }

      .digisuite-sider .ant-menu-item:hover{
        background: rgba(17,24,39,0.04) !important;
      }

      .digisuite-sider .ant-menu-item-selected{
        background: linear-gradient(180deg, var(--primary-soft), var(--primary-soft2)) !important;
        color: var(--text) !important;
        font-weight: 800 !important;
      }

      /* barre bleue AntD -> accent vert */
      .digisuite-sider .ant-menu-item-selected::after{
        border-right: 3px solid var(--primary) !important;
      }

      /* icônes */
      .digisuite-sider .ant-menu-item .anticon{
        color: rgba(17,24,39,0.65) !important;
      }
      .digisuite-sider .ant-menu-item-selected .anticon{
        color: var(--primary) !important;
      }

      /* HEADER clair premium */
      .digisuite-header{
        background: var(--panel) !important;
        border-bottom: 1px solid var(--border2) !important;
        box-shadow: var(--shadow);
      }

      /* Buttons header */
      .digisuite-header .ant-btn{
        border-radius: 14px !important;
        border: 1px solid var(--border) !important;
        background: var(--panel) !important;
        color: var(--text) !important;
      }
      .digisuite-header .ant-btn:hover{
        border-color: rgba(22,163,74,0.35) !important;
        box-shadow: 0 0 0 3px var(--primary-soft) !important;
      }

      /* Dropdown menu style */
      .ant-dropdown .ant-dropdown-menu{
        border-radius: 14px !important;
        border: 1px solid var(--border2) !important;
        box-shadow: var(--shadow) !important;
      }

      /* Content background */
      .digisuite-content{
        background: var(--bg) !important;
      }
    `
    document.head.appendChild(style)
  }, [])

  return null
}

export default function AppLayout() {
  const { user, tenant, logout } = useContext(AuthContext)
  const screens = useBreakpoint()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    setCollapsed(!screens.lg)
  }, [screens.lg])

  const role = String(user?.role || 'sales').toLowerCase()

  const menuItems = useMemo(() => {
    // ✅ Base COMMUN sans Dashboard (car admin ne doit pas le voir)
    const base = [
      item('Prospects', '/leads', <TeamOutlined />),
      item('Devis', '/quotes', <FileTextOutlined />),
      item('Contrats', '/contracts', <SafetyCertificateOutlined />),
      item('Factures', '/invoices', <DollarOutlined />),
      item('Ma carte', '/profile', <IdcardOutlined />),
      item('Ma localisation', '/tracking/me', <EnvironmentOutlined />),
    ]

    // ✅ Dashboard seulement pour sales/manager (ou ce que tu veux)
    const dashboard = item('Dashboard', '/dashboard', <AppstoreOutlined />)

    // ✅ Items admin
    const admin = [
      item('Admin', '/admin', <AppstoreOutlined />),
      item('Utilisateurs', '/users', <UserOutlined />),
      item('Entreprise', '/settings/tenant', <SettingOutlined />),
      item('Templates', '/settings/templates', <FileTextOutlined />),
      item('Localisation équipe', '/tracking/team', <EnvironmentOutlined />),
    ]

    // ✅ tenant_admin: admin + base (SANS dashboard)
    if (role === 'tenant_admin') return [...admin, ...base]

    // ✅ manager: dashboard + base + options manager
    if (role === 'manager') {
      return [
        dashboard,
        ...base,
        item('Localisation équipe', '/tracking/team', <EnvironmentOutlined />),
        item('Utilisateurs', '/users', <UserOutlined />),
        item('Entreprise', '/settings/tenant', <SettingOutlined />),
      ]
    }

    // ✅ sales (default): dashboard + base
    return [dashboard, ...base]
  }, [role])

  const selected = useMemo(() => {
    const p = location.pathname
    const m = menuItems.find((i) => p === i.key || p.startsWith(i.key + '/'))
    // ✅ fallback: si admin, pas /dashboard
    if (m) return [m.key]
    return role === 'tenant_admin' ? ['/leads'] : ['/dashboard']
  }, [location.pathname, menuItems, role])

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Se déconnecter',
        onClick: () => {
          logout()
          navigate('/login')
        },
      },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <GlobalAntiVertical />
      <LightPremiumTheme />

      <Sider
        className="digisuite-sider"
        width={260}
        collapsedWidth={screens.xs ? 0 : 80}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
      >
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={logoError ? '/icons/icon-192.png' : '/brand/digisuite-logo.png'}
            alt="DigiSuite"
            onError={() => setLogoError(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              objectFit: 'contain',
              background: 'rgba(17,24,39,0.03)',
              border: '1px solid rgba(17,24,39,0.08)',
              padding: 5,
            }}
          />

          {!collapsed && (
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <Text style={{ color: 'var(--text)', fontWeight: 900, display: 'block' }} ellipsis>
                DigiSuite
              </Text>
              <Text style={{ color: 'var(--muted)', fontSize: 12, display: 'block' }} ellipsis>
                {tenant?.name ? `${tenant.name} • ` : ''}
                {role === 'tenant_admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Commercial'}
              </Text>
            </div>
          )}
        </div>

        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selected}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          className="digisuite-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <Space size={12}>
            {!screens.lg && (
              <Button onClick={() => setCollapsed((v) => !v)}>
                Menu
              </Button>
            )}
          </Space>

          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <Button>
              <Space size={10}>
                <Avatar
                  src={user?.profile?.avatarUrl}
                  style={{
                    background: 'rgba(17,24,39,0.04)',
                    border: '1px solid rgba(17,24,39,0.08)',
                  }}
                >
                  {(user?.name || 'U').slice(0, 1).toUpperCase()}
                </Avatar>
                <div style={{ textAlign: 'left', maxWidth: 260, minWidth: 0 }}>
                  <Text style={{ color: 'var(--text)', display: 'block', fontWeight: 800 }} ellipsis>
                    {user?.name || 'Utilisateur'}
                  </Text>
                  <Text style={{ color: 'var(--muted)', fontSize: 12, display: 'block' }} ellipsis>
                    {user?.email || ''}
                  </Text>
                </div>
              </Space>
            </Button>
          </Dropdown>
        </Header>

        <Content className="digisuite-content" style={{ padding: 16 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}