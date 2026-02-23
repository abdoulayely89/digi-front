import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import AppLayout from '../ui/layout/AppLayout'

import LoginPage from '../pages/auth/LoginPage'
import AdminDashboard from '../pages/dashboard/AdminDashboard'
import SalesDashboard from '../pages/dashboard/SalesDashboard'
import LeadsPage from '../pages/leads/LeadsPage'
import QuotesPage from '../pages/quotes/QuotesPage'
import ContractsPage from '../pages/contracts/ContractsPage'
import InvoicesPage from '../pages/invoices/InvoicesPage'
import TenantSettingsPage from '../pages/settings/TenantSettingsPage'
import TemplatesPage from '../pages/settings/TemplatesPage'
import PublicProfilePage from '../pages/public/PublicProfilePage'
import PublicContractSignPage from '../pages/public/PublicContractSignPage' // ✅ NEW
import PublicQuotePage from '../pages/public/PublicQuotePage' // ✅ NEW
import UsersPage from '../pages/users/UsersPage'

// ✅ NEW: page privée "Ma carte" (QR code -> page publique)
import ProfilePage from '../pages/profile/ProfilePage'

// ✅ NEW: localisation
import MyLocationPage from '../pages/tracking/MyLocationPage'
import TeamLocationsPage from '../pages/tracking/TeamLocationsPage'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/t/:tenantSlug/u/:userSlug" element={<PublicProfilePage />} />
        <Route path="/t/:tenantSlug/q/:token" element={<PublicQuotePage />} /> {/* ✅ NEW */}
        <Route path="/t/:tenantSlug/c/:token" element={<PublicContractSignPage />} /> {/* ✅ NEW */}

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Private */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<SalesDashboard />} />
          <Route path="dashboard" element={<SalesDashboard />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />

          <Route path="users" element={<UsersPage />} />

          {/* ✅ NEW */}
          <Route path="profile" element={<ProfilePage />} />

          {/* ✅ NEW: localisation */}
          <Route path="tracking/me" element={<MyLocationPage />} />
          <Route path="tracking/team" element={<TeamLocationsPage />} />

          <Route path="settings/tenant" element={<TenantSettingsPage />} />
          <Route path="settings/templates" element={<TemplatesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}