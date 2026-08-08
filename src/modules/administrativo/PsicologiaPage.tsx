import { useMemo, useState } from 'react'
import { Button, Card, Select, Text, Textarea, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { AddRegular, PeopleCheckmarkRegular, SendRegular, ShieldPersonRegular, ClipboardTaskRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { useLocalList } from '../../hooks/useLocalList'
import type { AttendanceRecord } from '../../types'
import { pct } from '../../utils/helpers'

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
  const { students, gradeById, studentById } = useApp()
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const solicitudes = useLocalList<{ id: string; tipo: string; estudiante: string; detalle: string; fecha: string }>('arca_psicologia_solicitudes')

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

  const enviar = () => {
    if (!estudiante || !detalle) {
      window.alert('Complete el estudiante y el detalle de la solicitud.')
      return
    }
    solicitudes.add({ tipo, estudiante, detalle, fecha: new Date().toISOString() })
    toaster.dispatchToast("Solicitud enviada a la Unidad Psicopedagógica", { intent: "success" })
    setEstudiante('')
    setDetalle('')
  }

  return (
    <div>
      <PageHeader
        title="Psicología y Orientación Escolar"
        subtitle="Unidad de acompañamiento integral al estudiante: apoyo psicopedagógico, seguimiento de convivencia escolar y orientación a las familias."
      />

      <div className={styles.kpis}>
        <StatCard title="Casos de seguimiento" value={casosSeguimiento.length} icon={<PeopleCheckmarkRegular />} color="#AD1457" sub="Estudiantes con asistencia < 80%" />
        <StatCard title="Solicitudes de atención" value={solicitudes.items.length} icon={<ShieldPersonRegular />} color="#6A1B9A" sub="Ventanilla virtual" />
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
            <Button appearance="primary" icon={<SendRegular />} onClick={enviar}>Enviar solicitud</Button>
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
                      <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: c.porcentaje < 60 ? '#C62828' : '#EF6C00', color: '#fff' }}>
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
