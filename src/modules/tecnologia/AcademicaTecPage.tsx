import { useState } from 'react'
import { Badge, Button, Checkbox, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, ArrowDownloadRegular, DeleteRegular, EditRegular, OpenRegular, PeopleTeamRegular, VideoRegular } from '@fluentui/react-icons'
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

/** Extrae la asignatura del nombre del curso (quita grado, sección y nivel). */
const asignaturaDe = (curso: GradeSection): string => {
  if (curso.asignatura) return curso.asignatura
  let s = curso.name
  const g = s.match(GRADO_RE)
  if (g) s = s.slice(g[0].length)
  s = s.replace(/^[.\- ]?[A-Ga-g][.\- ]+/, '')   // sección inicial (".A ", " A ", "-A ")
  s = s.replace(/^[.\- ]+/, '')                  // separadores
  s = s.replace(/^de\s+/i, '')                   // "de ..."
  s = s.replace(/\s*\[?copia\]?\s*$/i, '')       // "[copia]"
  s = s.replace(/^\s*(inicial|primaria|secundaria)\b\.?\s*/i, '') // nivel al inicio
  s = s.replace(/\s+/g, ' ').trim()
  return s || '—'
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

  return (
    <div>
      <PageHeader
        title="Gestión académica"
        subtitle="Cursos y secciones del colegio con su equipo de Microsoft Teams. Cada curso puede tener un equipo de clase donde se agregan el docente y los estudiantes."
        actions={
          <>
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
          {gradesCol.items.map((g) => (
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
