import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { PsicologiaPage } from '../modules/administrativo/PsicologiaPage'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { PeopleCheckmarkRegular, MegaphoneRegular, ChatRegular, SparkleRegular, ClipboardTaskRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/psicologia', label: 'Psicología y Orientación', icon: <PeopleCheckmarkRegular />, end: true, group: 'General' },
  { to: '/psicologia/gestion-tic', label: 'Gestión de Psicología y Orientación', icon: <ClipboardTaskRegular />, group: 'Gestión' },
  { to: '/psicologia/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/psicologia/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/psicologia/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function PsicologiaPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<PsicologiaPage />} />
        <Route path="gestion-tic" element={<GestionTicPage title="Gestión de Psicología y Orientación" />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
