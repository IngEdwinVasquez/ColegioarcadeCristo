import { useMemo, useState } from 'react'
import { Button, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { SaveRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { FormField, FieldRow } from '../../components/shared/form'
import { StatusBadge } from '../../components/shared/StatusBadge'
import type { AttendanceRecord, AttendanceStatus, SchoolClassRecord } from '../../types'
import { formatDate, genId, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' },
  legend: { display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '12px 0' },
  studentCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  summary: { marginBottom: '12px', color: tokens.colorNeutralForeground2 },
})

export function TomarAsistencia({ classes }: { classes: SchoolClassRecord[] }) {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, subjects, grades, subjectById, gradeById, user } = useApp()

  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance, dataService.saveAttendance)

  const [selectedClassId, setSelectedClassId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [subjectId, setSubjectId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [period, setPeriod] = useState('')
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const filteredClasses = useMemo(
    () => classes.filter((c) => c.status !== 'cancelada'),
    [classes],
  )

  const gradeStudents = useMemo(() => students.filter((s) => s.gradeId === gradeId), [students, gradeId])

  const existingRecord = useMemo(
    () => (selectedClassId ? attendanceCol.items.find((a) => a.classId === selectedClassId) : undefined),
    [selectedClassId, attendanceCol.items],
  )

  const selectClass = (classId: string) => {
    setSelectedClassId(classId)
    const clase = filteredClasses.find((c) => c.id === classId)
    if (clase) {
      setSubjectId(clase.subjectId)
      setGradeId(clase.gradeId)
      setDate(clase.date)
      setPeriod(clase.period)
      const record = attendanceCol.items.find((a) => a.classId === classId)
      if (record) {
        const map: Record<string, AttendanceStatus> = {}
        const noteMap: Record<string, string> = {}
        for (const e of record.entries) {
          map[e.studentId] = e.status
          noteMap[e.studentId] = e.note ?? ''
        }
        setEntries(map)
        setNotes(noteMap)
      } else {
        setEntries(Object.fromEntries(gradeStudents.map((s) => [s.id, 'presente'])))
        setNotes({})
      }
    }
  }

  const allPresent = () => {
    const map: Record<string, AttendanceStatus> = {}
    for (const s of gradeStudents) map[s.id] = 'presente'
    setEntries(map)
  }

  const countBy = (status: AttendanceStatus) => gradeStudents.filter((s) => entries[s.id] === status).length

  const save = async () => {
    if (!gradeId || !subjectId || !date) {
      window.alert('Seleccione una clase o complete asignatura, grado y fecha.')
      return
    }
    const entriesArr = gradeStudents.map((s) => ({
      studentId: s.id,
      status: entries[s.id] ?? 'presente',
      note: notes[s.id] ?? '',
    }))
    const record: AttendanceRecord = {
      id: existingRecord?.id ?? genId('att'),
      classId: selectedClassId,
      subjectId,
      gradeId,
      date,
      period,
      entries: entriesArr,
      takenBy: user?.teacherId ?? 'docente',
      takenAt: new Date().toISOString(),
    }
    setSaving(true)
    try {
      await attendanceCol.save(record)
      toaster.dispatchToast("Asistencia registrada", { intent: "success" })
    } finally {
      setSaving(false)
    }
  }

  const summary = (
    <div className={styles.summary}>
      Presentes: <strong>{countBy('presente')}</strong> · Ausentes: <strong>{countBy('ausente')}</strong> · Tardanzas: <strong>{countBy('tarde')}</strong> · Justificados: <strong>{countBy('justificado')}</strong>
    </div>
  )

  return (
    <div>
      <FieldRow>
        <FormField label="Clase impartida" hint="Seleccione la clase para precargar asignatura, grado y fecha.">
          <Select value={selectedClassId} onChange={(_, d) => selectClass(d.value)}>
            <option value="">— Seleccionar clase —</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {formatDate(c.date)} · {subjectById(c.subjectId)?.name ?? c.subjectId} · {gradeById(c.gradeId)?.name ?? c.gradeId}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Asignatura" required>
          <Select value={subjectId} onChange={(_, d) => setSubjectId(d.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Grado" required>
          <Select value={gradeId} onChange={(_, d) => setGradeId(d.value)}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Fecha">
          <input name="fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: `1px solid ${tokens.colorNeutralStroke1}` }} />
        </FormField>
      </FieldRow>

      {gradeStudents.length === 0 && <Text>Seleccione una clase o un grado para ver la lista de estudiantes.</Text>}

      {gradeStudents.length > 0 && (
        <>
          {summary}
          <div className={styles.legend}>
            {(['presente', 'ausente', 'tarde', 'justificado'] as AttendanceStatus[]).map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <Button appearance="subtle" icon={<CheckmarkCircleRegular />} onClick={allPresent}>Marcar todos presentes</Button>

          <Table aria-label="Asistencia" style={{ marginTop: '12px' }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Estudiante</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Nota</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gradeStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className={styles.studentCell}>
                      <span style={{ fontSize: '16px' }}>👤</span>
                      <div>
                        <Text size={300} weight="semibold" block>{s.fullName}</Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{gradeById(s.gradeId)?.name ?? ''}</Text>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entries[s.id] ?? 'presente'}
                      onChange={(_, d) => setEntries((prev) => ({ ...prev, [s.id]: d.value as AttendanceStatus }))}
                      style={{ minWidth: '140px' }}
                    >
                      <option value="presente">Presente</option>
                      <option value="ausente">Ausente</option>
                      <option value="tarde">Tarde</option>
                      <option value="justificado">Justificado</option>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      placeholder="Nota (opcional)"
                      value={notes[s.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: `1px solid ${tokens.colorNeutralStroke1}` }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button appearance="primary" icon={<SaveRegular />} onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : existingRecord ? 'Actualizar asistencia' : 'Guardar asistencia'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
