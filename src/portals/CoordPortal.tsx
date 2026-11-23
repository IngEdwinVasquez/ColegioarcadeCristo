import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { CoordDashboard } from '../modules/coordinacion/CoordDashboard'
import { PersonasNivel } from '../modules/coordinacion/PersonasNivel'
import { HorariosPage } from '../modules/coordinacion/HorariosPage'
import { AcompanamientosPage } from '../modules/coordinacion/AcompanamientosPage'
import { CumplimientoPage } from '../modules/coordinacion/CumplimientoPage'
import { PlanificacionNivel } from '../modules/coordinacion/PlanificacionNivel'
import { AulasNivelPage } from '../modules/coordinacion/AulasNivelPage'
import { CursoAsignaturaPage } from '../modules/aulas/CursoAsignaturaPage'
import { RegistroGradoPage } from '../modules/registro/RegistroGradoPage'
import { CorregirExamenPage } from '../modules/academico/CorregirExamenPage'
import { PlanificadorPage } from '../modules/planificador/PlanificadorPage'
import { CargaHorariaPage } from '../modules/administrativo/CargaHorariaPage'
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
  VideoRegular,
  DocumentPdfRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/coordinacion', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/coordinacion/personas', label: 'Docentes y Estudiantes', icon: <PeopleRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/horarios', label: 'Horarios de Clase', icon: <CalendarLtrRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/planificacion', label: 'PlanificaciÃ³n del Nivel', icon: <NotebookRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/planificador-ia', label: 'Planificador IA', icon: <SparkleRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/acompanamientos', label: 'AcompaÃ±amiento Docente', icon: <HeartPulseRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/cumplimiento', label: 'Cumplimiento', icon: <CheckmarkCircleRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/promocion', label: 'PromociÃ³n', icon: <ArrowUpRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/asignaciones', label: 'Asignaciones', icon: <LinkSquareRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/gestion-academica', label: 'GestiÃ³n acadÃ©mica', icon: <BookRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/registro-grado', label: 'Registro de Grado', icon: <BookRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/corregir-examen', label: 'Corregir examen (IA)', icon: <ClipboardTaskRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/carga-horaria', label: 'Carga horaria', icon: <DocumentPdfRegular />, group: 'AcadÃ©mico' },
  { to: '/coordinacion/gestion-tic', label: 'GestiÃ³n de CoordinaciÃ³n PedagÃ³gica', icon: <ClipboardTaskRegular />, group: 'GestiÃ³n' },
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
        <Route path="planificador-ia" element={<PlanificadorPage />} />
        <Route path="acompanamientos" element={<AcompanamientosPage />} />
        <Route path="cumplimiento" element={<CumplimientoPage />} />
        <Route path="promocion" element={<PromocionPage />} />
        <Route path="asignaciones" element={<AsignacionesPage />} />
        <Route path="gestion-academica" element={<AcademicaTecPage />} />
        <Route path="aulas" element={<AulasNivelPage />} />
        <Route path="aulas/:gradeId/:section/:subjectId/virtual" element={<CursoAsignaturaPage />} />
        <Route path="registro-grado" element={<RegistroGradoPage scope={{ kind: 'coordinacion' }} />} />
        <Route path="corregir-examen" element={<CorregirExamenPage />} />
        <Route path="carga-horaria" element={<CargaHorariaPage />} />
        <Route path="gestion-tic" element={<GestionTicPage title="GestiÃ³n de CoordinaciÃ³n PedagÃ³gica" />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
