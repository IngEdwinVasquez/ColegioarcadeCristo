import { useState } from 'react'
import { Spinner, Text, makeStyles } from '@fluentui/react-components'
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
    borderTop: '3px solid #E62327',
    borderRadius: '18px',
    padding: '40px 32px',
    boxShadow: '0 8px 28px rgba(0,130,173,0.12)',
  },
  title: { fontWeight: 800, fontSize: '22px', color: 'var(--azul-oscuro)' },
  sub: { color: 'var(--texto-suave)', fontSize: '14px', lineHeight: 1.6 },
  error: { color: '#B42318', fontSize: '13px' },
  microsoftBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#0082AD',
    borderRadius: '8px',
    padding: '13px 26px',
    transition: 'background-color 0.3s ease, transform 0.1s ease',
    ':hover': { background: '#E62327' },
    ':active': { background: '#C21E22', transform: 'translateY(1px)' },
    ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
  },
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
        <button type="button" className={styles.microsoftBtn} onClick={() => void handleLogin()} disabled={busy}>
          {busy ? <Spinner size="tiny" /> : <PersonLockRegular />}
          {busy ? 'Redirigiendo a Microsoft…' : 'Iniciar sesión con Microsoft'}
        </button>
        {error && <Text className={styles.error}>{error}</Text>}
      </div>
    </AuthShell>
  )
}
