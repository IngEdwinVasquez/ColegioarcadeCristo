import { useEffect } from 'react'
import { Button, Text, makeStyles } from '@fluentui/react-components'
import { PersonLockRegular } from '@fluentui/react-icons'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from '../services/msal'
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
})

export function M365Login() {
  const styles = useStyles()
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const { setCurrentUser } = useApp()
  const account = accounts[0]

  useEffect(() => {
    if (isAuthenticated && account) {
      instance.setActiveAccount(account)
      setCurrentUser({
        id: account.homeAccountId,
        displayName: account.name ?? 'Usuario institucional',
        email: account.username,
        roles: [],
      })
    }
  }, [isAuthenticated, account, instance, setCurrentUser])

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest)
    } catch (error) {
      console.error('Error de inicio de sesión', error)
    }
  }

  return (
    <AuthShell>
      <div className={styles.card}>
        <Text className={styles.title}>Inicie sesión con su cuenta institucional</Text>
        <Text className={styles.sub}>
          Utilice el inicio de sesión único de Microsoft Entra ID para acceder a los portales del colegio.
        </Text>
        <Button appearance="primary" icon={<PersonLockRegular />} onClick={handleLogin} size="large">
          Iniciar sesión con Microsoft
        </Button>
      </div>
    </AuthShell>
  )
}
