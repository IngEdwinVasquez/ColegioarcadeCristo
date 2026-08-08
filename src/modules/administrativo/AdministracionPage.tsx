import { useState } from 'react'
import { Button, Card, Input, Select, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Textarea, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { DocumentArrowRightRegular, PersonAddRegular, QuestionCircleRegular, SendRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField, FieldRow } from '../../components/shared/form'
import { useLocalList } from '../../hooks/useLocalList'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', marginTop: '16px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
})

const FAQ = [
  { q: '¿Cómo solicito una certificación de estudios?', a: 'Complete el formulario de solicitud de documentos en el módulo de servicios administrativos. La certificación estará lista en 5 días hábiles.' },
  { q: '¿Cuál es el proceso de admisión para nuevos estudiantes?', a: 'Complete el formulario de admisión; la oficina se pondrá en contacto para coordinar la entrevista y la evaluación.' },
  { q: '¿Cómo puedo obtener una carta de recomendación?', a: 'Realice la solicitud a través del módulo de documentos indicando el propósito de la carta.' },
]

export function AdministracionPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const [tab, setTab] = useState('admisiones')

  const admisiones = useLocalList<{ id: string; estudiante: string; grado: string; contacto: string; fecha: string }>('arca_admisiones')
  const documentos = useLocalList<{ id: string; tipo: string; estudiante: string; detalle: string; fecha: string }>('arca_documentos')

  const [nuevoEstudiante, setNuevoEstudiante] = useState('')
  const [nuevoGrado, setNuevoGrado] = useState('')
  const [nuevoContacto, setNuevoContacto] = useState('')
  const [docTipo, setDocTipo] = useState('Certificación de estudios')
  const [docEstudiante, setDocEstudiante] = useState('')
  const [docDetalle, setDocDetalle] = useState('')

  const registrarAdmision = () => {
    if (!nuevoEstudiante || !nuevoGrado) {
      window.alert('Complete el nombre y el grado del aspirante.')
      return
    }
    admisiones.add({ estudiante: nuevoEstudiante, grado: nuevoGrado, contacto: nuevoContacto, fecha: new Date().toISOString() })
    toaster.dispatchToast("Solicitud de admisión registrada", { intent: "success" })
    setNuevoEstudiante('')
    setNuevoGrado('')
    setNuevoContacto('')
  }

  const solicitarDocumento = () => {
    if (!docEstudiante) {
      window.alert('Indique el estudiante.')
      return
    }
    documentos.add({ tipo: docTipo, estudiante: docEstudiante, detalle: docDetalle, fecha: new Date().toISOString() })
    toaster.dispatchToast("Solicitud de documento enviada", { intent: "success" })
    setDocEstudiante('')
    setDocDetalle('')
  }

  return (
    <div>
      <PageHeader
        title="Gestión Administrativa y Servicios"
        subtitle="Oficina de servicios administrativos: atención a solicitudes de certificaciones, proceso de admisiones de nuevos estudiantes y gestión operativa del centro."
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '16px' }}>
        <Tab value="admisiones" icon={<PersonAddRegular />}>Admisiones</Tab>
        <Tab value="documentos" icon={<DocumentArrowRightRegular />}>Solicitud de documentos</Tab>
        <Tab value="consultas" icon={<QuestionCircleRegular />}>Consultas frecuentes</Tab>
      </TabList>

      {tab === 'admisiones' && (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Registrar aspirante</Text>
            <div className={styles.form}>
              <FormField label="Nombre del aspirante" required>
                <Input value={nuevoEstudiante} onChange={(_, d) => setNuevoEstudiante(d.value)} placeholder="Nombre y apellidos" />
              </FormField>
              <FieldRow>
                <FormField label="Grado a ingresar">
                  <Select value={nuevoGrado} onChange={(_, d) => setNuevoGrado(d.value)}>
                    <option value="">— Seleccionar —</option>
                    {['1ro', '2do', '3ro', '4to', '5to', '6to'].map((g) => (
                      <option key={g} value={`${g} A`}>{g} A</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Contacto">
                  <Input value={nuevoContacto} onChange={(_, d) => setNuevoContacto(d.value)} placeholder="Teléfono o correo" />
                </FormField>
              </FieldRow>
              <Button appearance="primary" icon={<PersonAddRegular />} onClick={registrarAdmision}>Registrar admisión</Button>
            </div>
          </Card>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Expediente de admisiones</Text>
            {admisiones.items.length === 0 && <Text size={300}>Sin solicitudes registradas.</Text>}
            {admisiones.items.length > 0 && (
              <Table aria-label="Admisiones">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Fecha</TableHeaderCell>
                    <TableHeaderCell>Aspirante</TableHeaderCell>
                    <TableHeaderCell>Grado</TableHeaderCell>
                    <TableHeaderCell>Contacto</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admisiones.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{formatDate(a.fecha)}</TableCell>
                      <TableCell>{a.estudiante}</TableCell>
                      <TableCell>{a.grado}</TableCell>
                      <TableCell>{a.contacto}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'documentos' && (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Solicitud de certificaciones y cartas</Text>
            <div className={styles.form}>
              <FieldRow>
                <FormField label="Tipo de documento">
                  <Select value={docTipo} onChange={(_, d) => setDocTipo(d.value)}>
                    <option value="Certificación de estudios">Certificación de estudios</option>
                    <option value="Constancia de asistencia">Constancia de asistencia</option>
                    <option value="Carta de recomendación">Carta de recomendación</option>
                    <option value="Historial académico">Historial académico</option>
                  </Select>
                </FormField>
                <FormField label="Estudiante" required>
                  <Input value={docEstudiante} onChange={(_, d) => setDocEstudiante(d.value)} placeholder="Nombre del estudiante" />
                </FormField>
              </FieldRow>
              <FormField label="Detalle / propósito">
                <Textarea value={docDetalle} onChange={(_, d) => setDocDetalle(d.value)} resize="vertical" placeholder="Ej. Para fines de inscripción en otra institución…" />
              </FormField>
              <Button appearance="primary" icon={<SendRegular />} onClick={solicitarDocumento}>Enviar solicitud</Button>
            </div>
          </Card>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Solicitudes enviadas</Text>
            {documentos.items.length === 0 && <Text size={300}>Sin solicitudes registradas.</Text>}
            {documentos.items.length > 0 && (
              <Table aria-label="Documentos">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Fecha</TableHeaderCell>
                    <TableHeaderCell>Documento</TableHeaderCell>
                    <TableHeaderCell>Estudiante</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{formatDate(d.fecha)}</TableCell>
                      <TableCell>{d.tipo}</TableCell>
                      <TableCell>{d.estudiante}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'consultas' && (
        <Card className={styles.card} style={{ maxWidth: '760px' }}>
          <Text weight="semibold" size={400}>Canal de consultas (FAQ institucional)</Text>
          {FAQ.map((f) => (
            <div key={f.q} style={{ padding: '12px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
              <Text weight="semibold" size={300} block>{f.q}</Text>
              <Text size={300} block>{f.a}</Text>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
