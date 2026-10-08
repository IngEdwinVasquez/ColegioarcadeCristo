import { useMemo } from 'react'
import { Badge, Card, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { cursoNombre, nivelShort, ordenarCursos } from '../../utils/academic'
import type { AttendanceRecord, GradeSection, TeacherAssignment } from '../../types'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px', marginBottom: '16px' },
  kpi: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '2px' },
  value: { fontSize: '26px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
})

interface Fila { curso: string; nivel: string; dias: number; presente: number; ausente: number; tarde: number; justificado: number; total: number }

/**
 * Panel de asistencia. Sin filtros muestra todo; con `level` filtra por nivel
 * (Dirección/Tecnología/Coordinación) y con `teacherId` por docente.
 */
export function AsistenciaDashboard({ level, teacherId }: { level?: string; teacherId?: string }) {
  const styles = useStyles()
  const { grades, gradeById } = useApp()
  const attCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const asgCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)

  const filas = useMemo<Fila[]>(() => {
    // Cursos en alcance.
    let cursos: GradeSection[] = grades
    if (level) cursos = cursos.filter((g) => nivelShort(g.level) === level)
    if (teacherId) {
      const ids = new Set(asgCol.items.filter((a) => a.teacherId === teacherId).map((a) => a.gradeId))
      cursos = cursos.filter((g) => ids.has(g.id))
    }
    const permitidos = new Set(cursos.map((g) => cursoNombre(g)))

    const map = new Map<string, Fila>()
    for (const a of attCol.items) {
      if (a.subjectId) continue // solo pase de lista diario del aula
      const g = gradeById(a.gradeId)
      if (!g) continue
      const curso = cursoNombre(g)
      if (!permitidos.has(curso)) continue
      const fila = map.get(curso) ?? { curso, nivel: nivelShort(g.level), dias: 0, presente: 0, ausente: 0, tarde: 0, justificado: 0, total: 0 }
      fila.dias += 1
      for (const e of a.entries) {
        if (e.status === 'presente') fila.presente += 1
        else if (e.status === 'ausente') fila.ausente += 1
        else if (e.status === 'tarde') fila.tarde += 1
        else if (e.status === 'justificado') fila.justificado += 1
      }
      fila.total = fila.presente + fila.ausente + fila.tarde + fila.justificado
      map.set(curso, fila)
    }
    return ordenarCursos(cursos)
      .map((g) => map.get(cursoNombre(g)))
      .filter((f): f is Fila => !!f)
  }, [grades, level, teacherId, attCol.items, asgCol.items, gradeById])

  const totales = useMemo(() => {
    const t = { dias: 0, presente: 0, total: 0 }
    for (const f of filas) { t.dias += f.dias; t.presente += f.presente; t.total += f.total }
    return { ...t, pct: t.total ? Math.round((t.presente / t.total) * 100) : 0 }
  }, [filas])

  return (
    <Card className={styles.kpi} style={{ padding: '18px' }}>
      <Text weight="semibold" size={400}>Asistencia{level ? ` · ${level}` : ''}</Text>
      <Text size={200} style={{ color: 'var(--texto-suave)', marginBottom: '12px' }}>
        Pase de lista diario de las aulas. {filas.length} curso(s) con registros.
      </Text>
      <div className={styles.kpis}>
        <div><span className={styles.value}>{filas.length}</span><span className={styles.label} style={{ display: 'block' }}>Cursos con asistencia</span></div>
        <div><span className={styles.value}>{totales.dias}</span><span className={styles.label} style={{ display: 'block' }}>Pases de lista</span></div>
        <div><span className={styles.value}>{totales.pct}%</span><span className={styles.label} style={{ display: 'block' }}>Asistencia promedio</span></div>
      </div>
      {attCol.loading ? (
        <Spinner label="Cargando asistencia…" />
      ) : filas.length === 0 ? (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Aún no hay pase de lista registrado en su alcance.</Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Curso</TableHeaderCell>
                <TableHeaderCell>Pases</TableHeaderCell>
                <TableHeaderCell>Presentes</TableHeaderCell>
                <TableHeaderCell>Ausentes</TableHeaderCell>
                <TableHeaderCell>Tardanzas</TableHeaderCell>
                <TableHeaderCell>Justificados</TableHeaderCell>
                <TableHeaderCell>% Asistencia</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.curso}>
                  <TableCell><Text weight="semibold">{f.curso}</Text></TableCell>
                  <TableCell>{f.dias}</TableCell>
                  <TableCell>{f.presente}</TableCell>
                  <TableCell>{f.ausente}</TableCell>
                  <TableCell>{f.tarde}</TableCell>
                  <TableCell>{f.justificado}</TableCell>
                  <TableCell><Badge appearance="filled" color={f.total && f.presente / f.total >= 0.85 ? 'success' : 'warning'}>{f.total ? Math.round((f.presente / f.total) * 100) : 0}%</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
