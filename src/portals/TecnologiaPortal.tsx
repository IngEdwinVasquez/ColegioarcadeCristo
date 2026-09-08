import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { TecnologiaDashboard } from '../modules/tecnologia/TecnologiaDashboard'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { AcademicaTecPage } from '../modules/tecnologia/AcademicaTecPage'
import { PersonasPage } from '../modules/administrativo/PersonasPage'
import { DirectoresPage } from '../modules/administrativo/DirectoresPage'
import { UsuariosPage } from '../modules/administrativo/UsuariosPage'
import { RolesPage } from '../modules/administrativo/RolesPage'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { DeveloperBoardRegular, PeopleTeamRegular, ShieldPersonRegular, ShieldCheckmarkRegular, ChatRegular, SparkleRegular, ClipboardTaskRegular, BookRegular, PersonShieldRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/tecnologia', label: 'Panel de Tecnología', icon: <DeveloperBoardRegular />, end: true, group: 'General' },
  { to: '/tecnologia/gestion-tic', label: 'Gestión TIC', icon: <ClipboardTaskRegular />, group: 'Coordinación TIC' },
  { to: '/tecnologia/academica', label: 'Gestión académica', icon: <BookRegular />, group: 'Coordinación TIC' },
  { to: '/tecnologia/personas', label: 'Personal', icon: <PeopleTeamRegular />, group: 'Personas' },
  { to: '/tecnologia/directores', label: 'Directores', icon: <PersonShieldRegular />, group: 'Personas' },
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
        <Route path="gestion-tic" element={<GestionTicPage />} />
        <Route path="academica" element={<AcademicaTecPage />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="directores" element={<DirectoresPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
