import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Select, Tab, TabList, Text, Textarea, makeStyles } from '@fluentui/react-components'
import { ArrowLeftRegular, SaveRegular, PrintRegular, VideoRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { printPlan } from '../planificacion/exportPlan'
import { ProyectarUnidad } from '../planificacion/ProyectarUnidad'
import type { AttendanceRecord, DailyPlan, SchoolClassRecord } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  tabsWrap: { background: 'var(--superficie)', borderRadius: '14px', border: '1px solid var(--borde)', padding: '20px', marginTop: '16px' },
  kv: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 14px', fontSize: '13.5px', lineHeight: 1.5 },
  kvLabel: { color: 'var(--texto-suave)', fontWeight: 600 },
  attrBar: { display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--borde)', flexWrap: 'wrap' },
  student: { minWidth: '180px', fontWeight: 600 },
})

export function ClaseDocenteDetail() {
  const styles = useStyles()
  const navigate = useNavigate()
  const params = useParams()
  const { subjectById, gradeById, students } = useApp()
  const classId = params.classId ?? ''
  const [subjectId, gradeId, section] = useMemo(() => {
    const raw = params.key ?? ''
    const [s, g, sec] = raw.split('|').map((x) => decodeURIComponent(x))
    return [s ?? '', g ?? '', sec ?? '']
  }, [params.key])

  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses, dataService.saveClassRecord)
  const unidadesCol = useCollection<DailyPlan>(dataService.getDailyPlans)
  const attCol = useCollection<AttendanceRecord>(dataService.getAttendance, dataService.saveAttendance)

  const cls = classesCol.items.find((c) => c.id === classId)
  const unidad = unidadesCol.items.find((u) => u.id === cls?.unidadId)
  const rosterIds = cls?.roster ?? []
  const rosterStudents = students.filter((s) => rosterIds.includes(s.id))

  const [tab, setTab] = useState<'unidad' | 'lista' | 'informe'>('unidad')
  const [proyectar, setProyectar] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [editable, setEditable] = useState<SchoolClassRecord | null>(null)

  useEffect(() => { if (cls) setEditable({ ...cls }) }, [cls?.id])

  useEffect(() => {
    const att = attCol.items.find((a) => a.classId === classId)
    const map: Record<string, string> = {}
    if (att) att.entries.forEach((e) => { map[e.studentId] = e.status })
    else rosterStudents.forEach((s) => { map[s.id] = 'presente' })
    setStatuses(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, attCol.items.length, rosterStudents.length])

  const saveLista = async () => {
    if (!cls) return
    const entries = rosterStudents.map((s) => ({ studentId: s.id, status: (statuses[s.id] ?? 'presente') as 'presente' | 'ausente' | 'tarde' | 'justificado' }))
    const record: AttendanceRecord = { id: attCol.items.find((a) => a.classId === classId)?.id ?? genId('att'), classId, subjectId, gradeId, date: cls.date, period: cls.period, entries, takenBy: cls.teacherId, takenAt: new Date().toISOString() }
    await attCol.save(record)
    window.alert('Lista guardada.')
  }

  const saveInforme = async () => { if (editable) await classesCol.save(editable) }

  const setBefore = (key: keyof SchoolClassRecord['before'], value: string) => setEditable((e) => e ? { ...e, before: { ...e.before, [key]: value } } : e)
  const setDuring = (key: keyof SchoolClassRecord['during'], value: string) => setEditable((e) => e ? { ...e, during: { ...e.during, [key]: value } } : e)
  const setAfter = (key: keyof SchoolClassRecord['after'], value: string) => setEditable((e) => e ? { ...e, after: { ...e.after, [key]: value } } : e)

  return (
    <div>
      <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(`/docentes/aulas/${encodeURIComponent(`${subjectId}|${gradeId}|${section}`)}`)} style={{ marginBottom: '12px' }}>Volver a Mis Clases</Button>
      <PageHeader
        title="Clase"
        subtitle={cls ? `${subjectById(cls.subjectId)?.name ?? ''} · ${gradeById(cls.gradeId)?.name ?? ''}${section ? ` · ${section}` : ''} · ${cls.title} · ${cls.period}` : 'Cargando…'}
        actions={cls && unidad ? (
          <>
            <Button appearance="secondary" icon={<VideoRegular />} onClick={() => setProyectar(true)}>Proyectar en pizarra</Button>
            <Button appearance="secondary" icon={<PrintRegular />} onClick={() => void printPlan(unidad, subjectById(cls.subjectId)?.name ?? '', gradeById(cls.gradeId)?.name ?? '')}>
              Imprimir Unidad
            </Button>
          </>
        ) : null}
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)}>
        <Tab value="unidad">Unidad de Aprendizaje</Tab>
        <Tab value="lista">Pasar lista ({rosterStudents.length})</Tab>
        <Tab value="informe">Informe (Antes · Durante · Después)</Tab>
      </TabList>

      {tab === 'unidad' && (
        <div className={styles.tabsWrap}>
          <Card>
            {unidad ? (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Tema</span><span><Text weight="semibold">{unidad.tema}</Text></span>
                <span className={styles.kvLabel}>Duración</span><span>{unidad.duracion}</span>
                <span className={styles.kvLabel}>Competencias</span><span>{unidad.competenciasFundamentales.join(', ') || '—'}</span>
                <span className={styles.kvLabel}>Contenidos</span><span>{unidad.contenidos.conceptuales}<br />{unidad.contenidos.procedimentales}<br />{unidad.contenidos.actitudinales}</span>
                <span className={styles.kvLabel}>Cronograma</span><span><b>Inicio:</b> {unidad.actividades.inicio}<br /><b>Desarrollo:</b> {unidad.actividades.desarrollo}<br /><b>Cierre:</b> {unidad.actividades.cierre}</span>
                <span className={styles.kvLabel}>Recursos</span><span>{unidad.recursos.join(', ') || '—'}</span>
                <span className={styles.kvLabel}>Indicadores</span><span>{unidad.indicadoresLogro.join(' • ') || '—'}</span>
                <span className={styles.kvLabel}>Evaluación</span><span>{unidad.evaluacion.tipo} · {unidad.evaluacion.instrumento}<br />{unidad.evaluacion.criterios}</span>
                {unidad.situacionAprendizaje ? <><span className={styles.kvLabel}>Situación</span><span>{unidad.situacionAprendizaje}</span></> : null}
              </div>
            ) : <Text size={300} style={{ color: 'var(--texto-suave)' }}>Esta clase no está vinculada a una Unidad de Aprendizaje.</Text>}
          </Card>
        </div>
      )}

      {tab === 'lista' && (
        <div className={styles.tabsWrap}>
          <Text size={300} block style={{ marginBottom: '12px' }}>Registre la asistencia de la clase ({cls?.date}).</Text>
          {rosterStudents.map((s) => (
            <div key={s.id} className={styles.attrBar}>
              <span className={styles.student}>{s.fullName}</span>
              <Select value={statuses[s.id] ?? 'presente'} onChange={(_, d) => setStatuses((m) => ({ ...m, [s.id]: d.value }))}>
                <option value="presente">Presente</option>
                <option value="ausente">Ausente</option>
                <option value="tarde">Tarde</option>
                <option value="justificado">Justificado</option>
              </Select>
            </div>
          ))}
          {rosterStudents.length === 0 && <Text size={300} style={{ color: 'var(--texto-suave)' }}>No hay estudiantes en esta clase.</Text>}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button appearance="primary" icon={<SaveRegular />} onClick={() => void saveLista()}>Guardar lista</Button>
          </div>
        </div>
      )}

      {tab === 'informe' && editable && (
        <div className={styles.tabsWrap}>
          <Text weight="semibold" size={400} block style={{ marginBottom: '4px' }}>Antes · Planificación y cronograma</Text>
          <FieldRow>
            <FormField label="Objetivos / Planificación">
              <Textarea value={editable.before.objectives} onChange={(_, d) => setBefore('objectives', d.value)} resize="vertical" rows={3} />
            </FormField>
            <FormField label="Contenido">
              <Textarea value={editable.before.content} onChange={(_, d) => setBefore('content', d.value)} resize="vertical" rows={3} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField label="Recursos">
              <Textarea value={editable.before.resources} onChange={(_, d) => setBefore('resources', d.value)} resize="vertical" rows={2} />
            </FormField>
            <FormField label="Cronograma de la actividad">
              <Textarea value={editable.before.cronograma} onChange={(_, d) => setBefore('cronograma', d.value)} resize="vertical" rows={2} />
            </FormField>
          </FieldRow>

          <Text weight="semibold" size={400} block style={{ margin: '18px 0 4px' }}>Durante · Inicio, desarrollo y cierre</Text>
          <FormField label="Inicio">
            <Textarea value={editable.during.development} onChange={(_, d) => setDuring('development', d.value)} resize="vertical" rows={3} />
          </FormField>
          <FormField label="Desarrollo">
            <Textarea value={editable.during.participation} onChange={(_, d) => setDuring('participation', d.value)} resize="vertical" rows={3} />
          </FormField>
          <FormField label="Cierre">
            <Textarea value={editable.during.observations} onChange={(_, d) => setDuring('observations', d.value)} resize="vertical" rows={3} />
          </FormField>

          <Text weight="semibold" size={400} block style={{ margin: '18px 0 4px' }}>Después · Reflexión / autoevaluación</Text>
          <FieldRow>
            <FormField label="Reflexión">
              <Textarea value={editable.after.reflection} onChange={(_, d) => setAfter('reflection', d.value)} resize="vertical" rows={3} />
            </FormField>
            <FormField label="Logros">
              <Textarea value={editable.after.achieved} onChange={(_, d) => setAfter('achieved', d.value)} resize="vertical" rows={3} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField label="Por mejorar">
              <Textarea value={editable.after.toImprove} onChange={(_, d) => setAfter('toImprove', d.value)} resize="vertical" rows={3} />
            </FormField>
            <FormField label="Informe final">
              <Textarea value={editable.after.report} onChange={(_, d) => setAfter('report', d.value)} resize="vertical" rows={3} />
            </FormField>
          </FieldRow>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button appearance="primary" icon={<SaveRegular />} onClick={() => void saveInforme()}>Guardar informe</Button>
          </div>
        </div>
      )}

      <ProyectarUnidad open={proyectar} onClose={() => setProyectar(false)} unidad={unidad ?? null} subjectName={subjectById(cls?.subjectId ?? '')?.name ?? ''} gradeName={gradeById(cls?.gradeId ?? '')?.name ?? ''} />
    </div>
  )
}
