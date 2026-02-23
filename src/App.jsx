import React from 'react'
import { ConfigProvider, App as AntApp } from 'antd'
import frFR from 'antd/locale/fr_FR'
import AuthProvider from './context/AuthContext'
import { themeTokens } from './styles/theme'
import AppRouter from './routes/AppRouter'

export default function App() {
  return (
    <ConfigProvider locale={frFR} theme={themeTokens}>
      <AntApp>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
