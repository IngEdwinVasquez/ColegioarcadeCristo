import { useMemo, useRef, useState } from 'react'
import { Button, Card, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { DocumentPdfRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf } from '../../services/sigerdAi'
import { listEntraUsers } from '../../services/entraUsers'
import { genId } from '../../utils/helpers'
import { GRADOS, asignaturaDe, cicloFromGrade, cursoNombre, esCursoValido, gradoDe, isRealSubject, nivelDeTanda, nivelShort, ordenarCursos, seccionDe } from '../../utils/academic'
import type { Enrollment, GradeSection, SigerdHeader, SigerdReport, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
})

interface DirUser { id: string; displayName?: string; mail?: string | null }
interface PreviewRow { s: SigerdStudent; fullName: string; match?: DirUser; curso?: string }

const GRADO_WORD: Record<string, number> = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6,
  '1ro': 1, '2do': 2, '3ro': 3, '4to': 4, '5to': 5, '6to': 6,
}
const numGrado = (g?: string) => GRADO_WORD[(g ?? '').trim().toLowerCase()] ?? null
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const isoNac = (d?: string) => {
  const m = (d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
}

interface Props {
  cursoDefecto: string
  onCursoDefectoChange: (v: string) => void
}

/**
 * Importa estudiantes desde un PDF del SIGERD. Detecta el curso por el
 * encabezado (Nivel desde "Tanda-Servicio", Grado y Sección); si el curso no
 * existe en Gestión académica lo crea, guarda el encabezado y todas las
 * columnas, vincula la cuenta de Microsoft 365 y matricula.
 */
export function ImportarSigerdCard({ cursoDefecto, onCursoDefectoChange }: Props) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports, dataService.saveSigerdReport)
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade, dataService.deleteGrade)

  const [period, setPeriod] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [header, setHeader] = useState<SigerdHeader>({})
  const [progreso, setProgreso] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cursos = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => cursoNombre(g)),
    [grades],
  )
  const periodActive = periods.find((p) => p.id === period)?.isActive ?? false
  const headerNivel = nivelDeTanda(header.tandaServicio)

  // Asegura que exista el registro del curso en Gestión académica (lo crea si falta).
  const ensureGrade = async (curso: string, sample: SigerdStudent, cache: Map<string, GradeSection>): Promise<GradeSection | undefined> => {
    const cached = cache.get(curso)
    if (cached) return cached
    const g = grades.find((x) => cursoNombre(x) === curso && esCursoValido(x))
    if (g) { cache.set(curso, g); return g }
    const n = numGrado(sample.grado)
    const sec = (sample.seccion || '').trim().toUpperCase()
    if (!n || !sec) return undefined
    const nivelLargo = sample.nivel ?? headerNivel ?? 'Nivel Primario'
    const nuevo: GradeSection = {
      id: genId('g'),
      name: `${GRADOS[n - 1]}.${sec}`,
      level: nivelLargo,
      nivel: nivelShort(nivelLargo),
      section: sec,
      ciclo: cicloFromGrade(nivelLargo, GRADOS[n - 1]),
      asignatura: 'Asignaturas Generales',
    }
    await gradesCol.save(nuevo)
    cache.set(curso, nuevo)
    return nuevo
  }

  const grupos = useMemo(() => {
    if (!preview) return []
    const map = new Map<string, number>()
    let sinCurso = 0
    for (const r of preview) {
      if (r.curso) map.set(r.curso, (map.get(r.curso) ?? 0) + 1)
      else sinCurso += 1
    }
    return [...map.entries()].map(([curso, count]) => ({ curso, count })).concat(sinCurso ? [{ curso: 'Sin detectar (usa el curso por defecto)', count: sinCurso }] : [])
  }, [preview])

  const analizar = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setProgreso('Extrayendo texto del PDF…')
    try {
      const text = await extractPdfText(file)
      setProgreso('Analizando estudiantes…')
      const { header: hdr, estudiantes } = await parseSigerdStudentsPdf(text, (d, t) => setProgreso(`Analizando fragmentos ${d}/${t}…`))
      if (estudiantes.length === 0) throw new Error('No se encontraron estudiantes en el PDF del SIGERD.')
      setHeader(hdr)
      const nivelHeader = nivelDeTanda(hdr.tandaServicio)

      let dir: DirUser[] = []
      try { dir = await listEntraUsers() } catch { dir = [] }
      const dirByName = new Map(dir.map((u) => [norm(u.displayName ?? ''), u]))

      const rows: PreviewRow[] = estudiantes.map((s) => {
        const fullName = `${s.nombres} ${s.primerApellido} ${s.segundoApellido}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const alt = `${s.primerApellido} ${s.segundoApellido} ${s.nombres}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const nivel = s.nivel ?? nivelHeader
        const n = numGrado(s.grado)
        const sec = (s.seccion || '').trim().toUpperCase()
        let curso: string | undefined
        if (n && sec) {
          const g = grades.find((x) => gradoDe(x) === GRADOS[n - 1] && seccionDe(x) === sec && (!nivel || x.level === nivel)) ?? grades.find((x) => gradoDe(x) === GRADOS[n - 1] && seccionDe(x) === sec)
          curso = g ? cursoNombre(g) : `${GRADOS[n - 1]}.${sec} · ${nivelShort(nivel ?? 'Nivel Primario')}`
        }
        return { s, fullName, match: dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt)), curso }
      })
      setPreview(rows)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo procesar el PDF del SIGERD.', { intent: 'error' })
    } finally {
      setBusy(false)
      setProgreso('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmar = async () => {
    if (!preview || preview.length === 0) return
    if (!periodActive) {
      toaster.dispatchToast('Selecciona un período activo.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      const reportId = genId('sig')
      const cursosUsados = new Set<string>()
      const cursosCreados = new Map<string, GradeSection>()
      let created = 0
      let enrolled = 0
      let linked = 0
      let skipped = 0
      let errorMsg: string | null = null

      for (const row of preview) {
        const targetCurso = row.curso || cursoDefecto
        if (!targetCurso) { skipped += 1; continue }
        let rep: GradeSection | undefined
        try {
          rep = await ensureGrade(targetCurso, row.s, cursosCreados)
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : 'error al crear el curso'
        }
        if (!rep) { skipped += 1; continue }
        cursosUsados.add(targetCurso)
        if (row.match) linked += 1
        try {
          const existing = studentsCol.items.find((st) => (row.s.idEstudiante && st.sigerdId === row.s.idEstudiante) || norm(st.fullName) === norm(row.fullName))
          const student: Student = existing
            ? { ...existing, fullName: row.fullName, email: row.match?.mail ?? existing.email, userId: row.match?.id ?? existing.userId, sigerdId: row.s.idEstudiante || existing.sigerdId, birthDate: isoNac(row.s.nacimiento) ?? existing.birthDate, gradeId: rep.id, sigerd: row.s, sigerdReportId: reportId }
            : { id: genId('stu'), fullName: row.fullName, email: row.match?.mail ?? undefined, userId: row.match?.id, sigerdId: row.s.idEstudiante, gradeId: rep.id, birthDate: isoNac(row.s.nacimiento), sigerd: row.s, sigerdReportId: reportId }
          if (!existing) created += 1
          await studentsCol.save(student)
          const already = enrollmentsCol.items.some((e) => e.studentId === student.id && (!period || e.periodId === period))
          if (!already) {
            await enrollmentsCol.save({ id: genId('enr'), studentId: student.id, gradeId: rep.id, periodId: period })
            enrolled += 1
          }
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : 'error al guardar'
        }
      }

      await reportsCol.save({
        id: reportId,
        header,
        curso: [...cursosUsados].join(', ') || cursoDefecto || undefined,
        periodId: period,
        studentsCount: preview.length,
        createdAt: new Date().toISOString(),
      })

      toaster.dispatchToast(
        errorMsg
          ? `SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s). Aviso: ${errorMsg}`
          : `SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s), ${linked} vinculado(s) a Microsoft 365${skipped ? `, ${skipped} sin curso` : ''}.`,
        { intent: errorMsg || skipped ? 'warning' : 'success' },
      )
      setPreview(null)
    } catch (err) {
      toaster.dispatchToast(err instanceof Error ? err.message : 'No se pudieron crear los registros.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className={styles.card}>
        <Text weight="semibold" size={400}>Importar estudiantes desde PDF del SIGERD</Text>
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>
          Se detecta el curso por el encabezado (Nivel desde «Tanda-Servicio», Grado y Sección); si no existe, se crea en Gestión académica. Se guarda el encabezado y todas las columnas de cada estudiante.
        </Text>
        <FieldRow>
          <FormField label="Curso por defecto (si no se detecta)" hint="Se usa cuando el encabezado no permite detectar el curso; filtra la tabla.">
            <Select value={cursoDefecto} onChange={(_, d) => onCursoDefectoChange(d.value)}>
              <option value="">— Sin curso por defecto —</option>
              {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Período" required hint={periodActive ? 'Período activo' : 'Debe ser un período ACTIVO'}>
            <Select value={period} onChange={(_, d) => setPeriod(d.value)}>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
            </Select>
          </FormField>
        </FieldRow>
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void analizar(e.target.files?.[0])} />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <DocumentPdfRegular />} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Procesando…' : 'Cargar PDF SIGERD y previsualizar'}
          </Button>
          {busy && progreso && <Text size={200} style={{ color: 'var(--texto-suave)' }}>{progreso}</Text>}
        </div>
      </Card>

      <ModalForm
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null) }}
        title="Previsualización · Estudiantes del SIGERD"
        subtitle={`${preview?.length ?? 0} estudiante(s) en ${grupos.length} grupo(s)`}
        width={1100}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || !periodActive} onClick={() => void confirmar()}>
              {busy ? 'Procesando…' : 'Crear y matricular'}
            </Button>
          </>
        }
      >
        {preview && (
          <div>
            <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>
              {header.ano && <>Año: <strong>{header.ano}</strong> · </>}
              {header.centroEducativo && <>{header.centroEducativo} · </>}
              {headerNivel && <>Nivel: <strong>{nivelShort(headerNivel)}</strong> · </>}
              {header.grado && <>Grado: <strong>{header.grado}</strong> · </>}
              {header.seccion && <>Sec.: <strong>{header.seccion}</strong></>}
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {grupos.map((g) => (
                <span key={g.curso} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '3px 12px' }}>
                  <Text size={200}><strong>{g.curso}:</strong> {g.count}</Text>
                </span>
              ))}
            </div>
            <div style={{ maxHeight: '52vh', overflow: 'auto' }}>
              <Table aria-label="Estudiantes detectados" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>No.</TableHeaderCell>
                    <TableHeaderCell>Id</TableHeaderCell>
                    <TableHeaderCell>Estudiante</TableHeaderCell>
                    <TableHeaderCell>Nac.</TableHeaderCell>
                    <TableHeaderCell>Mun.</TableHeaderCell>
                    <TableHeaderCell>Libro/Folio/Acta</TableHeaderCell>
                    <TableHeaderCell>Curso (destino)</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Cuenta M365</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={`${row.s.idEstudiante}-${i}`}>
                      <TableCell>{row.s.noOrden || '—'}</TableCell>
                      <TableCell>{row.s.idEstudiante || '—'}</TableCell>
                      <TableCell><Text weight="semibold">{row.fullName}</Text></TableCell>
                      <TableCell>{row.s.nacimiento || '—'}</TableCell>
                      <TableCell>{row.s.municipio || '—'}</TableCell>
                      <TableCell>{row.s.libro || '—'}/{row.s.folio || '—'}/{row.s.acta || '—'}</TableCell>
                      <TableCell>{row.curso ?? (cursoDefecto ? `${cursoDefecto} (por defecto)` : <Text size={200} style={{ color: '#B42318' }}>Sin detectar</Text>)}</TableCell>
                      <TableCell>{row.s.estado || '—'}</TableCell>
                      <TableCell>{row.match?.mail ? row.match.mail : <Text size={200} style={{ color: '#B42318' }}>Sin coincidencia</Text>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ModalForm>
    </>
  )
}
