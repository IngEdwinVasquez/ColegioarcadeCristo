import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { SearchRegular, DeleteRegular, ArrowSyncRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ImportarSigerdCard } from '../administrativo/ImportarSigerdCard'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { useApp } from '../../context/useApp'
import { formatDate, genId } from '../../utils/helpers'
import { cursoNombre, nivelShort, gradoInicialDe, INICIAL_GRADOS, GRADOS, nivelDeTanda, gradoDe, seccionDe, ordenarCursos, isRealSubject, asignaturaDe, cicloFromGrade } from '../../utils/academic'
import { PERSON_GROUPS, transferPerson, type PersonRef } from '../../services/personGroups'
import type { Enrollment, GradeSection, SigerdReport, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  header: { display: 'flex', flexWrap: 'wrap', gap: '6px 22px', background: tokens.colorNeutralBackground2, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' },
  bar: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
  search: { maxWidth: '340px', flex: 1, minWidth: '220px' },
  scroll: { overflowX: 'auto' },
})

/** Número de grado tomando la PRIMERA mención (ej. "Quinto grado (3ro. Nivel Medio)" → 5). */
const numGradoSigerd = (g?: string): number | null => {
  const t = (g ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const re = /\b(1ro|1er|primero|primer|2do|2da|segundo|segunda|3ro|3er|tercero|tercera|4to|4ta|cuarto|cuarta|5to|5ta|quinto|quinta|6to|6ta|sexto|sexta)\b/
  const m = re.exec(t)
  if (!m) return null
  const x = m[1]
  if (/primero|primer|1ro|1er/.test(x)) return 1
  if (/segundo|segunda|2do|2da/.test(x)) return 2
  if (/tercero|tercera|3ro|3er/.test(x)) return 3
  if (/cuarto|cuarta|4to|4ta/.test(x)) return 4
  if (/quinto|quinta|5to|5ta/.test(x)) return 5
  if (/sexto|sexta|6to|6ta/.test(x)) return 6
  return null
}

/** Opciones de "cambiar tipo" (mismas categorías que la columna Tipo del sitio Personal). */
const TIPO_OPCIONES = [
  { label: 'Docente', key: 'docentes' },
  { label: 'Padre / Tutor', key: 'padres' },
  { label: 'Coordinador pedagógico', key: 'coordinacion' },
  { label: 'Tecnología (TIC)', key: 'tecnologia' },
  { label: 'Orientación y Psicología', key: 'psicologia' },
  { label: 'Pasante', key: 'pasantes' },
  { label: 'Personal de apoyo', key: 'apoyo' },
  { label: 'Director', key: 'directores' },
  { label: 'Administrador', key: 'administradores' },
  { label: 'SIGERD', key: 'siger' },
]

/** Página SIGERD: importación de estudiantes desde PDF, matriculación por aulas y consulta. */
export function SigerdPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { gradeById, grades, periods, refreshCatalogs } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports, dataService.saveSigerdReport, dataService.deleteSigerdReport)
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade)

  const [tab, setTab] = useState('reporte')
  const [search, setSearch] = useState('')
  const [reportId, setReportId] = useState('')
  const [cursoDefecto, setCursoDefecto] = useState('')
  const [busy, setBusy] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [matFilter, setMatFilter] = useState('todos')
  const [matNivel, setMatNivel] = useState('')
  const [selCurso, setSelCurso] = useState<Record<string, string>>({})
  const [selTipo, setSelTipo] = useState<Record<string, string>>({})

  const reports = useMemo(() => [...reportsCol.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [reportsCol.items])
  const activePeriod = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''
  const cursos = useMemo(() => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))), [grades])

  useEffect(() => {
    if (!reportId && reports.length) setReportId(reports[0].id)
  }, [reports, reportId])

  const students = useMemo(() => {
    const q = search.trim().toLowerCase()
    return studentsCol.items
      .filter((s) => !!s.sigerd || !!s.sigerdId)
      .filter((s) => !reportId || s.sigerdReportId === reportId)
      .filter((s) => {
        if (!cursoDefecto) return true
        const g = s.gradeId ? gradeById(s.gradeId) : undefined
        return !!g && cursoNombre(g) === cursoDefecto
      })
      .filter((s) => !q || s.fullName.toLowerCase().includes(q) || (s.sigerdId ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [studentsCol.items, search, reportId, cursoDefecto, gradeById])

  const selected = reports.find((r) => r.id === reportId)

  const nivelDeReporte = (r?: SigerdReport) => nivelShort(r?.nivel ?? nivelDeTanda(r?.header.tandaServicio) ?? '')

  const eliminarUno = async (s: Student) => {
    if (!window.confirm(`¿Eliminar el registro SIGERD de ${s.fullName}?`)) return
    setBusy(true)
    try {
      for (const e of enrollmentsCol.items.filter((x) => x.studentId === s.id)) await dataService.deleteEnrollment(e.id)
      await dataService.deleteStudent(s.id)
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh()])
      toaster.dispatchToast('Registro eliminado.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo eliminar.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const eliminarTodo = async () => {
    const sig = studentsCol.items.filter((s) => !!s.sigerd || !!s.sigerdId)
    if (sig.length === 0 && reports.length === 0) return
    if (!window.confirm(`¿Eliminar TODO el registro SIGERD (${sig.length} estudiantes, sus matrículas y ${reports.length} reportes)? Podrás volver a subir los PDF sin duplicar.`)) return
    setBusy(true)
    setProgreso('Eliminando…')
    try {
      const ids = new Set(sig.map((s) => s.id))
      const enrs = enrollmentsCol.items.filter((x) => ids.has(x.studentId))
      let n = 0
      for (const e of enrs) {
        await dataService.deleteEnrollment(e.id)
        n += 1
        if (n % 20 === 0) setProgreso(`Eliminando matrículas ${n}/${enrs.length}…`)
      }
      n = 0
      for (const s of sig) {
        await dataService.deleteStudent(s.id)
        n += 1
        if (n % 20 === 0) setProgreso(`Eliminando estudiantes ${n}/${sig.length}…`)
      }
      for (const r of reports) await dataService.deleteSigerdReport(r.id)
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), reportsCol.refresh()])
      setReportId('')
      toaster.dispatchToast('Se eliminó todo el registro SIGERD.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo eliminar el registro.', { intent: 'error' })
    } finally {
      setBusy(false)
      setProgreso('')
    }
  }

  /** Reconstruye los cursos de Inicial (uno por grado) y elimina los que no sigan ese patrón. */
  const reconstruirInicial = async () => {
    if (!window.confirm('¿Reconstruir los cursos de Inicial (Pre-Kinder, Kinder, Pre-Primaria) y reemplazar los existentes por estos? Se actualizará el curso de los estudiantes.')) return
    setBusy(true)
    setProgreso('Reconstruyendo cursos de Inicial…')
    try {
      const headerDe = (id?: string) => (id ? reportsCol.items.find((r) => r.id === id)?.header : undefined)
      const lista = gradesCol.items.length ? [...gradesCol.items] : [...grades]
      const nombreEstandar = (nombre: string) => `${nombre} · Inicial`
      const estandar = new Set(INICIAL_GRADOS.map((gi) => nombreEstandar(gi.nombre)))

      let cursosCreados = 0
      for (const gi of INICIAL_GRADOS) {
        const objetivo = nombreEstandar(gi.nombre)
        if (lista.some((x) => cursoNombre(x) === objetivo)) continue
        const nuevo: GradeSection = { id: genId('g'), name: gi.nombre, grado: gi.nombre, level: 'Nivel Inicial', nivel: 'Inicial', asignatura: 'Asignaturas Generales', edad: gi.edad }
        await dataService.saveGrade(nuevo)
        lista.push(nuevo)
        cursosCreados += 1
      }

      let actualizados = 0
      const protegidos = new Set<string>()
      for (const s of studentsCol.items) {
        const gi = gradoInicialDe(s.sigerd?.grado) ?? gradoInicialDe(gradeById(s.gradeId)?.name) ?? gradoInicialDe(headerDe(s.sigerdReportId)?.grado)
        if (!gi) { if (s.gradeId) protegidos.add(s.gradeId); continue }
        const curso = lista.find((x) => cursoNombre(x) === nombreEstandar(gi.nombre))
        if (!curso) continue
        if (s.gradeId !== curso.id) {
          await dataService.saveStudent({ ...s, gradeId: curso.id })
          actualizados += 1
        }
        if (activePeriod && !enrollmentsCol.items.some((e) => e.studentId === s.id && e.periodId === activePeriod)) {
          await dataService.saveEnrollment({ id: genId('enr'), studentId: s.id, gradeId: curso.id, periodId: activePeriod })
        }
      }

      let eliminados = 0
      for (const g of gradesCol.items) {
        if (nivelShort(g.level) !== 'Inicial') continue
        if (estandar.has(cursoNombre(g))) continue
        if (protegidos.has(g.id)) continue
        await dataService.deleteGrade(g.id)
        eliminados += 1
      }

      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), gradesCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`Inicial reconstruido: ${cursosCreados} curso(s), ${actualizados} estudiante(s), ${eliminados} curso(s) obsoleto(s) eliminado(s).`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo reconstruir los cursos de Inicial.', { intent: 'error' })
    } finally {
      setBusy(false)
      setProgreso('')
    }
  }

  /** Matricula a los estudiantes del reporte seleccionado en su aula (grado+sección+nivel), reemplazando la matrícula previa de esas aulas. */
  const matricularEnAulas = async () => {
    if (!selected) { toaster.dispatchToast('Selecciona un PDF procesado.', { intent: 'error' }); return }
    const nivel = nivelDeReporte(selected)
    if (!nivel) { toaster.dispatchToast('No se pudo determinar el nivel del PDF.', { intent: 'error' }); return }
    const lista = studentsCol.items.filter((s) => s.sigerdReportId === selected.id)
    if (lista.length === 0) { toaster.dispatchToast('Este PDF no tiene estudiantes.', { intent: 'error' }); return }
    if (!window.confirm(`Matricular a los ${lista.length} estudiantes de este PDF en sus aulas (Nivel ${nivel}), creando las aulas que falten y reemplazando la matrícula actual de esas aulas.`)) return
    setBusy(true)
    setProgreso('Matriculando…')
    const nivelLargo = nivel === 'Inicial' ? 'Nivel Inicial' : nivel === 'Secundaria' ? 'Nivel Secundario' : 'Nivel Primario'
    const listaGrades = [...(gradesCol.items.length ? gradesCol.items : grades)]
    let aulasCreadas = 0
    try {
      // Encuentra o crea el aula según grado + sección + nivel.
      const asegurarAula = async (g: SigerdStudent | undefined): Promise<GradeSection | null> => {
        if (!g) return null
        const gi = gradoInicialDe(g.grado)
        if (gi) {
          const sec = (g.seccion ?? '').trim().toUpperCase()
          const existente = listaGrades.find((x) => nivelShort(x.level) === 'Inicial' && gradoDe(x) === gi.nombre && (seccionDe(x) === sec || !sec))
            ?? listaGrades.find((x) => nivelShort(x.level) === 'Inicial' && gradoDe(x) === gi.nombre)
          if (existente) return existente
          const nuevo: GradeSection = { id: genId('g'), name: gi.nombre, grado: gi.nombre, section: sec || undefined, level: 'Nivel Inicial', nivel: 'Inicial', asignatura: 'Asignaturas Generales', edad: gi.edad }
          await dataService.saveGrade(nuevo)
          listaGrades.push(nuevo)
          aulasCreadas += 1
          return nuevo
        }
        const n = numGradoSigerd(g.grado)
        if (!n) return null
        const sec = (g.seccion ?? '').trim().toUpperCase() || 'A'
        const grado = GRADOS[n - 1]
        const existente = listaGrades.find((x) => cursoNombre(x) === `${grado}.${sec} · ${nivel}`)
          ?? listaGrades.find((x) => gradoDe(x) === grado && seccionDe(x) === sec && nivelShort(x.level) === nivel)
          ?? listaGrades.find((x) => gradoDe(x) === grado && seccionDe(x) === sec)
        if (existente) return existente
        const nuevo: GradeSection = { id: genId('g'), name: `${grado}.${sec}`, grado, section: sec, level: nivelLargo, nivel, ciclo: cicloFromGrade(nivelLargo, grado), asignatura: 'Asignaturas Generales' }
        await dataService.saveGrade(nuevo)
        listaGrades.push(nuevo)
        aulasCreadas += 1
        return nuevo
      }

      const porAula = new Map<string, Student[]>()
      const sinCurso: string[] = []
      for (const s of lista) {
        const aula = await asegurarAula(s.sigerd)
        if (!aula) { sinCurso.push(s.fullName); continue }
        if (!porAula.has(aula.id)) porAula.set(aula.id, [])
        porAula.get(aula.id)!.push(s)
      }
      // Quita las matrículas existentes de esas aulas (para que solo queden los de este proceso).
      let quitadas = 0
      for (const e of enrollmentsCol.items) {
        if (!porAula.has(e.gradeId)) continue
        if (activePeriod && e.periodId !== activePeriod) continue
        await dataService.deleteEnrollment(e.id)
        quitadas += 1
      }
      let ok = 0
      for (const [gradeId, alumnos] of porAula) {
        for (const s of alumnos) {
          await dataService.saveEnrollment({ id: genId('enr'), studentId: s.id, gradeId, periodId: activePeriod })
          if (s.gradeId !== gradeId) await dataService.saveStudent({ ...s, gradeId })
          ok += 1
        }
      }
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), gradesCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`Matriculados ${ok} estudiante(s) en ${porAula.size} aula(s). Aulas creadas: ${aulasCreadas}. Matrículas anteriores retiradas: ${quitadas}. Sin aula: ${sinCurso.length}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo matricular.', { intent: 'error' })
    } finally {
      setBusy(false)
      setProgreso('')
    }
  }

  /** Matricula manualmente un estudiante en el curso elegido. */
  const matricularManual = async (s: Student) => {
    const cursoNombreSel = selCurso[s.id]
    if (!cursoNombreSel) { toaster.dispatchToast('Selecciona un curso/aula.', { intent: 'error' }); return }
    const curso = cursos.find((c) => cursoNombre(c) === cursoNombreSel)
    if (!curso) { toaster.dispatchToast('No se encontró el curso.', { intent: 'error' }); return }
    setBusy(true)
    try {
      await dataService.saveEnrollment({ id: genId('enr'), studentId: s.id, gradeId: curso.id, periodId: activePeriod })
      if (s.gradeId !== curso.id) await dataService.saveStudent({ ...s, gradeId: curso.id })
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`${s.fullName} matriculado en ${cursoNombreSel}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo matricular.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Cambia el estudiante a otro grupo/tipo (como en Personal). */
  const cambiarTipo = async (s: Student) => {
    const targetKey = selTipo[s.id]
    if (!targetKey) { toaster.dispatchToast('Selecciona el nuevo tipo.', { intent: 'error' }); return }
    const target = PERSON_GROUPS.find((g) => g.key === targetKey)
    if (!target) return
    if (!window.confirm(`¿Convertir a "${s.fullName}" en ${target.label}? Se moverá de Estudiantes y se actualizará su rol.`)) return
    setBusy(true)
    try {
      const ref: PersonRef = { kind: 'estudiante', id: s.id, fullName: s.fullName, userId: s.userId, email: s.email }
      await transferPerson(ref, target, s.gradeId)
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`${s.fullName} ahora es ${target.label}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo cambiar el tipo.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const matriculadoIds = useMemo(
    () => new Set(enrollmentsCol.items.filter((e) => !activePeriod || e.periodId === activePeriod).map((e) => e.studentId)),
    [enrollmentsCol.items, activePeriod],
  )
  const listaMatriculacion = useMemo(() => {
    const q = search.trim().toLowerCase()
    const nivelEst = (s: Student) => nivelShort(gradeById(s.gradeId)?.level ?? nivelDeReporte(reports.find((r) => r.id === s.sigerdReportId))) || '—'
    return studentsCol.items
      .filter((s) => !q || s.fullName.toLowerCase().includes(q) || (s.sigerdId ?? '').toLowerCase().includes(q))
      .filter((s) => (matFilter === 'matriculados' ? matriculadoIds.has(s.id) : matFilter === 'no' ? !matriculadoIds.has(s.id) : true))
      .filter((s) => !matNivel || nivelEst(s) === matNivel)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [studentsCol.items, matFilter, matNivel, search, matriculadoIds, gradeById, reports])

  return (
    <div>
      <PageHeader
        title="SIGERD"
        subtitle="Importa la relación de estudiantes del SIGERD (PDF), matricula por aulas y gestiona los registros sin duplicar datos."
        actions={
          <>
            <Button appearance="secondary" icon={<ArrowSyncRegular />} disabled={busy} onClick={() => void reconstruirInicial()}>
              Reconstruir cursos de Inicial
            </Button>
            <Button appearance="secondary" icon={<DeleteRegular />} disabled={busy || (studentsCol.items.length === 0 && reports.length === 0)} onClick={() => void eliminarTodo()}>
              Eliminar todo el registro SIGERD
            </Button>
          </>
        }
      />

      <Text size={200} style={{ color: 'var(--texto-suave)', margin: '4px 0 12px' }}>
        <strong>Reconstruir cursos de Inicial:</strong> crea los cursos Pre-Kinder, Kinder y Pre-Primaria, asigna a cada estudiante su grado y elimina los cursos de Inicial mal nombrados (no toca Primaria ni Secundaria).
      </Text>

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '14px' }}>
        <Tab value="reporte">Reporte SIGERD</Tab>
        <Tab value="matriculacion">Matriculación ({listaMatriculacion.length})</Tab>
      </TabList>

      {tab === 'reporte' && (
        <>
          {busy && progreso && <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>{progreso}</Text>}

          <ImportarSigerdCard
            cursoDefecto={cursoDefecto}
            onCursoDefectoChange={setCursoDefecto}
            onImported={() => {
              void studentsCol.refresh()
              void reportsCol.refresh()
              void enrollmentsCol.refresh()
            }}
          />

          {reports.length === 0 ? (
            <EmptyStateView title="Sin registros SIGERD" message="Carga un PDF del SIGERD para crear los registros de estudiantes." />
          ) : (
            <>
              <div className={styles.bar}>
                <Text size={200} weight="semibold">Ver PDF procesado:</Text>
                <Select value={reportId} onChange={(_, d) => setReportId(d.value)} style={{ minWidth: '320px' }}>
                  <option value="">Todos los reportes</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nivel ? `${nivelShort(r.nivel)} · ` : ''}{(r.header.grado || '—')} · {(r.header.seccion || '—')} · {(r.header.docentes || '—')} · {formatDate(r.createdAt.slice(0, 10))} ({r.studentsCount})
                    </option>
                  ))}
                </Select>
                <Input className={styles.search} contentBefore={<SearchRegular />} value={search} onChange={(_, d) => setSearch(d.value)} placeholder="Buscar estudiante (nombre, Id o correo)…" />
              </div>

              {selected && (
                <>
                  <div className={styles.header}>
                    <Text size={200}><strong>Año:</strong> {selected.header.ano || '—'}</Text>
                    {selected.nivel && <Text size={200}><strong>Nivel:</strong> {nivelShort(selected.nivel)}</Text>}
                    <Text size={200}><strong>Centro:</strong> {selected.header.centroEducativo || '—'}</Text>
                    <Text size={200}><strong>Regional:</strong> {selected.header.direccionRegional || '—'}</Text>
                    <Text size={200}><strong>Distrito:</strong> {selected.header.distritoEducativo || '—'}</Text>
                    <Text size={200}><strong>Tanda:</strong> {selected.header.tandaServicio || '—'}</Text>
                    <Text size={200}><strong>Sector:</strong> {selected.header.sector || '—'}</Text>
                    <Text size={200}><strong>Grado:</strong> {selected.header.grado || '—'}</Text>
                    <Text size={200}><strong>Sección:</strong> {selected.header.seccion || '—'}</Text>
                    <Text size={200}><strong>Cantidad:</strong> {selected.header.cantidadEstudiantes || '—'}</Text>
                    <Text size={200}><strong>Docente:</strong> {selected.header.docentes || '—'}</Text>
                    <Text size={200}><strong>Importado:</strong> {formatDate(selected.createdAt.slice(0, 10))}</Text>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void matricularEnAulas()}>
                      {busy ? 'Procesando…' : 'Matricular estudiantes en sus aulas'}
                    </Button>
                  </div>
                </>
              )}

              {studentsCol.loading ? (
                <Text size={200}>Cargando…</Text>
              ) : students.length === 0 ? (
                <EmptyStateView title="Sin estudiantes" message="Este reporte no tiene estudiantes o no coinciden con la búsqueda." />
              ) : (
                <div className={styles.scroll}>
                  <Table aria-label="Estudiantes SIGERD" size="small">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>No.</TableHeaderCell>
                        <TableHeaderCell>Id Estudiante</TableHeaderCell>
                        <TableHeaderCell>Primer apellido</TableHeaderCell>
                        <TableHeaderCell>Segundo apellido</TableHeaderCell>
                        <TableHeaderCell>Nombre(s)</TableHeaderCell>
                        <TableHeaderCell>Nacimiento</TableHeaderCell>
                        <TableHeaderCell>Grado</TableHeaderCell>
                        <TableHeaderCell>Sec.</TableHeaderCell>
                        <TableHeaderCell>Estado</TableHeaderCell>
                        <TableHeaderCell>Acciones</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => {
                        const g: SigerdStudent = s.sigerd ?? { nombres: '', primerApellido: '', segundoApellido: '' }
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{g.noOrden || '—'}</TableCell>
                            <TableCell><Text weight="semibold">{s.sigerdId || g.idEstudiante || '—'}</Text></TableCell>
                            <TableCell>{g.primerApellido || '—'}</TableCell>
                            <TableCell>{g.segundoApellido || '—'}</TableCell>
                            <TableCell>{g.nombres || s.fullName}</TableCell>
                            <TableCell>{g.nacimiento || s.birthDate || '—'}</TableCell>
                            <TableCell>{g.grado || '—'}</TableCell>
                            <TableCell>{g.seccion || '—'}</TableCell>
                            <TableCell>{(g.estado || '—') === 'Inscrito' ? <Badge appearance="filled" color="success">Inscrito</Badge> : (g.estado || '—')}</TableCell>
                            <TableCell>
                              <Toolbar size="small">
                                <ToolbarButton icon={<DeleteRegular />} onClick={() => void eliminarUno(s)}>Eliminar</ToolbarButton>
                              </Toolbar>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'matriculacion' && (
        <>
          <div className={styles.bar}>
            <Text size={200} weight="semibold">Mostrar:</Text>
            <Select value={matFilter} onChange={(_, d) => setMatFilter(d.value)} style={{ minWidth: '180px' }}>
              <option value="todos">Todos</option>
              <option value="matriculados">Matriculados</option>
              <option value="no">No matriculados</option>
            </Select>
            <Select value={matNivel} onChange={(_, d) => setMatNivel(d.value)} style={{ minWidth: '160px' }}>
              <option value="">Todos los niveles</option>
              <option value="Inicial">Inicial</option>
              <option value="Primaria">Primaria</option>
              <option value="Secundaria">Secundaria</option>
            </Select>
            <Input className={styles.search} contentBefore={<SearchRegular />} value={search} onChange={(_, d) => setSearch(d.value)} placeholder="Buscar estudiante…" />
          </div>
          {studentsCol.loading ? (
            <Text size={200}>Cargando…</Text>
          ) : listaMatriculacion.length === 0 ? (
            <EmptyStateView title="Sin estudiantes" message="No hay estudiantes que coincidan con el filtro." />
          ) : (
            <div className={styles.scroll}>
              <Table aria-label="Matriculación de estudiantes" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Estudiante</TableHeaderCell>
                    <TableHeaderCell>Nivel</TableHeaderCell>
                    <TableHeaderCell>Curso / Aula</TableHeaderCell>
                    <TableHeaderCell>Matrícula</TableHeaderCell>
                    <TableHeaderCell>Matricular en…</TableHeaderCell>
                    <TableHeaderCell>Cambiar tipo</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaMatriculacion.map((s) => {
                    const g = s.gradeId ? gradeById(s.gradeId) : undefined
                    const matriculado = matriculadoIds.has(s.id)
                    return (
                      <TableRow key={s.id}>
                        <TableCell><Text weight="semibold">{s.fullName}</Text></TableCell>
                        <TableCell>{nivelShort(g?.level ?? nivelDeReporte(reports.find((r) => r.id === s.sigerdReportId))) || '—'}</TableCell>
                        <TableCell>{g ? cursoNombre(g) : '—'}</TableCell>
                        <TableCell>{matriculado ? <Badge appearance="filled" color="success">Matriculado</Badge> : <Badge appearance="filled" color="danger">No matriculado</Badge>}</TableCell>
                        <TableCell>
                          {!matriculado && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <Select value={selCurso[s.id] ?? ''} onChange={(_, d) => setSelCurso((m) => ({ ...m, [s.id]: d.value }))} style={{ minWidth: '180px' }}>
                                <option value="">Curso…</option>
                                {cursos.map((c) => <option key={c.id} value={cursoNombre(c)}>{cursoNombre(c)}</option>)}
                              </Select>
                              <Button size="small" icon={<CheckmarkCircleRegular />} onClick={() => void matricularManual(s)}>Matricular</Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Select value={selTipo[s.id] ?? ''} onChange={(_, d) => setSelTipo((m) => ({ ...m, [s.id]: d.value }))} style={{ minWidth: '200px' }}>
                              <option value="">Cambiar a…</option>
                              {TIPO_OPCIONES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </Select>
                            <Button size="small" icon={<ArrowSyncRegular />} onClick={() => void cambiarTipo(s)}>Cambiar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
