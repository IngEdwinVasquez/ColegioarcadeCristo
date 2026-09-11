import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, makeStyles } from '@fluentui/react-components'
import { ArrowRightRegular, CalendarLtrRegular } from '@fluentui/react-icons'
import { PORTALS } from '../portals/portals'
import { useApp } from '../context/useApp'
import { appConfig } from '../config/appConfig'
import { BrandLogo } from '../components/shared/BrandLogo'
import { AiSettingsCard } from '../components/shared/AiSettings'
import { initials } from '../utils/helpers'

const HIPSTER_HEX = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5-13-7.5v-15l13-7.5zM3 17.75v15l10.99 6.2 10.99-6.2v-15L13.99 9.25 3 17.75z'/%3E%3C/g%3E%3C/svg%3E\")"

const useStyles = makeStyles({
  root: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #005F8C 0%, #0082AD 48%, #2AA9D8 100%)',
    color: '#fff',
  },
  hex: { position: 'fixed', inset: 0, backgroundImage: HIPSTER_HEX, backgroundSize: '28px 49px', opacity: 0.9, pointerEvents: 'none', zIndex: 0 },
  dots: { position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none', zIndex: 0 },
  orb: {
    position: 'fixed',
    borderRadius: '50%',
    filter: 'blur(60px)',
    opacity: 0.5,
    pointerEvents: 'none',
    zIndex: 0,
  },
  orbLight: { width: '420px', height: '420px', top: '-140px', right: '-90px', background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)' },
  orbRed: { width: '320px', height: '320px', bottom: '-120px', left: '-80px', background: 'radial-gradient(circle, rgba(230,35,39,0.35) 0%, rgba(230,35,39,0) 70%)' },
  building: {
    position: 'fixed',
    right: '-40px',
    bottom: '-30px',
    width: '42vw',
    maxWidth: '620px',
    opacity: 0.14,
    pointerEvents: 'none',
    zIndex: 0,
    filter: 'grayscale(1) brightness(1.15)',
  },
  topbar: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 26px',
    background: 'rgba(255,255,255,0.09)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.14)',
    flexWrap: 'wrap',
    '@media (max-width: 720px)': { padding: '10px 14px', gap: '10px' },
  },
  brand: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0px' },
  brandLogoWrap: { background: '#fff', borderRadius: '12px', padding: '5px', boxShadow: '0 6px 16px rgba(0,0,0,0.2)', lineHeight: 0 },
  brandName: { fontWeight: 800, fontSize: '17px', color: '#fff', lineHeight: 1.1, letterSpacing: '0.01em' },
  brandSub: { fontWeight: 600, fontSize: '11px', color: '#9CE0F5', letterSpacing: '0.12em', textTransform: 'uppercase' },
  center: {
    display: 'none',
    '@media (min-width: 900px)': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '9px',
      background: '#fff',
      color: '#0082AD',
      borderRadius: '12px',
      padding: '10px 20px',
      fontWeight: 700,
      fontSize: '14px',
      boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
    },
  },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0px' },
  userName: {
    fontWeight: 600,
    fontSize: '13.5px',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '@media (max-width: 720px)': { display: 'none' },
  },
  logoutBtn: {
    background: '#E62327',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '10px',
    padding: '9px 18px',
    fontWeight: 700,
    fontSize: '13.5px',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    ':hover': { background: '#C21E22' },
    ':active': { transform: 'translateY(1px)' },
  },
  hero: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    padding: '52px 24px 20px',
    '@media (max-width: 720px)': { padding: '36px 16px 12px' },
  },
  heroKicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: '999px',
    padding: '7px 16px',
    fontSize: '12.5px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    marginBottom: '18px',
    backdropFilter: 'blur(6px)',
  },
  title: {
    fontWeight: 800,
    fontSize: '42px',
    letterSpacing: '0.01em',
    lineHeight: 1.05,
    color: '#fff',
    margin: 0,
    '@media (max-width: 720px)': { fontSize: '30px' },
  },
  titleAccent: { color: '#9CE0F5' },
  sub: { color: 'rgba(255,255,255,0.85)', margin: '12px auto 0', maxWidth: '640px', lineHeight: 1.6, fontSize: '15px' },
  gridWrap: { position: 'relative', zIndex: 1, maxWidth: '1160px', width: '100%', margin: '16px auto 72px', padding: '0 24px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '18px',
    '@media (min-width: 481px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
    '@media (min-width: 1025px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  },
  card: {
    background: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(8px)',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.6)',
    borderTop: '4px solid transparent',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    cursor: 'pointer',
    minHeight: '230px',
    color: 'var(--azul-oscuro)',
    boxShadow: '0 10px 30px rgba(4,54,80,0.25)',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-top-color 0.28s ease',
    ':hover': {
      transform: 'translateY(-6px)',
      borderTopColor: '#E62327',
      boxShadow: '0 20px 46px rgba(4,54,80,0.35)',
    },
    ':hover $icon': { transform: 'scale(1.06) rotate(-3deg)' },
    ':hover $cta': { color: '#E62327' },
    ':hover $arrow': { transform: 'translateX(5px)' },
  },
  icon: {
    width: '54px',
    height: '54px',
    borderRadius: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(0,0,0,0.16)',
    transition: 'transform 0.28s ease',
  },
  cardTitle: { fontWeight: 800, fontSize: '18px', letterSpacing: '-0.01em' },
  cardDesc: { fontSize: '13.5px', color: 'var(--texto-suave)', lineHeight: 1.65, flex: 1 },
  cta: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontWeight: 800,
    fontSize: '13.5px',
    color: '#0082AD',
    letterSpacing: '0.01em',
    transition: 'color 0.28s ease',
  },
  arrow: { transition: 'transform 0.28s ease' },
})

export function PortalSelector() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { role, setRole, effectiveRoles, user, logout } = useApp()

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

  return (
    <div className={styles.root}>
      <div className={styles.hex} />
      <div className={styles.dots} />
      <span className={`${styles.orb} ${styles.orbLight}`} />
      <span className={`${styles.orb} ${styles.orbRed}`} />
      <img src="/images/edificio.jpg" alt="" className={styles.building} />

      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandLogoWrap}>
            <BrandLogo size={42} />
          </div>
          <div style={{ minWidth: '0px' }}>
            <div className={styles.brandName}>{appConfig.shortName}</div>
            <div className={styles.brandSub}>Plataforma Virtual</div>
          </div>
        </div>

        <div className={styles.center}>
          <CalendarLtrRegular /> Calendario Académico
        </div>

        <div className={styles.userArea}>
          <Avatar name={user?.displayName} image={user?.photoUrl ? { src: user.photoUrl } : undefined} initials={initials(user?.displayName ?? '?')} color="colorful" size={32} />
          <span className={styles.userName}>{user?.displayName}</span>
          <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>Salir</button>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroKicker}>{appConfig.motto} · {appConfig.founded}</div>
        <h1 className={styles.title}>
          PLATAFORMA <span className={styles.titleAccent}>VIRTUAL</span>
        </h1>
        <p className={styles.sub}>
          {appConfig.institution} · {appConfig.city} · Elige el portal al que deseas acceder
        </p>
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

        <div style={{ marginTop: '20px' }}>
          <AiSettingsCard />
        </div>
      </div>
    </div>
  )
}
