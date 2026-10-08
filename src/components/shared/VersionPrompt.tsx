import { useEffect, useState } from 'react'
import { Button, Text, makeStyles } from '@fluentui/react-components'
import { ArrowSyncRegular } from '@fluentui/react-icons'

const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

const useStyles = makeStyles({
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '12px 20px',
    background: '#0A1F2B',
    borderTop: '3px solid #0082AD',
    boxShadow: '0 -6px 20px rgba(0,0,0,0.25)',
    flexWrap: 'wrap',
    '@media (max-width: 640px)': { padding: '10px 14px', gap: '10px' },
  },
  text: { color: '#fff', fontWeight: 600, fontSize: '14px' },
})

/**
 * Avisa cuando hay una nueva versión del sistema disponible y ofrece actualizarla.
 * No usa Service Worker: compara la marca de versión del build (`/version.json`),
 * de modo que nunca se sirve contenido viejo desde caché.
 */
export function VersionPrompt() {
  const styles = useStyles()
  const [nueva, setNueva] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const j = (await r.json()) as { id?: string }
        if (alive && j?.id && j.id !== BUILD_ID) setNueva(true)
      } catch {
        /* sin conexión o sin version.json */
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!nueva) return null

  return (
    <div className={styles.bar}>
      <Text className={styles.text}>Hay una nueva versión del sistema disponible.</Text>
      <Button size="small" appearance="primary" icon={<ArrowSyncRegular />} onClick={() => window.location.reload()}>
        Actualizar ahora
      </Button>
    </div>
  )
}
