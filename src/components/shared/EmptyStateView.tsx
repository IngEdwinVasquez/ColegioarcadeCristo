import type { ReactNode } from 'react'
import { Text, makeStyles, tokens } from '@fluentui/react-components'
import { DocumentSearchRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: { padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  icon: { fontSize: '44px', color: tokens.colorBrandForeground2 },
  title: { fontWeight: 700 },
  note: { color: tokens.colorNeutralForeground2 },
})

interface EmptyProps {
  title?: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyStateView({ title = 'Sin registros', message = 'No hay información que mostrar aún.', icon, action }: EmptyProps) {
  const styles = useStyles()
  return (
    <div className={styles.root}>
      <span className={styles.icon}>{icon ?? <DocumentSearchRegular />}</span>
      <Text size={500} className={styles.title}>{title}</Text>
      <Text size={300} className={styles.note}>{message}</Text>
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  )
}
