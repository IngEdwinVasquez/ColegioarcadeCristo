import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { CoordDashboard } from '../modules/coordinacion/CoordDashboard'
import { PersonasNivel } from '../modules/coordinacion/PersonasNivel'
import { HorariosPage } from '../modules/coordinacion/HorariosPage'
import { AcompanamientosPage } from '../modules/coordinacion/AcompanamientosPage'
import { CumplimientoPage } from '../modules/coordinacion/CumplimientoPage'
import { PlanificacionNivel } from '../modules/coordinacion/PlanificacionNivel'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { AcademicaTecPage } from '../modules/tecnologia/AcademicaTecPage'
import { AsignacionesPage } from '../modules/administrativo/AsignacionesPage'
import { PromocionPage } from '../modules/administrativo/PromocionPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import {
  HomeRegular,
  PeopleRegular,
  CalendarLtrRegular,
  HeartPulseRegular,
  CheckmarkCircleRegular,
  NotebookRegular,
  SparkleRegular,
  ClipboardTaskRegular,
  ArrowUpRegular,
  LinkSquareRegular,
  BookRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/coordinacion', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/coordinacion/personas', label: 'Docentes y Estudiantes', icon: <PeopleRegular />, group: 'Académico' },
  { to: '/coordinacion/horarios', label: 'Horarios de Clase', icon: <CalendarLtrRegular />, group: 'Académico' },
  { to: '/coordinacion/planificacion', label: 'Planificación del Nivel', icon: <NotebookRegular />, group: 'Académico' },
  { to: '/coordinacion/acompanamientos', label: 'Acompañamiento Docente', icon: <HeartPulseRegular />, group: 'Académico' },
  { to: '/coordinacion/cumplimiento', label: 'Cumplimiento', icon: <CheckmarkCircleRegular />, group: 'Académico' },
  { to: '/coordinacion/promocion', label: 'Promoción', icon: <ArrowUpRegular />, group: 'Académico' },
  { to: '/coordinacion/asignaciones', label: 'Asignaciones', icon: <LinkSquareRegular />, group: 'Académico' },
  { to: '/coordinacion/gestion-academica', label: 'Gestión académica', icon: <BookRegular />, group: 'Académico' },
  { to: '/coordinacion/gestion-tic', label: 'Gestión de Coordinación Pedagógica', icon: <ClipboardTaskRegular />, group: 'Gestión' },
  { to: '/coordinacion/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function CoordPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<CoordDashboard />} />
        <Route path="personas" element={<PersonasNivel />} />
        <Route path="horarios" element={<HorariosPage />} />
        <Route path="planificacion" element={<PlanificacionNivel />} />
        <Route path="acompanamientos" element={<AcompanamientosPage />} />
        <Route path="cumplimiento" element={<CumplimientoPage />} />
        <Route path="promocion" element={<PromocionPage />} />
        <Route path="asignaciones" element={<AsignacionesPage />} />
        <Route path="gestion-academica" element={<AcademicaTecPage />} />
        <Route path="gestion-tic" element={<GestionTicPage title="Gestión de Coordinación Pedagógica" />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
