import type { ReactNode } from 'react'
import { Text, makeStyles } from '@fluentui/react-components'
import { CallRegular, LocationRegular, MailRegular, CameraRegular, GlobeRegular } from '@fluentui/react-icons'
import { BrandLogo } from '../components/shared/BrandLogo'
import { appConfig } from '../config/appConfig'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'row',
    background: '#fff',
    '@media (max-width: 900px)': { flexDirection: 'column' },
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    flex: '0 0 46%',
    minHeight: '100vh',
    backgroundImage: 'url(/images/hero-educativo.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#fff',
    padding: '48px 44px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '32px',
    '@media (max-width: 900px)': { flex: '0 0 auto', minHeight: 'auto', padding: '36px 24px 44px' },
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(200deg, rgba(0,84,110,0.92) 0%, rgba(0,130,173,0.82) 52%, rgba(27,164,206,0.78) 100%)',
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(52px)',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  orbLight: { width: '340px', height: '340px', top: '-120px', left: '-80px', background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)' },
  orbRed: { width: '280px', height: '280px', bottom: '-90px', right: '-60px', background: 'radial-gradient(circle, rgba(230,35,39,0.45) 0%, rgba(230,35,39,0) 70%)' },
  brandRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' },
  brandName: { fontWeight: 800, fontSize: '22px', color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.25 },
  brandInstitution: { color: 'rgba(255,255,255,0.72)', fontSize: '12.5px', marginTop: '2px' },
  heroMain: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '460px' },
  heroTitle: {
    fontWeight: 800,
    fontSize: '31px',
    lineHeight: 1.22,
    color: '#fff',
    borderLeft: '4px solid #E62327',
    paddingLeft: '18px',
    '@media (max-width: 900px)': { fontSize: '23px' },
  },
  heroTagline: { color: 'rgba(255,255,255,0.82)', fontSize: '15px', lineHeight: 1.65 },
  contactList: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '11px' },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    fontSize: '13.5px',
    color: 'rgba(255,255,255,0.92)',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '12px',
    padding: '9px 14px',
    backdropFilter: 'blur(6px)',
  },
  contactIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    background: '#0082AD',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
  },
  panel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background:
      'radial-gradient(1200px 700px at 90% -10%, rgba(0,130,173,0.10) 0%, rgba(255,255,255,0) 60%), var(--fondo)',
  },
})

interface AuthShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  const styles = useStyles()
  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.overlay} />
        <span className={`${styles.orb} ${styles.orbLight}`} />
        <span className={`${styles.orb} ${styles.orbRed}`} />
        <div className={styles.brandRow}>
          <BrandLogo size={64} />
          <div>
            <div className={styles.brandName}>{appConfig.appName}</div>
            <div className={styles.brandInstitution}>{appConfig.motto} · desde {appConfig.founded} · {appConfig.city}</div>
          </div>
        </div>

        <div className={styles.heroMain}>
          <Text className={styles.heroTitle}>{title ?? 'Bienvenido a nuestra comunidad educativa'}</Text>
          <Text className={styles.heroTagline}>{subtitle ?? appConfig.tagline}</Text>
        </div>

        <div className={styles.contactList}>
          <div className={styles.contactRow}>
            <span className={styles.contactIcon}><LocationRegular /></span>
            {appConfig.contact.address}
          </div>
          <div className={styles.contactRow}>
            <span className={styles.contactIcon}><CallRegular /></span>
            {appConfig.contact.phone}
          </div>
          <div className={styles.contactRow}>
            <span className={styles.contactIcon}><MailRegular /></span>
            {appConfig.contact.email}
          </div>
          <div className={styles.contactRow}>
            <span className={styles.contactIcon}><CameraRegular /></span>
            {appConfig.contact.instagram}
          </div>
          <div className={styles.contactRow}>
            <span className={styles.contactIcon}><GlobeRegular /></span>
            {appConfig.contact.website}
          </div>
        </div>
      </div>

      <div className={styles.panel}>{children}</div>
    </div>
  )
}
