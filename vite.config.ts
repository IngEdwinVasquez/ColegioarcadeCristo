import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // PWA / caché offline DESACTIVADA.
      // Se genera un service worker que se autodestruye y limpia las cachés de las
      // versiones anteriores, para que ningún equipo quede atrapado en contenido viejo.
      // Las nuevas cargas ya no registran service worker (no hay precache).
      selfDestroying: true,
      injectRegister: false,
      manifest: {
        name: 'Arca de Cristo',
        short_name: 'Arca de Cristo',
        description:
          'Portal educativo del Centro Educativo Evangélico Arca de Cristo: planificación, clases, asistencia, aulas virtuales y encuentros. Impulsada por Microsoft 365.',
        theme_color: '#0095C8',
        background_color: '#F3F5F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
