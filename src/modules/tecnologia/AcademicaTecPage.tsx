import { useState } from 'react'
import { Badge, Button, Checkbox, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, ArrowDownloadRegular, DeleteRegular, EditRegular, OpenRegular, PeopleTeamRegular, VideoRegular, PrintRegular, DocumentRegular, CopyRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { createClassTeam, listTenantTeams, resolveTeamUrl, type TeamInfo } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import type { GradeSection } from '../../types'
import { genId } from '../../utils/helpers'
import { appConfig } from '../../config/appConfig'

const useStyles = makeStyles({
  hint: { marginBottom: '14px', color: 'var(--texto-suave)' },
})

/** Deduce el nivel educativo a partir del nombre del curso o del equipo. */
export function detectLevel(name: string): string | null {
  const n = ` ${name.toLowerCase()} `
  if (/(inicial|kinder|kínder|pre\s*-?\s*primar|preescolar|maternal|nido|kids)/.test(n)) return 'Nivel Inicial'
  // "Secundaria", "1roSec.", "2do Sec", "media", "bachillerato", "liceo"
  if (/(secundaria|secundario|bachiller|liceo|\bmedia\b|sec\.|\bsec\b|\dro?\.?\s*sec)/.test(n)) return 'Nivel Secundario'
  if (/(primaria|primario|b[aá]sica)/.test(n)) return 'Nivel Primario'
  return null
}

const LEVEL_SHORT: Record<string, string> = {
  'Nivel Inicial': 'Inicial',
  'Nivel Primario': 'Primaria',
  'Nivel Secundario': 'Secundaria',
}

const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to']
const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const CICLOS = ['Primer ciclo', 'Segundo ciclo']

const nivelShort = (level: string) => LEVEL_SHORT[level] ?? level

// Grado en cualquier parte del nombre (1ro..6to y ordinales en palabras).
const GRADO_RE = /\b(1ro|2do|3ro|4to|5to|6to|primer|segundo|tercero|cuarto|quinto|sexto)\b/i
const ORD: Record<string, number> = { '1ro':1,'2do':2,'3ro':3,'4to':4,'5to':5,'6to':6, primer:1,segundo:2,tercero:3,cuarto:4,quinto:5,sexto:6 }
const GRADE_WORD = ['1ro','2do','3ro','4to','5to','6to']

/** Extrae la sección del curso de forma segura: campo `section` o una letra A–G como palabra independiente. */
const seccionDe = (curso: GradeSection): string => {
  if (curso.section) return curso.section.trim().toUpperCase()
  const m = curso.name.match(/\b([A-Ga-g])\b/)
  return m ? m[1].toUpperCase() : 'A'
}

/** Extrae el grado (normalizado a 1ro…6to) desde cualquier parte del nombre. */
const gradoDe = (curso: GradeSection): string => {
  const m = curso.name.match(GRADO_RE)
  if (!m) return ''
  const num = ORD[m[1].toLowerCase()]
  return (num && GRADE_WORD[num - 1]) || m[1]
}

const gradeNum = (grado: string) => ORD[grado.toLowerCase()] ?? (parseInt(grado, 10) || null)

/** Grado + sección (ej. 1ro.A). Si no hay grado, solo la sección. */
const cursoGrado = (curso: GradeSection): string => {
  const g = gradoDe(curso)
  const s = seccionDe(curso)
  return g ? `${g}.${s}` : s
}

/** Ciclo según el grado: 1-3 → Primer ciclo, 4-6 → Segundo ciclo (Primaria/Secundaria). */
const cicloFromGrade = (level: string, grado: string): string | undefined => {
  if (level !== 'Nivel Primario' && level !== 'Nivel Secundario') return undefined
  const n = gradeNum(grado)
  if (n == null) return undefined
  if (n >= 1 && n <= 3) return 'Primer ciclo'
  if (n >= 4 && n <= 6) return 'Segundo ciclo'
  return undefined
}

/** Extrae la asignatura limpia del nombre del curso (sin grado, sección, nivel ni anotaciones). */
const asignaturaDe = (curso: GradeSection): string => {
  if (curso.asignatura) return curso.asignatura
  let s = curso.name || ''
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ')          // (YOSSY VILLAFAÑA), (Geografía…)
  s = s.replace(/\s*\[[^\]]*\]\s*/g, ' ')          // [copia]
  s = s.replace(/\b1(?:ro|°|er|a)|2(?:do|da|°)|3(?:ro|°)|4(?:to|°)|5(?:to|°)|6(?:to|°)\b/gi, ' ')
  s = s.replace(/\b(primer|segundo|tercero|cuarto|quinto|sexto)\b/gi, ' ')
  s = s.replace(/\bde\s+(primaria|secundaria|inicial)\b/gi, ' ')
  s = s.replace(/\b(primaria|secundaria|inicial|nivel)\b\.?/gi, ' ')
  s = s.replace(/\b[.-]?\s*[A-G]\s*\b/g, ' ')      // secciones sueltas
  s = s.replace(/\d{4}\s*[–\-/]\s*\d{4}/g, ' ')    // años
  s = s.replace(/\d+/g, ' ')
  s = s.replace(/\b(colegio|del|el|la|los|las|arca|cristo|tripulaci|espacial|equipo|implementaci|aula|practica|pr[aá]ctica|encuentros|virtual|imple)\b/gi, ' ')
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ') // emojis
  s = s.replace(/[|·,;:()\[\]+\-_.]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Reconoce si un nombre es una asignatura real (por palabras clave curriculares). */
const isRealSubject = (name: string): boolean => {
  const n = name.toLowerCase()
  const keys = ['matemat','lengua','ciencias de la naturaleza','ciencia','ciencias social','sociales','social','educación físico','ed. f','educación art','artística','formación integral','formación','religiosa','inglés','ingles','english','francés','frances','informática','informatica','artes','música','musica','natural','humanidades','historia','geografía','geografia','física','fisica','química','quimica','biología','biologia','tecnolog']
  return keys.some((k) => n.includes(k))
}

/**
 * RM-008: gestión académica desde Tecnología — cursos y secciones con
 * creación y vinculación del equipo de Microsoft Teams de cada curso.
 */
export function AcademicaTecPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, enrollments } = useAcademicData()
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade, dataService.deleteGrade)

  const [editing, setEditing] = useState<GradeSection | null>(null)
  const [creatingTeam, setCreatingTeam] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [teams, setTeams] = useState<TeamInfo[] | null>(null)
  const [importSel, setImportSel] = useState<string[]>([])
  const [importLevel, setImportLevel] = useState('Nivel Primario')
  const [createTeamToo, setCreateTeamToo] = useState(true)
  const [importing, setImporting] = useState(false)
  const [gradoFilter, setGradoFilter] = useState('')
  const [seccionFilter, setSeccionFilter] = useState('')
  const [nivelFilter, setNivelFilter] = useState('')

  /** Abre el asistente de importación y carga los equipos existentes de Teams. */
  const openImport = async () => {
    setImportOpen(true)
    setImportSel([])
    if (teams === null) {
      try {
        setTeams(await listTenantTeams())
      } catch (error) {
        setTeams([])
        toaster.dispatchToast(`No se pudieron listar los equipos: ${graphErrorMessage(error)}`, { intent: 'error' })
      }
    }
  }

  /** Crea (o vincula, si existe un curso con el mismo nombre) los equipos elegidos. */
  const runImport = async () => {
    if (importSel.length === 0) return
    setImporting(true)
    let creados = 0
    let vinculados = 0
    try {
      for (const teamId of importSel) {
        const team = (teams ?? []).find((t) => t.id === teamId)
        if (!team) continue
        const name = team.displayName.replace(new RegExp(`^${appConfig.shortName}\\s*·\\s*`, 'i'), '').trim()
        const url = await resolveTeamUrl(teamId)
        const existing = gradesCol.items.find((g) => g.name.trim().toLowerCase() === name.toLowerCase())
        if (existing) {
          await gradesCol.save({ ...existing, teamId, teamUrl: url })
          vinculados++
        } else {
          // El nivel se detecta por el nombre (inicial/primaria/secundaria); si no, se usa el elegido.
          await gradesCol.save({ id: genId('g'), name, level: detectLevel(team.displayName) ?? importLevel, teamId, teamUrl: url })
          creados++
        }
      }
      toaster.dispatchToast(`Importación completada: ${creados} curso(s) creado(s), ${vinculados} vinculado(s) a su equipo`, { intent: 'success' })
      setImportOpen(false)
    } catch (error) {
      toaster.dispatchToast(`Error al importar: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setImporting(false)
    }
  }

  const linkedTeamIds = gradesCol.items.map((g) => g.teamId ?? '').filter(Boolean)

  /** Solo cursos que corresponden a una asignatura real (filtra "Equipo de implementación", etc.). */
  const cursos = gradesCol.items.filter((g) => isRealSubject(asignaturaDe(g)))
  const ignorados = gradesCol.items.length - cursos.length
  const cursosFiltrados = (gradoFilter || seccionFilter || nivelFilter)
    ? cursos.filter((g) =>
        (!gradoFilter || gradoDe(g).toLowerCase() === gradoFilter.toLowerCase()) &&
        (!seccionFilter || seccionDe(g) === seccionFilter) &&
        (!nivelFilter || nivelShort(g.level) === nivelFilter))
    : cursos

  /** Base64 del logo institucional (para PDF y Excel). */
  const getLogo = async (): Promise<string> => {
    try {
      const res = await fetch('/images/logo-arca.jpg')
      if (!res.ok) return ''
      const blob = await res.blob()
      return await new Promise<string>((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => resolve('')
        r.readAsDataURL(blob)
      })
    } catch {
      return ''
    }
  }

  /** Genera e imprime (PDF) la lista de asignaturas por grado. */
  const generarPdf = async () => {
    const logo = await getLogo()
    const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = cursosFiltrados.map((g) => `<tr><td>${esc(asignaturaDe(g))}</td><td>${esc(nivelShort(g.level))}</td><td>${esc(g.ciclo || cicloFromGrade(g.level, gradoDe(g)) || '—')}</td><td>${esc(cursoGrado(g))}</td><td>${esc(seccionDe(g))}</td><td>${studentCount(g.id)}</td></tr>`).join('')
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Asignaturas por grado</title><style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1B2430;max-width:900px;margin:24px auto;padding:0 20px}
      .hdr{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0082AD;padding-bottom:10px;margin-bottom:12px}
      .hdr img{width:60px;height:60px;object-fit:contain}
      .hdr .n{font-weight:800;color:#0A1F2B;font-size:20px}
      .hdr .i{color:#667085;font-size:12px}
      h1{color:#0A1F2B;font-size:20px;margin:4px 0 2px}
      .sub{color:#667085;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#0A1F2B;color:#fff;padding:8px 10px;text-align:left;font-size:12px;text-transform:uppercase}
      td{border:1px solid #E2E8F0;padding:7px 10px;font-size:13px}
      tr:nth-child(even) td{background:#F8FAFC}
      .marca{font-size:11px;color:#667085;text-align:center;margin-top:20px;border-top:1px solid #E2E8F0;padding-top:8px}
    </style></head><body>
    <div class="hdr">${logo ? `<img src="${logo}" alt="Escudo"/>` : ''}<div><div class="n">${esc(appConfig.shortName)}</div><div class="i">${esc(appConfig.institution)}</div></div></div>
    <h1>Asignaturas por grado</h1>
    <div class="sub">${nivelFilter ? `Nivel: ${nivelFilter}` : 'Todos los niveles'}${gradoFilter ? ` · Grado: ${gradoFilter}` : ''}${seccionFilter ? ` · Sección ${seccionFilter}` : ''} · Generado ${new Date().toLocaleDateString('es-DO')}</div>
    <table><thead><tr><th>Asignatura</th><th>Nivel</th><th>Ciclo</th><th>Grado/curso</th><th>Sección</th><th>Estudiantes</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="marca">Generado por la Intranet ${esc(appConfig.shortName)}</p>
    </body></html>`
    const w = window.open('', '_blank', 'noopener,width=960,height=720')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  /** Exporta la lista de asignaturas por grado a Excel (.xls). */
  const exportarExcel = async () => {
    const esc = (s: string) => (s ?? '').replace(/"/g, '""')
    const rows = cursosFiltrados.map((g) => `<tr><td>${esc(asignaturaDe(g))}</td><td>${esc(nivelShort(g.level))}</td><td>${esc(g.ciclo || cicloFromGrade(g.level, gradoDe(g)) || '')}</td><td>${esc(cursoGrado(g))}</td><td>${esc(seccionDe(g))}</td><td>${studentCount(g.id)}</td></tr>`).join('')
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Asignatura</th><th>Nivel</th><th>Ciclo</th><th>Grado/curso</th><th>Sección</th><th>Estudiantes</th></tr>${rows}</table></body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Asignaturas_por_grado_${gradoFilter || 'Todos'}_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** Nivel detectado por equipo, para mostrarlo y para el resumen del asistente. */
  const levelSummary = (() => {
    const counts = { 'Nivel Inicial': 0, 'Nivel Primario': 0, 'Nivel Secundario': 0, sin: 0 }
    for (const t of teams ?? []) {
      const lvl = detectLevel(t.displayName)
      if (lvl) counts[lvl as keyof typeof counts]++
      else counts.sin++
    }
    return counts
  })()

  const studentCount = (gradeId: string) => {
    const byEnrollment = enrollments.filter((e) => e.gradeId === gradeId).map((e) => e.studentId)
    const direct = students.filter((s) => s.gradeId === gradeId).map((s) => s.id)
    return new Set([...byEnrollment, ...direct]).size
  }

  const save = async (g: GradeSection) => {
    // Normaliza: nombre = grado.sección (ej. 1ro.A), asignatura separada y ciclo por grado.
    const seccion = g.section || seccionDe(g)
    const grado = gradoDe(g) || '1ro'
    const nombre = `${grado}.${seccion}`
    const asignatura = (g.asignatura || asignaturaDe(g)) === '—' ? '' : g.asignatura || asignaturaDe(g)
    const next: GradeSection = {
      ...g,
      name: nombre,
      section: seccion,
      nivel: (g.level || (detectLevel(g.name) ?? 'Nivel Primario')).replace('Nivel ', ''),
      level: g.level || (detectLevel(g.name) ?? 'Nivel Primario'),
      asignatura: asignatura,
      ciclo: g.ciclo || cicloFromGrade(g.level || (detectLevel(g.name) ?? 'Nivel Primario'), grado),
    }
    if (!next.name.trim()) {
      toaster.dispatchToast('Indique el nombre del curso.', { intent: 'error' })
      return
    }
    try {
      const isNew = !gradesCol.items.some((x) => x.id === g.id)
      // Crear el curso también en Teams en el mismo paso.
      let saved: GradeSection = next
      if (isNew && createTeamToo && !saved.teamId) {
        try {
          const team = await createClassTeam(saved)
          saved = { ...saved, teamId: team.teamId, teamUrl: team.webUrl }
        } catch (error) {
          toaster.dispatchToast(`El curso se guardará, pero el equipo de Teams falló: ${graphErrorMessage(error)}`, { intent: 'warning' })
        }
      }
      await gradesCol.save(saved)
      toaster.dispatchToast(saved.teamId ? 'Curso guardado con su equipo de Teams' : 'Curso guardado', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  const crearEquipo = async (g: GradeSection) => {
    setCreatingTeam(g.id)
    try {
      const team = await createClassTeam(g)
      await gradesCol.save({ ...g, teamId: team.teamId, teamUrl: team.webUrl })
      toaster.dispatchToast(`Equipo de Teams creado para ${g.name}. Agregue docentes y estudiantes desde Teams.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo crear el equipo: ${graphErrorMessage(error)}. Verifique el permiso Team.Create y su licencia de Teams.`, { intent: 'error' })
    } finally {
      setCreatingTeam(null)
    }
  }

  /** Duplica un curso (misma asignatura/grado, nuevo id y sin equipo de Teams). */
  const duplicar = async (g: GradeSection) => {
    const copia: GradeSection = {
      ...g,
      id: genId('g'),
      name: `${g.name} [copia]`,
      teamId: undefined,
      teamUrl: undefined,
      ciclo: g.ciclo || cicloFromGrade(g.level, gradoDe(g)),
    }
    await gradesCol.save(copia)
    toaster.dispatchToast(`Asignatura duplicada: ${asignaturaDe(copia)} · ${cursoGrado(copia)}`, { intent: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Gestión académica"
        subtitle="Cursos y secciones del colegio con su equipo de Microsoft Teams. Cada curso puede tener un equipo de clase donde se agregan el docente y los estudiantes."
        actions={
          <>
            <Button appearance="secondary" icon={<PrintRegular />} onClick={() => void generarPdf()} disabled={cursosFiltrados.length === 0}>
              Generar PDF
            </Button>
            <Button appearance="secondary" icon={<DocumentRegular />} onClick={() => void exportarExcel()} disabled={cursosFiltrados.length === 0}>
              Exportar Excel
            </Button>
            <Button appearance="secondary" icon={<ArrowDownloadRegular />} onClick={() => void openImport()}>
              Importar desde Teams
            </Button>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing({ id: genId('g'), name: '1ro.A', level: 'Nivel Primario', section: 'A' })}>
              Nuevo curso
            </Button>
          </>
        }
      />
      <Text size={300} block className={styles.hint}>
        Al pulsar «Crear equipo de Teams» se genera un equipo de clase (plantilla educativa) con usted como propietario; los miembros se administran desde Teams.
      </Text>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        <Text size={300}>Filtrar por:</Text>
        <Select value={nivelFilter} onChange={(_, d) => setNivelFilter(d.value)} style={{ minWidth: '150px' }}>
          <option value="">Todos los niveles</option>
          <option value="Inicial">Inicial</option>
          <option value="Primaria">Primaria</option>
          <option value="Secundaria">Secundaria</option>
        </Select>
        <Select value={gradoFilter} onChange={(_, d) => setGradoFilter(d.value)} style={{ minWidth: '140px' }}>
          <option value="">Todos los grados</option>
          {GRADOS.map((grado) => (<option key={grado} value={grado}>{grado}</option>))}
        </Select>
        <Select value={seccionFilter} onChange={(_, d) => setSeccionFilter(d.value)} style={{ minWidth: '130px' }}>
          <option value="">Todas las secciones</option>
          {SECCIONES.map((s) => (<option key={s} value={s}>Sección {s}</option>))}
        </Select>
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>{cursosFiltrados.length} asignatura(s)</Text>
      </div>

      <Table aria-label="Cursos">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Nivel</TableHeaderCell>
            <TableHeaderCell>Ciclo</TableHeaderCell>
            <TableHeaderCell>Grado/curso</TableHeaderCell>
            <TableHeaderCell>Sección</TableHeaderCell>
            <TableHeaderCell>Estudiantes</TableHeaderCell>
            <TableHeaderCell>Microsoft Teams</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cursosFiltrados.map((g) => (
            <TableRow key={g.id}>
              <TableCell><Text weight="semibold">{asignaturaDe(g)}</Text></TableCell>
              <TableCell>{nivelShort(g.level)}</TableCell>
              <TableCell>{g.ciclo || cicloFromGrade(g.level, gradoDe(g)) || '—'}</TableCell>
              <TableCell>{cursoGrado(g)}</TableCell>
              <TableCell>{seccionDe(g)}</TableCell>
              <TableCell><Badge appearance="tint" color="brand" icon={<PeopleTeamRegular />}>{studentCount(g.id)}</Badge></TableCell>
              <TableCell>
                {g.teamId ? (
                  <Button size="small" appearance="outline" icon={<OpenRegular />} onClick={() => window.open(g.teamUrl, '_blank', 'noopener')}>
                    Abrir equipo
                  </Button>
                ) : (
                  <Button
                    size="small"
                    appearance="secondary"
                    icon={creatingTeam === g.id ? <Spinner size="tiny" /> : <VideoRegular />}
                    disabled={creatingTeam !== null}
                    onClick={() => void crearEquipo(g)}
                  >
                    {creatingTeam === g.id ? 'Creando…' : 'Crear equipo de Teams'}
                  </Button>
                )}
              </TableCell>
              <TableCell>
                <Toolbar size="small">
                  <ToolbarButton icon={<CopyRegular />} onClick={() => void duplicar(g)}>Duplicar</ToolbarButton>
                  <ToolbarButton icon={<EditRegular />} onClick={() => setEditing({ ...g })}>Editar</ToolbarButton>
                  <ToolbarButton
                    icon={<DeleteRegular />}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el curso ${g.name}? (el equipo de Teams, si existe, no se elimina)`)) void gradesCol.remove(g.id)
                    }}
                  >
                    Eliminar
                  </ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!gradesCol.loading && gradesCol.items.length === 0 && (
        <Text size={300} block style={{ marginTop: '12px', color: 'var(--texto-suave)' }}>Cree los cursos del colegio para vincularlos con Teams.</Text>
      )}
      {!gradesCol.loading && ignorados > 0 && (
        <Text size={200} block style={{ marginTop: '10px', color: 'var(--texto-suave)' }}>Se ocultaron {ignorados} curso(s) sin nombre de asignatura (por ejemplo equipos, aulas de práctica u otros). Puede editarlos si desea reasignarles una asignatura.</Text>
      )}

      {/* -------- Importar equipos de Teams como cursos -------- */}
      <ModalForm
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar cursos desde Microsoft Teams"
        subtitle="Seleccione los equipos que corresponden a cursos del colegio; se crearán (o se vincularán si el curso ya existe) con acceso directo a la clase."
        actions={
          <>
            <Button appearance="secondary" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void runImport()} disabled={importing || importSel.length === 0}>
              {importing ? 'Importando…' : `Importar ${importSel.length} equipo(s)`}
            </Button>
          </>
        }
      >
        {teams === null ? (
          <Spinner label="Leyendo equipos de Microsoft Teams…" />
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <Badge appearance="filled" style={{ background: '#9A9C2E', color: '#fff' }}>Inicial: {levelSummary['Nivel Inicial']}</Badge>
              <Badge appearance="filled" style={{ background: '#0095C8', color: '#fff' }}>Primaria: {levelSummary['Nivel Primario']}</Badge>
              <Badge appearance="filled" style={{ background: '#7D1D24', color: '#fff' }}>Secundaria: {levelSummary['Nivel Secundario']}</Badge>
              <Badge appearance="filled" style={{ background: '#475569', color: '#fff' }}>Sin detectar: {levelSummary.sin}</Badge>
            </div>
            <MultiSelect
              label={`Equipos disponibles (${teams.length})`}
              placeholder="Filtrar equipos… (p. ej. primaria, secundaria, inicial)"
              options={teams.map((t) => {
                const lvl = detectLevel(t.displayName)
                const marca = lvl ? LEVEL_SHORT[lvl] : '¿nivel?'
                return {
                  id: t.id,
                  label: t.displayName,
                  detail: linkedTeamIds.includes(t.id) ? 'ya vinculado' : `${marca}${t.description ? ' · ' + t.description.slice(0, 40) : ''}`,
                }
              })}
              selected={importSel}
              onChange={(ids) => setImportSel(ids.filter((id) => !linkedTeamIds.includes(id)))}
              emptyMessage="No se encontraron equipos de Teams. Verifique los permisos Team.ReadBasic.All / Directory.Read.All."
            />
            <FormField label="Nivel si no se puede detectar por el nombre">
              <Select value={importLevel} onChange={(_, d) => setImportLevel(d.value)}>
                <option value="Nivel Inicial">Nivel Inicial</option>
                <option value="Nivel Primario">Nivel Primario</option>
                <option value="Nivel Secundario">Nivel Secundario</option>
              </Select>
            </FormField>
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
              El nivel (Inicial / Primaria / Secundaria) se detecta automáticamente por el nombre del equipo; si no es posible, se usa el nivel elegido arriba. Los equipos «ya vinculado» pertenecen a un curso existente; los de igual nombre se vinculan sin duplicarse. Use la casilla junto al filtro para marcar todos.
            </Text>
          </div>
        )}
      </ModalForm>

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing && gradesCol.items.some((x) => x.id === editing.id) ? `Editar · ${editing.name}` : 'Nuevo curso'}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => editing && void save(editing)} disabled={gradesCol.saving}>{gradesCol.saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        {editing && (
          <div>
            <FieldRow>
              <FormField label="Nivel" required>
                <Select value={editing.level} onChange={(_, d) => setEditing({ ...editing, level: d.value })}>
                  <option value="Nivel Inicial">Inicial</option>
                  <option value="Nivel Primario">Primaria</option>
                  <option value="Nivel Secundario">Secundaria</option>
                </Select>
              </FormField>
              {(editing.level === 'Nivel Primario' || editing.level === 'Nivel Secundario') && (
                <FormField label="Ciclo">
                  <Select value={editing.ciclo ?? ''} onChange={(_, d) => setEditing({ ...editing, ciclo: d.value || undefined })}>
                    <option value="">Sin ciclo</option>
                    {CICLOS.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </Select>
                </FormField>
              )}
            </FieldRow>
            <FieldRow>
              <FormField label="Grado" required>
                <Select value={gradoDe(editing)} onChange={(_, d) => setEditing({ ...editing, name: `${d.value}.${editing.section || seccionDe(editing)}`, section: editing.section || seccionDe(editing) })}>
                  { (GRADOS.includes(gradoDe(editing)) ? GRADOS : [gradoDe(editing), ...GRADOS]).map((grado) => (<option key={grado} value={grado}>{grado}</option>)) }
                </Select>
              </FormField>
              <FormField label="Sección" required>
                <Select value={editing.section || seccionDe(editing)} onChange={(_, d) => setEditing({ ...editing, section: d.value, name: `${gradoDe(editing)}.${d.value}` })}>
                  {SECCIONES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </Select>
              </FormField>
            </FieldRow>
            <FormField label="Nombre del curso" hint="Se construye automáticamente con grado + sección (ej. 1ro.A). Puede ajustarlo.">
              <Input value={editing.name} onChange={(_, d) => setEditing({ ...editing, name: d.value })} placeholder="Ej. 1ro.A" />
            </FormField>
            {!gradesCol.items.some((x) => x.id === editing.id) && (
              <Checkbox
                checked={createTeamToo}
                onChange={(_, d) => setCreateTeamToo(!!d.checked)}
                label="Crear también el equipo de clase en Microsoft Teams"
              />
            )}
          </div>
        )}
      </ModalForm>
    </div>
  )
}

function useAcademicData() {
  const { students } = useApp()
  const enrollmentsCol = useCollection(dataService.getEnrollments)
  return { students, enrollments: enrollmentsCol.items }
}
