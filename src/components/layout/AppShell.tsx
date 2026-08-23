import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Text,
  makeStyles,
} from '@fluentui/react-components'
import { NavigationRegular, SignOutRegular, HomeRegular, ChevronRightRegular, LightbulbFilamentRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { appConfig } from '../../config/appConfig'
import { PORTALS } from '../../portals/portals'
import { initials } from '../../utils/helpers'
import { InstallPWA } from '../shared/InstallPWA'
import { BrandLogo } from '../shared/BrandLogo'
import { GuidedTour, type TourStep } from '../shared/GuidedTour'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  group?: string
}

const useStyles = makeStyles({
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--fondo)' },
  sidebar: {
    display: 'none',
    '@media (min-width: 940px)': { display: 'flex' },
  },
  sideInner: {
    width: '264px',
    height: '100vh',
    position: 'sticky',
    top: '0px',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #0A1F2B 0%, #0B2E3F 100%)',
    color: '#fff',
    overflowY: 'auto',
  },
  sideHeader: {
    padding: '22px 18px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  flag: { width: '40px', height: '27px', borderRadius: '4px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },
  sideTitle: { fontWeight: 800, letterSpacing: '0.01em', fontSize: '14px', color: '#fff' },
  sideSub: { fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' },
  nav: { flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' },
  groupLabel: {
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    padding: '14px 12px 6px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    padding: '10px 12px',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.78)',
    textDecoration: 'none',
    fontSize: '14px',
    position: 'relative',
    ':hover': { background: 'rgba(255,255,255,0.07)', color: '#fff' },
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontWeight: 600,
    ':hover': { background: 'rgba(255,255,255,0.12)', color: '#fff' },
  },
  navActiveBar: {
    position: 'absolute',
    left: '-12px',
    top: '8px',
    bottom: '8px',
    width: '4px',
    borderRadius: '0 4px 4px 0',
    background: 'linear-gradient(180deg, #7FCCE8, #3AB1DA)',
  },
  sideFooter: {
    padding: '14px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  profileName: { fontSize: '13px', fontWeight: 600, color: '#fff', lineHeight: 1.2 },
  profileRole: { fontSize: '11px', color: 'rgba(255,255,255,0.55)' },
  main: { flex: 1, minWidth: '0px', display: 'flex', flexDirection: 'column' },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '0 24px',
    height: '60px',
    background: 'var(--superficie)',
    borderBottom: '1px solid var(--borde)',
    position: 'sticky',
    top: '0px',
    zIndex: 20,
    '@media (max-width: 720px)': { padding: '0 12px', gap: '8px' },
  },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0px', flex: 1 },
  menuBtn: { '@media (min-width: 940px)': { display: 'none' } },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0px' },
  crumb: { fontSize: '14px', fontWeight: 600, color: 'var(--texto)', whiteSpace: 'nowrap' },
  crumbDivider: { color: '#9aa4b2', fontSize: '12px', flexShrink: 0 },
  crumbLight: {
    color: 'var(--texto-suave)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '@media (max-width: 640px)': { display: 'none' },
  },
  userArea: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  userName: { '@media (max-width: 720px)': { display: 'none' } },
  content: {
    padding: '28px',
    flex: 1,
    minWidth: '0px',
    '@media (max-width: 720px)': { padding: '16px' },
  },
})

function NavList({ nav }: { nav: NavItem[] }) {
  const styles = useStyles()
  const groups: string[] = []
  for (const item of nav) {
    const g = item.group ?? 'General'
    if (!groups.includes(g)) groups.push(g)
  }
  return (
    <div className={styles.nav}>
      {groups.map((group) => (
        <div key={group}>
          <div className={styles.groupLabel}>{group}</div>
          {nav
            .filter((n) => (n.group ?? 'General') === group)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className={styles.navActiveBar} />}
                    <span style={{ fontSize: '18px', display: 'inline-flex' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </div>
      ))}
    </div>
  )
}

interface AppShellProps {
  nav: NavItem[]
}

export function AppShell({ nav }: AppShellProps) {
  const styles = useStyles()
  const { user, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const portal = PORTALS.find((p) => location.pathname.startsWith(p.path))

  const tourSteps: TourStep[] = useMemo(() => {
    const role = portal?.role
    if (role === 'docente') return [
      { target: '[data-tour="hero-bienvenida"]', title: 'Bienvenida', description: 'Aquí ves un resumen de tu actividad: clases de hoy, completadas y próximas. Usa los botones para ir directo a impartir clase, tomar asistencia o publicar una actividad.' },
      { target: '[data-tour="nav-lateral"]', title: 'Navegación', description: 'En la barra izquierda están: Planificación Anual, Mis Clases (repositorio antes/durante/después), Asistencia, Aulas Virtuales, Encuentros, Comunicados y Mensajería para hablar con estudiantes y padres.' },
      { target: '[data-tour="cabecera-pagina"]', title: 'Módulos', description: 'Cada página tiene título, descripción y botones de acción. Desde aquí creas nuevas clases, actividades, registras asistencia y más. Cada clase se vincula a la planificación anual.' },
    ]
    if (role === 'estudiante') return [
      { target: '[data-tour="hero-bienvenida"]', title: 'Tu Campus Virtual', description: 'Aquí ves tu resumen académico: promedio, actividades pendientes, asistencia y clases de tu grado. Revisa tus calificaciones y entrega tus tareas a tiempo.' },
      { target: '[data-tour="nav-lateral"]', title: 'Tus secciones', description: 'En el menú: Mis Clases, Aula Virtual (actividades y calificaciones), Mi Asistencia, Comunicados del colegio y Mensajería para hablar con tus docentes.' },
      { target: '[data-tour="cabecera-pagina"]', title: 'Navega', description: 'Consulta tus calificaciones, revisa las actividades publicadas por tus docentes y participa en tu aprendizaje desde cada sección.' },
    ]
    if (role === 'padre') return [
      { target: '[data-tour="hero-bienvenida"]', title: 'Portal de Familias', description: 'Selecciona a tu hijo(a) para supervisar su progreso académico, calificaciones y asistencia. Todo en un solo lugar.' },
      { target: '[data-tour="nav-lateral"]', title: 'Navegación', description: 'En el menú: Progreso Académico, Asistencia, Comunicaciones (circulares oficiales) y Mensajería para contactar a los docentes de tu hijo(a).' },
      { target: '[data-tour="cabecera-pagina"]', title: 'Seguimiento', description: 'Cada sección filtra los datos del estudiante que selecciones. Mantente al día con las circulares y comunícate directamente con los docentes.' },
    ]
    return [
      { target: '[data-tour="hero-bienvenida"]', title: 'Panel Directivo', description: 'Dashboard con KPIs: matrícula, cumplimiento de planificación, asistencia promedio y rendimiento académico. Gráficos y tabla de cumplimiento por docente.' },
      { target: '[data-tour="nav-lateral"]', title: 'Gestión del colegio', description: 'Menú agrupado: Gestión (Psicología y Admisiones), Académico (planificación, clases, asistencia, catálogos, promoción), Personas (estudiantes, docentes, tutores, usuarios y roles).' },
      { target: '[data-tour="cabecera-pagina"]', title: 'Administración', description: 'Desde aquí gestionas matrícula, creas cursos y asignaturas, apruebas admisiones, asignas docentes y administras usuarios y roles. También publicas comunicados y usas la mensajería.' },
    ]
  }, [portal])

  const activeItem = nav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))

  const handleLogout = () => {
    void logout()
  }

  const sidebarBody = (
    <>
      <div className={styles.sideHeader}>
        <BrandLogo size={36} />
        <div>
          <div className={styles.sideTitle}>{appConfig.shortName}</div>
          <div className={styles.sideSub}>{portal?.shortTitle ?? 'Portal'}</div>
        </div>
      </div>
      <NavList nav={nav} />
      <div className={styles.sideFooter}>
        <div className={styles.profile}>
          <Avatar name={user?.displayName} image={user?.photoUrl ? { src: user.photoUrl } : undefined} initials={initials(user?.displayName ?? '?')} color="colorful" size={36} />
          <div style={{ minWidth: '0px' }}>
            <div className={styles.profileName}>{user?.displayName}</div>
            <div className={styles.profileRole}>{portal?.shortTitle}</div>
          </div>
        </div>
        <InstallPWA />
        <GuidedTour steps={tourSteps}>
          <Button
            appearance="subtle"
            icon={<LightbulbFilamentRegular />}
            style={{ color: 'rgba(255,255,255,0.85)', justifyContent: 'flex-start', width: '100%' }}
          >
            Iniciar tour
          </Button>
        </GuidedTour>
        <Button
          appearance="subtle"
          icon={<HomeRegular />}
          style={{ color: 'rgba(255,255,255,0.85)', justifyContent: 'flex-start', width: '100%' }}
          onClick={() => navigate('/')}
        >
          Cambiar de portal
        </Button>
        <Button
          appearance="subtle"
          icon={<SignOutRegular />}
          style={{ color: 'rgba(255,255,255,0.85)', justifyContent: 'flex-start', width: '100%' }}
          onClick={handleLogout}
        >
          Cerrar sesión
        </Button>
      </div>
    </>
  )

  return (
    <div className={styles.shell}>
      <div className={`${styles.sidebar} ${styles.sideInner}`} data-tour="nav-lateral">{sidebarBody}</div>

      <Drawer type="overlay" position="start" open={mobileOpen} onOpenChange={(_, data) => setMobileOpen(data.open)} style={{ width: '280px' }}>
        <DrawerHeader>
          <DrawerHeaderTitle>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <BrandLogo size={24} />
              {portal?.shortTitle}
            </span>
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>{sidebarBody}</DrawerBody>
      </Drawer>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <Button appearance="subtle" icon={<NavigationRegular />} onClick={() => setMobileOpen(true)} aria-label="Menú" className={styles.menuBtn} />
            <div className={styles.breadcrumb}>
              <span className={styles.crumb}>{portal?.shortTitle}</span>
              <ChevronRightRegular className={styles.crumbDivider} />
              <span className={styles.crumbLight}>{activeItem?.label ?? ''}</span>
            </div>
          </div>
          <div className={styles.userArea}>
            <div className={styles.userName} style={{ textAlign: 'right' }}>
              <Text size={200} weight="semibold" block>{user?.displayName}</Text>
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>{user?.email}</Text>
            </div>
            <Avatar name={user?.displayName} image={user?.photoUrl ? { src: user.photoUrl } : undefined} initials={initials(user?.displayName ?? '?')} color="colorful" size={32} />
          </div>
        </div>
        <div className={`${styles.content} app-surface`}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export { NavList }
