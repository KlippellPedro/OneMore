import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // host: true expoe o dev server na rede local, pra abrir no celular
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'OneMore - Treino & Dieta',
        short_name: 'OneMore',
        description: 'Monte treinos, controle a dieta e suba de nivel.',
        theme_color: '#0a0714',
        background_color: '#0a0714',
        display: 'standalone',
        orientation: 'portrait',
        // relativo de proposito: resolve contra a pasta do manifest, entao
        // funciona tanto na raiz quanto publicado num subcaminho
        // (usuario.github.io/onemore/) sem precisar mexer aqui
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // o sw.js gerado nao sabe nada de lembrete: esse arquivo e quem mostra
        // a notificacao quando o Android acorda o app com ele fechado
        importScripts: ['lembretes-sw.js'],
      },
    }),
  ],
})
