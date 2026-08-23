import { useState } from 'react'
import { Button, Spinner, Text, makeStyles } from '@fluentui/react-components'
import { PersonLockRegular } from '@fluentui/react-icons'
import { useApp } from '../context/useApp'
import { AuthShell } from './AuthShell'

const useStyles = makeStyles({
  card: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    alignItems: 'center',
    textAlign: 'center',
    background: '#fff',
    border: '1px solid var(--borde)',
    borderRadius: '18px',
    padding: '40px 32px',
    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
  },
  title: { fontWeight: 800, fontSize: '22px', color: 'var(--azul-oscuro)' },
  sub: { color: 'var(--texto-suave)', fontSize: '14px', lineHeight: 1.6 },
  error: { color: '#B42318', fontSize: '13px' },
})

export function M365Login() {
  const styles = useStyles()
  const { signIn } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className={styles.card}>
        <Text className={styles.title}>Inicie sesión con su cuenta institucional</Text>
        <Text className={styles.sub}>
          Acceso con inicio de sesión único de Microsoft Entra ID. Utilice su cuenta de Microsoft 365 del colegio.
        </Text>
        <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <PersonLockRegular />} onClick={() => void handleLogin()} size="large" disabled={busy}>
          {busy ? 'Redirigiendo a Microsoft…' : 'Iniciar sesión con Microsoft'}
        </Button>
        {error && <Text className={styles.error}>{error}</Text>}
      </div>
    </AuthShell>
  )
}
