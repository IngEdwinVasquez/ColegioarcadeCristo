import { useMemo, useState } from 'react'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
import { AddRegular, CalendarLtrRegular, OpenRegular, DeleteRegular, WandRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FormActions } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { secuenciasDeAsignatura, anioEscolar } from './curriculum'
import { PlanDiarioForm } from './PlanDiarioForm'
import type { DailyPlan } from '../../types'
import { formatDate, genId } from '../../utils/helpers'

const useStyles = makeStyles({
  controls: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  monthChip: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #00607F 0%, #0082AD 100%)', color: '#fff', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' },
  weekHead: { background: 'rgba(0,130,173,0.08)' },
  weekCell: { minWidth: '140px' },
  unit: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer', wordBreak: 'break-word', transition: 'transform 0.15s ease', ':hover': { transform: 'translateY(-1px)' }, marginBottom: '6px' },
  unitDelete: { marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', ':hover': { color: '#fff' } },
  addBtn: { alignSelf: 'flex-start' },
  catalog: { marginTop: '18px', padding: '16px', borderRadius: '12px', border: '1px solid var(--borde)', background: 'var(--superficie)' },
  catalogTitle: { fontWeight: 700, marginBottom: '10px' },
  chipWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tag: { padding: '6px 12px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', ':hover': { background: 'rgba(0,130,173,0.18)' } },
  kv: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px 14px', fontSize: '13.5px', lineHeight: 1.5 },
  kvLabel: { color: 'var(--texto-suave)', fontWeight: 600 },
})

interface Week { label: string; startDay: number; endDay: number }

export function PlanificadorSemanal() {
  const styles = useStyles()
  const { user, subjects, grades, subjectById, gradeById } = useApp()
  const col = useCollection<DailyPlan>(dataService.getDailyPlans, dataService.saveDailyPlan, dataService.deleteDailyPlan)

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '')
  const [section, setSection] = useState('')
  const [month, setMonth] = useState(defaultMonth)
  const [weekModal, setWeekModal] = useState<number | null>(null)
  const [newSeqCustom, setNewSeqCustom] = useState('')
  const [viewing, setViewing] = useState<DailyPlan | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const subjectName = subjectById(subjectId)?.name ?? ''
  const topics = secuenciasDeAsignatura(subjectName)

  const weeks = useMemo<Week[]>(() => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const arr: Week[] = []
    for (let start = 1; start <= days; start += 7) arr.push({ label: `Semana ${arr.length + 1}`, startDay: start, endDay: Math.min(start + 6, days) })
    return arr
  }, [month])

  const unitsOfMonth = useMemo(() => {
    return col.items.filter((p) => p.tipo === 'unidad' && (subjectId ? p.subjectId === subjectId : true) && (gradeId ? p.gradeId === gradeId : true) && p.fecha.startsWith(month))
  }, [col.items, subjectId, gradeId, month])

  const unitsInWeek = (week: Week) => {
    return unitsOfMonth.filter((p) => {
      const d = Number(p.fecha.slice(8, 10))
      return d >= week.startDay && d <= week.endDay && p.fecha === `${month}-${String(d).padStart(2, '0')}`
    }).sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  }

  const dateForWeek = (week: Week) => `${month}-${String(week.startDay).padStart(2, '0')}`

  const createUnit = async (topic: string, week: Week) => {
    const plan: DailyPlan = {
      id: genId('pdia'),
      teacherId: user?.teacherId ?? '',
      subjectId,
      gradeId,
      section,
      nivel: gradeById(gradeId)?.level ?? 'Primaria',
      tipo: 'unidad',
      unidad: topic,
      tema: topic,
      fecha: dateForWeek(week),
      duracion: '45 minutos',
      competenciasFundamentales: [],
      competenciasEspecificas: [],
      ejesTransversales: [],
      contenidos: { conceptuales: '', procedimentales: '', actitudinales: '' },
      actividades: { inicio: '', desarrollo: '', cierre: '' },
      estrategias: [],
      recursos: [],
      indicadoresLogro: [],
      evaluacion: { tipo: 'formativa', instrumento: '', criterios: '' },
      generadoPorIA: false,
      createdAt: new Date().toISOString(),
    }
    await col.save(plan)
    setViewing(plan)
    setWeekModal(null)
  }

  const fillDefault = async () => {
    for (let i = 0; i < weeks.length && i < topics.length; i++) {
      const topic = topics[i]
      const exists = unitsInWeek(weeks[i]).some((u) => u.tema === topic)
      if (exists) continue
      await createUnitSilent(topic, weeks[i])
    }
  }

  const createUnitSilent = async (topic: string, week: Week) => {
    const plan: DailyPlan = {
      id: genId('pdia'), teacherId: user?.teacherId ?? '', subjectId, gradeId, section, nivel: gradeById(gradeId)?.level ?? 'Primaria',
      tipo: 'unidad', unidad: topic, tema: topic, fecha: dateForWeek(week), duracion: '45 minutos',
      competenciasFundamentales: [], competenciasEspecificas: [], ejesTransversales: [],
      contenidos: { conceptuales: '', procedimentales: '', actitudinales: '' }, actividades: { inicio: '', desarrollo: '', cierre: '' },
      estrategias: [], recursos: [], indicadoresLogro: [], evaluacion: { tipo: 'formativa', instrumento: '', criterios: '' },
      generadoPorIA: false, createdAt: new Date().toISOString(),
    }
    await col.save(plan)
  }

  const addFromCatalog = (topic: string) => {
    if (weekModal == null) return
    void createUnit(topic, weeks[weekModal])
  }

  const addCustom = () => {
    if (weekModal == null || !newSeqCustom.trim()) return
    void createUnit(newSeqCustom.trim(), weeks[weekModal])
    setNewSeqCustom('')
  }

  return (
    <div>
      <PageHeader
        title="Planificador semanal"
        subtitle={`Organice las secuencias (unidades) de cada asignatura por semana, como en el Eduplan. Cada secuencia se despliega en el plan completo del MINERD. · ${anioEscolar()}`}
        actions={<Button appearance="secondary" icon={<WandRegular />} onClick={() => void fillDefault()}>Rellenar por defecto</Button>}
      />

      <div className={styles.controls}>
        <Select value={subjectId} onChange={(_, d) => setSubjectId(d.value)} style={{ minWidth: '200px' }}>
          {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        <Select value={gradeId} onChange={(_, d) => setGradeId(d.value)} style={{ minWidth: '150px' }}>
          {grades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
        </Select>
        <Select value={section} onChange={(_, d) => setSection(d.value)} style={{ minWidth: '100px' }}>
          <option value="">Todas</option>
          {['A', 'B', 'C', 'D'].map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
        <Input type="month" value={month} onChange={(_, d) => setMonth(d.value)} style={{ minWidth: '170px' }} />
      </div>

      <div className={styles.monthChip}><CalendarLtrRegular /> {new Date(`${month}-01T00:00:00`).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}</div>

      <Table aria-label="Planificador semanal">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            {weeks.map((w) => (<TableHeaderCell key={w.label} className={styles.weekHead}>{w.label}</TableHeaderCell>))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Text weight="semibold" block>{subjectName}</Text>
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>{gradeById(gradeId)?.name ?? ''}{section ? ` · ${section}` : ''}</Text>
            </TableCell>
            {weeks.map((w, wi) => (
              <TableCell key={w.label} className={styles.weekCell}>
                {unitsInWeek(w).map((u) => (
                  <div key={u.id} className={styles.unit} style={{ background: 'linear-gradient(135deg, #0082AD, #2AA9D8)' }} onClick={() => setViewing(u)}>
                    {u.tema}
                    <span className={styles.unitDelete} onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar esta secuencia?')) void col.remove(u.id) }}><DeleteRegular /></span>
                  </div>
                ))}
                <Button size="small" appearance="subtle" icon={<AddRegular />} className={styles.addBtn} onClick={() => { setWeekModal(wi); setNewSeqCustom('') }}>
                  Añadir secuencia
                </Button>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>

      {topics.length > 0 && (
        <div className={styles.catalog}>
          <Text className={styles.catalogTitle}>Catálogo de secuencias · {subjectName}</Text>
          <div className={styles.chipWrap}>
            {topics.map((t) => (<span key={t} className={styles.tag} onClick={() => weekModal == null ? void createUnit(t, weeks[0]) : addFromCatalog(t)}>{t}</span>))}
          </div>
        </div>
      )}

      <ModalForm open={weekModal != null} onOpenChange={(o) => !o && setWeekModal(null)} title="Añadir secuencia" subtitle={`Establecer en ${weekModal != null ? weeks[weekModal].label : ''}`} width={560}>
        {weekModal != null && (
          <div>
            <FormField label="Elegir del catálogo">
              <Select onChange={(_, d) => d.value && addFromCatalog(d.value)}>
                <option value="">…</option>
                {topics.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
            </FormField>
            <FormField label="O escribir una nueva">
              <Input value={newSeqCustom} onChange={(_, d) => setNewSeqCustom(d.value)} placeholder="Ej. La célula y sus partes" />
            </FormField>
            <FormActions onSubmit={addCustom} submitLabel="Crear y desarrollar" onCancel={() => setWeekModal(null)} />
          </div>
        )}
      </ModalForm>

      <ModalForm open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} title="Secuencia" subtitle={viewing ? `${subjectById(viewing.subjectId)?.name ?? ''} · ${gradeById(viewing.gradeId)?.name ?? ''}` : ''} width={720}>
        {viewing && (
          <div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Tema</span><span>{viewing.tema}</span>
              <span className={styles.kvLabel}>Fecha</span><span>{formatDate(viewing.fecha)}</span>
              <span className={styles.kvLabel}>Duración</span><span>{viewing.duracion}</span>
              <span className={styles.kvLabel}>Competencias específicas</span><span>{viewing.competenciasEspecificas.join(', ') || '—'}</span>
              <span className={styles.kvLabel}>Contenidos</span><span>{viewing.contenidos.conceptuales}<br />{viewing.contenidos.procedimentales}<br />{viewing.contenidos.actitudinales}</span>
              <span className={styles.kvLabel}>Actividades (cronograma)</span><span><b>Inicio:</b> {viewing.actividades.inicio}<br /><b>Desarrollo:</b> {viewing.actividades.desarrollo}<br /><b>Cierre:</b> {viewing.actividades.cierre}</span>
              <span className={styles.kvLabel}>Indicadores</span><span>{viewing.indicadoresLogro.join(' • ') || '—'}</span>
              <span className={styles.kvLabel}>Evaluación</span><span>{viewing.evaluacion.tipo} · {viewing.evaluacion.instrumento}<br />{viewing.evaluacion.criterios}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button appearance="primary" icon={<OpenRegular />} onClick={() => setEditOpen(true)}>Desarrollar plan</Button>
            </div>
          </div>
        )}
      </ModalForm>

      <ModalForm open={editOpen} onOpenChange={setEditOpen} title="Desarrollar secuencia" subtitle="Complete el plan de clase con la estructura del MINERD" width={820}>
        {viewing && (
          <PlanDiarioForm initial={viewing} submitting={col.saving} onSave={async (plan) => { await col.save(plan); setEditOpen(false); setViewing(plan) }} onCancel={() => setEditOpen(false)} />
        )}
      </ModalForm>
    </div>
  )
}
