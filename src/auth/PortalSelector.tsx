import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Text, makeStyles } from '@fluentui/react-components'
import { ArrowRightRegular, HatGraduationRegular } from '@fluentui/react-icons'
import { PORTALS } from '../portals/portals'
import { useApp } from '../context/useApp'
import { appConfig } from '../config/appConfig'
import { ROLE_LABELS, ROLE_PATHS } from '../types/roles'
import { BrandLogo } from '../components/shared/BrandLogo'

const useStyles = makeStyles({
  root: { position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F8FB' },
  pageBg: {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    backgroundImage: 'url(/images/edificio.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(10px) brightness(1.05)',
    opacity: 0.16,
    pointerEvents: 'none',
  },
  hero: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    background: 'linear-gradient(150deg, #005A7A 0%, #0082AD 48%, #1FB6D8 100%)',
    padding: '64px 24px 88px',
    color: '#fff',
    textAlign: 'center',
    '@media (max-width: 720px)': { padding: '44px 16px 60px' },
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(46px)',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  orbLight: { width: '360px', height: '360px', top: '-130px', left: '-90px', background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)' },
  orbRed: { width: '300px', height: '300px', bottom: '-120px', right: '-70px', background: 'radial-gradient(circle, rgba(230,35,39,0.55) 0%, rgba(230,35,39,0) 70%)' },
  orbTeal: { width: '220px', height: '220px', top: '40px', right: '16%', background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)' },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
    backgroundSize: '30px 30px',
    opacity: 0.45,
  },
  heroInner: { position: 'relative' },
  logoWrap: {
    display: 'inline-flex',
    position: 'relative',
    margin: '0 auto 20px',
  },
  logoGlow: {
    position: 'absolute',
    inset: '-14px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: '999px',
    padding: '7px 16px',
    marginBottom: '18px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    backdropFilter: 'blur(6px)',
  },
  title: {
    fontWeight: 800,
    fontSize: '32px',
    letterSpacing: '-0.015em',
    color: '#fff',
    margin: 0,
    lineHeight: 1.15,
    overflowWrap: 'break-word',
    '@media (max-width: 720px)': { fontSize: '24px' },
    '@media (max-width: 380px)': { fontSize: '19px' },
  },
  sub: { color: 'rgba(255,255,255,0.82)', margin: '12px auto 0', maxWidth: '640px', lineHeight: 1.65, fontSize: '15px' },
  gridWrap: {
    maxWidth: '1140px',
    width: '100%',
    margin: '-30px auto 0',
    padding: '0 24px 60px',
    position: 'relative',
    zIndex: 1,
    '@media (max-width: 720px)': { padding: '0 16px 44px' },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '20px',
    '@media (min-width: 481px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
    '@media (min-width: 1025px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  },
  card: {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)',
    borderRadius: '18px',
    border: '1px solid rgba(226,232,240,0.9)',
    borderTop: '3px solid transparent',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    cursor: 'pointer',
    minHeight: '250px',
    boxShadow: '0 6px 20px rgba(15,23,42,0.06)',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-top-color 0.28s ease',
    ':hover': {
      transform: 'translateY(-6px)',
      borderTopColor: '#E62327',
      boxShadow: '0 18px 40px rgba(0,130,173,0.18)',
    },
    ':hover $icon': { transform: 'scale(1.06) rotate(-3deg)' },
    ':hover $cta': { color: '#E62327' },
    ':hover $arrow': { transform: 'translateX(5px)' },
  },
  icon: {
    width: '54px',
    height: '54px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(0,0,0,0.14)',
    transition: 'transform 0.28s ease',
  },
  cardTitle: { fontWeight: 700, fontSize: '18px', color: 'var(--azul-oscuro)', letterSpacing: '-0.01em' },
  cardDesc: { fontSize: '13.5px', color: 'var(--texto-suave)', lineHeight: 1.65, flex: 1 },
  cta: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontWeight: 700,
    fontSize: '13.5px',
    color: '#0082AD',
    letterSpacing: '0.01em',
    transition: 'color 0.28s ease',
  },
  arrow: { transition: 'transform 0.28s ease' },
  continue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '22px',
    background: '#fff',
    color: 'var(--azul)',
    fontWeight: 600,
  },
})

export function PortalSelector() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { role, setRole, effectiveRoles } = useApp()

  const allowed = useMemo(() => {
    if (effectiveRoles.length === 0) return PORTALS
    return PORTALS.filter((p) => effectiveRoles.includes(p.role))
  }, [effectiveRoles])

  useEffect(() => {
    if (allowed.length === 1) {
      const portal = allowed[0]
      setRole(portal.role)
      navigate(portal.path, { replace: true })
    }
  }, [allowed, navigate, setRole])

  const enter = (path: string, portalRole: Parameters<typeof setRole>[0]) => {
    setRole(portalRole)
    navigate(path)
  }

  const pathOfRole = (r: NonNullable<typeof role>) => ROLE_PATHS[r]

  return (
    <div className={styles.root}>
      <div className={styles.pageBg} />
      <div className={styles.hero}>
        <span className={`${styles.orb} ${styles.orbLight}`} />
        <span className={`${styles.orb} ${styles.orbRed}`} />
        <span className={`${styles.orb} ${styles.orbTeal}`} />
        <div className={styles.heroGrid} />
        <div className={styles.heroInner}>
          <div className={styles.logoWrap}>
            <span className={styles.logoGlow} />
            <BrandLogo size={76} />
          </div>
          <div className={styles.chip}><HatGraduationRegular /> {appConfig.motto} · {appConfig.founded}</div>
          <h1 className={styles.title}>{appConfig.appName}</h1>
          <p className={styles.sub}>{appConfig.institution} · {appConfig.city}</p>
          <Text size={300} style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginTop: '10px' }}>
            {allowed.length === 1 ? 'Redirigiendo…' : 'Seleccione el portal al que desea acceder'}
          </Text>
          {role && (
            <Button appearance="secondary" icon={<ArrowRightRegular />} className={styles.continue} onClick={() => navigate(pathOfRole(role))}>
              Continuar como {ROLE_LABELS[role]}
            </Button>
          )}
        </div>
      </div>

      <div className={styles.gridWrap}>
        <div className={styles.grid}>
          {allowed.map((portal) => (
            <div key={portal.role} className={styles.card} onClick={() => enter(portal.path, portal.role)}>
              <span className={styles.icon} style={{ background: `linear-gradient(135deg, ${portal.accent}, ${portal.accent}cc)` }}>
                {portal.icon}
              </span>
              <div className={styles.cardTitle}>{portal.title}</div>
              <div className={styles.cardDesc}>{portal.description}</div>
              <div className={styles.cta}>
                {role === portal.role ? 'Portal activo' : 'Acceder'} <ArrowRightRegular className={styles.arrow} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
