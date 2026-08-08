import type { ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'

const useStyles = makeStyles({
  root: {
    padding: '6px 0 20px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  titles: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0px', flex: '1 1 300px' },
  title: { fontWeight: 800, color: 'var(--azul-oscuro)', letterSpacing: '-0.01em', fontSize: '22px', '@media (max-width: 640px)': { fontSize: '18px' } },
  sub: { color: 'var(--texto-suave)', maxWidth: '760px', lineHeight: 1.5, fontSize: '13px' },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    '@media (max-width: 640px)': { width: '100%', justifyContent: 'flex-start' },
  },
})

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const styles = useStyles()
  return (
    <div className={styles.root}>
      <div className={styles.titles}>
        <Text size={700} className={styles.title}>{title}</Text>
        {subtitle && (
          <Text size={300} className={styles.sub}>{subtitle}</Text>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
