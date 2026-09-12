import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// a mesma porta do `npm run servidor:local`. So vale no desenvolvimento:
// em producao o servidor.js serve site e API juntos, sem proxy nenhum.
//
// API_PORT e nao PORT: PORT aqui e a porta DESTE processo (o dev server), e
// quem roda o vite costuma definir ela - o proxy acabava apontando pra si
// mesmo e dava EADDRINUSE em toda chamada.
const PORTA_API = process.env.API_PORT ?? '8099'

export default defineConfig({
  // host: true expoe o dev server na rede local, pra abrir no celular
  server: {
    host: true,
    port: 5173,
    // no dev o site roda aqui e a API no `npm run servidor:local`.
    // o proxy faz o navegador ver os dois na mesma origem, igual em producao -
    // sem isso o cookie de sessao nao gruda e /api cairia no index.html
    // 127.0.0.1 e nao "localhost": no Windows o localhost resolve pra ::1
    // (IPv6) primeiro, e o servidor escuta em 0.0.0.0 (IPv4) - o proxy tomava
    // 502 sem nunca chegar na API.
    proxy: { '/api': { target: `http://127.0.0.1:${PORTA_API}`, changeOrigin: false } },
  },
  preview: { host: true, port: 4173 },
  /**
   * "site" e nao "dist": a Discloud ignora o conteudo de uma pasta chamada
   * dist/ no upload (ela assume que e artefato de build descartavel). O app
   * subia com a pasta vazia e respondia 500 em tudo. Com outro nome, os
   * arquivos compilados chegam ao servidor.
   */
  build: { outDir: 'site' },
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
