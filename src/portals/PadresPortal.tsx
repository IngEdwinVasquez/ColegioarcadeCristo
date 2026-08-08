import { useState, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../components/layout/AppShell'
import { PadresDashboard } from '../modules/dashboard/PadresDashboard'
import { StudentAulaView, StudentAsistenciaView, StudentPicker } from '../modules/dashboard/StudentViews'
import { Comunicados } from '../modules/dashboard/Comunicados'
import { ChatPage } from '../modules/chat/ChatPage'
import { PageHeader } from '../components/shared/PageHeader'
import {
  HomeRegular,
  StarRegular,
  CalendarCheckmarkRegular,
  MegaphoneRegular,
  ChatRegular,
} from '@fluentui/react-icons'

function ChildView({ render, title, subtitle }: { render: (childId: string) => ReactNode; title: string; subtitle: string }) {
  const [childId, setChildId] = useState('')
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div style={{ marginTop: '20px' }}>
        <StudentPicker value={childId} onChange={setChildId} />
        {childId && render(childId)}
      </div>
    </div>
  )
}

export function PadresPortal() {
  const NAV: NavItem[] = [
    { to: '/padres', label: 'Inicio', icon: <HomeRegular />, end: true, group: 'General' },
    { to: '/padres/progreso', label: 'Progreso Académico', icon: <StarRegular />, group: 'Académico' },
    { to: '/padres/asistencia', label: 'Asistencia', icon: <CalendarCheckmarkRegular />, group: 'Académico' },
    { to: '/padres/comunicados', label: 'Comunicaciones', icon: <MegaphoneRegular />, group: 'Comunidad' },
    { to: '/padres/chat', label: 'Mensajería', icon: <ChatRegular />, group: 'Comunidad' },
  ]

  return (
    <Routes>
      <Route element={<AppShell nav={NAV} />}>
        <Route index element={<PadresDashboard />} />
        <Route
          path="progreso"
          element={
            <ChildView
              title="Progreso académico y actividades"
              subtitle="Supervisión de las calificaciones y actividades de su hijo(a)."
              render={(id) => <StudentAulaView studentId={id} />}
            />
          }
        />
        <Route
          path="asistencia"
          element={
            <ChildView
              title="Reporte de asistencia"
              subtitle="Registro de asistencia por asignatura de su hijo(a)."
              render={(id) => <StudentAsistenciaView studentId={id} />}
            />
          }
        />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
