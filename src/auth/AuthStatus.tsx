import { Button, Spinner, Text, makeStyles } from '@fluentui/react-components'
import { ArrowClockwiseRegular, SignOutRegular, ShieldErrorRegular, PersonQuestionMarkRegular } from '@fluentui/react-icons'
import { useApp } from '../context/useApp'
import { appConfig } from '../config/appConfig'
import { AuthShell } from './AuthShell'

const useStyles = makeStyles({
  card: {
    width: '100%',
    maxWidth: '460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
    textAlign: 'center',
    background: '#fff',
    border: '1px solid var(--borde)',
    borderRadius: '18px',
    padding: '40px 32px',
    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
  },
  icon: { fontSize: '40px', color: 'var(--azul)' },
  title: { fontWeight: 800, fontSize: '20px', color: 'var(--azul-oscuro)' },
  sub: { color: 'var(--texto-suave)', fontSize: '14px', lineHeight: 1.6 },
  hint: {
    fontSize: '13px',
    color: '#7A5C00',
    background: '#FFF8E1',
    border: '1px solid #FFE08A',
    borderRadius: '10px',
    padding: '10px 12px',
    textAlign: 'left',
    width: '100%',
  },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' },
})

export function AuthLoading() {
  const styles = useStyles()
  return (
    <AuthShell title="Conectando con Microsoft 365" subtitle="Verificando su identidad y cargando los datos institucionales…">
      <div className={styles.card}>
        <Spinner size="large" label="Preparando su sesión…" />
      </div>
    </AuthShell>
  )
}

export function AccessPending() {
  const styles = useStyles()
  const { user, logout, retry } = useApp()
  return (
    <AuthShell title="Acceso pendiente de asignación" subtitle="Su cuenta es válida, pero aún no tiene un rol asignado en la intranet.">
      <div className={styles.card}>
        <PersonQuestionMarkRegular className={styles.icon} />
        <Text className={styles.title}>Hola, {user?.displayName}</Text>
        <Text className={styles.sub}>
          Su cuenta <strong>{user?.email}</strong> inició sesión correctamente, pero todavía no tiene un rol (docente, estudiante, padre o administrativo).
          Solicite a la Dirección que le asigne el rol desde el módulo <em>Usuarios y roles</em>.
        </Text>
        <div className={styles.actions}>
          <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={retry}>Volver a comprobar</Button>
          <Button appearance="secondary" icon={<SignOutRegular />} onClick={() => void logout()}>Cerrar sesión</Button>
        </div>
      </div>
    </AuthShell>
  )
}

export function SetupError() {
  const styles = useStyles()
  const { setupIssue, logout, retry } = useApp()
  return (
    <AuthShell title="Configuración de Microsoft 365" subtitle={`La intranet de ${appConfig.shortName} necesita completar su configuración.`}>
      <div className={styles.card}>
        <ShieldErrorRegular className={styles.icon} style={{ color: '#B42318' }} />
        <Text className={styles.title}>{setupIssue?.title ?? 'No se pudo iniciar'}</Text>
        <Text className={styles.sub}>{setupIssue?.message}</Text>
        {setupIssue?.hint && <div className={styles.hint}>{setupIssue.hint}</div>}
        <div className={styles.actions}>
          <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={retry}>Reintentar</Button>
          <Button appearance="secondary" icon={<SignOutRegular />} onClick={() => void logout()}>Cerrar sesión</Button>
        </div>
      </div>
    </AuthShell>
  )
}
