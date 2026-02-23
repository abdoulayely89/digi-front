import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // ✅ important pour React Router (SPA)
      strategies: 'generateSW',
      workbox: {
        navigateFallback: '/index.html',
        // évite que le SW tente de "SPA fallback" pour des endpoints backend/API
        navigateFallbackDenylist: [
          /^\/api\//,
          // optionnel : si tu utilises /auth/ côté backend sur le même domaine
          // si ton front doit quand même gérer /auth/login, supprime cette ligne
          // /^\/auth\//,
        ],
      },

      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-192.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: 'DigiSuite',
        short_name: 'DigiSuite',
        description: 'Cartes de visite digitales, CRM multi-tenant, devis, contrats et signature.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#2563eb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
})