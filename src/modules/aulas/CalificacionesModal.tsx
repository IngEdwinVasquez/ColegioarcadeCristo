import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { SaveRegular, StarRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Activity, Grade } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  scoreCell: { width: '120px' },
  avgRow: { marginTop: '12px', color: tokens.colorNeutralForeground2 },
})

interface CalificacionesModalProps {
  activity: Activity
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CalificacionesModal({ activity, open, onOpenChange }: CalificacionesModalProps) {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, gradeById, user } = useApp()
  const scoresCol = useCollection<Grade>(dataService.getScores, dataService.saveScore)

  const gradeStudents = useMemo(() => students.filter((s) => s.gradeId === activity.gradeId), [students, activity.gradeId])
  const existingScores = useMemo(() => scoresCol.items.filter((g) => g.activityId === activity.id), [scoresCol.items, activity.id])

  const [values, setValues] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map: Record<string, string> = {}
    const noteMap: Record<string, string> = {}
    for (const s of gradeStudents) {
      const score = existingScores.find((g) => g.studentId === s.id)
      map[s.id] = score ? String(score.score) : ''
      noteMap[s.id] = score?.comment ?? ''
    }
    setValues(map)
    setComments(noteMap)
  }, [gradeStudents, existingScores])

  const average = useMemo(() => {
    const vals = Object.values(values).filter((v) => v !== '' && !Number.isNaN(Number(v)))
    if (!vals.length) return null
    return (vals.reduce((acc, v) => acc + Number(v), 0) / vals.length).toFixed(1)
  }, [values])

  const save = async () => {
    setSaving(true)
    try {
      for (const s of gradeStudents) {
        const raw = values[s.id]?.trim()
        const score = raw === '' ? null : Number(raw)
        const existing = existingScores.find((g) => g.studentId === s.id)
        const gradeRecord: Grade = {
          id: existing?.id ?? genId('score'),
          activityId: activity.id,
          studentId: s.id,
          score: score ?? 0,
          comment: comments[s.id] ?? '',
          gradedBy: user?.teacherId ?? 'docente',
          gradedAt: new Date().toISOString(),
        }
        if (score !== null) await scoresCol.save(gradeRecord)
      }
      toaster.dispatchToast("Calificaciones guardadas", { intent: "success" })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title={`Calificar · ${activity.title}`}
      subtitle={`${gradeById(activity.gradeId)?.name ?? ''} · Valor ${activity.points} puntos · Escala 0-${activity.points}`}
      width={760}
      actions={
        <>
          <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button appearance="primary" icon={<SaveRegular />} onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar calificaciones'}
          </Button>
        </>
      }
    >
      {gradeStudents.length === 0 && <Text>No hay estudiantes en este grado.</Text>}
      {gradeStudents.length > 0 && (
        <Table aria-label="Calificaciones">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Estudiante</TableHeaderCell>
              <TableHeaderCell>Puntos (0 - {activity.points})</TableHeaderCell>
              <TableHeaderCell>Comentario</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gradeStudents.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Text size={300} weight="semibold" block>{s.fullName}</Text>
                </TableCell>
                <TableCell className={styles.scoreCell}>
                  <Input
                    type="number"
                    min={0}
                    max={activity.points}
                    value={values[s.id] ?? ''}
                    onChange={(_, d) => setValues((prev) => ({ ...prev, [s.id]: d.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Input value={comments[s.id] ?? ''} onChange={(_, d) => setComments((prev) => ({ ...prev, [s.id]: d.value }))} placeholder="Comentario (opcional)" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {average !== null && (
        <Text size={300} className={styles.avgRow} block>
          <StarRegular /> Promedio del grupo: <strong>{average}</strong> / {activity.points}
        </Text>
      )}
    </ModalForm>
  )
}
