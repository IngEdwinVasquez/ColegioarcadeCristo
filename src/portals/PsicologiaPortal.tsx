import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { PsicologiaPage } from '../modules/administrativo/PsicologiaPage'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { AulasView } from '../modules/aulas/aulas'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { PeopleCheckmarkRegular, MegaphoneRegular, ChatRegular, SparkleRegular, ClipboardTaskRegular, VideoRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/psicologia', label: 'PsicologÃ­a y OrientaciÃ³n', icon: <PeopleCheckmarkRegular />, end: true, group: 'General' },
  { to: '/psicologia/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'AcadÃ©mico' },
  { to: '/psicologia/gestion-tic', label: 'GestiÃ³n de PsicologÃ­a y OrientaciÃ³n', icon: <ClipboardTaskRegular />, group: 'GestiÃ³n' },
  { to: '/psicologia/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/psicologia/chat', label: 'MensajerÃ­a', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/psicologia/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function PsicologiaPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<PsicologiaPage />} />
        <Route path="aulas" element={<AulasView scope={{ kind: 'todos' }} pageTitle="Aulas por curso" subtitle="Todas las aulas del colegio con sus asignaturas." />} />
        <Route path="gestion-tic" element={<GestionTicPage title="GestiÃ³n de PsicologÃ­a y OrientaciÃ³n" />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
