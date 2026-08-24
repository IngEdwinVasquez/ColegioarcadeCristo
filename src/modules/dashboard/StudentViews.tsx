import { useEffect, useMemo } from 'react'
import { Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from '@fluentui/react-components'
import { useApp } from '../../context/useApp'
import { useMyChildren } from '../../hooks/useMyChildren'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { FormField } from '../../components/shared/form'
import type { Activity, AttendanceRecord, Grade, SchoolClassRecord } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  card: { padding: '20px' },
  subtitle: { color: tokens.colorNeutralForeground2 },
  selector: { maxWidth: '420px', marginBottom: '20px' },
})

export function StudentClassesView({ studentId }: { studentId: string }) {
  const styles = useStyles()
  const { studentById, subjectById, gradeById } = useApp()
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const gradeId = studentById(studentId)?.gradeId

  const mine = useMemo(
    () =>
      classesCol.items
        .filter((c) => c.gradeId === gradeId)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [classesCol.items, gradeId],
  )

  return (
    <div className="panel">
      <Text weight="semibold" size={400} block>Clases de mi grado · {gradeById(gradeId ?? '')?.name ?? ''}</Text>
      <Text size={200} className={styles.subtitle} block>Registro de clases impartidas en mi curso.</Text>
      <Table aria-label="Clases del estudiante" style={{ marginTop: '12px' }}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Clase</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mine.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{formatDate(c.date)}</TableCell>
              <TableCell>{subjectById(c.subjectId)?.name ?? c.subjectId}</TableCell>
              <TableCell>{c.title}</TableCell>
              <TableCell><StatusBadge status={c.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function StudentAulaView({ studentId }: { studentId: string }) {
  const styles = useStyles()
  const { studentById, subjectById } = useApp()
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const gradeId = studentById(studentId)?.gradeId

  const mine = useMemo(() => activitiesCol.items.filter((a) => a.gradeId === gradeId), [activitiesCol.items, gradeId])
  const myScores = useMemo(() => scoresCol.items.filter((s) => s.studentId === studentId), [scoresCol.items, studentId])

  const scoreBy = useMemo(() => {
    const m = new Map<string, Grade>()
    for (const s of myScores) m.set(s.activityId, s)
    return m
  }, [myScores])

  return (
    <div className="panel">
      <Text weight="semibold" size={400} block>Aula Virtual · Mis actividades y calificaciones</Text>
      <Text size={200} className={styles.subtitle} block>Guías de estudio, tareas y resultados de las actividades de mis asignaturas.</Text>
      <Table aria-label="Mis actividades" style={{ marginTop: '12px' }}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Actividad</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Entrega</TableHeaderCell>
            <TableHeaderCell>Puntos</TableHeaderCell>
            <TableHeaderCell>Mi nota</TableHeaderCell>
            <TableHeaderCell>Comentario</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mine
            .slice()
            .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
            .map((a) => {
              const s = scoreBy.get(a.id)
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <Text size={300} weight="semibold" block>{a.title}</Text>
                    <Text size={200} className={styles.subtitle}>{a.type}</Text>
                    {a.attachments?.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>
                        📎 {a.attachmentRefs?.find((r) => r.webUrl === url)?.name ?? `Material ${i + 1}`}
                      </a>
                    ))}
                  </TableCell>
                  <TableCell>{subjectById(a.subjectId)?.shortName ?? ''}</TableCell>
                  <TableCell>{formatDate(a.dueDate)}</TableCell>
                  <TableCell>{a.points}</TableCell>
                  <TableCell>
                    {s ? (
                      <Text weight="semibold" style={{ color: s.score / a.points >= 0.7 ? '#2E7D32' : '#C8102E' }}>{s.score} / {a.points}</Text>
                    ) : (
                      <StatusBadge status="pendiente">Pendiente</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>{s?.comment ?? '—'}</TableCell>
                </TableRow>
              )
            })}
        </TableBody>
      </Table>
    </div>
  )
}

export function StudentAsistenciaView({ studentId }: { studentId: string }) {
  const styles = useStyles()
  const { studentById, subjectById } = useApp()
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const gradeId = studentById(studentId)?.gradeId

  const mine = useMemo(
    () =>
      attendanceCol.items
        .filter((a) => a.gradeId === gradeId)
        .flatMap((a) => {
          const e = a.entries.find((x) => x.studentId === studentId)
          return e ? [{ date: a.date, period: a.period, subjectId: a.subjectId, status: e.status, note: e.note }] : []
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [attendanceCol.items, gradeId, studentId],
  )

  return (
    <div className="panel">
      <Text weight="semibold" size={400} block>Mi registro de asistencia</Text>
      <Text size={200} className={styles.subtitle} block>Asistencia registrada por cada asignatura impartida.</Text>
      <Table aria-label="Mi asistencia" style={{ marginTop: '12px' }}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Periodo</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Nota</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mine.map((r, idx) => (
            <TableRow key={idx}>
              <TableCell>{formatDate(r.date)}</TableCell>
              <TableCell>{subjectById(r.subjectId)?.name ?? ''}</TableCell>
              <TableCell>{r.period}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell>{r.note || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function StudentPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const styles = useStyles()
  const { gradeById } = useApp()
  // Privacidad: un padre solo ve a los estudiantes vinculados a su cuenta.
  const children = useMyChildren()
  useEffect(() => {
    if (!value && children.length === 1) onChange(children[0].id)
    if (value && !children.some((c) => c.id === value)) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, value])

  if (children.length === 0) {
    return (
      <div className={styles.selector}>
        <Text size={300} style={{ color: 'var(--texto-suave)' }}>
          Su cuenta no tiene estudiantes vinculados. Solicite a la administración del colegio que lo registre como padre o tutor de su hijo(a).
        </Text>
      </div>
    )
  }
  return (
    <div className={styles.selector}>
      <FormField label="Seleccione a su hijo(a)">
        <Select value={value} onChange={(_, d) => onChange(d.value)}>
          {!value && <option value="">— Seleccionar —</option>}
          {children.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} · {gradeById(s.gradeId)?.name ?? ''}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  )
}
