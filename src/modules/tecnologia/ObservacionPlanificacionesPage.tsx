import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { ArrowDownloadRegular, ChartMultipleRegular, FolderRegular, OpenRegular, PlayRegular } from '@fluentui/react-icons'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { resolveSharedFolder, listSharedFiles, downloadSharedFile, findSubfolder } from '../../services/sharedFolder'
import { evaluarPlanificacion } from '../../services/planObservationAi'
import { extractPdfText } from '../../services/pdf'
import { downloadPlanPdf } from '../../services/planPdf'
import { graphErrorMessage } from '../../services/graph'
import { genId, todayIso } from '../../utils/helpers'
import type { PlanFolderConfig, PlanNivel, PlanObservation } from '../../types'

const LEVELS: PlanNivel[] = ['Inicial', 'Primaria', 'Secundaria']

/** Períodos educativos disponibles. */
const PERIODOS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029', '2029-2030', '2030-2031']

/** Carpetas que no corresponden a un docente. */
const esCarpetaDocente = (name: string) => !/herramient|planes? del centro|documento|año|periodo|general|compartid|plantilla/i.test(name)

/** Documentos de planificación/actividades (PDF). */
const esDocumentoRelevante = (name: string) => /\.pdf$/i.test(name) && /planific|actividad|plan/i.test(name)

/** Normaliza el nombre del docente para agrupar (sin acentos, títulos ni mayúsculas). */
const normTeacher = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(prof|profa|lic|licda|dr|dra|maestro|maestra)\b\.?/g, '').replace(/\s+/g, ' ').trim()

const DEFAULT_LINKS: Record<PlanNivel, string> = {
  Inicial: '',
  Primaria: '',
  Secundaria:
    'https://arcadecristoeducationdr-my.sharepoint.com/shared?id=%2Fpersonal%2Fyendy%5Fquezada%5Farcadecristo%5Fedu%5Fdo%2FDocuments%2FA%C3%B1o%20escolar%202025%2D2026%2C%20Innovar%20y%20Aprender&listurl=%2Fpersonal%2Fyendy%5Fquezada%5Farcadecristo%5Fedu%5Fdo%2FDocuments',
}

const COLORS = ['#004D6B', '#0084B3', '#2AA9D8', '#0EA5E9', '#15803D', '#EA580C', '#7C3AED', '#C8102E']

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px', margin: '14px 0' },
  kpi: { padding: '16px' },
  value: { fontSize: '26px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '18px', marginTop: '14px' },
  chart: { padding: '16px' },
  linkRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' },
})

/** Página de observación de planificaciones por nivel (Inicial, Primaria, Secundaria). */
export function ObservacionPlanificacionesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const foldersCol = useCollection<PlanFolderConfig>(dataService.getPlanFolders, dataService.savePlanFolder, dataService.deletePlanFolder)
  const obsCol = useCollection<PlanObservation>(dataService.getPlanObservations, dataService.savePlanObservation, dataService.deletePlanObservation)

  const [level, setLevel] = useState<PlanNivel>('Inicial')
  const [periodo, setPeriodo] = useState('2025-2026')
  const [link, setLink] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [reportTeacher, setReportTeacher] = useState<string | null>(null)

  useEffect(() => {
    if (foldersCol.loading) return
    const cfg = foldersCol.items.find((f) => f.level === level)
    setLink(cfg?.url || DEFAULT_LINKS[level])
  }, [level, foldersCol.loading, foldersCol.items])

  const delNivel = useMemo(() => obsCol.items.filter((o) => o.level === level && (o.periodo ?? '') === periodo), [obsCol.items, level, periodo])

  const guardarEnlace = async () => {
    const cfg = foldersCol.items.find((f) => f.level === level)
    await foldersCol.save({ id: cfg?.id ?? genId('pf'), level, url: link.trim() })
    toaster.dispatchToast('Enlace guardado.', { intent: 'success' })
  }

  const analizar = async () => {
    if (!link.trim()) { toaster.dispatchToast('Pega el enlace de la carpeta compartida del coordinador.', { intent: 'error' }); return }
    setAnalizando(true)
    try {
      setProgreso('Resolviendo la carpeta compartida…')
      const root = await resolveSharedFolder(link.trim())
      // Localiza la carpeta del período seleccionado (si la raíz no lo es).
      let folder = { id: root.itemId, name: root.name }
      let coincide = root.name.includes(periodo)
      if (!coincide) {
        setProgreso(`Buscando la carpeta del período ${periodo}…`)
        const compact = periodo.replace(/[^0-9]/g, '')
        const found = await findSubfolder(root.driveId, root.itemId, (n) => n.includes(periodo) || n.replace(/[^0-9]/g, '').includes(compact), 3)
        if (found) { folder = found; coincide = true }
      }
      if (!coincide) {
        toaster.dispatchToast(`La carpeta compartida no corresponde al período ${periodo}. Comparte la carpeta raíz que contenga los años escolares.`, { intent: 'warning' })
        return
      }
      setProgreso(`Leyendo «${folder.name}»…`)
      const files = await listSharedFiles(root.driveId, folder.id, 4)
      const docs = files
        .filter((f) => esDocumentoRelevante(f.name))
        .filter((f) => { const parts = f.path.split('/'); return parts.length >= 2 && esCarpetaDocente(parts[0]) })
        .slice(0, 80)
      if (docs.length === 0) {
        toaster.dispatchToast(`No se encontraron documentos de planificación/actividades del período ${periodo} en «${folder.name}».`, { intent: 'warning' })
        return
      }
      // Limpia análisis anteriores del mismo nivel/período para no duplicar.
      for (const old of obsCol.items.filter((o) => o.level === level && (o.periodo ?? '') === periodo)) await obsCol.remove(old.id)
      let n = 0
      for (const f of docs) {
        setProgreso(`Analizando ${f.name} (${++n}/${docs.length})…`)
        try {
          const file = await downloadSharedFile(root.driveId, f)
          const text = await extractPdfText(file)
          if (!text.trim()) continue
          // El docente es SIEMPRE la subcarpeta de primer nivel (no el nombre que devuelve la IA).
          const teacher = f.path.split('/')[0].trim()
          const ev = await evaluarPlanificacion(text, { level, fileName: f.name, suggestedTeacher: teacher })
          await obsCol.save({
            id: genId('pobs'),
            level,
            periodo,
            teacherName: teacher,
            fileName: f.name,
            webUrl: f.webUrl,
            date: todayIso(),
            tools: ev.herramientas,
            resources: ev.recursos,
            score: ev.puntaje,
            summary: ev.resumen,
            strengths: ev.fortalezas,
            improvements: ev.mejoras,
            recommendations: ev.recomendaciones,
            analyzedAt: new Date().toISOString(),
            byUserId: user?.id,
            byName: user?.displayName,
          })
        } catch {
          /* continúa con el siguiente archivo */
        }
      }
      await obsCol.refresh()
      toaster.dispatchToast(`Análisis completado para ${periodo}. Revisa el panel y los informes.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setAnalizando(false)
      setProgreso('')
    }
  }

  const porDocente = useMemo(() => {
    const map = new Map<string, { key: string; name: string; suma: number; n: number; tools: Set<string> }>()
    for (const o of delNivel) {
      const key = normTeacher(o.teacherName) || o.teacherName
      const e = map.get(key) ?? { key, name: o.teacherName, suma: 0, n: 0, tools: new Set<string>() }
      e.suma += o.score; e.n += 1
      for (const t of o.tools) e.tools.add(t)
      map.set(key, e)
    }
    return [...map.values()].map((e) => ({ key: e.key, name: e.name, puntaje: Math.round(e.suma / Math.max(1, e.n)), docs: e.n, herramientas: e.tools.size })).sort((a, b) => b.puntaje - a.puntaje)
  }, [delNivel])

  const herramientas = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of delNivel) for (const t of o.tools) map.set(t, (map.get(t) ?? 0) + 1)
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [delNivel])

  const promedio = porDocente.length ? Math.round(porDocente.reduce((a, b) => a + b.puntaje, 0) / porDocente.length) : 0

  /** Genera un informe PDF por docente con sus observaciones. */
  const generarInforme = (teacher: string) => {
    const items = delNivel.filter((o) => normTeacher(o.teacherName) === normTeacher(teacher))
    const rows = items.map((o) => `<tr><td>${o.fileName}</td><td>${o.date}</td><td>${o.score}</td><td>${o.tools.join(', ') || '—'}</td><td>${o.resources.join(', ') || '—'}</td></tr>`).join('')
    const html = `<h1>Informe de observación de planificación</h1>
<p><strong>Nivel:</strong> ${level} · <strong>Docente:</strong> ${teacher} · <strong>Fecha:</strong> ${todayIso()}</p>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px">
<thead><tr><th>Documento</th><th>Fecha</th><th>Puntaje</th><th>Herramientas</th><th>Recursos</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Observaciones</h3>${items.map((o) => `<p><strong>${o.fileName}</strong> (${o.score}/100): ${o.summary}<br/><em>Fortalezas:</em> ${o.strengths ?? '—'}<br/><em>Mejoras:</em> ${o.improvements ?? '—'}<br/><em>Recomendaciones:</em> ${o.recommendations ?? '—'}</p>`).join('')}`
    void downloadPlanPdf(html, `Informe planificación · ${teacher} · ${level}`)
  }

  const reportItems = reportTeacher ? delNivel.filter((o) => normTeacher(o.teacherName) === normTeacher(reportTeacher)) : []

  return (
    <div>
      <PageHeader
        title="Observación de planificaciones"
        subtitle="Genera informes sobre las observaciones a los documentos de planificación y compara el uso de herramientas y recursos tecnológicos por nivel (Inicial, Primaria, Secundaria)."
      />

      <TabList selectedValue={level} onTabSelect={(_, d) => setLevel(d.value as PlanNivel)} style={{ marginBottom: '14px' }}>
        {LEVELS.map((l) => <Tab key={l} value={l}>Docentes de {l} ({obsCol.items.filter((o) => o.level === l && (o.periodo ?? '') === periodo).length})</Tab>)}
      </TabList>

      <Card className={styles.chart} style={{ marginBottom: '14px' }}>
        <Text weight="semibold" size={300} block><FolderRegular /> Carpeta compartida del coordinador de {level}</Text>
        <div className={styles.linkRow} style={{ marginTop: '8px' }}>
          <Select value={periodo} onChange={(_, d) => setPeriodo(d.value)} style={{ minWidth: '160px' }}>
            {PERIODOS.map((p) => <option key={p} value={p}>Período {p}</option>)}
          </Select>
          <Input value={link} onChange={(_, d) => setLink(d.value)} placeholder="https://…/shared?id=…" style={{ flex: 1, minWidth: '260px' }} />
          <Button appearance="secondary" onClick={() => void guardarEnlace()}>Guardar enlace</Button>
          <Button appearance="primary" icon={analizando ? <Spinner size="tiny" /> : <PlayRegular />} disabled={analizando} onClick={() => void analizar()}>
            {analizando ? 'Analizando…' : 'Analizar carpeta'}
          </Button>
          {link && <Button appearance="subtle" icon={<OpenRegular />} onClick={() => window.open(link, '_blank', 'noopener')}>Abrir carpeta</Button>}
        </div>
        <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
          Cada subcarpeta es un docente. Se analizan solo los PDF de <strong>planificación/actividades</strong> del período <strong>{periodo}</strong> que evidencien uso de herramientas y recursos tecnológicos. La IA evalúa cada documento.
        </Text>
        {progreso && <Text size={200} block style={{ color: 'var(--azul)', marginTop: '6px' }}>{progreso}</Text>}
      </Card>

      <div className={styles.kpis}>
        <Card className={styles.kpi}><span className={styles.value}>{delNivel.length}</span><span className={styles.label}>Planificaciones analizadas</span></Card>
        <Card className={styles.kpi}><span className={styles.value}>{porDocente.length}</span><span className={styles.label}>Docentes</span></Card>
        <Card className={styles.kpi}><span className={styles.value}>{promedio}/100</span><span className={styles.label}>Puntaje promedio</span></Card>
        <Card className={styles.kpi}><span className={styles.value}>{herramientas.length}</span><span className={styles.label}>Herramientas distintas</span></Card>
      </div>

      {delNivel.length === 0 ? (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Aún no hay análisis para {level}. Pega el enlace de la carpeta del coordinador y pulsa «Analizar carpeta».</Text>
      ) : (
        <>
          <div className={styles.charts}>
            <Card className={styles.chart}>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}><ChartMultipleRegular /> Puntaje por docente</Text>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porDocente}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <RTooltip /><Legend />
                  <Bar dataKey="puntaje" fill="#0084B3" name="Puntaje" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className={styles.chart}>
              <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Herramientas tecnológicas más usadas</Text>
              {herramientas.length === 0 ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin herramientas detectadas.</Text> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={herramientas} dataKey="value" nameKey="name" outerRadius={95} label>
                      {herramientas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend /><RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card className={styles.chart} style={{ marginTop: '16px' }}>
            <Text weight="semibold" size={400} block style={{ marginBottom: '8px' }}>Resultados por docente</Text>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Docente</TableHeaderCell>
                  <TableHeaderCell>Documentos</TableHeaderCell>
                  <TableHeaderCell>Puntaje</TableHeaderCell>
                  <TableHeaderCell>Herramientas</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porDocente.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell><Text weight="semibold">{d.name}</Text></TableCell>
                    <TableCell>{d.docs}</TableCell>
                    <TableCell>{d.puntaje}/100</TableCell>
                    <TableCell>{d.herramientas}</TableCell>
                    <TableCell>
                      <Button size="small" appearance="secondary" onClick={() => setReportTeacher(d.name)}>Ver informe</Button>
                      <Button size="small" appearance="subtle" icon={<ArrowDownloadRegular />} onClick={() => generarInforme(d.name)}>PDF</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <ModalForm
        open={!!reportTeacher}
        onOpenChange={(o) => { if (!o) setReportTeacher(null) }}
        title={`Informe · ${reportTeacher ?? ''}`}
        subtitle={`Observaciones de planificación · ${level}`}
        width={820}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setReportTeacher(null)}>Cerrar</Button>
            <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={() => reportTeacher && generarInforme(reportTeacher)}>Descargar PDF</Button>
          </>
        }
      >
        {reportItems.map((o) => (
          <Card key={o.id} style={{ marginBottom: '10px', padding: '12px' }}>
            <Text weight="semibold" block>{o.fileName} · {o.score}/100</Text>
            <Text size={200} block>{o.summary}</Text>
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>Herramientas: {o.tools.join(', ') || '—'}</Text>
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>Recursos: {o.resources.join(', ') || '—'}</Text>
            {o.recommendations && <Text size={200} block style={{ color: 'var(--texto-suave)' }}>Recomendaciones: {o.recommendations}</Text>}
          </Card>
        ))}
      </ModalForm>
    </div>
  )
}
