import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DocenteDashboard } from '../modules/dashboard/DocenteDashboard'
import { PlanificacionPage } from '../modules/planificacion/PlanificacionPage'
import { PlanificadorSemanal } from '../modules/planificacion/PlanificadorSemanal'
import { GradosSeccionesPage } from '../modules/planificacion/GradosSeccionesPage'
import { PlanificadorPage } from '../modules/planificador/PlanificadorPage'
import { MisAulasPage } from '../modules/docente/MisAulasPage'
import { AulaPage } from '../modules/docente/AulaPage'
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
  VideoPersonRegular,
  MegaphoneRegular,
  ChatRegular,
  SparkleRegular,
  VideoRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/docentes', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/docentes/aulas', label: 'Mis Aulas', icon: <VideoRegular />, group: 'Académico' },
  { to: '/docentes/planificador-ia', label: 'Planificador IA', icon: <SparkleRegular />, group: 'Académico' },
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
        <Route path="aulas" element={<MisAulasPage />} />
        <Route path="aulas/:gradeId/:section" element={<AulaPage />} />
        <Route path="aulas/:gradeId/:section/:subjectId" element={<MisClasesPage />} />
        <Route path="aulas/:gradeId/:section/:subjectId/clase/:classId" element={<ClaseDocenteDetail />} />
        <Route path="planificaciones" element={<PlanificacionPage />} />
        <Route path="planificador" element={<PlanificadorSemanal />} />
        <Route path="planificador-ia" element={<PlanificadorPage />} />
        <Route path="grados-secciones" element={<GradosSeccionesPage />} />
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
