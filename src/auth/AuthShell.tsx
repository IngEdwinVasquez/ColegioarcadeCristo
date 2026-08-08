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
    background: 'linear-gradient(200deg, rgba(5,20,40,0.88) 0%, rgba(8,31,62,0.72) 45%, rgba(16,63,126,0.55) 100%)',
  },
  brandRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: '18px' },
  brandName: { fontWeight: 800, fontSize: '22px', color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.25 },
  brandInstitution: { color: 'rgba(255,255,255,0.65)', fontSize: '12.5px', marginTop: '2px' },
  heroMain: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '460px' },
  heroTitle: { fontWeight: 800, fontSize: '30px', lineHeight: 1.25, color: '#fff', '@media (max-width: 900px)': { fontSize: '22px' } },
  heroTagline: { color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: 1.6 },
  contactList: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' },
  contactRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' },
  contactIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  panel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background: 'var(--fondo)',
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
        <div className={styles.brandRow}>
          <BrandLogo size={64} />
          <div>
            <div className={styles.brandName}>{appConfig.appName}</div>
            <div className={styles.brandInstitution}>{appConfig.city}</div>
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
