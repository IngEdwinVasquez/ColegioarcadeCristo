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
    background: `
      linear-gradient(160deg, rgba(8,31,62,0.92) 0%, rgba(10,39,78,0.85) 40%, rgba(16,63,126,0.78) 80%),
      radial-gradient(ellipse at 20% 80%, rgba(201,162,39,0.25) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(201,162,39,0.15) 0%, transparent 50%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 1024'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M60 0L0 0 0 60' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3Ccircle cx='1200' cy='800' r='40' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3Ccircle cx='1190' cy='790' r='55' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3Ccircle cx='1180' cy='780' r='70' fill='none' stroke='rgba(255,255,255,0.02)' stroke-width='1'/%3E%3Ccircle cx='180' cy='200' r='30' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3Ccircle cx='170' cy='190' r='45' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3Ctext x='1180' y='790' font-family='Georgia' font-size='16' fill='rgba(255,255,255,0.04)'%3E%E2%9C%A6%3C/text%3E%3Ctext x='900' y='900' font-family='Georgia' font-size='24' fill='rgba(255,255,255,0.03)'%3E%E2%9C%A6%3C/text%3E%3Ctext x='300' y='180' font-family='Georgia' font-size='20' fill='rgba(255,255,255,0.04)'%3E%E2%9C%A6%3C/text%3E%3Ctext x='1050' y='250' font-family='Georgia' font-size='14' fill='rgba(255,255,255,0.03)'%3E%E2%9C%A6%3C/text%3E%3C/svg%3E")
    `,
    backgroundSize: 'cover, cover, cover, cover',
    backgroundPosition: 'center',
    color: '#fff',
    padding: '48px 44px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '32px',
    '@media (max-width: 900px)': { flex: '0 0 auto', minHeight: 'auto', padding: '36px 24px 44px' },
  },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    opacity: 0.5,
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
