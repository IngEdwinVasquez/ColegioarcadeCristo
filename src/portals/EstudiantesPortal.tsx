import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { EstudianteDashboard } from '../modules/dashboard/EstudianteDashboard'
import { StudentAulaView, StudentAsistenciaView, StudentClassesView } from '../modules/dashboard/StudentViews'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { useApp } from '../context/useApp'
import {
  HomeRegular,
  NotebookRegular,
  VideoRegular,
  CalendarCheckmarkRegular,
  MegaphoneRegular,
  ChatRegular,
} from '@fluentui/react-icons'

function StudentWrapper({ children }: { children: (studentId: string) => React.ReactNode }) {
  const { user } = useApp()
  return <>{children(user?.studentId ?? '')}</>
}

export function EstudiantesPortal() {
  const NAV: NavItem[] = [
    { to: '/estudiantes', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
    { to: '/estudiantes/clases', label: 'Mis Clases', icon: <NotebookRegular />, group: 'Académico' },
    { to: '/estudiantes/aula', label: 'Aula Virtual', icon: <VideoRegular />, group: 'Académico' },
    { to: '/estudiantes/asistencia', label: 'Mi Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
    { to: '/estudiantes/comunicados', label: 'Comunicados', icon: <MegaphoneRegular />, group: 'Comunidad' },
    { to: '/estudiantes/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  ]

  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<EstudianteDashboard />} />
        <Route path="clases" element={<StudentWrapper>{(id) => <StudentClassesView studentId={id} />}</StudentWrapper>} />
        <Route path="aula" element={<StudentWrapper>{(id) => <StudentAulaView studentId={id} />}</StudentWrapper>} />
        <Route path="asistencia" element={<StudentWrapper>{(id) => <StudentAsistenciaView studentId={id} />}</StudentWrapper>} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
