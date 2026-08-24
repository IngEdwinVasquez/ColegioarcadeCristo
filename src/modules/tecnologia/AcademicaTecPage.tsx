import { useState } from 'react'
import { Badge, Button, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, EditRegular, OpenRegular, PeopleTeamRegular, VideoRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { createClassTeam } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import type { GradeSection } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  hint: { marginBottom: '14px', color: 'var(--texto-suave)' },
})

/**
 * RM-008: gestión académica desde Tecnología — cursos y secciones con
 * creación y vinculación del equipo de Microsoft Teams de cada curso.
 */
export function AcademicaTecPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, enrollments } = useAcademicData()
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade, dataService.deleteGrade)

  const [editing, setEditing] = useState<GradeSection | null>(null)
  const [creatingTeam, setCreatingTeam] = useState<string | null>(null)

  const studentCount = (gradeId: string) => {
    const byEnrollment = enrollments.filter((e) => e.gradeId === gradeId).map((e) => e.studentId)
    const direct = students.filter((s) => s.gradeId === gradeId).map((s) => s.id)
    return new Set([...byEnrollment, ...direct]).size
  }

  const save = async (g: GradeSection) => {
    if (!g.name.trim()) {
      toaster.dispatchToast('Indique el nombre del curso.', { intent: 'error' })
      return
    }
    try {
      await gradesCol.save(g)
      toaster.dispatchToast('Curso guardado', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  const crearEquipo = async (g: GradeSection) => {
    setCreatingTeam(g.id)
    try {
      const team = await createClassTeam(g)
      await gradesCol.save({ ...g, teamId: team.teamId, teamUrl: team.webUrl })
      toaster.dispatchToast(`Equipo de Teams creado para ${g.name}. Agregue docentes y estudiantes desde Teams.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo crear el equipo: ${graphErrorMessage(error)}. Verifique el permiso Team.Create y su licencia de Teams.`, { intent: 'error' })
    } finally {
      setCreatingTeam(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestión académica"
        subtitle="Cursos y secciones del colegio con su equipo de Microsoft Teams. Cada curso puede tener un equipo de clase donde se agregan el docente y los estudiantes."
        actions={
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing({ id: genId('g'), name: '', level: 'Nivel Primario', section: 'A' })}>
            Nuevo curso
          </Button>
        }
      />
      <Text size={300} block className={styles.hint}>
        Al pulsar «Crear equipo de Teams» se genera un equipo de clase (plantilla educativa) con usted como propietario; los miembros se administran desde Teams.
      </Text>

      <Table aria-label="Cursos">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Curso</TableHeaderCell>
            <TableHeaderCell>Nivel</TableHeaderCell>
            <TableHeaderCell>Sección</TableHeaderCell>
            <TableHeaderCell>Estudiantes</TableHeaderCell>
            <TableHeaderCell>Microsoft Teams</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gradesCol.items.map((g) => (
            <TableRow key={g.id}>
              <TableCell><Text weight="semibold">{g.name}</Text></TableCell>
              <TableCell>{g.level}</TableCell>
              <TableCell>{g.section ?? '—'}</TableCell>
              <TableCell><Badge appearance="tint" color="brand" icon={<PeopleTeamRegular />}>{studentCount(g.id)}</Badge></TableCell>
              <TableCell>
                {g.teamId ? (
                  <Button size="small" appearance="outline" icon={<OpenRegular />} onClick={() => window.open(g.teamUrl, '_blank', 'noopener')}>
                    Abrir equipo
                  </Button>
                ) : (
                  <Button
                    size="small"
                    appearance="secondary"
                    icon={creatingTeam === g.id ? <Spinner size="tiny" /> : <VideoRegular />}
                    disabled={creatingTeam !== null}
                    onClick={() => void crearEquipo(g)}
                  >
                    {creatingTeam === g.id ? 'Creando…' : 'Crear equipo de Teams'}
                  </Button>
                )}
              </TableCell>
              <TableCell>
                <Toolbar size="small">
                  <ToolbarButton icon={<EditRegular />} onClick={() => setEditing({ ...g })}>Editar</ToolbarButton>
                  <ToolbarButton
                    icon={<DeleteRegular />}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el curso ${g.name}? (el equipo de Teams, si existe, no se elimina)`)) void gradesCol.remove(g.id)
                    }}
                  >
                    Eliminar
                  </ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!gradesCol.loading && gradesCol.items.length === 0 && (
        <Text size={300} block style={{ marginTop: '12px', color: 'var(--texto-suave)' }}>Cree los cursos del colegio para vincularlos con Teams.</Text>
      )}

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing && gradesCol.items.some((x) => x.id === editing.id) ? `Editar · ${editing.name}` : 'Nuevo curso'}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => editing && void save(editing)} disabled={gradesCol.saving}>{gradesCol.saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        {editing && (
          <div>
            <FieldRow>
              <FormField label="Nombre del curso" required>
                <Input value={editing.name} onChange={(_, d) => setEditing({ ...editing, name: d.value })} placeholder="Ej. 6to A" />
              </FormField>
              <FormField label="Sección">
                <Input value={editing.section ?? ''} onChange={(_, d) => setEditing({ ...editing, section: d.value })} placeholder="A" />
              </FormField>
            </FieldRow>
            <FormField label="Nivel">
              <Select value={editing.level} onChange={(_, d) => setEditing({ ...editing, level: d.value })}>
                <option value="Nivel Inicial">Nivel Inicial</option>
                <option value="Nivel Primario">Nivel Primario</option>
                <option value="Nivel Secundario">Nivel Secundario</option>
              </Select>
            </FormField>
          </div>
        )}
      </ModalForm>
    </div>
  )
}

function useAcademicData() {
  const { students } = useApp()
  const enrollmentsCol = useCollection(dataService.getEnrollments)
  return { students, enrollments: enrollmentsCol.items }
}
