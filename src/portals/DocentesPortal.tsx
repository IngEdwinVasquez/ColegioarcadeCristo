import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DocenteDashboard } from '../modules/dashboard/DocenteDashboard'
import { AnualPlanPage } from '../modules/anualPlan/AnualPlanPage'
import { PlanificacionPage } from '../modules/planificacion/PlanificacionPage'
import { GradosSeccionesPage } from '../modules/planificacion/GradosSeccionesPage'
import { ClasesPage } from '../modules/clases/ClasesPage'
import { ClaseDetail } from '../modules/clases/ClaseDetail'
import { RecursosPage } from '../modules/docente/RecursosPage'
import { PortafolioPage } from '../modules/docente/PortafolioPage'
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage'
import { AulasPage } from '../modules/aulas/AulasPage'
import { EncuentrosPage } from '../modules/encuentros/EncuentrosPage'
import { EncuentroDetail } from '../modules/encuentros/EncuentroDetail'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import {
  HomeRegular,
  CalendarTodayRegular,
  CalendarLtrRegular,
  NotebookRegular,
  CalendarCheckmarkRegular,
  VideoRegular,
  VideoPersonRegular,
  MegaphoneRegular,
  ChatRegular,
  SparkleRegular,
  GridRegular,
  FolderRegular,
  BriefcaseRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/docentes', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/docentes/planificaciones', label: 'Planificaciones', icon: <CalendarLtrRegular />, group: 'Académico' },
  { to: '/docentes/planificacion', label: 'Planificación Anual', icon: <CalendarTodayRegular />, group: 'Académico' },
  { to: '/docentes/grados-secciones', label: 'Grados y Secciones', icon: <GridRegular />, group: 'Académico' },
  { to: '/docentes/clases', label: 'Mis Clases', icon: <NotebookRegular />, group: 'Académico' },
  { to: '/docentes/asistencia', label: 'Registro de Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
  { to: '/docentes/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'Académico' },
  { to: '/docentes/recursos', label: 'Recursos e Interactivos', icon: <FolderRegular />, group: 'Académico' },
  { to: '/docentes/portafolio', label: 'Portafolio y Agenda', icon: <BriefcaseRegular />, group: 'Académico' },
  { to: '/docentes/encuentros', label: 'Encuentros Virtuales', icon: <VideoPersonRegular />, group: 'Comunidad' },
  { to: '/docentes/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/docentes/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/docentes/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function DocentesPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<DocenteDashboard />} />
        <Route path="planificaciones" element={<PlanificacionPage />} />
        <Route path="planificacion" element={<AnualPlanPage />} />
        <Route path="grados-secciones" element={<GradosSeccionesPage />} />
        <Route path="clases" element={<ClasesPage />} />
        <Route path="clases/:id" element={<ClaseDetail />} />
        <Route path="asistencia" element={<AsistenciaPage />} />
        <Route path="aulas" element={<AulasPage />} />
        <Route path="recursos" element={<RecursosPage />} />
        <Route path="portafolio" element={<PortafolioPage />} />
        <Route path="encuentros" element={<EncuentrosPage />} />
        <Route path="encuentros/:id" element={<EncuentroDetail />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
