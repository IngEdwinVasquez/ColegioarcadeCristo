import { useMemo, useState } from 'react'
import { Button, Card, Select, Text, Textarea, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { AddRegular, PeopleCheckmarkRegular, SendRegular, ShieldPersonRegular, ClipboardTaskRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { AttendanceRecord, PsychRequest } from '../../types'
import { formatDate, genId, pct } from '../../utils/helpers'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
})

const TALLERES = [
  { id: 't1', titulo: 'Inteligencia emocional para el aula', fecha: 'Próximamente', responsable: 'Unidad Psicopedagógica' },
  { id: 't2', titulo: 'Guía de crianza para familias', fecha: 'Próximamente', responsable: 'Unidad Psicopedagógica' },
  { id: 't3', titulo: 'Convivencia escolar y resolución de conflictos', fecha: 'Próximamente', responsable: 'Orientación Escolar' },
]

export function PsicologiaPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, gradeById, studentById, user } = useApp()
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const solicitudes = useCollection<PsychRequest>(dataService.getPsychRequests, dataService.savePsychRequest, dataService.deletePsychRequest)

  const [tipo, setTipo] = useState('Orientación académica')
  const [estudiante, setEstudiante] = useState('')
  const [detalle, setDetalle] = useState('')

  const casosSeguimiento = useMemo(() => {
    const byStudent = new Map<string, { present: number; total: number }>()
    for (const rec of attendanceCol.items) {
      for (const e of rec.entries) {
        const entry = byStudent.get(e.studentId) ?? { present: 0, total: 0 }
        entry.total++
        if (e.status === 'presente') entry.present++
        byStudent.set(e.studentId, entry)
      }
    }
    return [...byStudent.entries()]
      .map(([studentId, v]) => ({ studentId, porcentaje: pct(v.present, v.total) }))
      .filter((c) => c.porcentaje < 80)
      .sort((a, b) => a.porcentaje - b.porcentaje)
  }, [attendanceCol.items])

  const enviar = async () => {
    if (!estudiante || !detalle) {
      window.alert('Complete el estudiante y el detalle de la solicitud.')
      return
    }
    try {
      await solicitudes.save({ id: genId('psy'), tipo, studentId: estudiante, detalle, fecha: new Date().toISOString(), solicitante: user?.displayName, estado: 'pendiente' })
      toaster.dispatchToast('Solicitud enviada a la Unidad Psicopedagógica', { intent: 'success' })
      setEstudiante('')
      setDetalle('')
    } catch (error) {
      toaster.dispatchToast(`No se pudo enviar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    }
  }

  const avanzar = async (r: PsychRequest) => {
    const siguiente: PsychRequest['estado'] = r.estado === 'pendiente' ? 'en_atencion' : 'cerrado'
    await solicitudes.save({ ...r, estado: siguiente })
  }

  const pendientes = solicitudes.items.filter((r) => r.estado !== 'cerrado')

  return (
    <div>
      <PageHeader
        title="Psicología y Orientación Escolar"
        subtitle="Unidad de acompañamiento integral al estudiante: apoyo psicopedagógico, seguimiento de convivencia escolar y orientación a las familias."
      />

      <div className={styles.kpis}>
        <StatCard title="Casos de seguimiento" value={casosSeguimiento.length} icon={<PeopleCheckmarkRegular />} color="#AD1457" sub="Estudiantes con asistencia < 80%" />
        <StatCard title="Solicitudes de atención" value={pendientes.length} icon={<ShieldPersonRegular />} color="#6A1B9A" sub="Ventanilla virtual" />
        <StatCard title="Talleres programados" value={TALLERES.length} icon={<ClipboardTaskRegular />} color="#4527A0" sub="Programa de talleres y guías de crianza" />
      </div>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <Text weight="semibold" size={400}>🧑‍⚕️ Ventanilla Virtual de Atención</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            Solicite orientación psicopedagógica para un estudiante o una consulta para la familia.
          </Text>
          <div className={styles.form}>
            <FieldRow>
              <FormField label="Tipo de solicitud">
                <Select value={tipo} onChange={(_, d) => setTipo(d.value)}>
                  <option value="Orientación académica">Orientación académica</option>
                  <option value="Acompañamiento emocional">Acompañamiento emocional</option>
                  <option value="Convivencia escolar">Convivencia escolar</option>
                  <option value="Orientación familiar">Orientación familiar</option>
                </Select>
              </FormField>
              <FormField label="Estudiante" required>
                <Select value={estudiante} onChange={(_, d) => setEstudiante(d.value)}>
                  <option value="">— Seleccionar —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} · {gradeById(s.gradeId)?.name}</option>
                  ))}
                </Select>
              </FormField>
            </FieldRow>
            <FormField label="Detalle de la solicitud" required>
              <Textarea value={detalle} onChange={(_, d) => setDetalle(d.value)} resize="vertical" placeholder="Describa brevemente el motivo de la solicitud…" />
            </FormField>
            <Button appearance="primary" icon={<SendRegular />} onClick={() => void enviar()}>Enviar solicitud</Button>
          </div>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400}>📋 Expediente y casos de seguimiento</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            Generados automáticamente desde el control de asistencia (umbral 80%).
          </Text>
          {casosSeguimiento.length === 0 && <Text size={300}>No hay casos por debajo del umbral. 🎉</Text>}
          {casosSeguimiento.length > 0 && (
            <Table aria-label="Casos de seguimiento">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Grado</TableHeaderCell>
                  <TableHeaderCell>% asistencia</TableHeaderCell>
                  <TableHeaderCell>Prioridad</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {casosSeguimiento.slice(0, 12).map((c) => (
                  <TableRow key={c.studentId}>
                    <TableCell>{studentById(c.studentId)?.fullName ?? c.studentId}</TableCell>
                    <TableCell>{gradeById(studentById(c.studentId)?.gradeId ?? '')?.name ?? '—'}</TableCell>
                    <TableCell>{c.porcentaje}%</TableCell>
                    <TableCell>
                      <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: c.porcentaje < 60 ? '#C8102E' : '#EF6C00', color: '#fff' }}>
                        {c.porcentaje < 60 ? 'Alta' : 'Media'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400}>🗂️ Solicitudes de atención</Text>
          {solicitudes.items.length === 0 && <Text size={300}>Sin solicitudes registradas.</Text>}
          {solicitudes.items.length > 0 && (
            <Table aria-label="Solicitudes de atención">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Detalle</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.items.slice().sort((x, y) => (x.fecha < y.fecha ? 1 : -1)).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.fecha)}</TableCell>
                    <TableCell>{r.tipo}</TableCell>
                    <TableCell>{studentById(r.studentId)?.fullName ?? r.studentId}</TableCell>
                    <TableCell>{r.detalle}</TableCell>
                    <TableCell>
                      {r.estado === 'cerrado' ? (
                        'Cerrado'
                      ) : (
                        <Button size="small" appearance="subtle" onClick={() => void avanzar(r)}>
                          {r.estado === 'en_atencion' ? 'Cerrar caso' : 'Iniciar atención'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400}>📚 Programa de talleres y guías de crianza</Text>
          <Table aria-label="Talleres">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Taller</TableHeaderCell>
                <TableHeaderCell>Fechas</TableHeaderCell>
                <TableHeaderCell>Responsable</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TALLERES.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.titulo}</TableCell>
                  <TableCell>{t.fecha}</TableCell>
                  <TableCell>{t.responsable}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button appearance="outline" icon={<AddRegular />}>Programar nuevo taller</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
