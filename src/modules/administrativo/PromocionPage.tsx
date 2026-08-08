import { useMemo, useState } from 'react'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { ArrowUpRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Enrollment, GradeSection, Student } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  cell: { verticalAlign: 'middle' },
})

const LEVEL_ORDER = ['Nivel Inicial', 'Nivel Primario', 'Nivel Secundario']

function suggestedNext(currentId: string, grades: GradeSection[]): string | undefined {
  const sorted = [...grades].sort((a, b) => {
    const la = LEVEL_ORDER.indexOf(a.level)
    const lb = LEVEL_ORDER.indexOf(b.level)
    if (la !== lb) return la - lb
    const na = parseInt(a.name, 10) || 0
    const nb = parseInt(b.name, 10) || 0
    if (na !== nb) return na - nb
    return a.name.localeCompare(b.name)
  })
  const idx = sorted.findIndex((g) => g.id === currentId)
  if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1].id
  return undefined
}

export function PromocionPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, gradeById } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment)

  const [target, setTarget] = useState<Student | null>(null)
  const [newGrade, setNewGrade] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return studentsCol.items
      .filter((s) => !q || s.fullName.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [studentsCol.items, search])

  const openPromote = (s: Student) => {
    setTarget(s)
    setNewGrade(suggestedNext(s.gradeId, grades) ?? s.gradeId)
  }

  const promote = async () => {
    if (!target || !newGrade || newGrade === target.gradeId) {
      window.alert('Seleccione el nuevo curso.')
      return
    }
    await studentsCol.save({ ...target, gradeId: newGrade })
    const enrollment = enrollmentsCol.items.find((e) => e.studentId === target.id)
    if (enrollment) {
      await enrollmentsCol.save({ ...enrollment, gradeId: newGrade })
    } else {
      await enrollmentsCol.save({
        id: genId('enr'),
        studentId: target.id,
        gradeId: newGrade,
        subjectId: '',
        periodId: '',
      })
    }
    toaster.dispatchToast(`${target.fullName} fue promovido(a) a ${gradeById(newGrade)?.name ?? ''}`, { intent: 'success' })
    setTarget(null)
  }

  return (
    <div>
      <PageHeader
        title="Promoción de estudiantes"
        subtitle="Promueva estudiantes al siguiente curso académico. Al promover se actualiza su matrícula."
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Input
          placeholder="Buscar estudiante…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ minWidth: '260px', flex: 1 }}
        />
      </div>

      <Table aria-label="Promoción">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Estudiante</TableHeaderCell>
            <TableHeaderCell>Curso actual</TableHeaderCell>
            <TableHeaderCell>Sugerido</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((s) => {
            const next = suggestedNext(s.gradeId, grades)
            return (
              <TableRow key={s.id}>
                <TableCell className={styles.cell}>
                  <Text weight="semibold">{s.fullName}</Text>
                </TableCell>
                <TableCell className={styles.cell}>{gradeById(s.gradeId)?.name ?? s.gradeId}</TableCell>
                <TableCell className={styles.cell}>{next ? gradeById(next)?.name ?? '' : 'Último curso'}</TableCell>
                <TableCell className={styles.cell}>
                  <Toolbar size="small">
                    <ToolbarButton icon={<ArrowUpRegular />} disabled={!next} onClick={() => openPromote(s)}>
                      Promover
                    </ToolbarButton>
                  </Toolbar>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <ModalForm
        open={!!target}
        onOpenChange={(o) => { if (!o) setTarget(null) }}
        title={`Promover · ${target?.fullName ?? ''}`}
        subtitle={target ? `Curso actual: ${gradeById(target.gradeId)?.name ?? ''}` : ''}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button appearance="primary" icon={<ArrowUpRegular />} onClick={() => void promote()}>Promover</Button>
          </>
        }
      >
        {target && (
          <FormField label="Nuevo curso" required>
            <Select value={newGrade} onChange={(_, d) => setNewGrade(d.value)}>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name} · {g.level}</option>
              ))}
            </Select>
          </FormField>
        )}
      </ModalForm>
    </div>
  )
}
