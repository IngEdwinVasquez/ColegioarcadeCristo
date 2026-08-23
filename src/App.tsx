import { lazy, Suspense, type ReactNode } from 'react'
import { FluentProvider, Spinner, Toaster, makeStyles } from '@fluentui/react-components'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MsalProvider } from '@azure/msal-react'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import { lightTheme } from './theme'
import { msalInstance } from './services/msal'
import { M365Login } from './auth/M365Login'
import { AccessPending, AuthLoading, SetupError } from './auth/AuthStatus'
import { PortalSelector } from './auth/PortalSelector'
import './index.css'

const DocentesPortal = lazy(() => import('./portals/DocentesPortal').then((m) => ({ default: m.DocentesPortal })))
const EstudiantesPortal = lazy(() => import('./portals/EstudiantesPortal').then((m) => ({ default: m.EstudiantesPortal })))
const PadresPortal = lazy(() => import('./portals/PadresPortal').then((m) => ({ default: m.PadresPortal })))
const AdminPortal = lazy(() => import('./portals/AdminPortal').then((m) => ({ default: m.AdminPortal })))

const useStyles = makeStyles({
  loader: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
})

function PortalSuspense({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <Suspense fallback={<div className={styles.loader}><Spinner label="Cargando módulo…" /></div>}>{children}</Suspense>
}

function RequireRole({ children }: { children: ReactNode }) {
  const { role } = useApp()
  if (!role) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { authState } = useApp()

  if (authState === 'anonymous') return <M365Login />
  if (authState === 'loading') return <AuthLoading />
  if (authState === 'error') return <SetupError />
  if (authState === 'no-access') return <AccessPending />

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PortalSelector />} />
        <Route path="/docentes/*" element={<RequireRole><PortalSuspense><DocentesPortal /></PortalSuspense></RequireRole>} />
        <Route path="/estudiantes/*" element={<RequireRole><PortalSuspense><EstudiantesPortal /></PortalSuspense></RequireRole>} />
        <Route path="/padres/*" element={<RequireRole><PortalSuspense><PadresPortal /></PortalSuspense></RequireRole>} />
        <Route path="/administrativo/*" element={<RequireRole><PortalSuspense><AdminPortal /></PortalSuspense></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={lightTheme}>
        <AppProvider>
          <AppRoutes />
          <Toaster position="top-end" />
        </AppProvider>
      </FluentProvider>
    </MsalProvider>
  )
}
