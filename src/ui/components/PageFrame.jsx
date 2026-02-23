import React from 'react'
import { Card, Space, Typography } from 'antd'

const { Title, Text } = Typography

export default function PageFrame({ title, subtitle, extra, children }) {
  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <Title level={3} style={{ margin: 0, color: 'var(--text)' }}>{title}</Title>
          {subtitle ? <Text style={{ color: 'var(--muted)' }}>{subtitle}</Text> : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      <Card styles={{ body: { background: 'var(--panel)', border: '1px solid var(--panelBorder)', borderRadius: 16 } }} style={{ background: 'transparent', border: 'none', boxShadow: 'var(--shadow)' }}>
        {children}
      </Card>
    </Space>
  )
}
