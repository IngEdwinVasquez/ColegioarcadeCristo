import { useMemo, useState } from 'react'
import { Badge, Button, ProgressBar, Radio, RadioGroup, Select, Spinner, Text, useToastController } from '@fluentui/react-components'
import { ArrowDownloadRegular, PeopleSyncRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { classifyDirectory, getTeamRoster } from '../../services/importM365'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import type { Role } from '../../types/roles'
import type { Student, Teacher, User } from '../../types'

interface Candidate {
  id: string
  displayName: string
  email: string
  jobTitle?: string
  licenses?: string[]
  /** Curso detectado (importación por Teams) */
  gradeId?: string
}

interface ImportPersonasWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Asistente "Importar desde Microsoft 365": clasifica las cuentas del tenant
 * por licencia (SKU STUDENT/FACULTY) o por los equipos de clase de Teams
 * (propietarios = docentes, miembros = estudiantes con su curso) y crea las
 * fichas + roles correspondientes en la aplicación.
 */
export function ImportPersonasWizard({ open, onOpenChange }: ImportPersonasWizardProps) {
  const toaster = useToastController()
  const { grades, students, teachers, refreshCatalogs } = useApp()

  const [mode, setMode] = useState<'licencias' | 'teams'>('licencias')
  const [loading, setLoading] = useState(false)
  const [candStudents, setCandStudents] = useState<Candidate[]>([])
  const [candTeachers, setCandTeachers] = useState<Candidate[]>([])
  const [unknownCount, setUnknownCount] = useState(0)
  const [selStudents, setSelStudents] = useState<string[]>([])
  const [selTeachers, setSelTeachers] = useState<string[]>([])
  const [defaultGrade, setDefaultGrade] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const registeredStudentUsers = useMemo(() => new Set(students.map((s) => s.userId ?? s.email ?? '')), [students])
  const registeredTeacherUsers = useMemo(() => new Set(teachers.map((t) => t.userId ?? t.email ?? '')), [teachers])

  const isRegistered = (c: Candidate, kind: 'estudiante' | 'docente') => {
    const set = kind === 'estudiante' ? registeredStudentUsers : registeredTeacherUsers
    const byEmail = kind === 'estudiante' ? students.some((s) => s.email === c.email) : teachers.some((t) => t.email === c.email)
    return set.has(c.id) || byEmail
  }

  const load = async (m: 'licencias' | 'teams') => {
    setLoading(true)
    setCandStudents([])
    setCandTeachers([])
    setUnknownCount(0)
    try {
      if (m === 'licencias') {
        const directory = await classifyDirectory()
        const est = directory.filter((p) => p.classification === 'estudiante')
        const doc = directory.filter((p) => p.classification === 'docente')
        setUnknownCount(directory.filter((p) => p.classification === 'desconocido').length)
        setCandStudents(est)
        setCandTeachers(doc)
        setSelStudents(est.filter((c) => !isRegistered(c, 'estudiante')).map((c) => c.id))
        setSelTeachers(doc.filter((c) => !isRegistered(c, 'docente')).map((c) => c.id))
      } else {
        const linked = grades.filter((g) => g.teamId)
        if (linked.length === 0) {
          toaster.dispatchToast('No hay cursos vinculados a un equipo de Teams. Vincúlelos primero en Gestión académica.', { intent: 'warning' })
        }
        const est = new Map<string, Candidate>()
        const doc = new Map<string, Candidate>()
        for (const g of linked) {
          const roster = await getTeamRoster(g.teamId as string)
          for (const o of roster.owners) if (!doc.has(o.id)) doc.set(o.id, { ...o })
          for (const s of roster.members) if (!est.has(s.id)) est.set(s.id, { ...s, gradeId: g.id })
        }
        const estList = [...est.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
        const docList = [...doc.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
        setCandStudents(estList)
        setCandTeachers(docList)
        setSelStudents(estList.filter((c) => !isRegistered(c, 'estudiante')).map((c) => c.id))
        setSelTeachers(docList.filter((c) => !isRegistered(c, 'docente')).map((c) => c.id))
      }
      setLoaded(true)
    } catch (error) {
      toaster.dispatchToast(`No se pudo leer Microsoft 365: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const runImport = async () => {
    const chosenStudents = candStudents.filter((c) => selStudents.includes(c.id) && !isRegistered(c, 'estudiante'))
    const chosenTeachers = candTeachers.filter((c) => selTeachers.includes(c.id) && !isRegistered(c, 'docente'))
    const total = chosenStudents.length + chosenTeachers.length
    if (total === 0) return
    setProgress({ done: 0, total })
    let done = 0
    let errors = 0
    try {
      const existingUsers = await dataService.getUsers()
      const userById = new Map(existingUsers.map((u) => [u.id, u]))

      const upsertUser = async (c: Candidate, role: Role, link: { teacherId?: string; studentId?: string }) => {
        const prev = userById.get(c.id)
        const roles = new Set<string>(prev?.roles ?? [])
        roles.add(role)
        const record: User = {
          id: c.id,
          displayName: c.displayName,
          email: c.email,
          jobTitle: c.jobTitle ?? prev?.jobTitle,
          roles: [...roles] as Role[],
          teacherId: link.teacherId ?? prev?.teacherId,
          studentId: link.studentId ?? prev?.studentId,
          updatedAt: new Date().toISOString(),
        }
        await dataService.saveUser(record)
        userById.set(c.id, record)
      }

      for (const c of chosenTeachers) {
        try {
          const teacher: Teacher = { id: genId('t'), fullName: c.displayName, email: c.email, userId: c.id, subjects: [], grades: [] }
          await dataService.saveTeacher(teacher)
          await upsertUser(c, 'docente', { teacherId: teacher.id })
        } catch {
          errors++
        }
        done++
        setProgress({ done, total })
      }
      for (const c of chosenStudents) {
        try {
          const student: Student = {
            id: genId('s'),
            fullName: c.displayName,
            email: c.email,
            userId: c.id,
            gradeId: c.gradeId ?? defaultGrade,
          }
          await dataService.saveStudent(student)
          await upsertUser(c, 'estudiante', { studentId: student.id })
        } catch {
          errors++
        }
        done++
        setProgress({ done, total })
      }
      await refreshCatalogs()
      toaster.dispatchToast(
        `Importación completada: ${chosenTeachers.length} docente(s) y ${chosenStudents.length} estudiante(s)${errors ? ` · ${errors} con error` : ''}`,
        { intent: errors ? 'warning' : 'success' },
      )
      onOpenChange(false)
    } catch (error) {
      toaster.dispatchToast(`Error durante la importación: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setProgress(null)
    }
  }

  const candidateOption = (c: Candidate, kind: 'estudiante' | 'docente') => ({
    id: c.id,
    label: c.displayName,
    detail: isRegistered(c, kind)
      ? 'ya registrado'
      : kind === 'estudiante' && c.gradeId
        ? grades.find((g) => g.id === c.gradeId)?.name ?? c.email
        : c.licenses?.[0] ?? c.email,
  })

  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="Importar personas desde Microsoft 365"
      subtitle="Identifica estudiantes y docentes por su licencia de Microsoft o por los equipos de clase de Teams, y crea sus fichas con rol y cuenta vinculada."
      actions={
        <>
          <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={!!progress}>Cancelar</Button>
          <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={() => void runImport()} disabled={!!progress || (selStudents.length === 0 && selTeachers.length === 0)}>
            {progress ? `Importando ${progress.done}/${progress.total}…` : `Importar ${selTeachers.length} docente(s) y ${selStudents.length} estudiante(s)`}
          </Button>
        </>
      }
    >
      <FormField label="Origen de la clasificación">
        <RadioGroup value={mode} layout="horizontal" onChange={(_, d) => { setMode(d.value as 'licencias' | 'teams'); setLoaded(false); setCandStudents([]); setCandTeachers([]) }}>
          <Radio value="licencias" label="Licencias de Microsoft (SKU Estudiante / Docente)" />
          <Radio value="teams" label="Equipos de Teams vinculados (miembros = estudiantes, propietarios = docentes)" />
        </RadioGroup>
      </FormField>

      {!loaded && (
        <Button appearance="secondary" icon={loading ? <Spinner size="tiny" /> : <PeopleSyncRegular />} disabled={loading} onClick={() => void load(mode)}>
          {loading ? 'Analizando el tenant…' : 'Analizar Microsoft 365'}
        </Button>
      )}

      {loaded && (
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '6px 0 10px' }}>
            <Badge appearance="tint" color="danger">{candStudents.length} estudiantes detectados</Badge>
            <Badge appearance="tint" color="brand">{candTeachers.length} docentes detectados</Badge>
            {unknownCount > 0 && <Badge appearance="tint" color="warning">{unknownCount} sin clasificar (revíselos manualmente)</Badge>}
          </div>

          <MultiSelect
            label="Docentes a importar"
            placeholder="Filtrar docentes…"
            options={candTeachers.map((c) => candidateOption(c, 'docente'))}
            selected={selTeachers}
            onChange={setSelTeachers}
            emptyMessage="No se detectaron docentes con este método."
          />
          <MultiSelect
            label="Estudiantes a importar"
            placeholder="Filtrar estudiantes…"
            options={candStudents.map((c) => candidateOption(c, 'estudiante'))}
            selected={selStudents}
            onChange={setSelStudents}
            emptyMessage="No se detectaron estudiantes con este método."
          />

          {mode === 'licencias' && (
            <FieldRow>
              <FormField label="Curso para los estudiantes importados (opcional)">
                <Select value={defaultGrade} onChange={(_, d) => setDefaultGrade(d.value)}>
                  <option value="">Sin curso (asignar después)</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </FormField>
            </FieldRow>
          )}
          {mode === 'teams' && (
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
              Cada estudiante se asigna automáticamente al curso del equipo de Teams donde es miembro.
            </Text>
          )}
          {progress && <ProgressBar value={progress.done / progress.total} thickness="large" />}
          <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '8px' }}>
            Los ya registrados aparecen marcados y no se duplican. Cada persona importada queda con su cuenta de Entra vinculada y el rol correspondiente en ARC_Users.
          </Text>
        </div>
      )}
    </ModalForm>
  )
}
