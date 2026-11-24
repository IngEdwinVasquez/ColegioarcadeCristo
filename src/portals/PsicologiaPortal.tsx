import { Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { PsicologiaPage } from '../modules/administrativo/PsicologiaPage'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { AulasView } from '../modules/aulas/aulas'
import { AnualPlanPage } from '../modules/anualPlan/AnualPlanPage'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { PeopleCheckmarkRegular, MegaphoneRegular, ChatRegular, SparkleRegular, ClipboardTaskRegular, VideoRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/psicologia', label: 'Psicología y Orientación', icon: <PeopleCheckmarkRegular />, end: true, group: 'General' },
  { to: '/psicologia/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'Académico' },
  { to: '/psicologia/gestion-tic', label: 'Gestión de Psicología y Orientación', icon: <ClipboardTaskRegular />, group: 'Gestión' },
  { to: '/psicologia/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/psicologia/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/psicologia/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

function AulasPsicologia() {
  const navigate = useNavigate()
  return (
    <AulasView
      scope={{ kind: 'todos' }}
      pageTitle="Aulas Virtuales"
      subtitle="Todas las aulas del colegio con sus asignaturas."
      onPlanificacionAnual={() => navigate('/psicologia/planificacion-anual')}
    />
  )
}

export function PsicologiaPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<PsicologiaPage />} />
        <Route path="aulas" element={<AulasPsicologia />} />
        <Route path="planificacion-anual" element={<AnualPlanPage />} />
        <Route path="gestion-tic" element={<GestionTicPage title="Gestión de Psicología y Orientación" />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
