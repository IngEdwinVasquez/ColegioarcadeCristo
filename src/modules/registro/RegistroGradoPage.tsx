import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell,
  TableRow, Text, Textarea, useToastController, makeStyles,
} from '@fluentui/react-components'
import { AddRegular, DeleteRegular, DocumentPdfRegular, SaveRegular, BookRegular, PeopleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { NivelSelector } from '../coordinacion/NivelSelector'
import { useCoordinationLevel } from '../coordinacion/useCoordinationLevel'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadAndShare } from '../../services/onedrive'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { cursoNombre, nivelShort, asignaturaDe, isRealSubject, ordenarCursos } from '../../utils/academic'
import type { Enrollment, GradeRegister, RegistroCalificacion, RegistroPeriodos, RegistroStudent, TeacherAssignment } from '../../types'

const PERIODOS: Array<{ key: keyof RegistroPeriodos; label: string }> = [
  { key: 'p1', label: 'I' }, { key: 'p2', label: 'II' }, { key: 'p3', label: 'III' }, { key: 'p4', label: 'IV' },
]

const CAL_COLS: Array<{ key: keyof RegistroCalificacion; label: string; grupo: string }> = [
  { key: 'cf', label: 'C.F.', grupo: 'C.F.' },
  { key: 'comp50', label: '50% C.F.', grupo: 'COMPLETIVA' },
  { key: 'compCec', label: 'C.E.C.', grupo: 'COMPLETIVA' },
  { key: 'comp30', label: '30% C.E.C.', grupo: 'COMPLETIVA' },
  { key: 'compCcf', label: 'C.C.F.', grupo: 'COMPLETIVA' },
  { key: 'ext30', label: '30% C.F.', grupo: 'EXTRAORDINARIA' },
  { key: 'extCex', label: 'C.EX.', grupo: 'EXTRAORDINARIA' },
  { key: 'ext70', label: '70% C.EX.', grupo: 'EXTRAORDINARIA' },
  { key: 'extCexf', label: 'C.EX.F.', grupo: 'EXTRAORDINARIA' },
  { key: 'espCf', label: 'C.F.', grupo: 'ESPECIALES' },
  { key: 'espCe', label: 'C.E.', grupo: 'ESPECIALES' },
  { key: 'situacion', label: 'A/R', grupo: 'SITUACIÓN FINAL' },
]

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  scroll: { overflowX: 'auto' },
  mini: { width: '62px' },
  th: { fontSize: '11px', whiteSpace: 'nowrap' },
})

export type RegistroScope = { kind: 'coordinacion' } | { kind: 'todos' } | { kind: 'docente'; teacherId: string }

/** Registro de Grado para el docente: solo sus cursos/asignaturas. */
export function MiRegistroGradoPage() {
  const { user } = useApp()
  return (
    <RegistroGradoPage
      scope={{ kind: 'docente', teacherId: user?.teacherId ?? '' }}
      title="Mi Registro de Grado"
      subtitle="Complete las hojas del registro de grado de las asignaturas que imparte. Solo puede digitar sus asignaturas."
    />
  )
}

interface Props {
  scope: RegistroScope
  title?: string
  subtitle?: string
}

/**
 * Registro de Grado (MINERD). Permite crear el registro por curso y llenar las hojas:
 * datos del centro, estudiantes (numerados), asistencia, especificaciones, calificaciones
 * por asignatura (con restricción al docente de cada asignatura) y promoción.
 */
export function RegistroGradoPage({ scope, title = 'Registro de Grado', subtitle }: Props) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods, students, studentById } = useApp()
  const registrosCol = useCollection<GradeRegister>(dataService.getGradeRegisters, dataService.saveGradeRegister, dataService.deleteGradeRegister)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const coord = useCoordinationLevel()

  const esCoord = scope.kind === 'coordinacion'
  const esDocente = scope.kind === 'docente'
  const nivelFiltro = esCoord ? coord.level : ''
  const [ciclo, setCiclo] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [detalle, setDetalle] = useState<GradeRegister | null>(null)
  const [draft, setDraft] = useState<GradeRegister | null>(null)
  const [tab, setTab] = useState('centro')
  const [busy, setBusy] = useState(false)
  const [nuevoCurso, setNuevoCurso] = useState('')
  const [nuevoPeriodo, setNuevoPeriodo] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '')
  const [plantilla, setPlantilla] = useState<{ nombre?: string; url?: string }>({})
  const plantillaRef = useRef<HTMLInputElement>(null)

  const cursosCatalogo = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => ({ nombre: cursoNombre(g), grade: g })),
    [grades],
  )

  // Cursos que puede ver el usuario según el alcance.
  const cursosPermitidos = useMemo(() => {
    if (esDocente) {
      const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
      const cursos = new Set(grades.filter((g) => ids.has(g.id)).map((g) => cursoNombre(g)))
      return cursosCatalogo.filter((c) => cursos.has(c.nombre))
    }
    return cursosCatalogo.filter((c) => {
      if (nivelFiltro && nivelShort(c.grade.level) !== nivelFiltro) return false
      if (ciclo && (c.grade.ciclo || '') !== ciclo) return false
      return true
    })
  }, [esDocente, scope, assignmentsCol.items, grades, cursosCatalogo, nivelFiltro, ciclo])

  const registros = useMemo(() => {
    const nombres = new Set(cursosPermitidos.map((c) => c.nombre))
    return registrosCol.items.filter((r) => nombres.has(r.curso)).sort((a, b) => a.curso.localeCompare(b.curso))
  }, [registrosCol.items, cursosPermitidos])

  // Asignaturas del docente en un curso (para restringir la edición).
  const asignaturasDocente = useMemo(() => {
    if (!esDocente || !draft) return null
    const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
    const set = new Set(grades.filter((g) => ids.has(g.id) && cursoNombre(g) === draft.curso).map((g) => asignaturaDe(g)))
    return set
  }, [esDocente, scope, assignmentsCol.items, grades, draft])

  useEffect(() => {
    if (detalle) { setDraft(structuredClone(detalle)); setTab('centro') }
  }, [detalle])

  const asignaturasCurso = useMemo(() => {
    const curso = draft?.curso
    if (!curso) return []
    return [...new Set(grades.filter((g) => cursoNombre(g) === curso && isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b))
  }, [grades, draft])

  const estudiantesCurso = (curso: string) => {
    const ids = new Set(grades.filter((g) => cursoNombre(g) === curso).map((g) => g.id))
    const byEnr = enrollmentsCol.items.filter((e) => ids.has(e.gradeId)).map((e) => e.studentId)
    const direct = students.filter((s) => ids.has(s.gradeId)).map((s) => s.id)
    return [...new Set([...byEnr, ...direct])].map((id) => studentById(id)).filter((s): s is NonNullable<typeof s> => !!s)
  }

  const abrirNuevo = () => {
    setNuevoCurso(cursosPermitidos[0]?.nombre ?? '')
    setPlantilla({})
    setOpenNew(true)
  }

  const subirPlantilla = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const ref = await uploadAndShare('Registro de Grado', file)
      setPlantilla({ nombre: file.name, url: ref.webUrl })
      toaster.dispatchToast('Plantilla cargada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const crear = async () => {
    const curso = cursosPermitidos.find((c) => c.nombre === nuevoCurso)
    if (!curso) { toaster.dispatchToast('Selecciona un curso.', { intent: 'error' }); return }
    setBusy(true)
    try {
      const estudiantes: RegistroStudent[] = estudiantesCurso(curso.nombre).map((s, i) => ({
        studentId: s.id,
        number: i + 1,
        apellidos: s.fullName.split(' ').slice(1).join(' ') || s.fullName,
        nombres: s.fullName.split(' ')[0] ?? '',
      }))
      const reg: GradeRegister = {
        id: genId('rg'),
        level: curso.grade.level,
        nivel: nivelShort(curso.grade.level),
        ciclo: curso.grade.ciclo || '',
        curso: curso.nombre,
        gradeId: curso.grade.id,
        periodId: nuevoPeriodo,
        plantillaNombre: plantilla.nombre,
        plantillaUrl: plantilla.url,
        centro: {},
        estudiantes,
        asistencia: {},
        especificaciones: {},
        calificaciones: {},
        promocion: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await registrosCol.save(reg)
      toaster.dispatchToast('Registro de grado creado.', { intent: 'success' })
      setOpenNew(false)
      setDetalle(reg)
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const guardar = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const next = { ...draft, updatedAt: new Date().toISOString() }
      await registrosCol.save(next)
      setDetalle(next)
      toaster.dispatchToast('Registro guardado.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const cargarMatriculados = () => {
    if (!draft) return
    const lista = estudiantesCurso(draft.curso)
    setDraft({
      ...draft,
      estudiantes: lista.map((s, i) => {
        const prev = draft.estudiantes.find((e) => e.studentId === s.id)
        return prev ? { ...prev, number: i + 1 } : { studentId: s.id, number: i + 1, apellidos: s.fullName.split(' ').slice(1).join(' ') || s.fullName, nombres: s.fullName.split(' ')[0] ?? '' }
      }),
    })
  }

  const setCal = (asignatura: string, numero: number, key: keyof RegistroCalificacion, value: string) => {
    if (!draft) return
    const cal = { ...(draft.calificaciones ?? {}) }
    const porAsig = { ...(cal[asignatura] ?? {}) }
    porAsig[String(numero)] = { ...(porAsig[String(numero)] ?? {}), [key]: value }
    cal[asignatura] = porAsig
    setDraft({ ...draft, calificaciones: cal })
  }

  const puedeEditarAsignatura = (asignatura: string) => !esDocente || !asignaturasDocente || asignaturasDocente.has(asignatura)

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle ?? 'Registro de grado por curso (MINERD): datos del centro, estudiantes, asistencia, especificaciones, calificaciones y promoción.'} />

      <Card className={styles.card}>
        <div className={styles.actions}>
          {esCoord && <NivelSelector value={coord.level} onChange={coord.setLevel} levels={coord.levels} />}
          {!esDocente && (
            <FormField label="Ciclo">
              <Select value={ciclo} onChange={(_, d) => setCiclo(d.value)}>
                <option value="">Todos los ciclos</option>
                <option value="Primer ciclo">Primer ciclo</option>
                <option value="Segundo ciclo">Segundo ciclo</option>
              </Select>
            </FormField>
          )}
          {!esDocente && <Button appearance="primary" icon={<AddRegular />} onClick={abrirNuevo} disabled={cursosPermitidos.length === 0}>Nuevo registro de grado</Button>}
        </div>
      </Card>

      {registrosCol.loading ? (
        <Spinner label="Cargando registros…" />
      ) : registros.length === 0 ? (
        <EmptyStateView title="Sin registros de grado" message={esDocente ? 'Aún no hay registros de grado para sus cursos asignados.' : 'Cree un registro de grado para un curso.'} icon={<BookRegular />} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
          {registros.map((r) => (
            <Card key={r.id} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text weight="semibold" size={400}>{r.curso}</Text>
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>{r.nivel}{r.ciclo ? ` · ${r.ciclo}` : ''} · {r.estudiantes.length} estudiante(s)</Text>
              {r.plantillaNombre && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Plantilla: {r.plantillaNombre}</Text>}
              <div className={styles.actions}>
                <Button appearance="primary" icon={<BookRegular />} onClick={() => setDetalle(r)}>Abrir registro</Button>
                {!esDocente && <Button appearance="secondary" icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar este registro de grado?')) void registrosCol.remove(r.id) }} aria-label="Eliminar" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Crear registro */}
      <Dialog open={openNew} onOpenChange={(_, d) => { if (!d.open) setOpenNew(false) }}>
        <DialogSurface style={{ maxWidth: 560 }}>
          <DialogBody>
            <DialogTitle>Nuevo registro de grado</DialogTitle>
            <DialogContent>
              <FormField label="Curso" required>
                <Select value={nuevoCurso} onChange={(_, d) => setNuevoCurso(d.value)}>
                  {cursosPermitidos.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Año escolar / período" required>
                <Select value={nuevoPeriodo} onChange={(_, d) => setNuevoPeriodo(d.value)}>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
                </Select>
              </FormField>
              <FormField label="Plantilla (PDF del modelo de registro)" hint="Opcional. Se guarda como referencia del registro.">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input ref={plantillaRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void subirPlantilla(e.target.files?.[0])} />
                  <Button icon={<DocumentPdfRegular />} disabled={busy} onClick={() => plantillaRef.current?.click()}>Seleccionar PDF</Button>
                  {plantilla.nombre && <Text size={200}>{plantilla.nombre}</Text>}
                </div>
              </FormField>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOpenNew(false)} disabled={busy}>Cancelar</Button>
              <Button appearance="primary" onClick={() => void crear()} disabled={busy || !nuevoCurso}>Crear</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Detalle */}
      <Dialog open={!!draft} onOpenChange={(_, d) => { if (!d.open) setDraft(null) }}>
        <DialogSurface style={{ maxWidth: 1200, width: '96vw' }}>
          <DialogBody>
            <DialogTitle>Registro de Grado · {draft?.curso}</DialogTitle>
            <DialogContent>
              {draft && (
                <>
                  <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '14px', flexWrap: 'wrap' }}>
                    <Tab value="centro">Datos del centro</Tab>
                    <Tab value="estudiantes">Datos generales del estudiante</Tab>
                    <Tab value="asistencia">Asistencia y puntualidad</Tab>
                    <Tab value="especificaciones">Especificaciones curriculares</Tab>
                    <Tab value="calificaciones">Calificaciones y rendimientos</Tab>
                    <Tab value="promocion">Promoción de grado</Tab>
                  </TabList>

                  {tab === 'centro' && (
                    <FieldRow>
                      {([['nombre', 'Nombre del centro'], ['codigo', 'Código de gestión'], ['sigerd', 'SIGERD'], ['direccionRegional', 'Dirección regional'], ['distrito', 'Distrito'], ['director', 'Director del centro'], ['docenteEncargado', 'Docente encargado'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['jornada', 'Jornada'], ['sector', 'Sector'], ['zona', 'Zona']] as Array<[keyof NonNullable<GradeRegister['centro']>, string]>).map(([k, label]) => (
                        <FormField key={k} label={label}>
                          <Input value={(draft.centro?.[k] as string) ?? ''} onChange={(_, d) => setDraft({ ...draft, centro: { ...(draft.centro ?? {}), [k]: d.value } })} />
                        </FormField>
                      ))}
                    </FieldRow>
                  )}

                  {tab === 'estudiantes' && (
                    <>
                      <div className={styles.actions}>
                        <Button appearance="secondary" icon={<PeopleRegular />} onClick={cargarMatriculados}>Cargar estudiantes matriculados</Button>
                        <Button appearance="secondary" icon={<AddRegular />} onClick={() => setDraft({ ...draft, estudiantes: [...draft.estudiantes, { number: draft.estudiantes.length + 1, apellidos: '', nombres: '' }] })}>Agregar estudiante</Button>
                      </div>
                      <div className={styles.scroll}>
                        <Table size="small">
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Apellidos</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Nombres</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Emergencia (nombre / parentesco / teléfono)</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Familiar o tutor (nombre / parentesco / teléfono)</TableHeaderCell>
                              <TableHeaderCell className={styles.th}></TableHeaderCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.estudiantes.map((e, i) => (
                              <TableRow key={i}>
                                <TableCell>{e.number}</TableCell>
                                <TableCell><Input value={e.apellidos} onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, apellidos: d.value }; setDraft({ ...draft, estudiantes: arr }) }} /></TableCell>
                                <TableCell><Input value={e.nombres} onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, nombres: d.value }; setDraft({ ...draft, estudiantes: arr }) }} /></TableCell>
                                <TableCell>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <Input value={e.emergenciaNombre ?? ''} placeholder="Nombre" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaNombre: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.emergenciaParentesco ?? ''} placeholder="Parentesco" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaParentesco: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.emergenciaTelefono ?? ''} placeholder="Teléfono" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaTelefono: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <Input value={e.familiares?.[0]?.nombre ?? ''} placeholder="Nombre" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), nombre: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.familiares?.[0]?.parentesco ?? ''} placeholder="Parentesco" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), parentesco: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.familiares?.[0]?.telefono ?? ''} placeholder="Teléfono" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), telefono: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                  </div>
                                </TableCell>
                                <TableCell><Button appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, estudiantes: draft.estudiantes.filter((_, j) => j !== i).map((x, j) => ({ ...x, number: j + 1 })) })} aria-label="Eliminar" /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}

                  {tab === 'asistencia' && (
                    <div className={styles.scroll}>
                      <Table size="small">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                            <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                            {PERIODOS.map((p) => <TableHeaderCell key={p.key} className={styles.th}>Periodo {p.label}</TableHeaderCell>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draft.estudiantes.map((e) => {
                            const key = String(e.number)
                            const val = draft.asistencia?.[key] ?? {}
                            return (
                              <TableRow key={key}>
                                <TableCell>{e.number}</TableCell>
                                <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                {PERIODOS.map((p) => (
                                  <TableCell key={p.key}>
                                    <Input className={styles.mini} value={val[p.key] ?? ''} placeholder="—" onChange={(_, d) => setDraft({ ...draft, asistencia: { ...(draft.asistencia ?? {}), [key]: { ...val, [p.key]: d.value } } })} />
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {tab === 'especificaciones' && (
                    <div className={styles.scroll}>
                      <Table size="small">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell className={styles.th}>Asignatura / área</TableHeaderCell>
                            {PERIODOS.map((p) => <TableHeaderCell key={p.key} className={styles.th}>Periodo {p.label}</TableHeaderCell>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {asignaturasCurso.map((a) => {
                            const val = draft.especificaciones?.[a] ?? {}
                            const editable = puedeEditarAsignatura(a)
                            return (
                              <TableRow key={a}>
                                <TableCell>{a}</TableCell>
                                {PERIODOS.map((p) => (
                                  <TableCell key={p.key}>
                                    <Textarea disabled={!editable} value={val[p.key] ?? ''} resize="vertical" onChange={(_, d) => setDraft({ ...draft, especificaciones: { ...(draft.especificaciones ?? {}), [a]: { ...val, [p.key]: d.value } } })} />
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {tab === 'calificaciones' && (
                    <>
                      {asignaturasCurso.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>El curso no tiene asignaturas registradas.</Text>}
                      {asignaturasCurso.map((a) => {
                        const editable = puedeEditarAsignatura(a)
                        const porEst = draft.calificaciones?.[a] ?? {}
                        return (
                          <Card key={a} style={{ padding: '14px', marginBottom: '14px' }}>
                            <Text weight="semibold" size={400}>{a}{!editable ? ' · (solo lectura: no es su asignatura)' : ''}</Text>
                            <div className={styles.scroll}>
                              <Table size="small">
                                <TableHeader>
                                  <TableRow>
                                    <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                                    <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                                    {CAL_COLS.map((c, i) => <TableHeaderCell key={`${c.grupo}-${c.key}-${i}`} className={styles.th}>{c.grupo === 'C.F.' ? 'C.F.' : `${c.grupo}: ${c.label}`}</TableHeaderCell>)}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draft.estudiantes.map((e) => {
                                    const cal = porEst[String(e.number)] ?? {}
                                    return (
                                      <TableRow key={e.number}>
                                        <TableCell>{e.number}</TableCell>
                                        <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                        {CAL_COLS.map((c, i) => (
                                          <TableCell key={`${c.key}-${i}`}>
                                            <Input className={styles.mini} disabled={!editable} value={(cal[c.key] as string) ?? ''} onChange={(_, d) => setCal(a, e.number, c.key, d.value)} />
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </Card>
                        )
                      })}
                    </>
                  )}

                  {tab === 'promocion' && (
                    <div className={styles.scroll}>
                      <Table size="small">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                            <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                            <TableHeaderCell className={styles.th}>Situación final (A / R)</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draft.estudiantes.map((e) => (
                            <TableRow key={e.number}>
                              <TableCell>{e.number}</TableCell>
                              <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                              <TableCell>
                                <Select value={draft.promocion?.[String(e.number)] ?? ''} onChange={(_, d) => setDraft({ ...draft, promocion: { ...(draft.promocion ?? {}), [String(e.number)]: d.value } })}>
                                  <option value="">—</option>
                                  <option value="A">A (Aprobado)</option>
                                  <option value="R">R (Reprobado)</option>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              {draft?.plantillaUrl && <Button appearance="secondary" as="a" href={draft.plantillaUrl} target="_blank" rel="noopener noreferrer" icon={<DocumentPdfRegular />}>Ver plantilla</Button>}
              <Button appearance="secondary" onClick={() => setDraft(null)}>Cerrar</Button>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <SaveRegular />} disabled={busy} onClick={() => void guardar()}>Guardar</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
