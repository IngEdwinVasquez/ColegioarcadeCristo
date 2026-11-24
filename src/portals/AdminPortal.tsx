import { Route, Routes, Navigate } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { DireccionPage } from '../modules/administrativo/DireccionPage'
import { InformesPage } from '../modules/administrativo/InformesPage'
import { AdmisionesPage } from '../modules/administrativo/AdmisionesPage'
import { PromocionPage } from '../modules/administrativo/PromocionPage'
import { AsignacionesPage } from '../modules/administrativo/AsignacionesPage'
import { AcademicaTecPage } from '../modules/tecnologia/AcademicaTecPage'
import { AnualPlanPage } from '../modules/anualPlan/AnualPlanPage'
import { ClasesPage } from '../modules/clases/ClasesPage'
import { ClaseDetail } from '../modules/clases/ClaseDetail'
import { PersonasPage } from '../modules/administrativo/PersonasPage'
import { SigerdPage } from '../modules/tecnologia/SigerdPage'
import { UsuariosPage } from '../modules/administrativo/UsuariosPage'
import { RolesPage } from '../modules/administrativo/RolesPage'
import { AulasViewManagement } from '../modules/aulas/aulas'
import { CursoAsignaturaPage } from '../modules/aulas/CursoAsignaturaPage'
import { CorregirExamenPage } from '../modules/academico/CorregirExamenPage'
import { PlanificadorPage } from '../modules/planificador/PlanificadorPage'
import { RegistroGradoPage } from '../modules/registro/RegistroGradoPage'
import { CargaHorariaPage } from '../modules/administrativo/CargaHorariaPage'
import { EncuentrosPage } from '../modules/encuentros/EncuentrosPage'
import { EncuentroDetail } from '../modules/encuentros/EncuentroDetail'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { CopilotPage } from '../modules/copilot/CopilotPage'
import {
  PremiumPersonRegular,
  PersonAddRegular,
  NotebookRegular,
  VideoRegular,
  VideoPersonRegular,
  LinkSquareRegular,
  ArrowUpRegular,
  MegaphoneRegular,
  ChatRegular,
  SparkleRegular,
  ClipboardTaskRegular,
  BookRegular,
  PeopleTeamRegular,
  BookOpenRegular,
  ShieldPersonRegular,
  ShieldCheckmarkRegular,
  DocumentPdfRegular,
} from '@fluentui/react-icons'

const NAV: NavItem[] = [
  { to: '/administrativo', label: 'Panel Directivo', icon: <PremiumPersonRegular />, end: true, group: 'General' },
  { to: '/administrativo/informes', label: 'Informes', icon: <ClipboardTaskRegular />, group: 'General' },
  { to: '/administrativo/admisiones', label: 'Admisiones', icon: <PersonAddRegular />, group: 'Gestión' },
  { to: '/administrativo/promocion', label: 'Promoción', icon: <ArrowUpRegular />, group: 'Académico' },
  { to: '/administrativo/asignaciones', label: 'Asignaciones', icon: <LinkSquareRegular />, group: 'Académico' },
  { to: '/administrativo/gestion-academica', label: 'Agregar Asignaturas', icon: <BookRegular />, group: 'Académico' },
  { to: '/administrativo/corregir-examen', label: 'Corregir examen (IA)', icon: <DocumentPdfRegular />, group: 'Académico' },
  { to: '/administrativo/carga-horaria', label: 'Carga horaria', icon: <DocumentPdfRegular />, group: 'Académico' },
  { to: '/administrativo/clases', label: 'Clases Impartidas', icon: <NotebookRegular />, group: 'Académico' },
  { to: '/administrativo/aulas-curso', label: 'Aulas Virtuales', icon: <VideoRegular />, group: 'Académico' },
  { to: '/administrativo/encuentros', label: 'Encuentros', icon: <VideoPersonRegular />, group: 'Académico' },
  { to: '/administrativo/personas', label: 'Personal', icon: <PeopleTeamRegular />, group: 'Personas' },
  { to: '/administrativo/siger', label: 'SIGERD', icon: <BookOpenRegular />, group: 'Personas' },
  { to: '/administrativo/usuarios', label: 'Usuarios y roles', icon: <ShieldPersonRegular />, group: 'Personas' },
  { to: '/administrativo/roles', label: 'Roles', icon: <ShieldCheckmarkRegular />, group: 'Personas' },
  { to: '/administrativo/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
  { to: '/administrativo/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  { to: '/administrativo/copilot', label: 'Copilot', icon: <SparkleRegular />, group: 'Herramientas' },
]

export function AdminPortal() {
  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<DireccionPage />} />
        <Route path="informes" element={<InformesPage />} />
        <Route path="admisiones" element={<AdmisionesPage />} />
        <Route path="promocion" element={<PromocionPage />} />
        <Route path="asignaciones" element={<AsignacionesPage />} />
        <Route path="gestion-academica" element={<AcademicaTecPage />} />
        <Route path="registro-grado" element={<RegistroGradoPage scope={{ kind: 'todos' }} />} />
        <Route path="corregir-examen" element={<CorregirExamenPage />} />
        <Route path="carga-horaria" element={<CargaHorariaPage />} />
        <Route path="planificacion" element={<AnualPlanPage />} />
        <Route path="planificador-ia" element={<PlanificadorPage />} />
        <Route path="clases" element={<ClasesPage />} />
        <Route path="clases/:id" element={<ClaseDetail />} />
        <Route path="aulas" element={<Navigate to="/administrativo/aulas-curso" replace />} />
        <Route path="aulas-curso" element={<AulasViewManagement base="/administrativo/aulas-curso" scope={{ kind: 'todos' }} pageTitle="Aulas Virtuales" subtitle="Todas las aulas del colegio con sus asignaturas y aulas de Teams." />} />
        <Route path="aulas-curso/:gradeId/:section/:subjectId/virtual" element={<CursoAsignaturaPage />} />
        <Route path="encuentros" element={<EncuentrosPage />} />
        <Route path="encuentros/:id" element={<EncuentroDetail />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="siger" element={<SigerdPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="copilot" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
