import { useMemo, useState } from 'react'
import { Badge, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { SearchRegular, DeleteRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ImportarSigerdCard } from '../administrativo/ImportarSigerdCard'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { formatDate } from '../../utils/helpers'
import type { Enrollment, SigerdReport, SigerdStudent, Student } from '../../types'

const useStyles = makeStyles({
  header: { display: 'flex', flexWrap: 'wrap', gap: '6px 22px', background: tokens.colorNeutralBackground2, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' },
  search: { maxWidth: '360px', marginBottom: '12px' },
  scroll: { overflowX: 'auto' },
})

/** Página SIGERD: importación de estudiantes desde PDF y tabla con todas las columnas del reporte. */
export function SigerdPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { gradeById } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports)

  const [search, setSearch] = useState('')

  const students = useMemo(() => {
    const q = search.trim().toLowerCase()
    return studentsCol.items
      .filter((s) => !!s.sigerd || !!s.sigerdId)
      .filter((s) => !q || s.fullName.toLowerCase().includes(q) || (s.sigerdId ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [studentsCol.items, search])

  const latest = useMemo(() => [...reportsCol.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0], [reportsCol.items])

  const eliminar = async (s: Student) => {
    if (!window.confirm(`¿Eliminar el registro SIGERD de ${s.fullName}?`)) return
    try {
      for (const e of enrollmentsCol.items.filter((x) => x.studentId === s.id)) await enrollmentsCol.remove(e.id)
      await studentsCol.remove(s.id)
      toaster.dispatchToast('Registro eliminado.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo eliminar.', { intent: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="SIGERD"
        subtitle="Importa la relación de estudiantes del SIGERD (PDF) y consulta aquí el registro creado con todas las columnas del reporte."
      />

      <ImportarSigerdCard />

      {latest && (
        <div className={styles.header}>
          <Text size={200}><strong>Año:</strong> {latest.header.ano || '—'}</Text>
          <Text size={200}><strong>Centro:</strong> {latest.header.centroEducativo || '—'}</Text>
          <Text size={200}><strong>Regional:</strong> {latest.header.direccionRegional || '—'}</Text>
          <Text size={200}><strong>Distrito:</strong> {latest.header.distritoEducativo || '—'}</Text>
          <Text size={200}><strong>Tanda:</strong> {latest.header.tandaServicio || '—'}</Text>
          <Text size={200}><strong>Sector:</strong> {latest.header.sector || '—'}</Text>
          <Text size={200}><strong>Grado:</strong> {latest.header.grado || '—'}</Text>
          <Text size={200}><strong>Sección:</strong> {latest.header.seccion || '—'}</Text>
          <Text size={200}><strong>Cantidad:</strong> {latest.header.cantidadEstudiantes || '—'}</Text>
          <Text size={200}><strong>Docente:</strong> {latest.header.docentes || '—'}</Text>
          <Text size={200}><strong>Importado:</strong> {formatDate(latest.createdAt.slice(0, 10))}</Text>
        </div>
      )}

      <Input className={styles.search} contentBefore={<SearchRegular />} value={search} onChange={(_, d) => setSearch(d.value)} placeholder="Buscar estudiante (nombre, Id o correo)…" />

      {studentsCol.loading ? (
        <Text size={200}>Cargando…</Text>
      ) : students.length === 0 ? (
        <EmptyStateView title="Sin registros SIGERD" message="Carga un PDF del SIGERD para crear los registros de estudiantes." />
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
                <TableHeaderCell>Curso</TableHeaderCell>
                <TableHeaderCell>Cuenta M365</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => {
                const g: SigerdStudent = s.sigerd ?? { nombres: '', primerApellido: '', segundoApellido: '' }
                const curso = gradeById(s.gradeId)?.name ?? '—'
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
                    <TableCell>{curso}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell>
                      <Toolbar size="small">
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => void eliminar(s)}>Eliminar</ToolbarButton>
                      </Toolbar>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
