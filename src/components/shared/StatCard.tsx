import type { ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    background: 'var(--superficie)',
    borderRadius: '14px',
    border: '1px solid var(--borde)',
    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    ':hover': { boxShadow: '0 8px 24px rgba(16,24,40,0.10)', transform: 'translateY(-2px)' },
  },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  label: { fontSize: '12.5px', fontWeight: 700, color: 'var(--texto-suave)', letterSpacing: '0.02em' },
  icon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    color: '#fff',
    flexShrink: 0,
  },
  value: { fontSize: '30px', fontWeight: 800, color: 'var(--azul-oscuro)', letterSpacing: '-0.02em', lineHeight: 1 },
  sub: { fontSize: '12.5px', color: 'var(--texto-suave)', lineHeight: 1.4 },
})

interface StatCardProps {
  title: string
  value: ReactNode
  icon: ReactNode
  color: string
  sub?: ReactNode
  gradient?: string
}

export function StatCard({ title, value, icon, color, sub, gradient }: StatCardProps) {
  const styles = useStyles()
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <Text size={300} className={styles.label}>{title}</Text>
        <span className={styles.icon} style={{ background: gradient ?? color }}>{icon}</span>
      </div>
      <div className={styles.value}>{value}</div>
      {sub && <Text size={200} className={styles.sub}>{sub}</Text>}
    </div>
  )
}
