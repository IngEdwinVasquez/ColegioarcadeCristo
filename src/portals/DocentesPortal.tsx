import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DocenteDashboard } from '../modules/dashboard/DocenteDashboard'
import { AnualPlanPage } from '../modules/anualPlan/AnualPlanPage'
import { ClasesPage } from '../modules/clases/ClasesPage'
import { ClaseDetail } from '../modules/clases/ClaseDetail'
import { AsistenciaPage } from '../modules/asistencia/AsistenciaPage'
import { AulasPage } from '../modules/aulas/AulasPage'
import { EncuentrosPage } from '../modules/encuentros/EncuentrosPage'
import { EncuentroDetail } from '../modules/encuentros/EncuentroDetail'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import {
  HomeRegular,
  CalendarTodayRegular,
  NotebookRegular,
  CalendarCheckmarkRegular,
  VideoRegular,
  VideoPersonRegular,
  MegaphoneRegular,
  ChatRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/docentes', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
  { to: '/docentes/planificacion', label: 'Planificación Anual', icon: <CalendarTodayRegular />, group: 'Académico' },
  { to: '/docentes/clases', label: 'Mis Clases', icon: <NotebookRegular />, group: 'Académico' },
  { to: '/docentes/asistencia', label: 'Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
  { to: '/docentes/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'Académico' },
  { to: '/docentes/encuentros', label: 'Encuentros Virtuales', icon: <VideoPersonRegular />, group: 'Comunidad' },
  { to: '/docentes/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/docentes/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
]

export function DocentesPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<DocenteDashboard />} />
        <Route path="planificacion" element={<AnualPlanPage />} />
        <Route path="clases" element={<ClasesPage />} />
        <Route path="clases/:id" element={<ClaseDetail />} />
        <Route path="asistencia" element={<AsistenciaPage />} />
        <Route path="aulas" element={<AulasPage />} />
        <Route path="encuentros" element={<EncuentrosPage />} />
        <Route path="encuentros/:id" element={<EncuentroDetail />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
