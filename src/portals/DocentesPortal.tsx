import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DocenteDashboard } from '../modules/dashboard/DocenteDashboard'
import { PlanificacionPage } from '../modules/planificacion/PlanificacionPage'
import { PlanificadorSemanal } from '../modules/planificacion/PlanificadorSemanal'
import { GradosSeccionesPage } from '../modules/planificacion/GradosSeccionesPage'
import { MisAulasPage } from '../modules/docente/MisAulasPage'
import { MisClasesPage } from '../modules/docente/MisClasesPage'
import { ClaseDocenteDetail } from '../modules/docente/ClaseDocenteDetail'
import { RecursosPage } from '../modules/docente/RecursosPage'
import { PortafolioPage } from '../modules/docente/PortafolioPage'
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage'
import { EncuentrosPage } from '../modules/encuentros/EncuentrosPage'
import { EncuentroDetail } from '../modules/encuentros/EncuentroDetail'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import {
  HomeRegular,
  CalendarLtrRegular,
  CalendarCheckmarkRegular,
  VideoPersonRegular,
  MegaphoneRegular,
  ChatRegular,
  SparkleRegular,
  GridRegular,
  FolderRegular,
  BriefcaseRegular,
  VideoRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/docentes', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/docentes/planificaciones', label: 'Planificación Anual', icon: <CalendarLtrRegular />, group: 'Académico' },
  { to: '/docentes/planificador', label: 'Planificador semanal', icon: <GridRegular />, group: 'Académico' },
  { to: '/docentes/grados-secciones', label: 'Grados y Secciones', icon: <GridRegular />, group: 'Académico' },
  { to: '/docentes/aulas', label: 'Mis Aulas', icon: <VideoRegular />, group: 'Académico' },
  { to: '/docentes/asistencia', label: 'Registro de Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
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
        <Route path="planificador" element={<PlanificadorSemanal />} />
        <Route path="grados-secciones" element={<GradosSeccionesPage />} />
        <Route path="aulas" element={<MisAulasPage />} />
        <Route path="aulas/:key" element={<MisClasesPage />} />
        <Route path="aulas/:key/clase/:classId" element={<ClaseDocenteDetail />} />
        <Route path="asistencia" element={<AsistenciaPage />} />
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
