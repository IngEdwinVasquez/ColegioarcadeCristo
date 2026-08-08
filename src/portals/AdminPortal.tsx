import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DireccionPage } from '../modules/administrativo/DireccionPage'
import { PsicologiaPage } from '../modules/administrativo/PsicologiaPage'
import { AdmisionesPage } from '../modules/administrativo/AdmisionesPage'
import { PromocionPage } from '../modules/administrativo/PromocionPage'
import { PersonasPage } from '../modules/administrativo/PersonasPage'
import { CatalogosPage } from '../modules/administrativo/CatalogosPage'
import { UsuariosPage } from '../modules/administrativo/UsuariosPage'
import { RolesPage } from '../modules/administrativo/RolesPage'
import { AsignacionesPage } from '../modules/administrativo/AsignacionesPage'
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
  PremiumPersonRegular,
  PeopleCheckmarkRegular,
  PersonAddRegular,
  CalendarTodayRegular,
  NotebookRegular,
  CalendarCheckmarkRegular,
  VideoRegular,
  VideoPersonRegular,
  LinkSquareRegular,
  DatabaseRegular,
  ArrowUpRegular,
  PeopleTeamRegular,
  ShieldPersonRegular,
  ShieldCheckmarkRegular,
  MegaphoneRegular,
  ChatRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/administrativo', label: 'Panel Directivo', icon: <PremiumPersonRegular />, end: true, group: 'General' },
  { to: '/administrativo/psicologia', label: 'Psicología y Orientación', icon: <PeopleCheckmarkRegular />, group: 'Gestión' },
  { to: '/administrativo/admisiones', label: 'Admisiones', icon: <PersonAddRegular />, group: 'Gestión' },
  { to: '/administrativo/promocion', label: 'Promoción', icon: <ArrowUpRegular />, group: 'Académico' },
  { to: '/administrativo/asignaciones', label: 'Asignaciones', icon: <LinkSquareRegular />, group: 'Académico' },
  { to: '/administrativo/catalogos', label: 'Catálogos', icon: <DatabaseRegular />, group: 'Académico' },
  { to: '/administrativo/planificacion', label: 'Planificación Anual', icon: <CalendarTodayRegular />, group: 'Académico' },
  { to: '/administrativo/clases', label: 'Clases Impartidas', icon: <NotebookRegular />, group: 'Académico' },
  { to: '/administrativo/asistencia', label: 'Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
  { to: '/administrativo/aulas', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'Académico' },
  { to: '/administrativo/encuentros', label: 'Encuentros', icon: <VideoPersonRegular />, group: 'Académico' },
  { to: '/administrativo/personas', label: 'Personas', icon: <PeopleTeamRegular />, group: 'Personas' },
  { to: '/administrativo/usuarios', label: 'Usuarios y roles', icon: <ShieldPersonRegular />, group: 'Personas' },
  { to: '/administrativo/roles', label: 'Roles', icon: <ShieldCheckmarkRegular />, group: 'Personas' },
  { to: '/administrativo/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/administrativo/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
]

export function AdminPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<DireccionPage />} />
        <Route path="psicologia" element={<PsicologiaPage />} />
        <Route path="admisiones" element={<AdmisionesPage />} />
        <Route path="promocion" element={<PromocionPage />} />
        <Route path="asignaciones" element={<AsignacionesPage />} />
        <Route path="catalogos" element={<CatalogosPage />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="roles" element={<RolesPage />} />
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
