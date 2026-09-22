import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { TecnologiaDashboard } from '../modules/tecnologia/TecnologiaDashboard'
import { GestionTicPage } from '../modules/tecnologia/GestionTicPage'
import { AcademicaTecPage } from '../modules/tecnologia/AcademicaTecPage'
import { AsignacionesPage } from '../modules/administrativo/AsignacionesPage'
import { PromocionPage } from '../modules/administrativo/PromocionPage'
import { PersonasPage } from '../modules/administrativo/PersonasPage'
import { SigerdPage } from '../modules/tecnologia/SigerdPage'
import { AulasView } from '../modules/aulas/aulas'
import { RegistroGradoPage } from '../modules/registro/RegistroGradoPage'
import { CargaHorariaPage } from '../modules/administrativo/CargaHorariaPage'
import { UsuariosPage } from '../modules/administrativo/UsuariosPage'
import { RolesPage } from '../modules/administrativo/RolesPage'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import { DeveloperBoardRegular, PeopleTeamRegular, ShieldPersonRegular, ShieldCheckmarkRegular, ChatRegular, SparkleRegular, ClipboardTaskRegular, BookRegular, BookOpenRegular, LinkSquareRegular, ArrowUpRegular, VideoRegular, DocumentPdfRegular } from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/tecnologia', label: 'Panel de Tecnología', icon: <DeveloperBoardRegular />, end: true, group: 'General' },
  { to: '/tecnologia/gestion-tic', label: 'Gestión TIC', icon: <ClipboardTaskRegular />, group: 'Coordinación TIC' },
  { to: '/tecnologia/academica', label: 'Gestión académica', icon: <BookRegular />, group: 'Coordinación TIC' },
  { to: '/tecnologia/asignaciones', label: 'Asignaciones', icon: <LinkSquareRegular />, group: 'Académico' },
  { to: '/tecnologia/aulas', label: 'Aulas por curso', icon: <VideoRegular />, group: 'Académico' },
  { to: '/tecnologia/registro-grado', label: 'Registro de Grado', icon: <BookRegular />, group: 'Académico' },
  { to: '/tecnologia/carga-horaria', label: 'Carga horaria', icon: <DocumentPdfRegular />, group: 'Académico' },
  { to: '/tecnologia/promocion', label: 'Promoción', icon: <ArrowUpRegular />, group: 'Académico' },
  { to: '/tecnologia/personas', label: 'Personal', icon: <PeopleTeamRegular />, group: 'Personas' },
  { to: '/tecnologia/siger', label: 'SIGERD', icon: <BookOpenRegular />, group: 'Personas' },
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
        <Route path="asignaciones" element={<AsignacionesPage />} />
        <Route path="aulas" element={<AulasView scope={{ kind: 'todos' }} pageTitle="Aulas por curso" subtitle="Todas las aulas del colegio con sus asignaturas y aulas de Teams." />} />
        <Route path="registro-grado" element={<RegistroGradoPage scope={{ kind: 'todos' }} />} />
        <Route path="carga-horaria" element={<CargaHorariaPage />} />
        <Route path="promocion" element={<PromocionPage />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="siger" element={<SigerdPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
