import { useMemo } from 'react'
import { Card, Spinner, Text, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { cursoNombre, nivelShort } from '../../utils/academic'
import type { AsignaturaLog, AttendanceRecord, Accompaniment, CoursePage, EnrollmentLogEntry } from '../../types'

const useStyles = makeStyles({
  wrap: { display: 'flex', flexDirection: 'column', gap: '12px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '12px' },
  value: { fontSize: '24px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '18px' },
  chartCard: { padding: '16px' },
})

const PIE_COLORS = ['#004D6B', '#EF6C00', '#C8102E', '#15803D']

/**
 * Actividad del aula (aula virtual): agrega lo que se realiza por curso —unidades,
 * actividades, entregas, pase de lista, movimientos de estudiantes y asignaturas, y
 * acompañamiento— filtrando por nivel (Dirección/Tecnología/Coordinación).
 */
export function AulaActividadDashboard({ level }: { level?: string }) {
  const styles = useStyles()
  const { grades, gradeById } = useApp()
  const pagesCol = useCollection<CoursePage>(dataService.getCoursePages)
  const attCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const enrLogCol = useCollection<EnrollmentLogEntry>(dataService.getEnrollmentLog)
  const asigLogCol = useCollection<AsignaturaLog>(dataService.getAsignaturaLog)
  const accCol = useCollection<Accompaniment>(dataService.getAccompaniments)

  const { cursos, gradeIds, permitidos } = useMemo(() => {
    const cur = level ? grades.filter((g) => nivelShort(g.level) === level) : grades
    return {
      cursos: cur,
      gradeIds: new Set(cur.map((g) => g.id)),
      permitidos: new Set(cur.map((g) => cursoNombre(g))),
    }
  }, [grades, level])

  const actividad = useMemo(() => {
    const map = new Map<string, { name: string; Unidades: number; Actividades: number; Entregas: number; 'Pase de lista': number }>()
    const get = (name: string) => map.get(name) ?? { name, Unidades: 0, Actividades: 0, Entregas: 0, 'Pase de lista': 0 }
    for (const p of pagesCol.items) {
      if (!gradeIds.has(p.gradeId)) continue
      const g = gradeById(p.gradeId)
      const name = g ? cursoNombre(g) : p.curso
      const e = get(name)
      e.Unidades += p.units?.length ?? 0
      e.Actividades += (p.units ?? []).reduce((a, u) => a + (u.actividades?.length ?? 0), 0)
      e.Entregas += p.entregas?.length ?? 0
      map.set(name, e)
    }
    for (const a of attCol.items) {
      if (a.subjectId || !gradeIds.has(a.gradeId)) continue
      const g = gradeById(a.gradeId)
      const name = g ? cursoNombre(g) : a.gradeId
      const e = get(name)
      e['Pase de lista'] += 1
      map.set(name, e)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [pagesCol.items, attCol.items, gradeIds, gradeById])

  const movEstudiantes = useMemo(() => {
    const map = new Map<string, { name: string; Agregados: number; Eliminados: number }>()
    for (const l of enrLogCol.items) {
      if (!permitidos.has(l.curso)) continue
      const e = map.get(l.curso) ?? { name: l.curso, Agregados: 0, Eliminados: 0 }
      if (l.action === 'agregado') e.Agregados++
      else e.Eliminados++
      map.set(l.curso, e)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [enrLogCol.items, permitidos])

  const movAsignaturas = useMemo(() => {
    const map = new Map<string, { name: string; Agregadas: number; Eliminadas: number }>()
    for (const l of asigLogCol.items) {
      if (!permitidos.has(l.curso)) continue
      const e = map.get(l.curso) ?? { name: l.curso, Agregadas: 0, Eliminadas: 0 }
      if (l.action === 'agregado') e.Agregadas++
      else e.Eliminadas++
      map.set(l.curso, e)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [asigLogCol.items, permitidos])

  const acamp = useMemo(() => {
    const c = { planificado: 0, realizado: 0, seguimiento: 0 }
    for (const a of accCol.items) {
      if (level && a.level !== level) continue
      if (a.status === 'realizado') c.realizado++
      else if (a.status === 'seguimiento') c.seguimiento++
      else c.planificado++
    }
    return c
  }, [accCol.items, level])

  const totals = useMemo(() => {
    let unidades = 0
    let actividades = 0
    let entregas = 0
    let pases = 0
    for (const a of actividad) { unidades += a.Unidades; actividades += a.Actividades; entregas += a.Entregas; pases += a['Pase de lista'] }
    return { unidades, actividades, entregas, pases, cursos: cursos.length }
  }, [actividad, cursos.length])

  const acampData = [
    { name: 'Planificado', value: acamp.planificado },
    { name: 'Realizado', value: acamp.realizado },
    { name: 'En seguimiento', value: acamp.seguimiento },
  ].filter((d) => d.value > 0)

  const loading = pagesCol.loading || attCol.loading

  return (
    <Card className={styles.chartCard}>
      <Text weight="semibold" size={400}>Actividad en el aula{level ? ` · ${level}` : ''}</Text>
      <Text size={200} style={{ color: 'var(--texto-suave)', marginBottom: '12px' }}>
        Lo que realizan docentes, estudiantes, coordinación y tecnología en las aulas {level ? 'de su nivel' : 'del colegio'}.
      </Text>
      {loading ? (
        <Spinner label="Cargando actividad del aula…" />
      ) : (
        <div className={styles.wrap}>
          <div className={styles.kpis}>
            <div><span className={styles.value}>{totals.cursos}</span><span className={styles.label} style={{ display: 'block' }}>Aulas</span></div>
            <div><span className={styles.value}>{totals.unidades}</span><span className={styles.label} style={{ display: 'block' }}>Unidades de aprendizaje</span></div>
            <div><span className={styles.value}>{totals.actividades}</span><span className={styles.label} style={{ display: 'block' }}>Actividades publicadas</span></div>
            <div><span className={styles.value}>{totals.entregas}</span><span className={styles.label} style={{ display: 'block' }}>Entregas de estudiantes</span></div>
            <div><span className={styles.value}>{totals.pases}</span><span className={styles.label} style={{ display: 'block' }}>Pases de lista</span></div>
          </div>

          <div className={styles.grid}>
            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Contenido y actividad por aula</Text>
              {actividad.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin datos.</Text> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={actividad}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RTooltip /><Legend />
                    <Bar dataKey="Unidades" fill="#004D6B" stackId="a" />
                    <Bar dataKey="Actividades" fill="#0084B3" stackId="a" />
                    <Bar dataKey="Entregas" fill="#2AA9D8" stackId="a" />
                    <Bar dataKey="Pase de lista" fill="#7C3AED" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Movimientos de estudiantes por aula</Text>
              {movEstudiantes.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin movimientos.</Text> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={movEstudiantes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RTooltip /><Legend />
                    <Bar dataKey="Agregados" fill="#15803D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Eliminados" fill="#C8102E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Movimientos de asignaturas por aula</Text>
              {movAsignaturas.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin movimientos.</Text> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={movAsignaturas}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RTooltip /><Legend />
                    <Bar dataKey="Agregadas" fill="#15803D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Eliminadas" fill="#C8102E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Acompañamiento docente</Text>
              {acampData.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin acompañamientos.</Text> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={acampData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {acampData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend /><RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
