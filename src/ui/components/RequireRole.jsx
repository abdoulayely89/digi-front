import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'

function safeStr(v) { return String(v ?? '').trim() }

export default function RequireRole({ roles = [], children }) {
  const { user } = useContext(AuthContext)

  const role = safeStr(user?.role).toLowerCase()
  const allow = (roles || []).map((r) => safeStr(r).toLowerCase())

  if (!role) return <Navigate to="/auth/login" replace />
  if (!allow.includes(role)) return <Navigate to="/dashboard" replace />

  return children
}