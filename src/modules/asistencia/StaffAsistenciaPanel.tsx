import { useEffect, useMemo, useState } from 'react'
import { Card, Select, Spinner, Text, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { backfillStaffAbsent, type PersonalRef } from '../../services/staffAttendance'
import { todayIso } from '../../utils/helpers'
import type { Persona, StaffAttendanceRecord } from '../../types'

const useStyles = makeStyles({
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' },
  card: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px', marginBottom: '16px' },
  value: { fontSize: '26px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
})

const COLORS = { presente: '#15803D', ausente_evidencia: '#EA580C', ausente: '#C8102E' }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function rango(periodo: string, hoy: string): { desde: string; hasta: string } {
  const d = new Date(`${hoy}T12:00:00`)
  if (periodo === 'dia') return { desde: hoy, hasta: hoy }
  if (periodo === 'semana') { const x = new Date(d); x.setDate(d.getDate() - 6); return { desde: x.toISOString().slice(0, 10), hasta: hoy } }
  if (periodo === 'anio') return { desde: `${d.getFullYear()}-01-01`, hasta: hoy }
  return { desde: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, hasta: hoy }
}

/** Panel de asistencia del personal docente/institucional (Dirección). */
export function StaffAsistenciaPanel() {
  const styles = useStyles()
  const { teachers } = useApp()
  const personasCol = useCollection<Persona>(dataService.getPersonas)
  const attCol = useCollection<StaffAttendanceRecord>(dataService.getStaffAttendance, dataService.saveStaffAttendance)
  const [periodo, setPeriodo] = useState('mes')
  const [docente, setDocente] = useState('')
  const [listo, setListo] = useState(false)

  const staff = useMemo<PersonalRef[]>(() => [
    ...teachers.map((t) => ({ id: t.id, name: t.fullName, kind: 'docente' as const })),
    ...personasCol.items.map((p) => ({ id: p.id, name: p.fullName, kind: 'persona' as const })),
  ], [teachers, personasCol.items])

  // Marca ausentes automáticos del mes en curso (días laborales transcurridos).
  useEffect(() => {
    if (personasCol.loading || attCol.loading || listo || staff.length === 0) return
    const hoy = todayIso()
    void backfillStaffAbsent(staff, `${hoy.slice(0, 4)}-${hoy.slice(5, 7)}-01`).then(() => {
      void attCol.refresh()
      setListo(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personasCol.loading, attCol.loading, staff.length, listo])

  const { desde, hasta } = rango(periodo, todayIso())
  const filtrados = useMemo(
    () => attCol.items
      .filter((r) => r.date >= desde && r.date <= hasta)
      .filter((r) => !docente || r.personId === docente),
    [attCol.items, desde, hasta, docente],
  )

  const conteo = useMemo(() => {
    const c = { presente: 0, ausente_evidencia: 0, ausente: 0 }
    for (const r of filtrados) {
      const k = r.status === 'presente' ? 'presente' : r.status === 'ausente_evidencia' ? 'ausente_evidencia' : 'ausente'
      c[k]++
    }
    return c
  }, [filtrados])

  const pieData = [
    { name: 'Presentes', value: conteo.presente, fill: COLORS.presente },
    { name: 'Ausentes con evidencia', value: conteo.ausente_evidencia, fill: COLORS.ausente_evidencia },
    { name: 'Ausentes', value: conteo.ausente, fill: COLORS.ausente },
  ].filter((d) => d.value > 0)

  const porFecha = useMemo(() => {
    const map = new Map<string, { key: string; presente: number; ausente_evidencia: number; ausente: number }>()
    for (const r of filtrados) {
      let key: string
      if (periodo === 'anio') key = `${r.date.slice(0, 4)}`
      else if (periodo === 'mes') key = `${MESES[Number(r.date.slice(5, 7)) - 1]}`
      else key = r.date.slice(5)
      const e = map.get(key) ?? { key, presente: 0, ausente_evidencia: 0, ausente: 0 }
      if (r.status === 'presente') e.presente++
      else if (r.status === 'ausente_evidencia') e.ausente_evidencia++
      else e.ausente++
      map.set(key, e)
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [filtrados, periodo])

  return (
    <Card className={styles.card}>
      <Text weight="semibold" size={400}>Asistencia del personal docente</Text>
      <Text size={200} style={{ color: 'var(--texto-suave)' }}>Presentes, ausentes con evidencia y ausentes. Se marca ausente automáticamente a quien no reporte en el día.</Text>
      <div className={styles.filters}>
        <Select value={periodo} onChange={(_, d) => setPeriodo(d.value)} style={{ minWidth: '150px' }}>
          <option value="dia">Día</option>
          <option value="semana">Semana</option>
          <option value="mes">Mes</option>
          <option value="anio">Año</option>
        </Select>
        <Select value={docente} onChange={(_, d) => setDocente(d.value)} style={{ minWidth: '240px' }}>
          <option value="">Todos los docentes</option>
          {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      {attCol.loading || personasCol.loading ? (
        <Spinner label="Cargando asistencia del personal…" />
      ) : (
        <>
          <div className={styles.kpis}>
            <div><span className={styles.value}>{conteo.presente}</span><span className={styles.label} style={{ display: 'block' }}>Presentes</span></div>
            <div><span className={styles.value}>{conteo.ausente_evidencia}</span><span className={styles.label} style={{ display: 'block' }}>Ausentes con evidencia</span></div>
            <div><span className={styles.value}>{conteo.ausente}</span><span className={styles.label} style={{ display: 'block' }}>Ausentes</span></div>
          </div>
          <div className={styles.charts}>
            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Relación</Text>
              {pieData.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin datos en el período.</Text> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Legend /><RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Evolución ({periodo})</Text>
              {porFecha.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin datos en el período.</Text> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={porFecha}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="presente" stackId="a" fill={COLORS.presente} name="Presentes" />
                    <Bar dataKey="ausente_evidencia" stackId="a" fill={COLORS.ausente_evidencia} name="Con evidencia" />
                    <Bar dataKey="ausente" stackId="a" fill={COLORS.ausente} name="Ausentes" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
