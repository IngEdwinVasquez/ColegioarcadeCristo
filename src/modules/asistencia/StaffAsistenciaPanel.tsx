import { useEffect, useMemo, useState } from 'react'
import { Card, Select, Spinner, Tab, TabList, Text, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { backfillStaffAbsent, diasHabiles } from '../../services/staffAttendance'
import { todayIso } from '../../utils/helpers'
import type { Persona, StaffAttendanceRecord } from '../../types'

const useStyles = makeStyles({
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' },
  card: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px', marginBottom: '16px' },
  value: { fontSize: '26px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
  tabs: { marginBottom: '14px' },
})

const COLORS = { presente: '#15803D', ausente_evidencia: '#EA580C', ausente: '#C8102E' }
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Persona del personal (docente o rol) para el panel de asistencia. */
interface StaffRef { id: string; name: string; kind: 'docente' | 'persona'; tipo: string }

/** Función desempeñada (misma organización que en «Personas»), excluyendo estudiantes/familias. */
const FUNCIONES: Array<{ id: string; label: string; test: (s: StaffRef) => boolean }> = [
  { id: 'docentes', label: 'Docentes', test: (s) => s.kind === 'docente' },
  { id: 'personal', label: 'Personal', test: (s) => s.kind === 'persona' },
  { id: 'coordinacion', label: 'Coordinación Pedagógica', test: (s) => s.tipo === 'coordinador' },
  { id: 'tecnologia', label: 'Tecnología', test: (s) => s.tipo === 'tic' },
  { id: 'psicologia', label: 'Psicología y Prometacom', test: (s) => s.tipo === 'psicologia' || s.tipo === 'prometacom' },
  { id: 'pasantes', label: 'Pasantes', test: (s) => s.tipo === 'pasante' },
  { id: 'apoyo', label: 'Personal de apoyo', test: (s) => s.tipo === 'apoyo' },
  { id: 'directores', label: 'Directores', test: (s) => s.tipo === 'director' },
  { id: 'administradores', label: 'Administradores', test: (s) => s.tipo === 'administrador' },
]

function rango(periodo: string, hoy: string): { desde: string; hasta: string } {
  const d = new Date(`${hoy}T12:00:00`)
  if (periodo === 'dia') return { desde: hoy, hasta: hoy }
  if (periodo === 'semana') { const x = new Date(d); x.setDate(d.getDate() - 6); return { desde: x.toISOString().slice(0, 10), hasta: hoy } }
  if (periodo === 'anio') return { desde: `${d.getFullYear()}-01-01`, hasta: hoy }
  return { desde: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, hasta: hoy }
}

/** Panel de asistencia del personal (Dirección): una pestaña por función, con los mismos gráficos. */
export function StaffAsistenciaPanel() {
  const styles = useStyles()
  const { teachers } = useApp()
  const personasCol = useCollection<Persona>(dataService.getPersonas)
  const attCol = useCollection<StaffAttendanceRecord>(dataService.getStaffAttendance, dataService.saveStaffAttendance)
  const [funcion, setFuncion] = useState('docentes')
  const [periodo, setPeriodo] = useState('mes')
  const [persona, setPersona] = useState('')
  const [listo, setListo] = useState(false)

  const staff = useMemo<StaffRef[]>(() => [
    ...teachers.map((t) => ({ id: t.id, name: t.fullName, kind: 'docente' as const, tipo: 'docente' })),
    ...personasCol.items.map((p) => ({ id: p.id, name: p.fullName, kind: 'persona' as const, tipo: p.tipo })),
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

  const grupoActual = FUNCIONES.find((f) => f.id === funcion) ?? FUNCIONES[0]
  const staffFuncion = useMemo(() => staff.filter(grupoActual.test), [staff, grupoActual])

  const { desde, hasta } = rango(periodo, todayIso())

  // Personal en alcance según el filtro de persona.
  const staffFiltrado = useMemo(
    () => staffFuncion.filter((p) => !persona || p.id === persona),
    [staffFuncion, persona],
  )

  // Recorre cada día laboral del período por persona. Si no hay reporte, cuenta como AUSENTE,
  // de modo que los gráficos reflejen a TODA la función (no solo a quien reportó).
  const { conteo, porFecha } = useMemo(() => {
    const hoy = todayIso()
    const dias = diasHabiles(desde, hasta).filter((d) => d <= hoy)
    const recMap = new Map(attCol.items.map((r) => [`${r.personId}|${r.date}`, r]))
    const c = { presente: 0, ausente_evidencia: 0, ausente: 0 }
    const map = new Map<string, { key: string; presente: number; ausente_evidencia: number; ausente: number }>()
    for (const p of staffFiltrado) {
      for (const d of dias) {
        const st = recMap.get(`${p.id}|${d}`)?.status ?? 'ausente'
        const k = st === 'presente' ? 'presente' : st === 'ausente_evidencia' ? 'ausente_evidencia' : 'ausente'
        c[k]++
        let key: string
        if (periodo === 'anio') key = d.slice(0, 4)
        else if (periodo === 'mes') key = MESES[Number(d.slice(5, 7)) - 1]
        else key = d.slice(5)
        const e = map.get(key) ?? { key, presente: 0, ausente_evidencia: 0, ausente: 0 }
        e[k]++
        map.set(key, e)
      }
    }
    return { conteo: c, porFecha: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)) }
  }, [staffFiltrado, attCol.items, desde, hasta, periodo])

  const pieData = [
    { name: 'Presentes', value: conteo.presente, fill: COLORS.presente },
    { name: 'Ausentes con evidencia', value: conteo.ausente_evidencia, fill: COLORS.ausente_evidencia },
    { name: 'Ausentes', value: conteo.ausente, fill: COLORS.ausente },
  ].filter((d) => d.value > 0)

  return (
    <Card className={styles.card}>
      <Text weight="semibold" size={400}>Asistencia del personal por función</Text>
      <Text size={200} style={{ color: 'var(--texto-suave)' }}>Presentes, ausentes con evidencia y ausentes. Quien no reporte en el día se cuenta como ausente.</Text>

      <TabList className={styles.tabs} selectedValue={funcion} onTabSelect={(_, d) => { setFuncion(String(d.value)); setPersona('') }}>
        {FUNCIONES.map((f) => (
          <Tab key={f.id} value={f.id}>{f.label} ({staff.filter(f.test).length})</Tab>
        ))}
      </TabList>

      <div className={styles.filters}>
        <Select value={periodo} onChange={(_, d) => setPeriodo(d.value)} style={{ minWidth: '150px' }}>
          <option value="dia">Día</option>
          <option value="semana">Semana</option>
          <option value="mes">Mes</option>
          <option value="anio">Año</option>
        </Select>
        <Select value={persona} onChange={(_, d) => setPersona(d.value)} style={{ minWidth: '240px' }}>
          <option value="">Todos ({grupoActual.label})</option>
          {staffFuncion.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      {attCol.loading || personasCol.loading ? (
        <Spinner label="Cargando asistencia del personal…" />
      ) : staffFuncion.length === 0 ? (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>No hay personas registradas en «{grupoActual.label}».</Text>
      ) : (
        <>
          <div className={styles.kpis}>
            <div><span className={styles.value}>{conteo.presente}</span><span className={styles.label} style={{ display: 'block' }}>Presentes</span></div>
            <div><span className={styles.value}>{conteo.ausente_evidencia}</span><span className={styles.label} style={{ display: 'block' }}>Ausentes con evidencia</span></div>
            <div><span className={styles.value}>{conteo.ausente}</span><span className={styles.label} style={{ display: 'block' }}>Ausentes</span></div>
          </div>
          <div className={styles.charts}>
            <div>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Relación · {grupoActual.label}</Text>
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
