import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Text, makeStyles } from '@fluentui/react-components'
import { ArrowRightRegular } from '@fluentui/react-icons'
import { PORTALS } from '../portals/portals'
import { useApp } from '../context/useApp'
import { appConfig } from '../config/appConfig'
import { ROLE_LABELS, ROLE_PATHS } from '../types/roles'
import { BrandLogo } from '../components/shared/BrandLogo'

const useStyles = makeStyles({
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--fondo)' },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #0A1F2B 0%, #0B2E3F 45%, #0095C8 100%)',
    padding: '64px 24px 72px',
    color: '#fff',
    textAlign: 'center',
    '@media (max-width: 720px)': { padding: '44px 16px 56px' },
  },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    opacity: 0.5,
  },
  flag: { width: '64px', height: '43px', borderRadius: '6px', margin: '0 auto 18px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' },
  title: {
    fontWeight: 800,
    fontSize: '30px',
    letterSpacing: '-0.01em',
    color: '#fff',
    margin: 0,
    overflowWrap: 'break-word',
    '@media (max-width: 720px)': { fontSize: '22px' },
    '@media (max-width: 380px)': { fontSize: '18px' },
  },
  sub: { color: 'rgba(255,255,255,0.7)', margin: '10px auto 0', maxWidth: '620px', lineHeight: 1.6 },
  gridWrap: {
    maxWidth: '1120px',
    width: '100%',
    margin: '-34px auto 0',
    padding: '0 24px 56px',
    position: 'relative',
    '@media (max-width: 720px)': { padding: '0 16px 40px' },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '18px',
    '@media (min-width: 481px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
    '@media (min-width: 1025px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid var(--borde)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    cursor: 'pointer',
    minHeight: '240px',
    boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 32px rgba(16,24,40,0.12)' },
  },
  icon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    color: '#fff',
  },
  cardTitle: { fontWeight: 700, fontSize: '17px', color: 'var(--azul-oscuro)' },
  cardDesc: { fontSize: '13.5px', color: 'var(--texto-suave)', lineHeight: 1.6, flex: 1 },
  cta: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13.5px' },
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
  const { role, setRole, user } = useApp()

  const allowed = useMemo(() => {
    const roles = user?.roles ?? []
    if (roles.length === 0) return PORTALS
    return PORTALS.filter((p) => roles.includes(p.role))
  }, [user])

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
      <div className={styles.hero}>
        <div className={styles.heroGrid} />
        <div style={{ position: 'relative' }}>
          <BrandLogo size={72} />
        </div>
        <h1 className={styles.title}>{appConfig.appName}</h1>
        <p className={styles.sub}>{appConfig.institution} · {appConfig.city}</p>
        <Text size={300} style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: '10px' }}>
          {allowed.length === 1 ? 'Redirigiendo…' : 'Seleccione el portal al que desea acceder'}
        </Text>
        {role && (
          <Button appearance="secondary" icon={<ArrowRightRegular />} className={styles.continue} onClick={() => navigate(pathOfRole(role))}>
            Continuar como {ROLE_LABELS[role]}
          </Button>
        )}
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
              <div className={styles.cta} style={{ color: portal.accent }}>
                {role === portal.role ? 'Portal activo' : 'Acceder'} <ArrowRightRegular />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
