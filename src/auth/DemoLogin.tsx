import type { ReactNode } from 'react'
import { Badge, Text, makeStyles } from '@fluentui/react-components'
import { PersonRegular, PersonSupportRegular, PeopleTeamRegular, PersonLockRegular, CrownRegular, ArrowRightRegular } from '@fluentui/react-icons'
import { useApp } from '../context/useApp'
import { ROLE_LABELS } from '../types/roles'
import type { Role } from '../types/roles'
import { AuthShell } from './AuthShell'

const useStyles = makeStyles({
  card: { width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px' },
  head: { display: 'flex', flexDirection: 'column', gap: '6px' },
  title: { fontWeight: 800, fontSize: '24px', color: 'var(--azul-oscuro)' },
  sub: { color: 'var(--texto-suave)', fontSize: '14px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid var(--borde)',
    background: '#fff',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
    ':hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(16,24,40,0.10)' },
  },
  icon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: '#fff',
    flexShrink: 0,
  },
  name: { fontWeight: 700, fontSize: '14px', color: 'var(--azul-oscuro)' },
  email: { fontSize: '12px', color: 'var(--texto-suave)' },
  arrow: { marginLeft: 'auto', color: 'var(--texto-suave)' },
})

const USER_ICONS: Record<string, ReactNode> = {
  'u-docente': <PersonSupportRegular />,
  'u-estudiante': <PersonRegular />,
  'u-padre': <PeopleTeamRegular />,
  'u-admin': <PersonLockRegular />,
  'u-superadmin': <CrownRegular />,
}

const USER_COLORS: Record<string, string> = {
  'u-docente': 'linear-gradient(135deg,#103F7E,#35679F)',
  'u-estudiante': 'linear-gradient(135deg,#A50E1E,#E53440)',
  'u-padre': 'linear-gradient(135deg,#14532D,#22C55E)',
  'u-admin': 'linear-gradient(135deg,#4C1D95,#7C3AED)',
  'u-superadmin': 'linear-gradient(135deg,#B45309,#F59E0B)',
}

const ROLE_COLORS: Record<Role, string> = {
  docente: '#103F7E',
  estudiante: '#C62828',
  padre: '#15803D',
  admin: '#6B21A8',
}

export function DemoLogin() {
  const styles = useStyles()
  const { users, loginAsDemo } = useApp()

  return (
    <AuthShell>
      <div className={styles.card}>
        <div className={styles.head}>
          <Badge color="warning" appearance="tint" style={{ alignSelf: 'flex-start' }}>Modo demostración</Badge>
          <Text className={styles.title}>Acceso al sistema</Text>
          <Text className={styles.sub}>Seleccione un usuario de demostración para explorar los portales del colegio.</Text>
        </div>
        <div className={styles.list}>
          {users.map((user) => (
            <div key={user.id} className={styles.userCard} onClick={() => loginAsDemo(user)}>
              <span className={styles.icon} style={{ background: USER_COLORS[user.id] ?? 'linear-gradient(135deg,#103F7E,#35679F)' }}>
                {USER_ICONS[user.id]}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className={styles.name}>{user.displayName}</div>
                <Badge appearance="filled" size="small" style={{ background: ROLE_COLORS[user.roles[0]], color: '#fff', marginTop: '3px' }}>
                  {ROLE_LABELS[user.roles[0]]}{user.roles.length > 1 ? ` +${user.roles.length - 1}` : ''}
                </Badge>
                <div className={styles.email}>{user.email}</div>
              </div>
              <ArrowRightRegular className={styles.arrow} />
            </div>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}
