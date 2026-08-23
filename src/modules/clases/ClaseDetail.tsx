import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Label, Tab, TabList, Text, Textarea, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  CalendarCheckmarkRegular,
  CheckmarkCircleRegular,
  DocumentTextRegular,
  EditRegular,
  LinkRegular,
  SaveRegular,
  VideoRegular,
} from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import type { SchoolClassRecord } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  row: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  meta: { color: tokens.colorNeutralForeground2 },
  phaseCard: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  phaseTitle: { display: 'flex', alignItems: 'center', gap: '8px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  loading: { padding: '40px', textAlign: 'center' },
})

interface PhaseEditorProps {
  label: string
  values: string[]
  fields: string[]
  editing: boolean
  onEdit: (values: string[]) => void
}

function PhaseEditor({ label, values, fields, editing, onEdit }: PhaseEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Text weight="semibold">{label}</Text>
      {fields.map((field, idx) => (
        <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label size="small">{field}</Label>
          {editing ? (
            <Textarea value={values[idx]} onChange={(_, d) => { const next = [...values]; next[idx] = d.value; onEdit(next) }} resize="vertical" />
          ) : (
            <Text size={300} block>{values[idx] || '—'}</Text>
          )}
        </div>
      ))}
    </div>
  )
}

export function ClaseDetail() {
  const styles = useStyles()
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { subjectById, gradeById, teacherById, role } = useApp()

  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses, dataService.saveClassRecord, dataService.deleteClassRecord)
  const clase = useMemo(() => classesCol.items.find((c) => c.id === id), [classesCol.items, id])

  const [tab, setTab] = useState('antes')
  const [editing, setEditing] = useState(false)
  const [before, setBefore] = useState<SchoolClassRecord['before'] | null>(null)
  const [during, setDuring] = useState<SchoolClassRecord['during'] | null>(null)
  const [after, setAfter] = useState<SchoolClassRecord['after'] | null>(null)
  const [saving, setSaving] = useState(false)
  const toaster = useToastController()

  useEffect(() => {
    if (clase) {
      setBefore(clase.before)
      setDuring(clase.during)
      setAfter(clase.after)
      if (params.get('tomar')) setTab('asistencia')
    }
  }, [clase, params])

  const basePath = role === 'admin' ? '/administrativo' : '/docentes'

  const handleSave = async () => {
    if (!clase || !before || !during || !after) return
    setSaving(true)
    try {
      await classesCol.save({ ...clase, before, during, after })
      toaster.dispatchToast("Clase guardada", { intent: "success" })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const markComplete = async () => {
    if (!clase) return
    const report = after?.report || `Informe de la clase "${clase.title}" del ${formatDate(clase.date)}. Asistencia registrada.`
    await classesCol.save({ ...clase, status: 'completada', after: { ...(after ?? clase.after), report } })
    toaster.dispatchToast("Clase completada", { intent: "success" })
  }

  const openReport = () => {
    if (!clase) return
    const subject = subjectById(clase.subjectId)?.name ?? clase.subjectId
    const grade = gradeById(clase.gradeId)?.name ?? clase.gradeId
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe de clase</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:40px;max-width:800px;margin:auto}
h1{color:#004D6B;border-bottom:3px solid #E30613;padding-bottom:8px}
h3{color:#004D6B}table{width:100%;border-collapse:collapse;margin:12px 0}
td,th{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}
.section{margin:24px 0}</style></head><body>
<h1>Informe de Clase — Colegio Arca de Cristo</h1>
<table><tr><td><b>Asignatura:</b> ${subject}</td><td><b>Grado:</b> ${grade}</td></tr>
<tr><td><b>Fecha:</b> ${formatDate(clase.date)}</td><td><b>Periodo:</b> ${clase.period}</td></tr>
<tr><td colspan="2"><b>Docente:</b> ${teacherById(clase.teacherId)?.fullName ?? '—'}</td></tr></table>
<div class="section"><h3>ANTES — Planificación</h3>
<table><tr><th>Objetivos</th><td>${(before?.objectives ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Contenido</th><td>${(before?.content ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Actividades</th><td>${(before?.activities ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Cronograma</th><td>${(before?.cronograma ?? '—').replace(/\n/g, '<br>')}</td></tr></table></div>
<div class="section"><h3>DURANTE — Desarrollo</h3>
<table><tr><th>Desarrollo</th><td>${(during?.development ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Participación</th><td>${(during?.participation ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Observaciones</th><td>${(during?.observations ?? '—').replace(/\n/g, '<br>')}</td></tr></table></div>
<div class="section"><h3>DESPUÉS — Reflexión e informe</h3>
<table><tr><th>Reflexión</th><td>${(after?.reflection ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Logros</th><td>${(after?.achieved ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Por mejorar</th><td>${(after?.toImprove ?? '—').replace(/\n/g, '<br>')}</td></tr>
<tr><th>Informe</th><td>${(after?.report ?? '—').replace(/\n/g, '<br>')}</td></tr></table></div>
<p style="margin-top:40px;font-size:12px;color:#666">Generado por Colegio Evangélico Arca de Cristo — La Romana, RD</p>
</body></html>`
    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
    win?.focus()
    win?.print()
  }

  if (!clase) {
    return <div className={styles.loading}><Text>Registrando clase…</Text></div>
  }

  return (
    <div>
      <PageHeader
        title={clase.title}
        subtitle={`${subjectById(clase.subjectId)?.name ?? ''} · ${gradeById(clase.gradeId)?.name ?? ''} · ${formatDate(clase.date)} · ${clase.period}`}
        actions={
          <div className={styles.actions}>
            <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(`${basePath}/clases`)}>Volver</Button>
            {clase.planId && (
              <Button appearance="outline" icon={<LinkRegular />} onClick={() => navigate(`${basePath}/planificacion`)}>Planificación</Button>
            )}
            <Button appearance="outline" icon={<CalendarCheckmarkRegular />} onClick={() => navigate(`${basePath}/asistencia?classId=${clase.id}`)}>Tomar asistencia</Button>
            <Button appearance="outline" icon={<VideoRegular />} onClick={() => navigate(`${basePath}/aulas?classId=${clase.id}`)}>Actividad en aula</Button>
            <Button appearance="outline" icon={<DocumentTextRegular />} onClick={openReport}>Reporte</Button>
            {clase.status !== 'completada' ? (
              <Button appearance="primary" icon={<CheckmarkCircleRegular />} onClick={() => void markComplete()}>Marcar completada</Button>
            ) : (
              <StatusBadge status="completada" />
            )}
          </div>
        }
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '16px' }}>
        <Tab value="antes">ANTES · Planificación</Tab>
        <Tab value="durante">DURANTE · Desarrollo</Tab>
        <Tab value="despues">DESPUÉS · Reflexión</Tab>
      </TabList>

      {tab === 'antes' && before && (
        <Card className={styles.phaseCard}>
          <div className={styles.phaseTitle}>
            <span style={{ fontSize: '20px', color: tokens.colorBrandForeground1 }}>📋</span>
            <Text weight="semibold" size={400}>Antes de la clase</Text>
            <span className={styles.meta}>(planificación, plan de trabajo y cronograma)</span>
            {!editing && <Button appearance="subtle" size="small" icon={<EditRegular />} onClick={() => setEditing(true)}>Editar</Button>}
          </div>
          <PhaseEditor
            label=""
            editing={editing}
            values={[before.objectives, before.content, before.activities, before.resources, before.cronograma]}
            fields={['Objetivos', 'Contenido', 'Actividades / secuencia didáctica', 'Recursos', 'Cronograma de la sesión']}
            onEdit={(v) => setBefore({ ...before, objectives: v[0], content: v[1], activities: v[2], resources: v[3], cronograma: v[4] })}
          />
        </Card>
      )}

      {tab === 'durante' && during && (
        <Card className={styles.phaseCard}>
          <div className={styles.phaseTitle}>
            <span style={{ fontSize: '20px' }}>▶️</span>
            <Text weight="semibold" size={400}>Durante la clase</Text>
            <span className={styles.meta}>(lo realizado en la actividad)</span>
            {!editing && <Button appearance="subtle" size="small" icon={<EditRegular />} onClick={() => setEditing(true)}>Editar</Button>}
          </div>
          <PhaseEditor
            label=""
            editing={editing}
            values={[during.development, during.participation, during.observations]}
            fields={['Desarrollo de la actividad', 'Participación de los estudiantes', 'Observaciones']}
            onEdit={(v) => setDuring({ ...during, development: v[0], participation: v[1], observations: v[2] })}
          />
        </Card>
      )}

      {tab === 'despues' && after && (
        <Card className={styles.phaseCard}>
          <div className={styles.phaseTitle}>
            <span style={{ fontSize: '20px' }}>🔍</span>
            <Text weight="semibold" size={400}>Después de la clase</Text>
            <span className={styles.meta}>(reflexiones e informe de la actividad realizada)</span>
            {!editing && <Button appearance="subtle" size="small" icon={<EditRegular />} onClick={() => setEditing(true)}>Editar</Button>}
          </div>
          <PhaseEditor
            label=""
            editing={editing}
            values={[after.reflection, after.achieved, after.toImprove, after.report]}
            fields={['Reflexión docente', 'Logros alcanzados', 'Aspectos a mejorar', 'Informe de la actividad realizada']}
            onEdit={(v) => setAfter({ ...after, reflection: v[0], achieved: v[1], toImprove: v[2], report: v[3] })}
          />
        </Card>
      )}

      {tab === 'asistencia' && (
        <Card className={styles.phaseCard}>
          <Text>Para registrar la asistencia de esta clase utilice el módulo de Asistencia.</Text>
          <Button appearance="primary" icon={<CalendarCheckmarkRegular />} onClick={() => navigate(`${basePath}/asistencia?classId=${clase.id}`)}>
            Ir a control de asistencia
          </Button>
        </Card>
      )}

      {editing && (
        <div className={styles.actions} style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
          <Button appearance="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button appearance="primary" icon={<SaveRegular />} onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  )
}
