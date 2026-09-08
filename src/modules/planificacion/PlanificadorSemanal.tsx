import { useMemo, useState } from 'react'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles } from '@fluentui/react-components'
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
  weekHead: { background: 'rgba(0,130,173,0.08)', textAlign: 'center' },
  weekCell: { minWidth: '150px' },
  subjectCell: { verticalAlign: 'top', minWidth: '180px', fontWeight: 700 },
  unit: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer', wordBreak: 'break-word', transition: 'transform 0.15s ease', ':hover': { transform: 'translateY(-1px)' }, marginBottom: '6px' },
  unitDelete: { marginLeft: 'auto', color: 'rgba(255,255,255,0.75)', ':hover': { color: '#fff' } },
  addBtn: { marginTop: '4px' },
  empty: { fontSize: '12px', color: 'var(--texto-suave)' },
  kv: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px 14px', fontSize: '13.5px', lineHeight: 1.5 },
  kvLabel: { color: 'var(--texto-suave)', fontWeight: 600 },
})

interface Week { label: string; startDay: number; endDay: number }
interface AddTarget { subjectId: string; subjectName: string; weekIndex: number }

const SUBJECT_COLORS = ['#0082AD', '#2AA9D8', '#0EA5E9', '#0B6E4F', '#E62327', '#AD1457', '#7D1D24', '#9A9C2E']

export function PlanificadorSemanal() {
  const styles = useStyles()
  const { user, subjects, grades, gradeById, subjectById } = useApp()
  const col = useCollection<DailyPlan>(dataService.getDailyPlans, dataService.saveDailyPlan, dataService.deleteDailyPlan)

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '')
  const [section, setSection] = useState('')
  const [month, setMonth] = useState(defaultMonth)
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)
  const [newSeqCustom, setNewSeqCustom] = useState('')
  const [viewing, setViewing] = useState<DailyPlan | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const weeks = useMemo<Week[]>(() => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const arr: Week[] = []
    for (let start = 1; start <= days; start += 7) arr.push({ label: `Semana ${arr.length + 1}`, startDay: start, endDay: Math.min(start + 6, days) })
    return arr
  }, [month])

  const unitsOfMonth = useMemo(() => col.items.filter((p) => p.tipo === 'unidad' && (gradeId ? p.gradeId === gradeId : true) && p.fecha.startsWith(month)), [col.items, gradeId, month])

  const unitsIn = (subjectId: string, week: Week) => {
    return unitsOfMonth
      .filter((p) => p.subjectId === subjectId)
      .filter((p) => {
        const d = Number(p.fecha.slice(8, 10))
        return d >= week.startDay && d <= week.endDay && p.fecha === `${month}-${String(d).padStart(2, '0')}`
      })
      .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  }

  const dateForWeek = (week: Week) => `${month}-${String(week.startDay).padStart(2, '0')}`

  const buildUnit = (subjectId: string, topic: string, week: Week): DailyPlan => ({
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
  })

  const addSequence = async (subjectId: string, topic: string, week: Week) => {
    const plan = buildUnit(subjectId, topic, week)
    await col.save(plan)
    setViewing(plan)
    setAddTarget(null)
  }

  const fillDefault = async () => {
    for (const subj of subjects) {
      const topics = secuenciasDeAsignatura(subj.name)
      for (let i = 0; i < weeks.length && i < topics.length; i++) {
        const topic = topics[i]
        const exists = unitsIn(subj.id, weeks[i]).some((u) => u.tema === topic)
        if (exists) continue
        const plan = buildUnit(subj.id, topic, weeks[i])
        await col.save(plan)
      }
    }
  }

  const activeTopics = addTarget ? secuenciasDeAsignatura(addTarget.subjectName) : []

  const addCustom = () => {
    if (!addTarget || !newSeqCustom.trim()) return
    void addSequence(addTarget.subjectId, newSeqCustom.trim(), weeks[addTarget.weekIndex])
    setNewSeqCustom('')
  }

  return (
    <div>
      <PageHeader
        title="Planificador semanal"
        subtitle={`Todas las asignaturas por semana, como el Eduplan. Cada secuencia se despliega en el plan completo del MINERD. · ${anioEscolar()}`}
        actions={<Button appearance="secondary" icon={<WandRegular />} onClick={() => void fillDefault()}>Rellenar por defecto</Button>}
      />

      <div className={styles.controls}>
        <Select value={gradeId} onChange={(_, d) => setGradeId(d.value)} style={{ minWidth: '160px' }}>
          {grades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
        </Select>
        <Select value={section} onChange={(_, d) => setSection(d.value)} style={{ minWidth: '110px' }}>
          <option value="">Toda la sección</option>
          {['A', 'B', 'C', 'D'].map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
        <Input type="month" value={month} onChange={(_, d) => setMonth(d.value)} style={{ minWidth: '170px' }} />
      </div>

      <div className={styles.monthChip}><CalendarLtrRegular /> {new Date(`${month}-01T00:00:00`).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}</div>

      <Table aria-label="Planificador semanal por asignatura">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            {weeks.map((w) => (<TableHeaderCell key={w.label} className={styles.weekHead}>{w.label}</TableHeaderCell>))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((subj, si) => (
            <TableRow key={subj.id}>
              <TableCell className={styles.subjectCell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: subj.color ?? SUBJECT_COLORS[si % SUBJECT_COLORS.length] }} />
                  {subj.name}
                </span>
              </TableCell>
              {weeks.map((w, wi) => {
                const units = unitsIn(subj.id, w)
                return (
                  <TableCell key={w.label} className={styles.weekCell}>
                    {units.length === 0 && <div className={styles.empty}>—</div>}
                    {units.map((u) => (
                      <div key={u.id} className={styles.unit} style={{ background: `linear-gradient(135deg, ${subj.color ?? SUBJECT_COLORS[si % SUBJECT_COLORS.length]}, ${subj.color ?? SUBJECT_COLORS[si % SUBJECT_COLORS.length]}cc)` }} onClick={() => setViewing(u)}>
                        {u.tema}
                        <span className={styles.unitDelete} onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar esta secuencia?')) void col.remove(u.id) }}><DeleteRegular /></span>
                      </div>
                    ))}
                    <Button size="small" appearance="subtle" icon={<AddRegular />} className={styles.addBtn} onClick={() => { setAddTarget({ subjectId: subj.id, subjectName: subj.name, weekIndex: wi }); setNewSeqCustom('') }}>
                      Añadir secuencia
                    </Button>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ModalForm open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)} title="Añadir secuencia" subtitle={`${addTarget?.subjectName ?? ''} · ${addTarget ? weeks[addTarget.weekIndex].label : ''}`} width={560}>
        {addTarget && (
          <div>
            <FormField label="Elegir del catálogo">
              <Select onChange={(_, d) => d.value && void addSequence(addTarget.subjectId, d.value, weeks[addTarget.weekIndex])}>
                <option value="">…</option>
                {activeTopics.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
            </FormField>
            <FormField label="O escribir una nueva">
              <Input value={newSeqCustom} onChange={(_, d) => setNewSeqCustom(d.value)} placeholder="Ej. La célula y sus partes" />
            </FormField>
            <FormActions onSubmit={addCustom} submitLabel="Crear y desarrollar" onCancel={() => setAddTarget(null)} />
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
