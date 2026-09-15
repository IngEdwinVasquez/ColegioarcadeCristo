import { useMemo, useRef, useState } from 'react'
import { Button, Card, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { DocumentPdfRegular, CheckmarkCircleRegular, DeleteRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf } from '../../services/sigerdAi'
import { listEntraUsers } from '../../services/entraUsers'
import { formatDate, genId } from '../../utils/helpers'
import { GRADOS, asignaturaDe, cursoNombre, gradoDe, isRealSubject, ordenarCursos, seccionDe } from '../../utils/academic'
import type { Enrollment, SigerdHeader, SigerdReport, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
})

interface DirUser { id: string; displayName?: string; email?: string }
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

/**
 * Importa la relación de estudiantes de un PDF del SIGERD (uno por curso):
 * guarda el encabezado y todas las columnas de cada estudiante, detecta el curso
 * por Grado/Sección, previsualiza, vincula la cuenta de Microsoft 365 y matricula.
 */
export function ImportarSigerdCard() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports, dataService.saveSigerdReport, dataService.deleteSigerdReport)

  const [cursoDefecto, setCursoDefecto] = useState('')
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

  const cursoDeGradoSeccion = (grado?: string, seccion?: string): string | undefined => {
    const n = numGrado(grado)
    const sec = (seccion || '').trim().toUpperCase()
    if (!n || !sec) return undefined
    const found = grades.find((g) => isRealSubject(asignaturaDe(g)) && gradoDe(g) === GRADOS[n - 1] && seccionDe(g) === sec)
    return found ? cursoNombre(found) : undefined
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

      let dir: DirUser[] = []
      try { dir = await listEntraUsers() } catch { dir = [] }
      const dirByName = new Map(dir.map((u) => [norm(u.displayName ?? ''), u]))
      const headerCurso = cursoDeGradoSeccion(hdr.grado, hdr.seccion)

      const rows: PreviewRow[] = estudiantes.map((s) => {
        const fullName = `${s.nombres} ${s.primerApellido} ${s.segundoApellido}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const alt = `${s.primerApellido} ${s.segundoApellido} ${s.nombres}`.replace(/\s+/g, ' ').trim().toUpperCase()
        return { s, fullName, match: dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt)), curso: cursoDeGradoSeccion(s.grado, s.seccion) ?? headerCurso }
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
      const cursosUsados = new Set<string>()
      let created = 0
      let enrolled = 0
      let linked = 0
      let skipped = 0
      let error: string | null = null
      for (const row of preview) {
        const targetCurso = row.curso || cursoDefecto
        if (!targetCurso) { skipped += 1; continue }
        const rep = grades.find((g) => isRealSubject(asignaturaDe(g)) && cursoNombre(g) === targetCurso)
        if (!rep) { skipped += 1; continue }
        cursosUsados.add(targetCurso)
        if (row.match) linked += 1
        try {
          const existing = studentsCol.items.find((st) => (row.s.idEstudiante && st.sigerdId === row.s.idEstudiante) || norm(st.fullName) === norm(row.fullName))
          const student: Student = existing
            ? { ...existing, fullName: row.fullName, email: row.match?.email ?? existing.email, userId: row.match?.id ?? existing.userId, sigerdId: row.s.idEstudiante || existing.sigerdId, birthDate: isoNac(row.s.nacimiento) ?? existing.birthDate, gradeId: rep.id, sigerd: row.s }
            : { id: genId('stu'), fullName: row.fullName, email: row.match?.email, userId: row.match?.id, sigerdId: row.s.idEstudiante, gradeId: rep.id, birthDate: isoNac(row.s.nacimiento), sigerd: row.s }
          if (!existing) created += 1
          await studentsCol.save(student)
          const already = enrollmentsCol.items.some((e) => e.studentId === student.id && (!period || e.periodId === period))
          if (!already) {
            await enrollmentsCol.save({ id: genId('enr'), studentId: student.id, gradeId: rep.id, periodId: period })
            enrolled += 1
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'error al guardar'
        }
      }

      // Guarda el encabezado del reporte como registro (una vez).
      await reportsCol.save({
        id: genId('sig'),
        header: { ...header, curso: undefined } as SigerdHeader,
        curso: [...cursosUsados].join(', ') || cursoDefecto || undefined,
        periodId: period,
        studentsCount: preview.length,
        createdAt: new Date().toISOString(),
      })

      if (error) {
        toaster.dispatchToast(`SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s). Aviso: ${error}`, { intent: 'warning' })
      } else {
        toaster.dispatchToast(`SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s), ${linked} vinculado(s) a Microsoft 365${skipped ? `, ${skipped} sin curso` : ''}.`, { intent: skipped ? 'warning' : 'success' })
      }
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
          Sube el reporte del SIGERD. Se guarda el encabezado y todas las columnas de cada estudiante, se detecta el curso por Grado/Sección, se previsualizan, se vinculan a Microsoft 365 y se matriculan.
        </Text>
        <FieldRow>
          <FormField label="Curso por defecto (si no se detecta)" hint="Opcional.">
            <Select value={cursoDefecto} onChange={(_, d) => setCursoDefecto(d.value)}>
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

      {/* Registros (encabezados) importados */}
      {reportsCol.items.length > 0 && (
        <>
          <Text weight="semibold" size={400} block style={{ margin: '8px 0' }}>Reportes SIGERD importados ({reportsCol.items.length})</Text>
          <Table aria-label="Reportes SIGERD">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Año</TableHeaderCell>
                <TableHeaderCell>Centro</TableHeaderCell>
                <TableHeaderCell>Regional / Distrito</TableHeaderCell>
                <TableHeaderCell>Grado / Sec.</TableHeaderCell>
                <TableHeaderCell>Tanda / Sector</TableHeaderCell>
                <TableHeaderCell>Docentes</TableHeaderCell>
                <TableHeaderCell>Est.</TableHeaderCell>
                <TableHeaderCell>Importado</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...reportsCol.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.header.ano || '—'}</TableCell>
                  <TableCell>{r.header.centroEducativo || '—'}</TableCell>
                  <TableCell>{r.header.direccionRegional || '—'} / {r.header.distritoEducativo || '—'}</TableCell>
                  <TableCell>{r.header.grado || '—'} · {r.header.seccion || '—'}</TableCell>
                  <TableCell>{r.header.tandaServicio || '—'} · {r.header.sector || '—'}</TableCell>
                  <TableCell>{r.header.docentes || '—'}</TableCell>
                  <TableCell>{r.studentsCount}</TableCell>
                  <TableCell>{formatDate(r.createdAt.slice(0, 10))}</TableCell>
                  <TableCell>
                    <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => void reportsCol.remove(r.id)}>Eliminar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

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
              {header.grado && <>Grado: <strong>{header.grado}</strong> · </>}
              {header.seccion && <>Sec.: <strong>{header.seccion}</strong> · </>}
              {header.cantidadEstudiantes && <>Cantidad: <strong>{header.cantidadEstudiantes}</strong> · </>}
              {header.docentes && <>Docente: <strong>{header.docentes}</strong></>}
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
                      <TableCell>{row.match?.email ? row.match.email : <Text size={200} style={{ color: '#B42318' }}>Sin coincidencia</Text>}</TableCell>
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
