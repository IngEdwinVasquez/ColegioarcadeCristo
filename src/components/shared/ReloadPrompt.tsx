import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button, Text, makeStyles } from '@fluentui/react-components'
import { ArrowSyncRegular } from '@fluentui/react-icons'

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

/** Muestra un aviso cuando hay una nueva versión del sitio (PWA / Service Worker). */
export function ReloadPrompt() {
  const styles = useStyles()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) {
        // Comprueba si hay actualizaciones cada hora (además del check al navegar).
        setInterval(() => {
          reg.update?.()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError() {
      /* la app sigue funcionando sin SW */
    },
  })

  const close = () => setOfflineReady(false)

  if (offlineReady) {
    return (
      <div className={styles.bar}>
        <Text className={styles.text}>Listo para trabajar sin conexión. </Text>
        <Button size="small" appearance="secondary" onClick={close}>Cerrar</Button>
      </div>
    )
  }

  if (needRefresh) {
    return (
      <div className={styles.bar}>
        <Text className={styles.text}>Hay una nueva versión del sitio disponible.</Text>
        <Button size="small" appearance="primary" icon={<ArrowSyncRegular />} onClick={() => updateServiceWorker(true)}>
          Recargar
        </Button>
      </div>
    )
  }

  return null
}
