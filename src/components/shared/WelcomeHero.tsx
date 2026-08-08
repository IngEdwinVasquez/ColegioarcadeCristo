import type { ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'

const useStyles = makeStyles({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '18px',
    padding: '28px',
    background: 'linear-gradient(120deg, #081F3E 0%, #0A274E 45%, #103F7E 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 12px 30px rgba(8,31,62,0.28)',
    marginBottom: '24px',
    '@media (max-width: 720px)': { padding: '20px', borderRadius: '14px' },
  },
  watermark: {
    position: 'absolute',
    right: '-60px',
    top: '-60px',
    opacity: 0.06,
    transform: 'rotate(8deg)',
    pointerEvents: 'none',
    '@media (max-width: 720px)': { display: 'none' },
  },
  content: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '720px', minWidth: '0px' },
  title: { fontWeight: 800, fontSize: '24px', color: '#fff', letterSpacing: '-0.01em', '@media (max-width: 720px)': { fontSize: '19px' } },
  sub: { color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, fontSize: '14px', '@media (max-width: 720px)': { fontSize: '12.5px' } },
  actions: { position: 'relative', display: 'flex', gap: '10px', flexWrap: 'wrap', '@media (max-width: 720px)': { width: '100%' } },
})

interface WelcomeHeroProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

function FlagMark() {
  return (
    <svg width="280" height="190" viewBox="0 0 72 48" className={undefined} aria-hidden>
      <rect width="72" height="48" fill="#fff" />
      <rect x="0" y="0" width="36" height="24" fill="#103F7E" />
      <rect x="36" y="24" width="36" height="24" fill="#103F7E" />
      <rect x="36" y="0" width="36" height="24" fill="#CE1126" />
      <rect x="0" y="24" width="36" height="24" fill="#CE1126" />
    </svg>
  )
}

export function WelcomeHero({ title, subtitle, actions }: WelcomeHeroProps) {
  const styles = useStyles()
  return (
    <div className={styles.hero}>
      <div className={styles.watermark}>{FlagMark()}</div>
      <div className={styles.content}>
        <Text size={500} className={styles.title}>{title}</Text>
        {subtitle && <Text size={300} className={styles.sub}>{subtitle}</Text>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
