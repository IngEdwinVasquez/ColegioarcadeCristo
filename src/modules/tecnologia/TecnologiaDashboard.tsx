import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Text, makeStyles, tokens } from '@fluentui/react-components'
import { PeopleTeamRegular, ShieldPersonRegular, PersonWarningRegular, DatabaseRegular, OpenRegular, ArrowRightRegular } from '@fluentui/react-icons'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { StatCard } from '../../components/shared/StatCard'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { getDirectoryUsers } from '../../services/userLinks'
import { appConfig } from '../../config/appConfig'
import { ROLE_LABELS } from '../../types/roles'
import { gradientes } from '../../theme'
import type { Persona } from '../../types'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', margin: '20px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  muted: { color: tokens.colorNeutralForeground2 },
})

export function TecnologiaDashboard() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { user, roleLabel } = useApp()
  // RM-007: indicadores con datos en vivo del sistema (no la caché del inicio de sesión)
  const usersCol = useCollection(dataService.getUsers)
  const studentsCol = useCollection(dataService.getStudents)
  const teachersCol = useCollection(dataService.getTeachers)
  const guardiansCol = useCollection(dataService.getGuardians)
  const personasCol = useCollection<Persona>(dataService.getPersonas)
  const users = usersCol.items
  const students = studentsCol.items
  const teachers = teachersCol.items
  const guardians = guardiansCol.items
  const [directoryCount, setDirectoryCount] = useState<number | null>(null)

  useEffect(() => {
    getDirectoryUsers()
      .then((list) => setDirectoryCount(list.length))
      .catch(() => setDirectoryCount(null))
  }, [])

  const byRole = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of Object.keys(ROLE_LABELS)) map.set(r, 0)
    for (const u of users) for (const r of u.roles) map.set(r, (map.get(r) ?? 0) + 1)
    return map
  }, [users])

  const sinCuenta = useMemo(
    () => students.filter((s) => !s.userId).length + teachers.filter((t) => !t.userId).length + guardians.filter((g) => !g.userId).length,
    [students, teachers, guardians],
  )
  const sinRol = useMemo(() => users.filter((u) => u.roles.length === 0).length, [users])

  const personalByTipo = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of personasCol.items) map.set(p.tipo, (map.get(p.tipo) ?? 0) + 1)
    return map
  }, [personasCol.items])

  const personalCat = [
    { tipo: 'coordinador', label: 'Coordinador pedagógico', path: '/tecnologia/personas' },
    { tipo: 'tic', label: 'Tecnología (TIC)', path: '/tecnologia/personas' },
    { tipo: 'director', label: 'Directores', path: '/tecnologia/directores' },
    { tipo: 'administrador', label: 'Administradores', path: '/tecnologia/administradores' },
    { tipo: 'siger', label: 'SIGER', path: '/tecnologia/siger' },
    { tipo: 'apoyo', label: 'Personal de apoyo', path: '/tecnologia/apoyo' },
    { tipo: 'psicologia', label: 'Orientación y Psicología', path: '/tecnologia/personas' },
  ] as const

  return (
    <div>
      <WelcomeHero
        title={<span>Tecnología e Innovación · {user?.displayName}</span>}
        subtitle="Administración de la plataforma: personas, cuentas de Microsoft 365, roles de acceso y estado de la integración."
        actions={
          <>
            <Button appearance="primary" icon={<PeopleTeamRegular />} onClick={() => navigate('/tecnologia/personas')}>Personal</Button>
            <Button appearance="secondary" icon={<ShieldPersonRegular />} onClick={() => navigate('/tecnologia/usuarios')}>Usuarios y roles</Button>
          </>
        }
      />

      <div className={styles.kpis}>
        <StatCard title="Usuarios con acceso" value={users.filter((u) => u.roles.length > 0).length} icon={<ShieldPersonRegular />} color="#0095C8" gradient={gradientes.azul} sub={directoryCount != null ? `De ${directoryCount} cuentas en Entra ID` : 'Cuentas con al menos un rol'} />
        <StatCard title="Personas registradas" value={students.length + teachers.length + guardians.length} icon={<PeopleTeamRegular />} color="#15803D" gradient={gradientes.verde} sub={`${students.length} estudiantes · ${teachers.length} docentes · ${guardians.length} tutores`} />
        <StatCard title="Fichas sin cuenta M365" value={sinCuenta} icon={<PersonWarningRegular />} color="#EA580C" gradient={gradientes.naranja} sub="Requieren vincular una cuenta de Entra ID" />
        <StatCard title="Cuentas sin rol" value={sinRol} icon={<PersonWarningRegular />} color="#C8102E" gradient={gradientes.rojo} sub="Han iniciado sesión sin acceso asignado" />
      </div>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <Text weight="semibold" size={400}><PeopleTeamRegular /> Personal institucional por categoría</Text>
          {personalCat.map((c) => (
            <div key={c.tipo} className={styles.row}>
              <Text size={300}>{c.label}</Text>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Text size={300} weight="semibold">{personalByTipo.get(c.tipo) ?? 0}</Text>
                <Button appearance="subtle" size="small" icon={<ArrowRightRegular />} onClick={() => navigate(c.path)} />
              </div>
            </div>
          ))}
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400}>Usuarios por rol</Text>
          {[...byRole.entries()].map(([r, count]) => (
            <div key={r} className={styles.row}>
              <Text size={300}>{roleLabel(r)}</Text>
              <Text size={300} weight="semibold">{count}</Text>
            </div>
          ))}
          <Button appearance="subtle" icon={<ArrowRightRegular />} onClick={() => navigate('/tecnologia/roles')} style={{ alignSelf: 'flex-start' }}>Mantenimiento de roles</Button>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400}><DatabaseRegular /> Plataforma Microsoft 365</Text>
          <div className={styles.row}><Text size={300}>Tenant</Text><Text size={300} className={styles.muted}>{appConfig.m365.tenantId}</Text></div>
          <div className={styles.row}><Text size={300}>Aplicación (Entra ID)</Text><Text size={300} className={styles.muted}>{appConfig.m365.clientId}</Text></div>
          <div className={styles.row}><Text size={300}>Sitio de SharePoint</Text><Text size={300} className={styles.muted}>{appConfig.m365.siteHostname || 'auto'}{appConfig.m365.sitePath}</Text></div>
          <div className={styles.row}><Text size={300}>Correo por Power Automate</Text><Text size={300} className={styles.muted}>{appConfig.automation.mailFlowUrl ? 'Configurado' : 'No configurado (se usa Graph)'}</Text></div>
          <div className={styles.row}><Text size={300}>Copilot Studio</Text><Text size={300} className={styles.muted}>{appConfig.copilot.embedUrl ? 'Agente embebido' : 'Microsoft 365 Copilot'}</Text></div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button appearance="outline" size="small" icon={<OpenRegular />} onClick={() => window.open('https://entra.microsoft.com', '_blank', 'noopener')}>Entra ID</Button>
            <Button appearance="outline" size="small" icon={<OpenRegular />} onClick={() => window.open(`https://${appConfig.m365.siteHostname}${appConfig.m365.sitePath}/_layouts/15/viewlsts.aspx`, '_blank', 'noopener')} disabled={!appConfig.m365.siteHostname}>Listas de SharePoint</Button>
            <Button appearance="outline" size="small" icon={<OpenRegular />} onClick={() => window.open('https://make.powerautomate.com', '_blank', 'noopener')}>Power Automate</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
