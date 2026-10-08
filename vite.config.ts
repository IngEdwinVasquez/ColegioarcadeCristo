import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Genera un id único por build, lo inyecta como `__BUILD_ID__` en la app y emite
 * `/version.json` en el sitio. La app consulta ese archivo para avisar cuando hay
 * una versión nueva (sin Service Worker).
 */
function buildVersion(): Plugin {
  const id = Date.now().toString(36)
  return {
    name: 'arca-build-version',
    config: () => ({ define: { __BUILD_ID__: JSON.stringify(id) } }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ id, builtAt: new Date().toISOString() }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    buildVersion(),
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
