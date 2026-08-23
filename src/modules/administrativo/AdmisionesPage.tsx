import { useMemo, useState } from 'react'
import { Button, Input, Select, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, Badge, makeStyles } from '@fluentui/react-components'
import { AddRegular, CheckmarkCircleRegular, DismissCircleRegular, EditRegular, ArrowSyncRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { emailTemplate, escapeHtml, notify } from '../../services/notifications'
import { appConfig } from '../../config/appConfig'
import { formatDate, genId } from '../../utils/helpers'
import type { AdmissionEvaluation, AdmissionRequest, DocumentType, Student } from '../../types'
import { gradientes } from '../../theme'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, Tooltip as RTooltip,
} from 'recharts'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '14px', marginBottom: '20px' },
  tabs: { marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  chartCard: { background: 'var(--superficie)', borderRadius: '14px', border: '1px solid var(--borde)', padding: '16px', marginBottom: '16px' },
})

export function AdmisionesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const docTypesCol = useCollection<DocumentType>(dataService.getDocumentTypes, dataService.saveDocumentType, dataService.deleteDocumentType)
  const evalsCol = useCollection<AdmissionEvaluation>(dataService.getAdmissionEvals, dataService.saveAdmissionEval, dataService.deleteAdmissionEval)
  const admisiones = useCollection<AdmissionRequest>(dataService.getAdmissions, dataService.saveAdmission, dataService.deleteAdmission)

  const [tab, setTab] = useState('dashboard')
  const [formOpen, setFormOpen] = useState(false)
  const [estudiante, setEstudiante] = useState('')
  const [grado, setGrado] = useState('')
  const [contacto, setContacto] = useState('')
  const [editingDt, setEditingDt] = useState<DocumentType | null>(null)

  const stats = useMemo(() => {
    const list = admisiones.items
    return {
      total: list.length,
      pendientes: list.filter((a) => (a.estado ?? 'pendiente') === 'pendiente').length,
      aprobadas: list.filter((a) => a.estado === 'aprobada').length,
      rechazadas: list.filter((a) => a.estado === 'rechazada').length,
    }
  }, [admisiones.items])

  const chartData = useMemo(() => [
    { name: 'Pendientes', value: stats.pendientes, fill: '#EF6C00' },
    { name: 'Aprobadas', value: stats.aprobadas, fill: '#15803D' },
    { name: 'Rechazadas', value: stats.rechazadas, fill: '#C62828' },
  ], [stats])

  const register = async () => {
    if (!estudiante || !grado) { window.alert('Complete el nombre y el grado.'); return }
    try {
      await admisiones.save({ id: genId('adm'), estudiante, grado, contacto, fecha: new Date().toISOString(), estado: 'pendiente' })
      toaster.dispatchToast('Solicitud registrada', { intent: 'success' })
      setEstudiante(''); setGrado(''); setContacto(''); setFormOpen(false)
    } catch (error) {
      toaster.dispatchToast(`No se pudo registrar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    }
  }

  const notifyFamily = async (a: AdmissionRequest, resultado: 'aprobada' | 'rechazada') => {
    if (!a.contacto?.includes('@')) return
    try {
      await notify({
        category: 'admision',
        to: [{ email: a.contacto }],
        subject: `Resultado de la solicitud de admisión de ${a.estudiante}`,
        body: emailTemplate(
          'Proceso de admisión',
          resultado === 'aprobada'
            ? `<p>Nos complace informarle que la solicitud de admisión de <strong>${escapeHtml(a.estudiante)}</strong> para <strong>${escapeHtml(a.grado)}</strong> ha sido <strong>aprobada</strong>. El estudiante ha quedado matriculado en ${appConfig.institution}.</p>`
            : `<p>Le informamos que la solicitud de admisión de <strong>${escapeHtml(a.estudiante)}</strong> para <strong>${escapeHtml(a.grado)}</strong> no ha sido aprobada en esta ocasión. Puede comunicarse con la oficina de admisiones para más información.</p>`,
        ),
        metadata: { admissionId: a.id, resultado },
      })
    } catch (error) {
      toaster.dispatchToast(`No se pudo notificar a la familia: ${error instanceof Error ? error.message : 'error'}`, { intent: 'warning' })
    }
  }

  const approve = async (a: AdmissionRequest) => {
    const grade = grades.find((g) => g.name === a.grado)
    const student: Student = { id: genId('s'), fullName: a.estudiante, gradeId: grade?.id ?? grades[0]?.id ?? '', parentName: '', parentEmail: a.contacto?.includes('@') ? a.contacto : '' }
    await studentsCol.save(student)
    await admisiones.save({ ...a, estado: 'aprobada', observacion: `Matriculado en ${a.grado}` })
    toaster.dispatchToast('Admisión aprobada y estudiante matriculado', { intent: 'success' })
    void notifyFamily(a, 'aprobada')
  }

  const reject = async (a: AdmissionRequest) => {
    await admisiones.save({ ...a, estado: 'rechazada' })
    toaster.dispatchToast('Solicitud rechazada', { intent: 'warning' })
    void notifyFamily(a, 'rechazada')
  }

  const saveDt = async (dt: DocumentType) => {
    await docTypesCol.save(dt)
    toaster.dispatchToast('Tipo de documento guardado', { intent: 'success' })
    setEditingDt(null)
  }

  return (
    <div>
      <PageHeader
        title="Admisiones"
        subtitle="Dashboard de solicitudes de admisión, gestión de documentos requeridos y evaluaciones de aspirantes."
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={() => setFormOpen(true)}>Registrar aspirante</Button>}
      />

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="dashboard">Dashboard ({stats.total})</Tab>
        <Tab value="solicitudes">Solicitudes ({stats.pendientes})</Tab>
        <Tab value="documentos">Documentos ({docTypesCol.items.length})</Tab>
        <Tab value="evaluaciones">Evaluaciones ({evalsCol.items.length})</Tab>
      </TabList>

      {tab === 'dashboard' && (
        <div>
          <div className={styles.kpis}>
            <StatCard title="Total solicitudes" value={stats.total} icon={<EditRegular />} color="#103F7E" gradient={gradientes.azul} />
            <StatCard title="Pendientes" value={stats.pendientes} icon={<ArrowSyncRegular />} color="#EF6C00" gradient={gradientes.naranja} sub="Por revisar" />
            <StatCard title="Aprobadas" value={stats.aprobadas} icon={<CheckmarkCircleRegular />} color="#15803D" gradient={gradientes.verde} sub="Estudiantes matriculados" />
            <StatCard title="Rechazadas" value={stats.rechazadas} icon={<DismissCircleRegular />} color="#C62828" gradient={gradientes.rojo} />
          </div>
          {chartData.some((d) => d.value > 0) && (
            <div className={styles.chartCard}>
              <Text weight="semibold" size={400} block>Resultados de admisiones</Text>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <RTooltip />
                  <Bar dataKey="value" fill="#103F7E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {tab === 'solicitudes' && (
        <>
          <Table aria-label="Solicitudes">
            <TableHeader>
              <TableRow><TableHeaderCell>Fecha</TableHeaderCell><TableHeaderCell>Aspirante</TableHeaderCell><TableHeaderCell>Grado</TableHeaderCell><TableHeaderCell>Contacto</TableHeaderCell><TableHeaderCell>Estado</TableHeaderCell><TableHeaderCell>Acciones</TableHeaderCell></TableRow>
            </TableHeader>
            <TableBody>
              {admisiones.items.slice().sort((x, y) => (x.fecha < y.fecha ? 1 : -1)).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className={styles.cell}>{formatDate(a.fecha)}</TableCell>
                  <TableCell className={styles.cell}><Text weight="semibold">{a.estudiante}</Text>{a.observacion && <Text size={200} block style={{ color: 'var(--texto-suave)' }}>{a.observacion}</Text>}</TableCell>
                  <TableCell className={styles.cell}>{a.grado}</TableCell>
                  <TableCell className={styles.cell}>{a.contacto || '—'}</TableCell>
                  <TableCell className={styles.cell}><StatusBadge status={(a.estado ?? 'pendiente')} /></TableCell>
                  <TableCell className={styles.cell}>
                    {(a.estado ?? 'pendiente') === 'pendiente' ? (
                      <Toolbar size="small">
                        <ToolbarButton icon={<CheckmarkCircleRegular />} onClick={() => void approve(a)}>Aprobar</ToolbarButton>
                        <ToolbarButton icon={<DismissCircleRegular />} onClick={() => void reject(a)}>Rechazar</ToolbarButton>
                      </Toolbar>
                    ) : (<Text size={200} style={{ color: 'var(--texto-suave)' }}>—</Text>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {tab === 'documentos' && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditingDt({ id: genId('dt'), name: '', description: '', required: true, order: (docTypesCol.items.length + 1) })}>
              Nuevo tipo de documento
            </Button>
          </div>
          <Table aria-label="Tipos de documento">
            <TableHeader>
              <TableRow><TableHeaderCell>Documento</TableHeaderCell><TableHeaderCell>Descripción</TableHeaderCell><TableHeaderCell>Requerido</TableHeaderCell><TableHeaderCell>Orden</TableHeaderCell><TableHeaderCell>Acciones</TableHeaderCell></TableRow>
            </TableHeader>
            <TableBody>
              {docTypesCol.items.slice().sort((a,b)=>a.order-b.order).map((dt) => (
                <TableRow key={dt.id}>
                  <TableCell><Text weight="semibold">{dt.name}</Text></TableCell>
                  <TableCell>{dt.description}</TableCell>
                  <TableCell><Badge appearance="filled" color={dt.required ? 'danger' : 'subtle'}>{dt.required ? 'Sí' : 'Opcional'}</Badge></TableCell>
                  <TableCell>{dt.order}</TableCell>
                  <TableCell>
                    <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => setEditingDt(dt)}>Editar</Button>
                    <Button size="small" appearance="subtle" onClick={() => { if (window.confirm('¿Eliminar?')) void docTypesCol.remove(dt.id) }}>Eliminar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ModalForm open={!!editingDt} onOpenChange={(o) => { if (!o) setEditingDt(null) }} title={editingDt?.id && docTypesCol.items.some(d=>d.id===editingDt.id) ? 'Editar documento' : 'Nuevo tipo de documento'}
            actions={<><Button appearance="secondary" onClick={() => setEditingDt(null)}>Cancelar</Button><Button appearance="primary" onClick={() => editingDt && saveDt(editingDt)}>Guardar</Button></>}
          >
            {editingDt && (
              <div>
                <FieldRow><FormField label="Nombre" required><Input value={editingDt.name} onChange={(_,d)=>setEditingDt({...editingDt,name:d.value})} /></FormField>
                  <FormField label="Requerido"><Select value={editingDt.required ? 'si' : 'no'} onChange={(_,d)=>setEditingDt({...editingDt,required:d.value==='si'})}><option value="si">Sí</option><option value="no">Opcional</option></Select></FormField></FieldRow>
                <FormField label="Descripción"><Input value={editingDt.description} onChange={(_,d)=>setEditingDt({...editingDt,description:d.value})} /></FormField>
                <FormField label="Orden"><Input type="number" value={String(editingDt.order)} onChange={(_,d)=>setEditingDt({...editingDt,order:Number(d.value)})} /></FormField>
              </div>
            )}
          </ModalForm>
        </div>
      )}

      {tab === 'evaluaciones' && (
        <Table aria-label="Evaluaciones">
          <TableHeader><TableRow><TableHeaderCell>Fecha</TableHeaderCell><TableHeaderCell>Solicitud</TableHeaderCell><TableHeaderCell>Evaluador</TableHeaderCell><TableHeaderCell>Puntuación</TableHeaderCell><TableHeaderCell>Resultado</TableHeaderCell><TableHeaderCell>Acciones</TableHeaderCell></TableRow></TableHeader>
          <TableBody>
            {evalsCol.items.map((ev) => {
              const adm = admisiones.items.find((a) => a.id === ev.admissionId)
              return (
                <TableRow key={ev.id}>
                  <TableCell>{formatDate(ev.fecha)}</TableCell>
                  <TableCell>{adm?.estudiante ?? ev.admissionId}</TableCell>
                  <TableCell>
                    <Input size="small" value={ev.evaluador} onChange={(_, d) => evalsCol.save({ ...ev, evaluador: d.value })} placeholder="Nombre del evaluador" style={{ minWidth: '160px' }} />
                  </TableCell>
                  <TableCell>
                    <Input size="small" type="number" value={String(ev.puntuacion)} onChange={(_, d) => evalsCol.save({ ...ev, puntuacion: Number(d.value) })} style={{ minWidth: '80px' }} />
                  </TableCell>
                  <TableCell>
                    <Select size="small" value={ev.resultado} onChange={(_, d) => evalsCol.save({ ...ev, resultado: d.value as AdmissionEvaluation['resultado'] })}>
                      <option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="small" icon={<CheckmarkCircleRegular />} onClick={() => void approve(adm!)} disabled={!adm || (adm.estado ?? 'pendiente') !== 'pendiente'}>Aprobar</Button>
                    <Button size="small" icon={<DismissCircleRegular />} onClick={() => adm && void reject(adm)} disabled={!adm || (adm.estado ?? 'pendiente') !== 'pendiente'}>Rechazar</Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <ModalForm open={formOpen} onOpenChange={setFormOpen} title="Registrar aspirante" subtitle="Admisión · nuevo estudiante"
        actions={<><Button appearance="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button><Button appearance="primary" onClick={() => void register()}>Registrar</Button></>}
      >
        <FormField label="Nombre del aspirante" required>
          <Input value={estudiante} onChange={(_, d) => setEstudiante(d.value)} placeholder="Nombre y apellidos" />
        </FormField>
        <FieldRow>
          <FormField label="Grado a ingresar" required>
            <Select value={grado} onChange={(_, d) => setGrado(d.value)}>
              <option value="">— Seleccionar —</option>
              {grades.map((g) => (<option key={g.id} value={g.name}>{g.name}</option>))}
            </Select>
          </FormField>
          <FormField label="Contacto">
            <Input value={contacto} onChange={(_, d) => setContacto(d.value)} placeholder="Teléfono o correo" />
          </FormField>
        </FieldRow>
      </ModalForm>
    </div>
  )
}
