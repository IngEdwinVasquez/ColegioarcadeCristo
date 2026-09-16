import { useMemo, useRef, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { DocumentPdfRegular, CheckmarkCircleRegular, PersonAddRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf } from '../../services/sigerdAi'
import { listEntraUsers, createEntraUser } from '../../services/entraUsers'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { GRADOS, NIVELES, asignaturaDe, cicloFromGrade, cursoNombre, esCursoValido, isRealSubject, nivelDeTanda, nivelShort, ordenarCursos } from '../../utils/academic'
import type { Enrollment, GradeSection, SigerdHeader, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
})

interface DirUser { id: string; displayName?: string; mail?: string | null; userPrincipalName?: string }
interface PreviewRow { s: SigerdStudent; fullName: string; match?: DirUser; curso?: string }

/** Dominio de correo institucional de los estudiantes. */
const M365_DOMAIN = 'arcadecristo.edu.do'
const mailOf = (u?: DirUser) => (u?.mail ?? u?.userPrincipalName ?? '').trim()
/** Compone "primernombre.primerapellido" para el correo institucional. */
const upnBase = (s: SigerdStudent) => {
  const primerNombre = norm(s.nombres ?? '').split(' ')[0] || 'estudiante'
  const primerApellido = norm(s.primerApellido ?? '').split(' ')[0]
  return primerApellido ? `${primerNombre}.${primerApellido}` : primerNombre
}

const GRADO_MAP: Array<[RegExp, number]> = [
  [/\b(1ro|1er|primero|primer)\b/, 1],
  [/\b(2do|segundo)\b/, 2],
  [/\b(3ro|3er|tercero|tercer)\b/, 3],
  [/\b(4to|cuarto)\b/, 4],
  [/\b(5to|quinto)\b/, 5],
  [/\b(6to|sexto)\b/, 6],
]
/** Detecta el grado (1…6) aunque venga como texto, p. ej. "Cuarto grado" o "4to. Grado". */
const numGrado = (g?: string) => {
  const t = (g ?? '').trim().toLowerCase()
  for (const [re, n] of GRADO_MAP) if (re.test(t)) return n
  return null
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const isoNac = (d?: string) => {
  const m = (d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
}

interface Props {
  cursoDefecto: string
  onCursoDefectoChange: (v: string) => void
  /** Se invoca al terminar una importación para que la página refresque sus listados. */
  onImported?: () => void
}

/**
 * Importa estudiantes desde un PDF del SIGERD. Detecta el curso por el
 * encabezado (Nivel desde "Tanda-Servicio", Grado y Sección); si el curso no
 * existe en Gestión académica lo crea, guarda el encabezado y todas las
 * columnas, vincula la cuenta de Microsoft 365 y matricula.
 */
export function ImportarSigerdCard({ cursoDefecto, onCursoDefectoChange, onImported }: Props) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods, refreshCatalogs } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment)

  const [period, setPeriod] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '')
  const [tipoPdf, setTipoPdf] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [header, setHeader] = useState<SigerdHeader>({})
  const [progreso, setProgreso] = useState('')
  const [tempPassword, setTempPassword] = useState('Arca2026*')
  const fileRef = useRef<HTMLInputElement>(null)

  const cursos = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => cursoNombre(g)),
    [grades],
  )
  const periodActive = periods.find((p) => p.id === period)?.isActive ?? false
  const headerNivel = nivelDeTanda(header.tandaServicio)

  /**
   * Construye el curso (GradeSection) de un estudiante a partir de su Grado/Sección.
   * - Primaria/Secundaria (o grado numérico 1ro…6to): "1ro.A · Primaria".
   * - Inicial (sin grado numérico): usa el texto del grado tal cual
   *   (p. ej. "Preprimario.A · Inicial"); admite solo sección.
   */
  const gradeFor = (s: SigerdStudent, nivel?: string | null): GradeSection | undefined => {
    const nivelLargo = nivel ?? headerNivel ?? 'Nivel Primario'
    const sec = (s.seccion || '').trim().toUpperCase()
    const n = numGrado(s.grado)
    if (n) {
      const grado = GRADOS[n - 1]
      return { id: '', name: `${grado}${sec ? `.${sec}` : ''}`, grado, level: nivelLargo, nivel: nivelShort(nivelLargo), section: sec || undefined, ciclo: cicloFromGrade(nivelLargo, grado), asignatura: 'Asignaturas Generales' }
    }
    if (nivelShort(nivelLargo) === 'Inicial') {
      const gradoTxt = (s.grado || '').trim()
      if (!gradoTxt && !sec) return undefined
      return { id: '', name: [gradoTxt, sec].filter(Boolean).join('.') || 'Inicial', grado: gradoTxt || undefined, level: 'Nivel Inicial', nivel: 'Inicial', section: sec || undefined, asignatura: 'Asignaturas Generales' }
    }
    return undefined
  }

  // Asegura que exista el registro del curso en Gestión académica (lo crea si falta).
  const ensureGrade = async (curso: string, sample: SigerdStudent, cache: Map<string, GradeSection>): Promise<GradeSection | undefined> => {
    const cached = cache.get(curso)
    if (cached) return cached
    const g = grades.find((x) => cursoNombre(x) === curso && esCursoValido(x))
    if (g) { cache.set(curso, g); return g }
    const gs = gradeFor(sample, sample.nivel ?? headerNivel)
    if (!gs || cursoNombre(gs) !== curso) return undefined
    const nuevo: GradeSection = { ...gs, id: genId('g') }
    await dataService.saveGrade(nuevo)
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

  const sinCuenta = useMemo(() => (preview ?? []).filter((r) => !mailOf(r.match)).length, [preview])

  /** Crea en Microsoft 365 las cuentas faltantes y devuelve las filas actualizadas. */
  const crearCuentasM365 = async (rows: PreviewRow[], usados: Set<string>) => {
    const updated = [...rows]
    let creadas = 0
    let fallidas = 0
    let errorMsg: string | null = null
    for (let i = 0; i < updated.length; i++) {
      const row = updated[i]
      if (mailOf(row.match)) continue
      const base = upnBase(row.s)
      let upn = `${base}@${M365_DOMAIN}`
      let intentos = 0
      while (usados.has(upn.toLowerCase()) && intentos < 50) {
        intentos += 1
        upn = `${base}${intentos + 1}@${M365_DOMAIN}`
      }
      try {
        const displayName = `${row.s.nombres} ${row.s.primerApellido} ${row.s.segundoApellido}`.replace(/\s+/g, ' ').trim()
        const creado = await createEntraUser({
          displayName,
          mailNickname: upn.split('@')[0],
          userPrincipalName: upn,
          givenName: row.s.nombres,
          surname: row.s.primerApellido,
          password: tempPassword,
          usageLocation: 'DO',
        })
        usados.add(upn.toLowerCase())
        updated[i] = { ...row, match: { id: creado.id, displayName, mail: creado.mail ?? upn, userPrincipalName: creado.userPrincipalName ?? upn } }
        creadas += 1
      } catch (e) {
        fallidas += 1
        errorMsg = graphErrorMessage(e)
      }
    }
    return { updated, creadas, fallidas, errorMsg }
  }

  const crearCuentasFaltantes = async () => {
    if (!preview) return
    if (sinCuenta === 0) {
      toaster.dispatchToast('Todos los estudiantes ya tienen cuenta de Microsoft 365.', { intent: 'info' })
      return
    }
    setBusy(true)
    setProgreso('Creando cuentas de Microsoft 365…')
    try {
      const usados = new Set<string>()
      try {
        ;(await listEntraUsers()).forEach((u) => { const p = (u.mail ?? u.userPrincipalName ?? '').toLowerCase(); if (p) usados.add(p) })
      } catch { /* sin acceso al directorio */ }
      const { updated, creadas, fallidas, errorMsg } = await crearCuentasM365(preview, usados)
      setPreview(updated)
      toaster.dispatchToast(
        fallidas
          ? `Cuentas creadas: ${creadas}. Con error: ${fallidas}. ${errorMsg ?? ''}`
          : `Se crearon ${creadas} cuenta(s) de Microsoft 365 (${M365_DOMAIN}).`,
        { intent: fallidas ? 'warning' : 'success' },
      )
    } finally {
      setBusy(false)
      setProgreso('')
    }
  }

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
        const nivel = tipoPdf || s.nivel || nivelHeader
        const stu = nivel && nivel !== s.nivel ? { ...s, nivel } : s
        const gs = gradeFor(stu, nivel)
        let curso: string | undefined
        if (gs) {
          const nombre = cursoNombre(gs)
          const existente = grades.find((x) => cursoNombre(x) === nombre && esCursoValido(x))
          curso = existente ? cursoNombre(existente) : nombre
        }
        return { s: stu, fullName, match: dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt)), curso }
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
    if (!preview.some((r) => r.curso || cursoDefecto)) {
      toaster.dispatchToast('No se detectó el curso de ningún estudiante. Elige un «Curso por defecto» o revisa el «Tipo de PDF (nivel)».', { intent: 'error' })
      return
    }
    setBusy(true)
    setProgreso('Preparando…')
    try {
      const reportId = genId('sig')
      const cursosUsados = new Set<string>()
      const cursosCreados = new Map<string, GradeSection>()
      const bySigerdId = new Map<string, Student>()
      const byName = new Map<string, Student>()
      for (const st of studentsCol.items) {
        if (st.sigerdId) bySigerdId.set(st.sigerdId, st)
        byName.set(norm(st.fullName), st)
      }
      const yaMatriculados = new Set(
        enrollmentsCol.items.filter((e) => !period || e.periodId === period).map((e) => e.studentId),
      )
      let created = 0
      let enrolled = 0
      let linked = 0
      let skipped = 0
      let createdAccounts = 0
      let errorMsg: string | null = null

      // Crea en Microsoft 365 las cuentas que falten (correo institucional) y las
      // agrega a la previsualización antes de matricular.
      let rows = preview
      if (rows.some((r) => !mailOf(r.match))) {
        setProgreso('Creando cuentas de Microsoft 365…')
        const usados = new Set<string>()
        for (const st of studentsCol.items) { const p = (st.email ?? '').toLowerCase(); if (p) usados.add(p) }
        try {
          ;(await listEntraUsers()).forEach((u) => { const p = (u.mail ?? u.userPrincipalName ?? '').toLowerCase(); if (p) usados.add(p) })
        } catch { /* sin acceso al directorio */ }
        const res = await crearCuentasM365(rows, usados)
        rows = res.updated
        createdAccounts = res.creadas
        if (res.errorMsg) errorMsg = res.errorMsg
      }

      // Se guarda directo (sin refrescar la lista en cada ítem) y se actualizan los
      // listados una sola vez al final: con cientos de estudiantes es mucho más rápido.
      let n = 0
      for (const row of rows) {
        n += 1
        if (n === 1 || n % 10 === 0) setProgreso(`Guardando ${n}/${rows.length}…`)
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
          const existing = (row.s.idEstudiante && bySigerdId.get(row.s.idEstudiante)) || byName.get(norm(row.fullName))
          const student: Student = existing
            ? { ...existing, fullName: row.fullName, email: mailOf(row.match) || existing.email, userId: row.match?.id ?? existing.userId, sigerdId: row.s.idEstudiante || existing.sigerdId, birthDate: isoNac(row.s.nacimiento) ?? existing.birthDate, gradeId: rep.id, sigerd: row.s, sigerdReportId: reportId }
            : { id: genId('stu'), fullName: row.fullName, email: mailOf(row.match) || undefined, userId: row.match?.id, sigerdId: row.s.idEstudiante, gradeId: rep.id, birthDate: isoNac(row.s.nacimiento), sigerd: row.s, sigerdReportId: reportId }
          if (!existing) {
            created += 1
            if (student.sigerdId) bySigerdId.set(student.sigerdId, student)
            byName.set(norm(student.fullName), student)
          }
          await dataService.saveStudent(student)
          if (!yaMatriculados.has(student.id)) {
            await dataService.saveEnrollment({ id: genId('enr'), studentId: student.id, gradeId: rep.id, periodId: period })
            yaMatriculados.add(student.id)
            enrolled += 1
          }
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : 'error al guardar'
        }
      }

      if (created === 0 && enrolled === 0) {
        toaster.dispatchToast(
          `No se guardó ningún estudiante (${skipped} sin curso). Revisa el «Tipo de PDF (nivel)», el Grado/Sección del PDF o elige un «Curso por defecto».${errorMsg ? ` Detalle: ${errorMsg}` : ''}`,
          { intent: 'error' },
        )
        return
      }

      setProgreso('Guardando reporte…')
      await dataService.saveSigerdReport({
        id: reportId,
        header,
        nivel: tipoPdf || headerNivel || undefined,
        curso: [...cursosUsados].join(', ') || cursoDefecto || undefined,
        periodId: period,
        studentsCount: rows.length,
        createdAt: new Date().toISOString(),
      })

      setProgreso('Actualizando listados…')
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh(), refreshCatalogs()])
      onImported?.()

      const extra = [
        createdAccounts ? `${createdAccounts} cuenta(s) M365 creada(s)` : '',
        `${linked} vinculado(s) a Microsoft 365`,
        skipped ? `${skipped} sin curso` : '',
      ].filter(Boolean).join(', ')
      toaster.dispatchToast(
        errorMsg
          ? `SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s). Aviso: ${errorMsg}`
          : `SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s), ${extra}.`,
        { intent: errorMsg || skipped ? 'warning' : 'success' },
      )
      setPreview(null)
    } catch (err) {
      toaster.dispatchToast(err instanceof Error ? err.message : 'No se pudieron crear los registros.', { intent: 'error' })
    } finally {
      setBusy(false)
      setProgreso('')
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
          <FormField label="Tipo de PDF (nivel)" hint="Cada período sube 3 PDF: uno de Inicial, uno de Primaria y otro de Secundaria.">
            <Select value={tipoPdf} onChange={(_, d) => setTipoPdf(d.value)}>
              <option value="">Autodetectar (por el encabezado)</option>
              {NIVELES.map((n) => <option key={n} value={`Nivel ${n}`}>{n}</option>)}
            </Select>
          </FormField>
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
          <FormField label="Contraseña temporal (cuentas nuevas)" hint="Se exige cambiarla al primer inicio de sesión.">
            <Input value={tempPassword} onChange={(_, d) => setTempPassword(d.value)} />
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
            {busy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--fondo-suave, #F3F2F1)', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px' }}>
                <Spinner size="tiny" />
                <Text size={200} weight="semibold">{progreso || 'Procesando…'}</Text>
              </div>
            )}
            <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>
              {header.ano && <>Año: <strong>{header.ano}</strong> · </>}
              {header.centroEducativo && <>{header.centroEducativo} · </>}
              {(tipoPdf || headerNivel) && <>Nivel: <strong>{nivelShort(tipoPdf || headerNivel || '')}</strong> · </>}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <Text size={200}>
                Cuentas Microsoft 365: <strong>{(preview?.length ?? 0) - sinCuenta}</strong> con coincidencia ·{' '}
                <strong style={{ color: sinCuenta ? '#B42318' : undefined }}>{sinCuenta}</strong> sin cuenta
              </Text>
              <Button
                size="small"
                appearance="secondary"
                icon={busy ? <Spinner size="tiny" /> : <PersonAddRegular />}
                disabled={busy || sinCuenta === 0}
                onClick={() => void crearCuentasFaltantes()}
              >
                {`Crear cuentas M365 faltantes (${sinCuenta})`}
              </Button>
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
                    <TableHeaderCell>Grado (PDF)</TableHeaderCell>
                    <TableHeaderCell>Sec. (PDF)</TableHeaderCell>
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
                      <TableCell>{row.s.grado || '—'}</TableCell>
                      <TableCell>{row.s.seccion || '—'}</TableCell>
                      <TableCell>{row.curso ?? (cursoDefecto ? `${cursoDefecto} (por defecto)` : <Text size={200} style={{ color: '#B42318' }}>Sin detectar</Text>)}</TableCell>
                      <TableCell>{row.s.estado || '—'}</TableCell>
                      <TableCell>{mailOf(row.match) || <Text size={200} style={{ color: '#B42318' }}>Sin coincidencia</Text>}</TableCell>
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
