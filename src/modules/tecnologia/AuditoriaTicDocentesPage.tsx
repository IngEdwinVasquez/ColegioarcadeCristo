import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { ArrowDownloadRegular, ArrowSyncRegular, FolderRegular, OpenRegular, SearchRegular } from '@fluentui/react-icons'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell } from 'recharts'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { resolveSharedFolder, listSharedFiles, downloadSharedFile } from '../../services/sharedFolder'
import { listFilesRecursive, getFileDownloadUrl } from '../../services/onedrive'
import { extractPdfText } from '../../services/pdf'
import { analizarEvidenciaTic } from '../../services/ticAuditoriaAi'
import { downloadPlanPdf } from '../../services/planPdf'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import type { TicAuditoriaConfig, TicAuditoriaDoc, TicNivel } from '../../types'

const NIVELES: TicNivel[] = ['Inicial', 'Primaria', 'Secundaria']
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const COLORS = ['#004D6B', '#0084B3', '#2AA9D8', '#0EA5E9', '#15803D', '#EA580C', '#7C3AED', '#C8102E', '#B45309', '#0A7C66']

const mesLabel = (mes: string): string => {
  if (!mes) return 'Sin mes'
  const [y, m] = mes.split('-')
  const name = MESES_ES[Number(m) - 1]
  return name ? `${name} ${y}` : mes
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Busca un mes (YYYY-MM) en la ruta o el nombre del archivo. */
const detectMes = (text: string): string => {
  const s = norm(text)
  let m = s.match(/(20\d{2})[-_/.](\d{1,2})/)
  if (m) return `${m[1]}-${String(Math.min(12, Math.max(1, Number(m[2])))).padStart(2, '0')}`
  m = s.match(/(\d{1,2})[-_/.](20\d{2})/)
  if (m) return `${m[2]}-${String(Math.min(12, Math.max(1, Number(m[1])))).padStart(2, '0')}`
  const idx = MESES_ES.findIndex((mes) => s.includes(norm(mes)))
  const y = s.match(/(20\d{2})/)
  if (idx >= 0 && y) return `${y[1]}-${String(idx + 1).padStart(2, '0')}`
  return ''
}

/** Toma la primera subcarpeta como nombre del docente. */
const detectDocente = (path: string): string => {
  const parts = path.split('/').filter(Boolean)
  if (parts.length >= 2) return parts[0].replace(/\.[^.]+$/, '').trim()
  return ''
}

const detectTipo = (name: string): string => {
  if (/planific/i.test(name)) return 'Planificación'
  if (/informe/i.test(name)) return 'Informe'
  if (/capacit/i.test(name)) return 'Capacitación'
  if (/actividad/i.test(name)) return 'Actividad'
  if (/foto|imagen|img|evidencia/i.test(name)) return 'Evidencia'
  if (/lista|cotejo|rubrica|rúbrica/i.test(name)) return 'Instrumento'
  return 'Evidencia'
}

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 165px), 1fr))', gap: '14px', margin: '14px 0' },
  kpi: { padding: '16px' },
  value: { fontSize: '26px', fontWeight: 800, color: '#0A1F2B' },
  label: { fontSize: '12px', color: 'var(--texto-suave)' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: '18px', marginTop: '14px' },
  chart: { padding: '16px' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' },
  cfg: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
})

/** Informe de Auditoría TIC de docentes por nivel, con gráficos y filtros. */
export function AuditoriaTicDocentesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const cfgCol = useCollection<TicAuditoriaConfig>(dataService.getTicAuditoriaConfigs, dataService.saveTicAuditoriaConfig, dataService.deleteTicAuditoriaConfig)
  const docsCol = useCollection<TicAuditoriaDoc>(dataService.getTicAuditoria, dataService.saveTicAuditoria, dataService.deleteTicAuditoria)

  const [level, setLevel] = useState<TicNivel>('Secundaria')
  const [mode, setMode] = useState<'onedrive' | 'share'>('onedrive')
  const [path, setPath] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [savingCfg, setSavingCfg] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [progreso, setProgreso] = useState('')

  const [fDocente, setFDocente] = useState('')
  const [fMes, setFMes] = useState('')
  const [q, setQ] = useState('')

  const savedCfg = useMemo(() => cfgCol.items.find((c) => c.level === level), [cfgCol.items, level])

  // Carga la configuración del nivel seleccionado.
  useEffect(() => {
    const c = savedCfg
    setMode(c?.mode ?? 'onedrive')
    setPath(c?.path ?? (level === 'Secundaria' ? 'Auditoria_TIC_Docentes' : ''))
    setShareUrl(c?.shareUrl ?? '')
  }, [level, savedCfg])

  const docsNivel = useMemo(() => docsCol.items.filter((d) => d.level === level), [docsCol.items, level])

  const docentes = useMemo(() => [...new Set(docsNivel.map((d) => d.docente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [docsNivel])
  const meses = useMemo(() => [...new Set(docsNivel.map((d) => d.mes).filter(Boolean))].sort(), [docsNivel])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return docsNivel.filter((d) =>
      (!fDocente || d.docente === fDocente) &&
      (!fMes || d.mes === fMes) &&
      (!query || `${d.docente} ${d.fileName} ${d.resumen} ${d.tipo}`.toLowerCase().includes(query)),
    )
  }, [docsNivel, fDocente, fMes, q])

  const kpis = useMemo(() => {
    const conPuntaje = filtered.filter((d) => d.source === 'ia')
    const promedio = conPuntaje.length ? Math.round(conPuntaje.reduce((s, d) => s + (d.puntaje || 0), 0) / conPuntaje.length) : 0
    return {
      docentes: new Set(filtered.map((d) => d.docente)).size,
      evidencias: filtered.length,
      promedio,
      meses: new Set(filtered.map((d) => d.mes).filter(Boolean)).size,
      sinAnalizar: filtered.filter((d) => d.source !== 'ia').length,
    }
  }, [filtered])

  const porDocente = useMemo(() => {
    const map = new Map<string, { sum: number; n: number; total: number }>()
    for (const d of filtered) {
      const cur = map.get(d.docente) ?? { sum: 0, n: 0, total: 0 }
      cur.total += 1
      if (d.source === 'ia') { cur.sum += d.puntaje || 0; cur.n += 1 }
      map.set(d.docente, cur)
    }
    return [...map.entries()].map(([name, v]) => ({ name, puntaje: v.n ? Math.round(v.sum / v.n) : 0, evidencias: v.total }))
      .sort((a, b) => b.evidencias - a.evidencias)
  }, [filtered])

  const porMes = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of filtered) {
      const k = d.mes || 'sin-mes'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()].map(([k, v]) => ({ name: k === 'sin-mes' ? 'Sin mes' : mesLabel(k), evidencias: v })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filtered])

  const porTipo = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of filtered) map.set(d.tipo || 'Evidencia', (map.get(d.tipo || 'Evidencia') ?? 0) + 1)
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  const guardarConfig = async () => {
    setSavingCfg(true)
    try {
      const rec: TicAuditoriaConfig = {
        id: `tic-aud-${level.toLowerCase()}`,
        level,
        mode,
        path: path.trim(),
        shareUrl: shareUrl.trim(),
        updatedAt: new Date().toISOString(),
      }
      await cfgCol.save(rec)
      toaster.dispatchToast('Configuración guardada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setSavingCfg(false)
    }
  }

  const analizarCarpeta = async () => {
    if (mode === 'onedrive' && !path.trim()) {
      toaster.dispatchToast('Indica la carpeta de OneDrive (por ejemplo: Auditoria_TIC_Docentes).', { intent: 'error' })
      return
    }
    if (mode === 'share' && !shareUrl.trim()) {
      toaster.dispatchToast('Pega el enlace compartido de la carpeta.', { intent: 'error' })
      return
    }
    setAnalizando(true)
    setProgreso('Leyendo carpeta…')
    try {
      let files: Array<{ id: string; name: string; webUrl?: string; downloadUrl?: string; mimeType?: string; path: string }> = []
      let shareDriveId = ''

      if (mode === 'onedrive') {
        const candidatos = [...new Set([
          path.trim(),
          'Auditoria_TIC_Docentes',
          'Auditoria TIC Docentes',
          'Auditoria TIC Docente',
          'Auditoria tic docente',
        ].filter(Boolean))]
        for (const p of candidatos) {
          const encontrados = await listFilesRecursive(p, 4)
          if (encontrados.length) {
            files = encontrados
            if (p !== path.trim()) setPath(p)
            break
          }
        }
      } else {
        const folder = await resolveSharedFolder(shareUrl.trim())
        shareDriveId = folder.driveId
        const items = await listSharedFiles(folder.driveId, folder.itemId, 4)
        files = items.map((i) => ({ id: i.id, name: i.name, webUrl: i.webUrl, downloadUrl: i.downloadUrl, mimeType: i.mimeType, path: i.path }))
      }

      if (!files.length) {
        toaster.dispatchToast('La carpeta está vacía o no se encontró.', { intent: 'warning' })
        return
      }

      const existentes = new Set(docsNivel.map((d) => d.fileId))
      const nuevos = files.filter((f) => !existentes.has(f.id))
      if (!nuevos.length) {
        toaster.dispatchToast(`No hay archivos nuevos (${files.length} ya analizados).`, { intent: 'info' })
        return
      }

      const lote = nuevos.slice(0, 15)
      let ok = 0
      let conError = 0

      for (let i = 0; i < lote.length; i++) {
        const f = lote[i]
        setProgreso(`Analizando ${i + 1}/${lote.length}: ${f.name}`)
        const docentePath = detectDocente(f.path)
        const mesPath = detectMes(`${f.path} ${f.name}`)
        const tipoBase = detectTipo(f.name)
        let ev: Awaited<ReturnType<typeof analizarEvidenciaTic>> | null = null
        let source: 'ia' | 'manual' = 'manual'
        let resumen = 'Archivo no analizable automáticamente (no es PDF).'
        let puntaje = 0

        const esPdf = /\.pdf$/i.test(f.name) || f.mimeType === 'application/pdf'
        if (esPdf) {
          try {
            let fileObj: File
            if (mode === 'onedrive') {
              const url = f.downloadUrl ?? await getFileDownloadUrl(f.id)
              const res = await fetch(url)
              if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`)
              const blob = await res.blob()
              fileObj = new File([blob], f.name, { type: 'application/pdf' })
            } else {
              fileObj = await downloadSharedFile(shareDriveId, { id: f.id, name: f.name, webUrl: f.webUrl, downloadUrl: f.downloadUrl, mimeType: f.mimeType, path: f.path })
            }
            const texto = await extractPdfText(fileObj)
            if (texto && texto.trim().length > 20) {
              ev = await analizarEvidenciaTic(texto, { level, fileName: f.name, path: f.path })
              source = 'ia'
              resumen = ev.resumen || 'Sin resumen.'
              puntaje = ev.puntaje ?? 0
            } else {
              resumen = 'El PDF no tiene texto legible (posible documento escaneado).'
            }
          } catch (e) {
            conError += 1
            resumen = `No se pudo analizar: ${e instanceof Error ? e.message : 'error'}`
          }
        }

        const docente = ev?.docente?.trim() || docentePath || 'Sin docente'
        const mes = ev?.mes || mesPath || ''
        const doc: TicAuditoriaDoc = {
          id: genId('ticaud'),
          level,
          fileId: f.id,
          path: f.path,
          fileName: f.name,
          webUrl: f.webUrl,
          docente,
          mes,
          mesLabel: mesLabel(mes),
          tipo: ev?.tipo || tipoBase,
          resumen,
          herramientas: ev?.herramientas ?? [],
          evidencias: ev?.evidencias ?? [],
          fortalezas: ev?.fortalezas,
          mejoras: ev?.mejoras,
          puntaje,
          source,
          analizadoEn: new Date().toISOString(),
          analizadoPor: user?.displayName ?? '',
        }
        await docsCol.save(doc)
        ok += 1
      }

      toaster.dispatchToast(`Análisis completado: ${ok} documento(s)${conError ? `, ${conError} con error` : ''}.`, { intent: 'success' })
      if (nuevos.length > lote.length) {
        toaster.dispatchToast(`Quedan ${nuevos.length - lote.length} archivo(s) por analizar. Pulsa de nuevo «Analizar carpeta».`, { intent: 'info' })
      }
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setAnalizando(false)
      setProgreso('')
    }
  }

  const descargarInforme = () => {
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const rows = filtered
      .slice()
      .sort((a, b) => a.docente.localeCompare(b.docente, 'es') || a.mes.localeCompare(b.mes))
      .map((d) => `<tr><td>${esc(d.docente)}</td><td>${esc(d.mesLabel)}</td><td>${esc(d.tipo)}</td><td>${esc(d.fileName)}</td><td style="text-align:center">${d.source === 'ia' ? esc(d.puntaje) : '—'}</td><td>${esc(d.resumen)}</td></tr>`)
      .join('')
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Auditoría TIC Docentes · ${esc(level)}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:16mm;color:#111;font-size:10.5pt}h1{font-size:17pt;color:#0A4E63}h2{font-size:13pt;margin-top:16px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:5px;vertical-align:top}th{background:#0A4E63;color:#fff;text-align:left}.kpi{display:inline-block;border:1px solid #ddd;border-radius:8px;padding:8px 12px;margin-right:8px;margin-bottom:8px}.kpi b{display:block;font-size:16pt;color:#0A4E63}</style></head>
      <body>
      <h1>Auditoría TIC Docentes · Nivel ${esc(level)}</h1>
      <p>Fecha del informe: ${esc(new Date().toLocaleDateString('es-DO'))}</p>
      <div><span class="kpi">Docentes<b>${kpis.docentes}</b></span><span class="kpi">Evidencias<b>${kpis.evidencias}</b></span><span class="kpi">Puntaje promedio<b>${kpis.promedio}</b></span><span class="kpi">Meses cubiertos<b>${kpis.meses}</b></span></div>
      <h2>Detalle por docente</h2>
      <table><thead><tr><th>Docente</th><th>Mes</th><th>Tipo</th><th>Archivo</th><th>Puntaje</th><th>Resumen</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sin datos.</td></tr>'}</tbody></table>
      </body></html>`
    void downloadPlanPdf(html, `Auditoria_TIC_Docentes_${level}`)
  }

  return (
    <div>
      <PageHeader
        title="Auditoría TIC Docentes"
        subtitle="Evidencias mensuales del trabajo de los docentes TIC. Analiza la carpeta, mira los gráficos y filtra por docente y mes."
        actions={
          <Button appearance="secondary" icon={<ArrowDownloadRegular />} onClick={descargarInforme} disabled={filtered.length === 0}>Descargar informe (PDF)</Button>
        }
      />

      <TabList selectedValue={level} onTabSelect={(_, d) => { setLevel(d.value as TicNivel); setFDocente(''); setFMes(''); setQ('') }} style={{ marginBottom: '12px' }}>
        {NIVELES.map((n) => <Tab key={n} value={n}>{n}</Tab>)}
      </TabList>

      <Card className={styles.cfg}>
        <Text weight="semibold" size={400}><FolderRegular /> Carpeta de evidencias · {level}</Text>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormField label="Origen">
            <Select value={mode} onChange={(_, d) => setMode(d.value as 'onedrive' | 'share')} style={{ minWidth: '230px' }}>
              <option value="onedrive">Carpeta de mi OneDrive</option>
              <option value="share">Enlace compartido</option>
            </Select>
          </FormField>
          {mode === 'onedrive' ? (
            <FormField label="Carpeta (dentro de ArcaDeCristo)">
              <Input value={path} onChange={(_, d) => setPath(d.value)} placeholder="Ej.: Auditoria_TIC_Docentes" style={{ minWidth: '320px' }} />
            </FormField>
          ) : (
            <FormField label="Enlace compartido de la carpeta">
              <Input value={shareUrl} onChange={(_, d) => setShareUrl(d.value)} placeholder="https://…/shared?id=…" style={{ minWidth: '360px', flex: 1 }} />
            </FormField>
          )}
          <Button appearance="secondary" onClick={() => void guardarConfig()} disabled={savingCfg}>{savingCfg ? 'Guardando…' : 'Guardar configuración'}</Button>
          <Button appearance="primary" icon={analizando ? <Spinner size="tiny" /> : <ArrowSyncRegular />} onClick={() => void analizarCarpeta()} disabled={analizando}>
            {analizando ? 'Analizando…' : 'Analizar carpeta (buscar información nueva)'}
          </Button>
        </div>
        {progreso && <Text size={200} style={{ color: 'var(--texto-suave)' }}>{progreso}</Text>}
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>
          La IA identifica al docente y el mes de cada documento, aunque cada docente organice sus archivos de forma diferente. Al ejecutarlo de nuevo, se agregan los meses/informaciones futuras.
        </Text>
      </Card>

      <div className={styles.kpis}>
        <Card className={styles.kpi}><Text className={styles.value} block>{kpis.docentes}</Text><Text className={styles.label}>Docentes</Text></Card>
        <Card className={styles.kpi}><Text className={styles.value} block>{kpis.evidencias}</Text><Text className={styles.label}>Evidencias</Text></Card>
        <Card className={styles.kpi}><Text className={styles.value} block>{kpis.promedio}</Text><Text className={styles.label}>Puntaje promedio</Text></Card>
        <Card className={styles.kpi}><Text className={styles.value} block>{kpis.meses}</Text><Text className={styles.label}>Meses cubiertos</Text></Card>
        <Card className={styles.kpi}><Text className={styles.value} block>{kpis.sinAnalizar}</Text><Text className={styles.label}>Sin analizar</Text></Card>
      </div>

      <div className={styles.filters}>
        <Select value={fDocente} onChange={(_, d) => setFDocente(d.value)} style={{ minWidth: '220px' }}>
          <option value="">Todos los docentes</option>
          {docentes.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={fMes} onChange={(_, d) => setFMes(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los meses</option>
          {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </Select>
        <Input value={q} onChange={(_, d) => setQ(d.value)} placeholder="Buscar docente, archivo o resumen…" contentBefore={<SearchRegular />} style={{ minWidth: '260px', flex: 1 }} />
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>{filtered.length} de {docsNivel.length} evidencia(s)</Text>
      </div>

      {docsCol.loading ? (
        <Spinner label="Cargando evidencias…" />
      ) : docsNivel.length === 0 ? (
        <Card style={{ padding: '18px' }}>
          <Text block>Aún no hay evidencias analizadas para {level}.</Text>
          <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '6px' }}>
            Vincula la carpeta y pulsa «Analizar carpeta» para que la IA lea los documentos, identifique a cada docente y el mes, y construya el informe.
          </Text>
        </Card>
      ) : (
        <>
          <div className={styles.charts}>
            <Card className={styles.chart}>
              <Text weight="semibold" block style={{ marginBottom: '6px' }}>Puntaje promedio por docente</Text>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={porDocente} margin={{ top: 8, right: 8, left: -20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} />
                    <RTooltip />
                    <Bar dataKey="puntaje" fill="#0082AD" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className={styles.chart}>
              <Text weight="semibold" block style={{ marginBottom: '6px' }}>Evidencias por mes</Text>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={porMes} margin={{ top: 8, right: 8, left: -20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="evidencias" fill="#0A7C66" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className={styles.chart}>
              <Text weight="semibold" block style={{ marginBottom: '6px' }}>Distribución por tipo</Text>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={porTipo} dataKey="value" nameKey="name" outerRadius={95} label>
                      {porTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: '18px', maxHeight: '520px', overflowY: 'auto' }}>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Docente</TableHeaderCell>
                  <TableHeaderCell>Mes</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Archivo</TableHeaderCell>
                  <TableHeaderCell>Puntaje</TableHeaderCell>
                  <TableHeaderCell>Resumen</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><Text weight="semibold">{d.docente}</Text></TableCell>
                    <TableCell>{d.mesLabel}</TableCell>
                    <TableCell>{d.tipo}</TableCell>
                    <TableCell>
                      {d.webUrl ? <Button size="small" appearance="subtle" icon={<OpenRegular />} as="a" href={d.webUrl} target="_blank" rel="noopener noreferrer">{d.fileName}</Button> : d.fileName}
                    </TableCell>
                    <TableCell>{d.source === 'ia' ? d.puntaje : '—'}</TableCell>
                    <TableCell style={{ maxWidth: '420px' }}><Text size={200}>{d.resumen}</Text></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
