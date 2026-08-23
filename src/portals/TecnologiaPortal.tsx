import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { TecnologiaDashboard } from '../modules/tecnologia/TecnologiaDashboard'
import { PersonasPage } from '../modules/administrativo/PersonasPage'
import { UsuariosPage } from '../modules/administrativo/UsuariosPage'
import { RolesPage } from '../modules/administrativo/RolesPage'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { DeveloperBoardRegular, PeopleTeamRegular, ShieldPersonRegular, ShieldCheckmarkRegular, ChatRegular, SparkleRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/tecnologia', label: 'Panel de Tecnología', icon: <DeveloperBoardRegular />, end: true, group: 'General' },
  { to: '/tecnologia/personas', label: 'Personas', icon: <PeopleTeamRegular />, group: 'Personas' },
  { to: '/tecnologia/usuarios', label: 'Usuarios y roles', icon: <ShieldPersonRegular />, group: 'Personas' },
  { to: '/tecnologia/roles', label: 'Roles', icon: <ShieldCheckmarkRegular />, group: 'Personas' },
  { to: '/tecnologia/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/tecnologia/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function TecnologiaPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<TecnologiaDashboard />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
