// src/pages/settings/TemplatesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Divider,
  Empty,
  Tooltip,
  Segmented,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  EyeOutlined,
  CodeOutlined,
  FontSizeOutlined,
  UnorderedListOutlined,
  TableOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import PageFrame from '../../ui/components/PageFrame'
import { api } from '../../api/api'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

function safeStr(v) { return String(v ?? '').trim() }
function safeUpper(v) { return safeStr(v).toUpperCase() }
function isActive(status) { return String(status || '').toUpperCase() === 'ACTIVE' }

function typeLabel(t) {
  const v = String(t || '').toUpperCase()
  if (v === 'QUOTE') return 'Devis'
  if (v === 'CONTRACT') return 'Contrat'
  if (v === 'INVOICE') return 'Facture'
  return v || '—'
}

function typeColor(t) {
  const v = String(t || '').toUpperCase()
  if (v === 'QUOTE') return 'blue'
  if (v === 'CONTRACT') return 'purple'
  if (v === 'INVOICE') return 'gold'
  return 'default'
}

function statusColor(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'ACTIVE') return 'green'
  if (v === 'ARCHIVED') return 'default'
  return 'default' // DRAFT
}

// ----------------------------
// Blocks helpers (MODEL-COMPAT)
// block = { id, type, data }
// ----------------------------
function uid(prefix = 'blk') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function mkTitle(text, level = 1, align = 'left') {
  return { id: uid('title'), type: 'TITLE', data: { text, level, align } }
}
function mkHeading(text, level = 2, align = 'left') {
  return { id: uid('heading'), type: 'HEADING', data: { text, level, align } }
}
function mkParagraph(text, align = 'left') {
  return { id: uid('p'), type: 'PARAGRAPH', data: { text, align } }
}
function mkBullets(items = []) {
  return { id: uid('list'), type: 'BULLETS', data: { items } }
}
function mkDivider() {
  return { id: uid('div'), type: 'DIVIDER', data: {} }
}

function defaultBlocks(type) {
  const t = String(type || '').toUpperCase()

  if (t === 'INVOICE') {
    return [
      mkTitle('FACTURE', 1, 'left'),
      mkParagraph(
        'Bonjour {{clientName}},\n\nVoici la facture n° {{invoiceNumber}} du {{invoiceDate}} relative au contrat {{contractNumber}}.',
        'left'
      ),
      mkBullets([
        'Référence : {{invoiceNumber}}',
        'Contrat : {{contractNumber}} — {{contractTitle}}',
        'Montant total : {{amountFormatted}}',
        'Devise : {{currency}}',
      ]),
      mkParagraph('Merci pour votre confiance.\n\nCordialement,\n{{tenantName}}', 'left'),
    ]
  }

  if (t === 'CONTRACT') {
    return [
      mkTitle('CONTRAT DE PRESTATION', 1, 'left'),
      mkParagraph("Objet : décrire clairement la prestation.", 'left'),
      mkHeading('Périmètre & livrables', 2, 'left'),
      mkBullets(['Livrable 1', 'Livrable 2']),
      mkHeading('Modalités', 2, 'left'),
      mkBullets(['Délais', 'Paiement', 'Confidentialité']),
      mkDivider(),
      mkParagraph('Signature électronique (preuve + horodatage).', 'left'),
    ]
  }

  // QUOTE
  return [
    mkTitle('DEVIS', 1, 'left'),
    mkParagraph('Bonjour {{clientName}},\n\nVeuillez trouver ci-dessous notre proposition.', 'left'),
    mkBullets(['Validité : XX jours', 'Paiement : à réception / 30 jours', 'Contact : {{tenantEmail}}']),
  ]
}

// ✅ Convertit une entrée API vers Form (déjà block-format)
function normalizeTemplateFromApi(row) {
  const legal = row?.legal || {}
  const blocks = Array.isArray(row?.contentBlocks) ? row.contentBlocks : []
  return {
    type: row?.type,
    name: row?.name,
    status: row?.status,
    version: Number(row?.version || 1),
    contentBlocks: blocks,
    legal: {
      governingLaws: Array.isArray(legal?.governingLaws) ? legal.governingLaws : [],
      jurisdictions: Array.isArray(legal?.jurisdictions) ? legal.jurisdictions : [],
      legalMentions: legal?.legalMentions || '',
    },
  }
}

// ✅ Nettoie / normalise vers payload API (block-format)
function normalizePayloadToApi(values) {
  const gl = Array.isArray(values?.legal?.governingLaws) ? values.legal.governingLaws : []
  const js = Array.isArray(values?.legal?.jurisdictions) ? values.legal.jurisdictions : []
  const blocks = Array.isArray(values?.contentBlocks) ? values.contentBlocks : []

  const cleaned = blocks
    .map((b) => {
      const type = safeUpper(b?.type || b?.kind) // compat si jamais un vieux bloc traîne
      const id = safeStr(b?.id) || uid('blk')
      const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? { ...b.data } : {}

      if (!type) return null

      if (type === 'TITLE' || type === 'HEADING') {
        const text = safeStr(data.text ?? b?.text)
        const level = Number((data.level ?? b?.level) || (type === 'TITLE' ? 1 : 2))
        const align = safeStr((data.align ?? b?.align) || 'left')
        return { id, type, data: { text, level, align } }
      }

      if (type === 'PARAGRAPH' || type === 'NOTE') {
        const text = safeStr(data.text ?? b?.text)
        const align = safeStr(data.align ?? b?.align) || 'left'
        return { id, type, data: { text, align } }
      }

      if (type === 'BULLETS') {
        const itemsRaw = Array.isArray(data.items) ? data.items : (Array.isArray(b?.items) ? b.items : [])
        const items = itemsRaw.map((x) => safeStr(x)).filter(Boolean)
        return { id, type, data: { items } }
      }

      if (type === 'DIVIDER' || type === 'SPACER') {
        return { id, type, data: data || {} }
      }

      // TABLE / autres types: on conserve data tel quel (Mixed)
      return { id, type, data: data || {} }
    })
    .filter(Boolean)

  return {
    type: values.type,
    name: values.name,
    status: values.status,
    version: Number(values.version || 1),
    contentBlocks: cleaned,
    legal: {
      governingLaws: gl
        .map((x) => ({
          label: safeStr(x?.label),
          note: safeStr(x?.note),
          priority: Number(x?.priority || 1),
        }))
        .filter((x) => x.label),
      jurisdictions: js
        .map((x) => ({
          label: safeStr(x?.label),
          type: safeStr(x?.type) || 'COURT',
          seat: safeStr(x?.seat),
        }))
        .filter((x) => x.label),
      legalMentions: safeStr(values?.legal?.legalMentions),
    },
  }
}

function blockIcon(type) {
  const k = String(type || '').toUpperCase()
  if (k === 'TITLE' || k === 'HEADING') return <FontSizeOutlined />
  if (k === 'PARAGRAPH' || k === 'NOTE') return <FileTextOutlined />
  if (k === 'BULLETS') return <UnorderedListOutlined />
  if (k === 'DIVIDER') return <TableOutlined />
  return <FileTextOutlined />
}

function blockLabel(type) {
  const k = String(type || '').toUpperCase()
  if (k === 'TITLE') return 'Titre (H1)'
  if (k === 'HEADING') return 'Sous-titre (H2/H3)'
  if (k === 'PARAGRAPH') return 'Paragraphe'
  if (k === 'BULLETS') return 'Liste'
  if (k === 'DIVIDER') return 'Séparateur'
  if (k === 'NOTE') return 'Note'
  if (k === 'TABLE') return 'Tableau'
  if (k === 'SPACER') return 'Espace'
  return k || 'Bloc'
}

function applyVars(text, vars) {
  const s = safeStr(text)
  if (!s) return ''
  return s.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').trim()
    const v = vars?.[k]
    return v === undefined || v === null ? '' : String(v)
  })
}

// demo vars for preview
function previewVars(type) {
  const t = String(type || '').toUpperCase()
  const base = {
    tenantName: 'DigiSuite SARL',
    tenantEmail: 'contact@digisuite.io',
    tenantPhone: '+221 77 000 00 00',
    tenantAddress: 'Dakar, Sénégal',
    clientName: 'M. Kouamé',
    clientEmail: 'client@example.com',
    clientPhone: '+225 07 00 00 00',
    clientAddress: 'Cocody, Abidjan',
    currency: 'XOF',
    amount: '295181',
    amountFormatted: '295 181 F CFA',
  }
  if (t === 'INVOICE') {
    return {
      ...base,
      invoiceNumber: 'FA-20260215-0001',
      invoiceDate: '15/02/2026',
      contractNumber: 'CT-20260210-0003',
      contractTitle: 'Abonnement DigiSuite — Pack Pro',
    }
  }
  if (t === 'CONTRACT') {
    return {
      ...base,
      contractNumber: 'CT-20260210-0003',
      contractTitle: 'Prestation de développement & maintenance',
    }
  }
  return {
    ...base,
    quoteNumber: 'DV-20260215-0002',
    quoteDate: '15/02/2026',
  }
}

// ✅ PREVIEW visuel “page”
function renderPreviewBlocks(blocks, vars) {
  const arr = Array.isArray(blocks) ? blocks : []

  return (
    <div
      style={{
        maxWidth: 820,
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid rgba(17,24,39,0.10)',
        borderRadius: 16,
        padding: 22,
        boxShadow: '0 12px 30px rgba(17,24,39,0.06)',
      }}
    >
      {arr.map((b) => {
        const type = String(b?.type || '').toUpperCase()
        const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {}
        const align = safeStr(data?.align) || 'left'

        if (type === 'DIVIDER') {
          return (
            <div key={b.id} style={{ margin: '14px 0' }}>
              <div style={{ height: 1, background: 'rgba(17,24,39,0.10)' }} />
            </div>
          )
        }

        if (type === 'SPACER') {
          const h = Number(data?.height || 10)
          return <div key={b.id} style={{ height: Math.min(80, Math.max(6, h)) }} />
        }

        if (type === 'TITLE' || type === 'HEADING') {
          const level = Number(data?.level || (type === 'TITLE' ? 1 : 2))
          const fontSize = level === 1 ? 22 : level === 2 ? 17 : 14
          const text = applyVars(data?.text, vars)

          return (
            <div
              key={b.id}
              style={{
                textAlign: align,
                margin: '6px 0 10px 0',
                fontWeight: 900,
                fontSize,
                color: '#0f172a',
              }}
            >
              {text || '—'}
            </div>
          )
        }

        if (type === 'PARAGRAPH' || type === 'NOTE') {
          const text = applyVars(data?.text, vars)
          return (
            <div
              key={b.id}
              style={{
                textAlign: align,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                margin: '0 0 12px 0',
                padding: type === 'NOTE' ? 12 : 0,
                borderRadius: 14,
                background: type === 'NOTE' ? 'rgba(22,163,74,0.08)' : 'transparent',
                border: type === 'NOTE' ? '1px solid rgba(22,163,74,0.18)' : 'none',
                color: '#0f172a',
              }}
            >
              {text || ''}
            </div>
          )
        }

        if (type === 'BULLETS') {
          const items = Array.isArray(data?.items) ? data.items : []
          return (
            <ul
              key={b.id}
              style={{
                margin: '0 0 14px 18px',
                padding: 0,
                textAlign: align,
                lineHeight: 1.7,
                color: '#0f172a',
              }}
            >
              {items.map((it, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {applyVars(it, vars)}
                </li>
              ))}
            </ul>
          )
        }

        if (type === 'TABLE') {
          return (
            <div key={b.id} style={{ margin: '10px 0', opacity: 0.8 }}>
              [TABLE]
            </div>
          )
        }

        return (
          <div key={b.id} style={{ margin: '8px 0', opacity: 0.8 }}>
            [{type}]
          </div>
        )
      })}
    </div>
  )
}

// ✅ Styles UI (anti overflow, layout premium, drawer header sticky)
function UiEnhancers() {
  useEffect(() => {
    const id = 'templates-page-ui-enhancers'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      /* drawer look */
      .templates-drawer .ant-drawer-header{
        position: sticky;
        top: 0;
        z-index: 10;
        background: #fff;
        border-bottom: 1px solid rgba(17,24,39,0.08);
      }
      .templates-drawer .ant-drawer-body{
        padding-top: 14px !important;
      }

      /* cards premium */
      .tpl-card{
        border-radius: 16px !important;
        border: 1px solid rgba(17,24,39,0.08) !important;
        box-shadow: 0 10px 26px rgba(17,24,39,0.06) !important;
        overflow: hidden;
      }
      .tpl-card .ant-card-head{
        border-bottom: 1px solid rgba(17,24,39,0.06) !important;
      }

      /* list cards */
      .tpl-block-card{
        border-radius: 14px !important;
        border: 1px solid rgba(17,24,39,0.08) !important;
        transition: box-shadow .15s ease, border-color .15s ease, transform .15s ease;
      }
      .tpl-block-card:hover{
        box-shadow: 0 10px 26px rgba(17,24,39,0.10) !important;
        transform: translateY(-1px);
      }
      .tpl-block-card.is-active{
        border-color: rgba(22,163,74,0.55) !important;
        box-shadow: 0 0 0 3px rgba(22,163,74,0.14) !important;
      }

      /* avoid vertical/overflow weirdness */
      .templates-page :is(.ant-typography, .ant-tag, .ant-btn, .ant-card, .ant-menu, .ant-table){
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
      }
      .templates-page :is(p, span, a, div, li, td, th, label, .ant-typography, .ant-card-head-title){
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      /* ============================
         ✅ Fix superposition texte/boutons
         ============================ */

      /* 1) Card header: title + extra doivent pouvoir wrap */
      .templates-page .ant-card-head{
        align-items: flex-start !important;
      }
      .templates-page .ant-card-head-wrapper{
        gap: 10px;
      }
      .templates-page .ant-card-head-title{
        min-width: 0 !important; /* essentiel pour ellipsis */
      }
      .templates-page .ant-card-extra{
        max-width: 100%;
      }
      .templates-page .ant-card-extra > .ant-space{
        flex-wrap: wrap !important;
        justify-content: flex-end;
        row-gap: 8px;
      }

      /* 2) Table: éviter que cellules longues chevauchent la colonne actions */
      .templates-page .ant-table{
        table-layout: fixed; /* stabilise largeur des colonnes */
      }
      .templates-page .ant-table-cell{
        vertical-align: top;
      }
      .templates-page .ant-table-cell .ant-space{
        min-width: 0; /* autorise ellipsis et évite overflow */
      }

      /* 3) Colonne actions: autoriser retour à la ligne et garder les boutons “propres” */
      .templates-page .tpl-actions{
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .templates-page .tpl-actions .ant-btn{
        flex: 0 0 auto;
      }

      /* 4) Nom + badge: éviter que le badge pousse/chevauche */
      .templates-page .tpl-name{
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .templates-page .tpl-name .ant-typography{
        min-width: 0;
      }
      .templates-page .tpl-name .ant-badge{
        flex: 0 0 auto;
      }

      /* 5) Mobile: actions en colonne si besoin */
      @media (max-width: 768px){
        .templates-page .tpl-actions{
          justify-content: flex-start;
        }
        .templates-page .tpl-actions .ant-btn{
          width: 100%;
        }
      }
    `
    document.head.appendChild(style)
  }, [])
  return null
}

export default function TemplatesPage() {
  const { message } = AntApp.useApp()
  const screens = useBreakpoint()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // ✅ drawer init queue
  const [pendingInit, setPendingInit] = useState(null) // { mode: 'CREATE'|'EDIT', row?: any }

  // ✅ Blocks UI state
  const [viewMode, setViewMode] = useState('EDIT') // EDIT | PREVIEW
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const listScrollRef = useRef(null)

  const [form] = Form.useForm()

  // watch
  const blocks = Form.useWatch('contentBlocks', form) || []
  const currentType = Form.useWatch('type', form) || (editing?.type || 'INVOICE')

  async function fetchList() {
    setLoading(true)
    try {
      const data = await api.templates.list({ q: safeStr(q) || undefined, type: typeFilter || undefined })
      const arr = Array.isArray(data) ? data : (data?.items || [])
      setItems(arr)
    } catch (e) {
      message.error(e?.response?.data?.message || 'Impossible de charger les templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function closeDrawer() {
    setOpen(false)
    setEditing(null)
    setPendingInit(null)
    setSelectedBlockId('')
    setViewMode('EDIT')
    form.resetFields()
  }

  function onCreate() {
    setEditing(null)
    setPendingInit({ mode: 'CREATE' })
    setOpen(true)
  }

  function onEdit(row) {
    setEditing(row)
    setPendingInit({ mode: 'EDIT', row })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    if (!pendingInit) return

    if (pendingInit.mode === 'CREATE') {
      const initialType = 'INVOICE'
      const initialBlocks = defaultBlocks(initialType)

      form.resetFields()
      form.setFieldsValue({
        type: initialType,
        status: 'DRAFT',
        version: 1,
        name: 'Template Facture (V1)',
        contentBlocks: initialBlocks,
        legal: {
          governingLaws: [{ label: 'OHADA', note: '', priority: 1 }],
          jurisdictions: [{ label: "Tribunal de Commerce d'Abidjan", type: 'COURT', seat: 'Abidjan' }],
          legalMentions: '',
        },
      })

      setSelectedBlockId(initialBlocks?.[0]?.id || '')
      setViewMode('EDIT')
    }

    if (pendingInit.mode === 'EDIT') {
      const norm = normalizeTemplateFromApi(pendingInit.row)
      form.resetFields()
      form.setFieldsValue(norm)

      const bb = norm?.contentBlocks || []
      setSelectedBlockId(bb?.[0]?.id || '')
      setViewMode('EDIT')
    }

    setPendingInit(null)
  }, [open, pendingInit]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onRemove(row) {
    try {
      await api.templates.remove(row._id)
      message.success('Template supprimé')
      fetchList()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Suppression impossible')
    }
  }

  async function onActivate(row) {
    try {
      await api.templates.activate(row._id)
      message.success('Template activé')
      fetchList()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Activation impossible')
    }
  }

  async function onSubmit(values) {
    const payload = normalizePayloadToApi(values)
    try {
      if (editing?._id) {
        await api.templates.update(editing._id, payload)
        message.success('Template mis à jour')
      } else {
        await api.templates.create(payload)
        message.success('Template créé')
      }
      closeDrawer()
      fetchList()
    } catch (e) {
      message.error(e?.response?.data?.message || 'Enregistrement impossible')
    }
  }

  function setBlocks(next) {
    form.setFieldsValue({ contentBlocks: Array.isArray(next) ? next : [] })
  }

  function ensureSelection(nextBlocks) {
    const arr = Array.isArray(nextBlocks) ? nextBlocks : []
    if (!arr.length) {
      setSelectedBlockId('')
      return
    }
    const stillExists = arr.some((b) => b?.id === selectedBlockId)
    if (stillExists) return
    setSelectedBlockId(arr[0].id)
  }

  function addBlock(type) {
    const t = safeUpper(type)
    const current = Array.isArray(blocks) ? blocks : []
    let block = { id: uid(t.toLowerCase()), type: t, data: {} }

    if (t === 'TITLE') block = { ...block, data: { text: 'Titre', level: 1, align: 'left' } }
    if (t === 'HEADING') block = { ...block, data: { text: 'Sous-titre', level: 2, align: 'left' } }
    if (t === 'PARAGRAPH') block = { ...block, data: { text: 'Votre texte ici…', align: 'left' } }
    if (t === 'BULLETS') block = { ...block, data: { items: ['Point 1', 'Point 2'] } }
    if (t === 'DIVIDER') block = { ...block, data: {} }

    const next = [...current, block]
    setBlocks(next)
    setSelectedBlockId(block.id)

    setTimeout(() => {
      try { listScrollRef.current?.scrollTo?.({ top: 99999, behavior: 'smooth' }) } catch {}
    }, 0)
  }

  function removeBlock(id) {
    const current = Array.isArray(blocks) ? blocks : []
    const next = current.filter((b) => b?.id !== id)
    setBlocks(next)
    if (selectedBlockId === id) setSelectedBlockId(next?.[0]?.id || '')
  }

  function moveBlock(id, dir) {
    const current = Array.isArray(blocks) ? blocks : []
    const idx = current.findIndex((b) => b?.id === id)
    if (idx < 0) return
    const j = dir === 'UP' ? idx - 1 : idx + 1
    if (j < 0 || j >= current.length) return
    const next = [...current]
    const tmp = next[idx]
    next[idx] = next[j]
    next[j] = tmp
    setBlocks(next)
  }

  function updateBlock(id, patchData) {
    const current = Array.isArray(blocks) ? blocks : []
    const next = current.map((b) => {
      if (b?.id !== id) return b
      const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {}
      return { ...b, data: { ...data, ...(patchData || {}) } }
    })
    setBlocks(next)
  }

  function updateBulletItem(blockId, index, value) {
    const current = Array.isArray(blocks) ? blocks : []
    const next = current.map((b) => {
      if (b?.id !== blockId) return b
      const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? { ...b.data } : {}
      const items = Array.isArray(data?.items) ? [...data.items] : []
      items[index] = value
      return { ...b, data: { ...data, items } }
    })
    setBlocks(next)
  }

  function addBulletItem(blockId) {
    const current = Array.isArray(blocks) ? blocks : []
    const next = current.map((b) => {
      if (b?.id !== blockId) return b
      const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? { ...b.data } : {}
      const items = Array.isArray(data?.items) ? [...data.items, 'Nouveau point'] : ['Nouveau point']
      return { ...b, data: { ...data, items } }
    })
    setBlocks(next)
  }

  function removeBulletItem(blockId, index) {
    const current = Array.isArray(blocks) ? blocks : []
    const next = current.map((b) => {
      if (b?.id !== blockId) return b
      const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? { ...b.data } : {}
      const items = Array.isArray(data?.items) ? data.items.filter((_, i) => i !== index) : []
      return { ...b, data: { ...data, items } }
    })
    setBlocks(next)
  }

  const filteredItems = useMemo(() => {
    const qq = safeStr(q).toLowerCase()
    const tf = safeStr(typeFilter).toUpperCase()
    return (items || []).filter((it) => {
      const okType = !tf || String(it?.type || '').toUpperCase() === tf
      if (!okType) return false
      if (!qq) return true

      const name = safeStr(it?.name).toLowerCase()
      const laws = Array.isArray(it?.legal?.governingLaws)
        ? it.legal.governingLaws.map((x) => `${x?.label || ''} ${x?.note || ''}`).join(' ').toLowerCase()
        : ''
      const juris = Array.isArray(it?.legal?.jurisdictions)
        ? it.legal.jurisdictions.map((x) => `${x?.label || ''} ${x?.seat || ''} ${x?.type || ''}`).join(' ').toLowerCase()
        : ''
      const mentions = safeStr(it?.legal?.legalMentions).toLowerCase()

      const bl = Array.isArray(it?.contentBlocks)
        ? it.contentBlocks.map((b) => {
          const type = safeStr(b?.type)
          const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {}
          const txt = safeStr(data?.text)
          const items2 = Array.isArray(data?.items) ? data.items.join(' ') : ''
          return `${type} ${txt} ${items2}`
        }).join(' ').toLowerCase()
        : ''

      return name.includes(qq) || bl.includes(qq) || laws.includes(qq) || juris.includes(qq) || mentions.includes(qq)
    })
  }, [items, q, typeFilter])

  const columns = useMemo(() => ([
    {
      title: 'Type',
      dataIndex: 'type',
      width: 150,
      render: (v) => <Tag color={typeColor(v)} style={{ marginInlineEnd: 0 }}>{typeLabel(v)}</Tag>,
    },
    {
      title: 'Nom',
      dataIndex: 'name',
      ellipsis: true,
      render: (v, row) => (
        <div className="tpl-name">
          <Text strong ellipsis style={{ maxWidth: 320 }}>
            {safeStr(v) || '—'}
          </Text>
          {isActive(row?.status) && <Badge status="success" text={<span style={{ fontSize: 12 }}>ACTIF</span>} />}
        </div>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      width: 110,
      render: (v) => <Text type="secondary">{Number(v || 1)}</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={statusColor(v)} style={{ marginInlineEnd: 0 }}>{safeStr(v) || '—'}</Tag>,
    },
    {
      title: '',
      width: 260,
      fixed: screens.lg ? 'right' : undefined,
      render: (_, row) => (
        <div className="tpl-actions">
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)}>
            {screens.lg ? 'Modifier' : null}
          </Button>

          <Button size="small" icon={<CheckCircleOutlined />} disabled={isActive(row?.status)} onClick={() => onActivate(row)}>
            {screens.lg ? 'Activer' : null}
          </Button>

          <Popconfirm
            title="Supprimer ce template ?"
            description="Cette action est irréversible."
            okText="Supprimer"
            cancelText="Annuler"
            onConfirm={() => onRemove(row)}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              {screens.lg ? 'Supprimer' : null}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]), [screens.lg]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ensureSelection(blocks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks?.length, selectedBlockId])

  const selectedBlock = useMemo(() => {
    const arr = Array.isArray(blocks) ? blocks : []
    return arr.find((b) => b?.id === selectedBlockId) || null
  }, [blocks, selectedBlockId])

  const previewRender = useMemo(() => {
    const vars = previewVars(currentType)
    return renderPreviewBlocks(blocks, vars)
  }, [blocks, currentType])

  return (
    <div className="templates-page">
      <UiEnhancers />

      <PageFrame
        title="Templates"
        subtitle="Éditeur par blocs + mentions légales structurées (lois + juridictions)."
        extra={
          <Space wrap>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, texte, loi, juridiction...)"
              allowClear
              style={{ width: screens.md ? 340 : 220 }}
            />
            <Select
              value={typeFilter || undefined}
              onChange={(v) => setTypeFilter(v || '')}
              allowClear
              placeholder="Type"
              style={{ width: screens.md ? 170 : 140 }}
              options={[
                { value: 'QUOTE', label: 'Devis' },
                { value: 'CONTRACT', label: 'Contrat' },
                { value: 'INVOICE', label: 'Facture' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
              {screens.md ? 'Rafraîchir' : null}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              Nouveau
            </Button>
          </Space>
        }
      >
        <Card className="tpl-card" bodyStyle={{ padding: 14 }}>
          <Table
            rowKey={(r) => r._id}
            loading={loading}
            dataSource={filteredItems}
            columns={columns}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 980 }}
            locale={{ emptyText: 'Aucun template.' }}
          />
          <div style={{ marginTop: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <FileTextOutlined /> Active 1 template par type. Le rendu PDF prend un snapshot (template + mentions).
            </Text>
          </div>
        </Card>

        <Drawer
          className="templates-drawer"
          title={editing ? 'Modifier template' : 'Nouveau template'}
          open={open}
          onClose={closeDrawer}
          width={screens.md ? 1120 : '100%'}
          destroyOnClose
        >
          <Form layout="vertical" form={form} onFinish={onSubmit} requiredMark={false}>
            <Card className="tpl-card" bodyStyle={{ padding: 14, background: '#fff' }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={10}>
                  <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Type requis' }]}>
                    <Select
                      options={[
                        { value: 'QUOTE', label: 'Devis' },
                        { value: 'CONTRACT', label: 'Contrat' },
                        { value: 'INVOICE', label: 'Facture' },
                      ]}
                      onChange={(v) => {
                        const current = form.getFieldValue('contentBlocks') || []
                        if (!Array.isArray(current) || !current.length) {
                          const seeded = defaultBlocks(v)
                          form.setFieldsValue({ contentBlocks: seeded })
                          setSelectedBlockId(seeded?.[0]?.id || '')
                        }
                      }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="status" label="Statut" rules={[{ required: true, message: 'Statut requis' }]}>
                    <Select
                      options={[
                        { value: 'DRAFT', label: 'Brouillon' },
                        { value: 'ACTIVE', label: 'Actif' },
                        { value: 'ARCHIVED', label: 'Archivé' },
                      ]}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="version" label="Version" tooltip="Incrémenter quand tu changes la trame.">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
                <Input placeholder="Ex: Template Facture (V2 - OHADA)" />
              </Form.Item>
            </Card>

            <Divider style={{ margin: '14px 0' }} />

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={10}>
                <Card
                  className="tpl-card"
                  bodyStyle={{ padding: 14 }}
                  title={
                    <Space>
                      <Text strong>Blocs</Text>
                      <Tooltip title="Variables dans les textes (ex: {{invoiceNumber}}).">
                        <InfoCircleOutlined style={{ color: '#94a3b8' }} />
                      </Tooltip>
                    </Space>
                  }
                  extra={
                    <Space size={6}>
                      <Tooltip title="Titre">
                        <Button size="small" icon={<FontSizeOutlined />} onClick={() => addBlock('TITLE')} />
                      </Tooltip>
                      <Tooltip title="Sous-titre">
                        <Button size="small" icon={<FontSizeOutlined />} onClick={() => addBlock('HEADING')} />
                      </Tooltip>
                      <Tooltip title="Paragraphe">
                        <Button size="small" icon={<FileTextOutlined />} onClick={() => addBlock('PARAGRAPH')} />
                      </Tooltip>
                      <Tooltip title="Liste">
                        <Button size="small" icon={<UnorderedListOutlined />} onClick={() => addBlock('BULLETS')} />
                      </Tooltip>
                      <Tooltip title="Séparateur">
                        <Button size="small" icon={<TableOutlined />} onClick={() => addBlock('DIVIDER')} />
                      </Tooltip>
                    </Space>
                  }
                >
                  {!blocks?.length ? (
                    <Empty
                      description={
                        <div>
                          <div style={{ fontWeight: 700 }}>Aucun bloc</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                            Variables: <code>{'{{invoiceNumber}}'}</code>, <code>{'{{clientName}}'}</code>…
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => addBlock('PARAGRAPH')}>
                              Ajouter un bloc
                            </Button>
                          </div>
                        </div>
                      }
                    />
                  ) : (
                    <div
                      ref={listScrollRef}
                      style={{
                        maxHeight: screens.lg ? 560 : 440,
                        overflow: 'auto',
                        paddingRight: 4,
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size={10}>
                        {blocks.map((b, idx) => {
                          const active = b?.id === selectedBlockId
                          const type = safeUpper(b?.type || '')
                          const data = (b && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {}

                          const smallText =
                            (type === 'TITLE' || type === 'HEADING')
                              ? safeStr(data?.text)
                              : (type === 'PARAGRAPH' || type === 'NOTE')
                                ? safeStr(data?.text).split('\n')[0]
                                : type === 'BULLETS'
                                  ? `${(Array.isArray(data?.items) ? data.items.length : 0)} item(s)`
                                  : type === 'DIVIDER'
                                    ? '—'
                                    : '—'

                          return (
                            <Card
                              key={b.id}
                              size="small"
                              className={`tpl-block-card ${active ? 'is-active' : ''}`}
                              bodyStyle={{ padding: 12 }}
                              onClick={() => setSelectedBlockId(b.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                                <Space align="start" style={{ minWidth: 0 }}>
                                  <div style={{ marginTop: 2 }}>{blockIcon(type)}</div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800 }}>{blockLabel(type)}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>
                                      {safeStr(smallText) ? safeStr(smallText).slice(0, 72) : '—'}
                                    </div>
                                  </div>
                                </Space>

                                <Space size={4}>
                                  <Tooltip title="Monter">
                                    <Button
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 'UP') }}
                                      disabled={idx === 0}
                                    >
                                      ↑
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="Descendre">
                                    <Button
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 'DOWN') }}
                                      disabled={idx === blocks.length - 1}
                                    >
                                      ↓
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="Supprimer">
                                    <Button
                                      danger
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); removeBlock(b.id) }}
                                      icon={<DeleteOutlined />}
                                    />
                                  </Tooltip>
                                </Space>
                              </Space>
                            </Card>
                          )
                        })}
                      </Space>
                    </div>
                  )}
                </Card>
              </Col>

              <Col xs={24} lg={14}>
                <Card
                  className="tpl-card"
                  bodyStyle={{ padding: 14 }}
                  title={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Text strong>{viewMode === 'EDIT' ? 'Éditeur' : 'Aperçu'}</Text>
                        <Tooltip title="Aperçu avec variables remplacées (démo).">
                          <InfoCircleOutlined style={{ color: '#94a3b8' }} />
                        </Tooltip>
                      </Space>

                      <Segmented
                        value={viewMode}
                        onChange={(v) => setViewMode(v)}
                        options={[
                          { label: <Space size={6}><CodeOutlined /> Éditer</Space>, value: 'EDIT' },
                          { label: <Space size={6}><EyeOutlined /> Aperçu</Space>, value: 'PREVIEW' },
                        ]}
                      />
                    </Space>
                  }
                >
                  {viewMode === 'PREVIEW' ? (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        message="Aperçu (démo)"
                        description={
                          <div style={{ fontSize: 12 }}>
                            Ex: <code>{'{{invoiceNumber}}'}</code>, <code>{'{{clientName}}'}</code>, <code>{'{{amountFormatted}}'}</code>.
                          </div>
                        }
                        style={{ borderRadius: 12, marginBottom: 12 }}
                      />
                      {previewRender}
                    </>
                  ) : (
                    <>
                      {!selectedBlock ? (
                        <Empty description="Sélectionne un bloc" />
                      ) : (
                        <BlockEditor
                          block={selectedBlock}
                          onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                          onBulletChange={(i, val) => updateBulletItem(selectedBlock.id, i, val)}
                          onBulletAdd={() => addBulletItem(selectedBlock.id)}
                          onBulletRemove={(i) => removeBulletItem(selectedBlock.id, i)}
                        />
                      )}
                    </>
                  )}
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />

            <Title level={5} style={{ marginTop: 0 }}>Juridique (structuré)</Title>

            <Card className="tpl-card" style={{ marginBottom: 12 }} bodyStyle={{ padding: 14 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>Lois applicables</Text>
                  <Button
                    size="small"
                    icon={<PlusCircleOutlined />}
                    onClick={() => {
                      const cur = form.getFieldValue(['legal', 'governingLaws']) || []
                      form.setFieldsValue({
                        legal: { ...form.getFieldValue('legal'), governingLaws: [...cur, { label: '', note: '', priority: 1 }] },
                      })
                    }}
                  >
                    Ajouter
                  </Button>
                </Space>

                <Form.List name={['legal', 'governingLaws']}>
                  {(fields, { remove }) => (
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                      {fields.map((field) => (
                        <Row gutter={[10, 10]} key={field.key} align="middle">
                          <Col xs={24} md={9}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'label']}
                              label="Label"
                              rules={[{ required: true, message: 'Label requis' }]}
                            >
                              <Input placeholder="Ex: OHADA / Droit ivoirien" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={11}>
                            <Form.Item {...field} name={[field.name, 'note']} label="Note">
                              <Input placeholder="Précision (optionnel)" />
                            </Form.Item>
                          </Col>
                          <Col xs={18} md={3}>
                            <Form.Item {...field} name={[field.name, 'priority']} label="Priorité">
                              <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={6} md={1} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                          </Col>
                        </Row>
                      ))}
                      {!fields.length && <Text type="secondary">Aucune loi définie.</Text>}
                    </Space>
                  )}
                </Form.List>
              </Space>
            </Card>

            <Card className="tpl-card" style={{ marginBottom: 12 }} bodyStyle={{ padding: 14 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>Juridictions compétentes</Text>
                  <Button
                    size="small"
                    icon={<PlusCircleOutlined />}
                    onClick={() => {
                      const cur = form.getFieldValue(['legal', 'jurisdictions']) || []
                      form.setFieldsValue({
                        legal: { ...form.getFieldValue('legal'), jurisdictions: [...cur, { label: '', type: 'COURT', seat: '' }] },
                      })
                    }}
                  >
                    Ajouter
                  </Button>
                </Space>

                <Form.List name={['legal', 'jurisdictions']}>
                  {(fields, { remove }) => (
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                      {fields.map((field) => (
                        <Row gutter={[10, 10]} key={field.key} align="middle">
                          <Col xs={24} md={11}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'label']}
                              label="Label"
                              rules={[{ required: true, message: 'Label requis' }]}
                            >
                              <Input placeholder="Ex: Tribunal de Commerce d'Abidjan" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item {...field} name={[field.name, 'type']} label="Type">
                              <Select
                                options={[
                                  { value: 'COURT', label: 'Tribunal' },
                                  { value: 'ARBITRATION', label: 'Arbitrage' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={18} md={6}>
                            <Form.Item {...field} name={[field.name, 'seat']} label="Siège / Ville">
                              <Input placeholder="Ex: Abidjan" />
                            </Form.Item>
                          </Col>
                          <Col xs={6} md={1} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                          </Col>
                        </Row>
                      ))}
                      {!fields.length && <Text type="secondary">Aucune juridiction définie.</Text>}
                    </Space>
                  )}
                </Form.List>
              </Space>
            </Card>

            <Form.Item name={['legal', 'legalMentions']} label="Mentions légales (bas de page / clauses)">
              <Input.TextArea rows={screens.md ? 5 : 4} placeholder="RCCM, NINEA, conditions de paiement, etc." />
            </Form.Item>

            {/* ✅ champ réel dans le form (pour submit) */}
            <Form.Item
              name="contentBlocks"
              rules={[{ required: true, message: 'Ajoute au moins un bloc' }]}
              style={{ marginBottom: 0 }}
            >
              <Input type="hidden" />
            </Form.Item>

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                background: '#fff',
                paddingTop: 12,
                paddingBottom: 12,
                borderTop: '1px solid rgba(17,24,39,0.08)',
                zIndex: 5,
              }}
            >
              <Divider style={{ margin: '10px 0' }} />
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={closeDrawer}>Annuler</Button>
                <Button type="primary" htmlType="submit">Enregistrer</Button>
              </Space>
            </div>
          </Form>
        </Drawer>
      </PageFrame>
    </div>
  )
}

// ----------------------------
// BlockEditor component (MODEL-COMPAT)
// ----------------------------
function BlockEditor({ block, onChange, onBulletChange, onBulletAdd, onBulletRemove }) {
  const type = String(block?.type || '').toUpperCase()
  const data = (block && typeof block.data === 'object' && !Array.isArray(block.data)) ? block.data : {}

  if (type === 'DIVIDER') {
    return (
      <Alert
        type="info"
        showIcon
        message="Séparateur"
        description="Ce bloc insère une ligne de séparation dans le rendu PDF."
        style={{ borderRadius: 12 }}
      />
    )
  }

  if (type === 'TITLE' || type === 'HEADING') {
    const levelDefault = type === 'TITLE' ? 1 : 2
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={[10, 10]}>
          <Col xs={24} md={16}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Texte</div>
            <Input
              value={data?.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder={type === 'TITLE' ? 'Titre…' : 'Sous-titre…'}
            />
          </Col>
          <Col xs={12} md={4}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Niveau</div>
            <Select
              value={Number(data?.level || levelDefault)}
              onChange={(v) => onChange({ level: Number(v) })}
              options={[
                { value: 1, label: 'H1' },
                { value: 2, label: 'H2' },
                { value: 3, label: 'H3' },
              ]}
            />
          </Col>
          <Col xs={12} md={4}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Align</div>
            <Select
              value={safeStr(data?.align) || 'left'}
              onChange={(v) => onChange({ align: v })}
              options={[
                { value: 'left', label: 'Gauche' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Droite' },
              ]}
            />
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 12 }}
          message="Variables"
          description={<span>Tu peux utiliser: <code>{'{{invoiceNumber}}'}</code>, <code>{'{{clientName}}'}</code>, <code>{'{{amountFormatted}}'}</code>, etc.</span>}
        />
      </Space>
    )
  }

  if (type === 'BULLETS') {
    const items = Array.isArray(data?.items) ? data.items : []
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>Éléments</Text>
          <Button size="small" icon={<PlusOutlined />} onClick={onBulletAdd}>Ajouter</Button>
        </Space>

        {!items.length ? (
          <Empty description="Aucun élément" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {items.map((it, i) => (
              <Row key={i} gutter={[10, 10]} align="middle">
                <Col xs={24} md={22}>
                  <Input
                    value={it}
                    onChange={(e) => onBulletChange(i, e.target.value)}
                    placeholder="• texte…"
                  />
                </Col>
                <Col xs={24} md={2} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => onBulletRemove(i)} />
                </Col>
              </Row>
            ))}
          </Space>
        )}

        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 12 }}
          message="Astuce"
          description={<span>Tu peux mettre des variables dans les items: <code>{'{{contractNumber}}'}</code>, <code>{'{{tenantEmail}}'}</code>…</span>}
        />
      </Space>
    )
  }

  // PARAGRAPH / NOTE (default)
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={10}>
      <Row gutter={[10, 10]}>
        <Col xs={24} md={18}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Texte</div>
          <Input.TextArea
            rows={10}
            value={data?.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Ton texte…"
          />
        </Col>
        <Col xs={24} md={6}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Align</div>
          <Select
            value={safeStr(data?.align) || 'left'}
            onChange={(v) => onChange({ align: v })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Droite' },
            ]}
          />
          <div style={{ marginTop: 12 }}>
            <Alert
              type="info"
              showIcon
              style={{ borderRadius: 12 }}
              message="Variables utiles"
              description={
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div><code>{'{{invoiceNumber}}'}</code> <code>{'{{invoiceDate}}'}</code></div>
                  <div><code>{'{{clientName}}'}</code> <code>{'{{clientEmail}}'}</code></div>
                  <div><code>{'{{amountFormatted}}'}</code> <code>{'{{currency}}'}</code></div>
                </div>
              }
            />
          </div>
        </Col>
      </Row>
    </Space>
  )
}