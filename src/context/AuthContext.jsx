import React, { createContext, useEffect, useMemo, useState } from 'react'
import { setTokenGetter, setTenantIdGetter } from '../api/http'

export const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ds_token') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ds_user') || 'null') } catch { return null }
  })
  const [tenant, setTenant] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ds_tenant') || 'null') } catch { return null }
  })

  useEffect(() => {
    setTokenGetter(() => token)
    setTenantIdGetter(() => tenant?._id || '')
  }, [token, tenant])

  useEffect(() => {
    if (token) localStorage.setItem('ds_token', token)
    else localStorage.removeItem('ds_token')
  }, [token])
  useEffect(() => {
    if (user) localStorage.setItem('ds_user', JSON.stringify(user))
    else localStorage.removeItem('ds_user')
  }, [user])
  useEffect(() => {
    if (tenant) localStorage.setItem('ds_tenant', JSON.stringify(tenant))
    else localStorage.removeItem('ds_tenant')
  }, [tenant])

  const value = useMemo(() => ({
    token,
    user,
    tenant,
    isAuthed: !!token && !!user,
    setAuthSession({ token: t, user: u, tenant: tn }) {
      setToken(t)
      setUser(u)
      setTenant(tn)
    },
    logout() {
      setToken('')
      setUser(null)
      setTenant(null)
    }
  }), [token, user, tenant])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
