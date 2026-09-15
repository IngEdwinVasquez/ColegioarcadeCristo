import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { SearchRegular, DeleteRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ImportarSigerdCard } from '../administrativo/ImportarSigerdCard'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { formatDate } from '../../utils/helpers'
import type { Enrollment, SigerdReport, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  header: { display: 'flex', flexWrap: 'wrap', gap: '6px 22px', background: tokens.colorNeutralBackground2, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' },
  bar: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
  search: { maxWidth: '340px', flex: 1, minWidth: '220px' },
  scroll: { overflowX: 'auto' },
})

/** Página SIGERD: importación de estudiantes desde PDF y consulta por cada reporte. */
export function SigerdPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports, dataService.saveSigerdReport, dataService.deleteSigerdReport)

  const [search, setSearch] = useState('')
  const [reportId, setReportId] = useState('')
  const [busy, setBusy] = useState(false)
  const [progreso, setProgreso] = useState('')

  const reports = useMemo(() => [...reportsCol.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [reportsCol.items])

  useEffect(() => {
    if (!reportId && reports.length) setReportId(reports[0].id)
  }, [reports, reportId])

  const students = useMemo(() => {
    const q = search.trim().toLowerCase()
    return studentsCol.items
      .filter((s) => !!s.sigerd || !!s.sigerdId)
      .filter((s) => !reportId || s.sigerdReportId === reportId)
      .filter((s) => !q || s.fullName.toLowerCase().includes(q) || (s.sigerdId ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [studentsCol.items, search, reportId])

  const selected = reports.find((r) => r.id === reportId)

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

  return (
    <div>
      <PageHeader
        title="SIGERD"
        subtitle="Importa la relación de estudiantes del SIGERD (PDF), consulta cada reporte procesado y gestiona los registros sin duplicar datos."
        actions={
          <Button appearance="secondary" icon={<DeleteRegular />} disabled={busy || (studentsCol.items.length === 0 && reports.length === 0)} onClick={() => void eliminarTodo()}>
            Eliminar todo el registro SIGERD
          </Button>
        }
      />

      {busy && progreso && <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>{progreso}</Text>}

      <ImportarSigerdCard />

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
                  {(r.header.grado || '—')} · {(r.header.seccion || '—')} · {(r.header.docentes || '—')} · {formatDate(r.createdAt.slice(0, 10))} ({r.studentsCount})
                </option>
              ))}
            </Select>
            <Input className={styles.search} contentBefore={<SearchRegular />} value={search} onChange={(_, d) => setSearch(d.value)} placeholder="Buscar estudiante (nombre, Id o correo)…" />
          </div>

          {selected && (
            <div className={styles.header}>
              <Text size={200}><strong>Año:</strong> {selected.header.ano || '—'}</Text>
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
                    <TableHeaderCell>Declarado</TableHeaderCell>
                    <TableHeaderCell>Municipio</TableHeaderCell>
                    <TableHeaderCell>Oficialía</TableHeaderCell>
                    <TableHeaderCell>Libro</TableHeaderCell>
                    <TableHeaderCell>Folio</TableHeaderCell>
                    <TableHeaderCell>Acta</TableHeaderCell>
                    <TableHeaderCell>Año</TableHeaderCell>
                    <TableHeaderCell>Grado</TableHeaderCell>
                    <TableHeaderCell>Sec.</TableHeaderCell>
                    <TableHeaderCell>Condición</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Cuenta M365</TableHeaderCell>
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
                        <TableCell>{g.declarado || '—'}</TableCell>
                        <TableCell>{g.municipio || '—'}</TableCell>
                        <TableCell>{g.oficialia || '—'}</TableCell>
                        <TableCell>{g.libro || '—'}</TableCell>
                        <TableCell>{g.folio || '—'}</TableCell>
                        <TableCell>{g.acta || '—'}</TableCell>
                        <TableCell>{g.anio || '—'}</TableCell>
                        <TableCell>{g.grado || '—'}</TableCell>
                        <TableCell>{g.seccion || '—'}</TableCell>
                        <TableCell>{g.condicion || '—'}</TableCell>
                        <TableCell>{(g.estado || '—') === 'Inscrito' ? <Badge appearance="filled" color="success">Inscrito</Badge> : (g.estado || '—')}</TableCell>
                        <TableCell>{s.email || '—'}</TableCell>
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
    </div>
  )
}
