import { useMemo, useState } from 'react'
import { Button, Card, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { CalendarCheckmarkRegular, StarRegular, NotebookRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { GruposPersonas } from './GruposPersonas'
import { AsistenciaDashboard } from '../asistencia/AsistenciaDashboard'
import { StaffAsistenciaPanel } from '../asistencia/StaffAsistenciaPanel'
import { PortalesActividad } from './PortalesActividad'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { AttendanceRecord, Activity, Grade, VirtualMeeting, TeacherAssignment, GradeSection, CoursePage, CursoUnidad } from '../../types'
import { formatDate, pct, todayIso } from '../../utils/helpers'
import { cursoNombre, detectLevel, ordenarCursos } from '../../utils/academic'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  card: { padding: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
})

export function DireccionPage() {
  const styles = useStyles()
  const { subjects, grades, teacherById, subjectById, gradeById, studentById, teachers } = useApp()
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const coursePagesCol = useCollection<CoursePage>(dataService.getCoursePages)

  const [gradeFilter, setGradeFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [detalle, setDetalle] = useState<'cumplimiento' | 'asistencia' | 'rendimiento' | 'acuerdos' | null>(null)

  // Clasificación robusta del nivel y cursos únicos por nivel.
  const normNivel = (v?: string | null): string => {
    const s = (v ?? '').toLowerCase()
    if (s.includes('inicial')) return 'Inicial'
    if (s.includes('primar')) return 'Primaria'
    if (s.includes('secund')) return 'Secundaria'
    return ''
  }
  const nivelDeCurso = (g: GradeSection): string => normNivel(g.level) || normNivel(g.nivel) || normNivel(detectLevel(g.name))

  // Ámbito de cursos según los filtros (grado tiene prioridad sobre nivel; vacío = todo).
  const scopeIds = useMemo<Set<string> | null>(() => {
    if (gradeFilter) {
      // Un curso agrupa varios registros (uno por asignatura); se incluyen todos por su nombre de curso.
      const g = grades.find((x) => x.id === gradeFilter)
      if (!g) return new Set([gradeFilter])
      const curso = cursoNombre(g)
      return new Set(grades.filter((x) => cursoNombre(x) === curso).map((x) => x.id))
    }
    if (levelFilter) return new Set(grades.filter((g) => nivelDeCurso(g) === levelFilter).map((g) => g.id))
    return null
  }, [gradeFilter, levelFilter, grades])

  // Cursos únicos (sin repetir) que corresponden al nivel seleccionado.
  const cursosOpciones = useMemo(() => {
    const base = levelFilter ? grades.filter((g) => nivelDeCurso(g) === levelFilter) : grades
    return ordenarCursos(base)
  }, [grades, levelFilter])
  const inScope = (gradeId?: string) => !scopeIds || (!!gradeId && scopeIds.has(gradeId))

  /** Pase de lista diario del aula (sin asignatura): matriculados vs asistieron. */
  const attendanceDiaria = useMemo(() => attendanceCol.items.filter((a) => !a.subjectId && inScope(a.gradeId)), [attendanceCol.items, scopeIds])
  const activities = useMemo(() => activitiesCol.items.filter((a) => inScope(a.gradeId)), [activitiesCol.items, scopeIds])
  const scores = useMemo(() => {
    const actGrade = new Map(activitiesCol.items.map((a) => [a.id, a.gradeId]))
    return scoresCol.items.filter((s) => inScope(actGrade.get(s.activityId)))
  }, [scoresCol.items, activitiesCol.items, scopeIds])

  /**
   * Cumplimiento de planificación: de las unidades de aprendizaje planificadas (aula virtual)
   * cuyo período ya venció (o cuya planificación fue creada), cuántas cuentan con informe de ejecución.
   */
  const planiUnidades = useMemo(() => {
    const hoy = todayIso()
    const teacherOf = new Map<string, string>()
    for (const a of assignmentsCol.items) {
      const k = `${a.gradeId}|${a.subjectId}`
      if (!teacherOf.has(k)) teacherOf.set(k, a.teacherId)
    }
    type Row = { subjectId: string; gradeId: string; teacherId: string; planificadas: number; vencidas: number; informes: number }
    const rows = new Map<string, Row>()
    const ensure = (subjectId: string, gradeId: string): Row => {
      const teacherId = teacherOf.get(`${gradeId}|${subjectId}`) ?? ''
      const key = `${gradeId}|${subjectId}|${teacherId}`
      if (!rows.has(key)) rows.set(key, { subjectId, gradeId, teacherId, planificadas: 0, vencidas: 0, informes: 0 })
      return rows.get(key) as Row
    }
    const detalle: { unidad: CursoUnidad; page: CoursePage; vencida: boolean; conInforme: boolean }[] = []
    let planificadas = 0
    let vencidas = 0
    let informes = 0
    for (const p of coursePagesCol.items.filter((x) => inScope(x.gradeId))) {
      for (const u of p.units) {
        const planificada = !!u.planFecha || !!u.planHtml
        if (!planificada) continue
        const vencida = u.hasta ? u.hasta < hoy : u.desde ? u.desde <= hoy : true
        planificadas++
        const r = ensure(p.subjectId, p.gradeId)
        r.planificadas++
        if (vencida) { vencidas++; r.vencidas++ }
        const conInforme = !!u.informeFecha
        if (conInforme) { informes++; r.informes++ }
        if (vencida) detalle.push({ unidad: u, page: p, vencida, conInforme })
      }
    }
    return { planificadas, vencidas, informes, rows: [...rows.values()], detalle }
  }, [coursePagesCol.items, assignmentsCol.items, scopeIds])

  const cumplimiento = pct(planiUnidades.informes, planiUnidades.vencidas || planiUnidades.planificadas)

  const avgAttendance = useMemo(() => {
    let total = 0
    let presentes = 0
    for (const rec of attendanceDiaria) {
      total += rec.entries.length
      presentes += rec.entries.filter((e) => e.status === 'presente').length
    }
    return pct(presentes, total)
  }, [attendanceDiaria])

  const avgAcademic = useMemo(() => {
    if (!scores.length) return 0
    const activitiesMap = new Map(activitiesCol.items.map((a) => [a.id, a.points]))
    const normalized = scores.map((s) => {
      const points = activitiesMap.get(s.activityId) ?? 100
      return (s.score / points) * 100
    })
    return Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length)
  }, [scores, activitiesCol.items])

  const bySubject = useMemo(() => {
    const map = new Map<string, { name: string; Planificadas: number; 'Con informe': number }>()
    for (const r of planiUnidades.rows) {
      const name = subjectById(r.subjectId)?.shortName ?? r.subjectId
      const e = map.get(r.subjectId) ?? { name, Planificadas: 0, 'Con informe': 0 }
      e.Planificadas += r.planificadas
      e['Con informe'] += r.informes
      map.set(r.subjectId, e)
    }
    return [...map.values()]
  }, [planiUnidades.rows, subjectById])

  const byTeacher = useMemo(() => {
    return planiUnidades.rows.reduce<Record<string, { plan: number; vencidas: number; informes: number }>>((acc, r) => {
      if (!r.teacherId) return acc
      acc[r.teacherId] = acc[r.teacherId] ?? { plan: 0, vencidas: 0, informes: 0 }
      acc[r.teacherId].plan += r.planificadas
      acc[r.teacherId].vencidas += r.vencidas
      acc[r.teacherId].informes += r.informes
      return acc
    }, {})
  }, [planiUnidades.rows])

  const avgBySubject = useMemo(() => {
    return subjects.map((s) => {
      const acts = activities.filter((a) => a.subjectId === s.id)
      if (!acts.length) return { name: s.shortName, promedio: 0 }
      const ids = new Set(acts.map((a) => a.id))
      const sc = scores.filter((g) => ids.has(g.activityId))
      if (!sc.length) return { name: s.shortName, promedio: 0 }
      const pointsMap = new Map(acts.map((a) => [a.id, a.points]))
      const norm = sc.map((g) => (g.score / (pointsMap.get(g.activityId) ?? 100)) * 100)
      return { name: s.shortName, promedio: Math.round(norm.reduce((a, b) => a + b, 0) / norm.length) }
    })
  }, [subjects, activities, scores])

  const dayTrend = useMemo(() => {
    const map = new Map<string, { date: string; p: number; t: number }>()
    for (const rec of attendanceDiaria) {
      const e = map.get(rec.date) ?? { date: rec.date, p: 0, t: 0 }
      e.t += rec.entries.length
      e.p += rec.entries.filter((x) => x.status === 'presente').length
      map.set(rec.date, e)
    }
    return [...map.values()]
      .map((d) => ({ ...d, asistencia: pct(d.p, d.t) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [attendanceDiaria])

  const pendingAgreements = useMemo(() => {
    const teacherIds = scopeIds ? new Set(teachers.filter((t) => t.grades.some((g) => scopeIds.has(g))).map((t) => t.id)) : null
    return meetingsCol.items
      .filter((m) => !teacherIds || teacherIds.has(m.organizerId))
      .flatMap((m) => (m.record?.agreements ?? []).filter((a) => a.status !== 'completado')).length
  }, [meetingsCol.items, scopeIds, teachers])

  // Reporte por asignatura asignada: planificación (unidades) e interacción del docente.
  const detalleAsignaturas = useMemo(() => {
    type Row = { key: string; subjectId: string; gradeId: string; teacherId: string; plan: number; venc: number; inf: number; act: number; asi: number; cal: number }
    const map = new Map<string, Row>()
    const keyOf = (subjectId: string, gradeId: string, teacherId: string) => `${subjectId}|${gradeId}|${teacherId}`
    const ensure = (subjectId: string, gradeId: string, teacherId: string) => {
      const key = keyOf(subjectId, gradeId, teacherId)
      if (!map.has(key)) map.set(key, { key, subjectId, gradeId, teacherId, plan: 0, venc: 0, inf: 0, act: 0, asi: 0, cal: 0 })
      return map.get(key) as Row
    }
    for (const a of assignmentsCol.items.filter((x) => inScope(x.gradeId))) ensure(a.subjectId, a.gradeId, a.teacherId)
    for (const r of planiUnidades.rows) { const e = ensure(r.subjectId, r.gradeId, r.teacherId); e.plan += r.planificadas; e.venc += r.vencidas; e.inf += r.informes }
    for (const a of activitiesCol.items.filter((x) => inScope(x.gradeId))) ensure(a.subjectId, a.gradeId, a.teacherId).act += 1
    const actSubject = new Map(activitiesCol.items.map((a) => [a.id, a]))
    for (const s of scoresCol.items) { const act = actSubject.get(s.activityId); if (act && inScope(act.gradeId)) ensure(act.subjectId, act.gradeId, act.teacherId).cal += 1 }
    for (const r of attendanceCol.items.filter((x) => x.subjectId && inScope(x.gradeId))) for (const e of map.values()) if (e.subjectId === r.subjectId && e.gradeId === r.gradeId) e.asi += 1
    return [...map.values()].sort((a, b) => (subjectById(a.subjectId)?.name ?? a.subjectId).localeCompare(subjectById(b.subjectId)?.name ?? b.subjectId))
  }, [assignmentsCol.items, planiUnidades.rows, activitiesCol.items, scoresCol.items, attendanceCol.items, subjectById, scopeIds])

  const pieCumplimiento = [
    { name: 'Con informe de ejecución', value: planiUnidades.informes, color: '#004D6B' },
    { name: 'Vencidas sin informe', value: Math.max(planiUnidades.vencidas - planiUnidades.informes, 0), color: '#E30613' },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <PageHeader
        title="Dirección y Coordinación Pedagógica"
        subtitle="Monitoreo institucional, indicadores de rendimiento académico, supervisión docente y toma de decisiones estratégicas."
      />

      <AsistenciaDashboard level={levelFilter || undefined} />

      <StaffAsistenciaPanel />

      <div className={styles.filterRow}>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los cursos</option>
          {cursosOpciones.map((g) => (
            <option key={g.id} value={g.id}>{cursoNombre(g)}</option>
          ))}
        </Select>
        <Select value={levelFilter} onChange={(_, d) => { setLevelFilter(d.value); setGradeFilter('') }} style={{ minWidth: '180px' }}>
          <option value="">Todos los niveles</option>
          <option value="Inicial">Inicial</option>
          <option value="Primaria">Primaria</option>
          <option value="Secundaria">Secundaria</option>
        </Select>
      </div>

      <div className={styles.kpis}>
        <StatCard title="Cumplimiento de planificación" value={`${cumplimiento}%`} icon={<CalendarCheckmarkRegular />} color="#EF6C00" sub={`${planiUnidades.informes} informes de ejecución de ${planiUnidades.vencidas} planificaciones vencidas`} action={<Button appearance="subtle" size="small" onClick={() => setDetalle('cumplimiento')}>Verificar detalle</Button>} />
        <StatCard title="Asistencia promedio" value={`${avgAttendance}%`} icon={<NotebookRegular />} color="#0084B3" sub="Pase de lista de cada aula: matriculados vs asistieron" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('asistencia')}>Verificar detalle</Button>} />
        <StatCard title="Rendimiento académico" value={`${avgAcademic}/100`} icon={<StarRegular />} color="#AD1457" sub="Promedio normalizado de actividades" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('rendimiento')}>Verificar detalle</Button>} />
        <StatCard title="Acuerdos pendientes" value={pendingAgreements} icon={<CalendarCheckmarkRegular />} color="#7D1D24" sub="Derivados de encuentros virtuales" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('acuerdos')}>Verificar detalle</Button>} />
      </div>

      <Text weight="semibold" size={500} block style={{ margin: '4px 0 12px' }}>Grupos de personas</Text>
      <div style={{ marginBottom: '20px' }}>
        <GruposPersonas scopeIds={scopeIds} levelFilter={levelFilter} />
      </div>

      <Text weight="semibold" size={500} block style={{ margin: '4px 0 12px' }}>Actividad y cumplimiento por portal</Text>
      <div style={{ marginBottom: '20px' }}>
        <PortalesActividad scopeIds={scopeIds} />
      </div>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Unidades de aprendizaje planificadas vs. informes de ejecución</Text>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <RTooltip />
              <Legend />
              <Bar dataKey="Planificadas" fill="#004D6B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Con informe" fill="#E30613" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Promedio académico por asignatura</Text>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={avgBySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <RTooltip formatter={(v) => [`${v}`, 'Promedio']} />
              <Bar dataKey="promedio" fill="#0084B3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Distribución de cumplimiento</Text>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieCumplimiento} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                {pieCumplimiento.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <RTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Tendencia de asistencia</Text>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dayTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} minTickGap={16} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <RTooltip formatter={(v) => [`${v}%`, 'Asistencia']} labelFormatter={(v) => formatDate(String(v))} />
              <Line type="monotone" dataKey="asistencia" stroke="#004D6B" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400} block>Supervisión de cumplimiento por docente</Text>
          <Table aria-label="Cumplimiento por docente" style={{ marginTop: '12px' }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Docente</TableHeaderCell>
                <TableHeaderCell>Unidades planificadas</TableHeaderCell>
                <TableHeaderCell>Vencidas</TableHeaderCell>
                <TableHeaderCell>Informes de ejecución</TableHeaderCell>
                <TableHeaderCell>Cumplimiento</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(byTeacher).map(([teacherId, v]) => (
                <TableRow key={teacherId}>
                  <TableCell>{teacherById(teacherId)?.fullName ?? '—'}</TableCell>
                  <TableCell>{v.plan}</TableCell>
                  <TableCell>{v.vencidas}</TableCell>
                  <TableCell>{v.informes}</TableCell>
                  <TableCell>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: pct(v.informes, v.vencidas || v.plan) >= 90 ? '#2E7D32' : pct(v.informes, v.vencidas || v.plan) >= 60 ? '#EF6C00' : '#C8102E',
                        color: '#fff',
                      }}
                    >
                      {pct(v.informes, v.vencidas || v.plan)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ModalForm
        open={!!detalle}
        onOpenChange={(o) => { if (!o) setDetalle(null) }}
        title={
          detalle === 'cumplimiento' ? 'Detalle por asignatura · trabajo del docente'
            : detalle === 'asistencia' ? 'Detalle · Asistencia promedio'
              : detalle === 'rendimiento' ? 'Detalle · Rendimiento académico'
                : 'Detalle · Acuerdos pendientes'
        }
        subtitle="Informes de lo realizado por el docente en las asignaturas que le fueron asignadas (aulas por curso)."
        width={1000}
        actions={<Button appearance="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle === 'cumplimiento' && (
          <Table aria-label="Detalle por asignatura">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Asignatura</TableHeaderCell>
                <TableHeaderCell>Curso</TableHeaderCell>
                <TableHeaderCell>Docente</TableHeaderCell>
                <TableHeaderCell>Unidades planificadas</TableHeaderCell>
                <TableHeaderCell>Vencidas</TableHeaderCell>
                <TableHeaderCell>Informes de ejecución</TableHeaderCell>
                <TableHeaderCell>Actividades</TableHeaderCell>
                <TableHeaderCell>Asistencia</TableHeaderCell>
                <TableHeaderCell>Calificaciones</TableHeaderCell>
                <TableHeaderCell>Cumplimiento</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalleAsignaturas.map((r) => {
                const g = gradeById(r.gradeId)
                return (
                  <TableRow key={r.key}>
                    <TableCell>{subjectById(r.subjectId)?.name ?? r.subjectId}</TableCell>
                    <TableCell>{g ? cursoNombre(g) : r.gradeId}</TableCell>
                    <TableCell>{teacherById(r.teacherId)?.fullName ?? '—'}</TableCell>
                    <TableCell>{r.plan}</TableCell>
                    <TableCell>{r.venc}</TableCell>
                    <TableCell>{r.inf}</TableCell>
                    <TableCell>{r.act}</TableCell>
                    <TableCell>{r.asi}</TableCell>
                    <TableCell>{r.cal}</TableCell>
                    <TableCell>{(r.venc || r.plan) ? `${pct(r.inf, r.venc || r.plan)}%` : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'asistencia' && (
          <Table aria-label="Detalle asistencia">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Curso / Aula</TableHeaderCell>
                <TableHeaderCell>Presentes</TableHeaderCell>
                <TableHeaderCell>Matriculados</TableHeaderCell>
                <TableHeaderCell>%</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceDiaria.map((rec) => {
                const total = rec.entries.length
                const presentes = rec.entries.filter((e) => e.status === 'presente').length
                const g = gradeById(rec.gradeId)
                return (
                  <TableRow key={rec.id}>
                    <TableCell>{formatDate(rec.date)}</TableCell>
                    <TableCell>{g ? cursoNombre(g) : '—'}</TableCell>
                    <TableCell>{presentes}</TableCell>
                    <TableCell>{total}</TableCell>
                    <TableCell>{pct(presentes, total)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'rendimiento' && (
          <Table aria-label="Detalle rendimiento">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Estudiante</TableHeaderCell>
                <TableHeaderCell>Actividad</TableHeaderCell>
                <TableHeaderCell>Nota</TableHeaderCell>
                <TableHeaderCell>Puntos</TableHeaderCell>
                <TableHeaderCell>%</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((s) => {
                const act = activitiesCol.items.find((a) => a.id === s.activityId)
                const pts = act?.points ?? 100
                return (
                  <TableRow key={s.id}>
                    <TableCell>{studentById(s.studentId)?.fullName ?? '—'}</TableCell>
                    <TableCell>{act?.title ?? s.activityId}</TableCell>
                    <TableCell>{s.score}</TableCell>
                    <TableCell>{pts}</TableCell>
                    <TableCell>{pct(s.score, pts)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'acuerdos' && (
          <Table aria-label="Detalle acuerdos">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Encuentro</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Acuerdo</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetingsCol.items.flatMap((m) => (m.record?.agreements ?? []).filter((a) => a.status !== 'completado').map((a) => (
                <TableRow key={`${m.id}-${a.id}`}>
                  <TableCell>{m.title}</TableCell>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell>{a.description}</TableCell>
                  <TableCell>{a.status}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        )}
      </ModalForm>
    </div>
  )
}
