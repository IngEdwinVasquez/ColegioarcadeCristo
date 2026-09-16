import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Select, Spinner, Text, useToastController, makeStyles, tokens,
} from '@fluentui/react-components'
import {
  VideoRegular, ArrowRightRegular, ImageRegular, AddRegular, DeleteRegular, BookOpenRegular, ArrowUploadRegular,
} from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { cursoNombre, nivelShort, ordenarCursos, asignaturaDe, isRealSubject, gradoDe, seccionDe } from '../../utils/academic'
import { createClassTeam, listTenantTeams, resolveTeamUrl } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import { uploadFile, downloadFileAsDataUrl } from '../../services/onedrive'
import type { Enrollment, GradeSection, TeacherAssignment } from '../../types'

export const AULA_IMAGENES = [
  '/aulas/aula1.svg', '/aulas/aula2.svg', '/aulas/aula3.svg',
  '/aulas/aula4.svg', '/aulas/aula5.svg', '/aulas/aula6.svg',
]

export interface Aula {
  curso: string
  level: string
  nivel: string
  grado: string
  section: string
  imageUrl?: string
  imageRef?: string
  records: GradeSection[]
}

const hash = (s: string) => [...s].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7)
export const aulaImage = (aula: Aula) => aula.imageUrl || AULA_IMAGENES[hash(aula.curso) % AULA_IMAGENES.length]

// Caché en memoria: id de imagen en OneDrive → data URL (para renderizar en <img>).
const imgCache = new Map<string, string>()

/** Componente que resuelve y muestra la imagen del aula (subida o preset). */
export function AulaImg({ aula, className, style, alt }: { aula: Aula; className?: string; style?: CSSProperties; alt?: string }) {
  const [src, setSrc] = useState<string>(() => aula.imageUrl || (aula.imageRef ? imgCache.get(aula.imageRef) : '') || aulaImage(aula))
  useEffect(() => {
    if (aula.imageUrl) { setSrc(aula.imageUrl); return }
    const ref = aula.imageRef
    if (!ref) { setSrc(aulaImage(aula)); return }
    const cached = imgCache.get(ref)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(ref).then((data) => { imgCache.set(ref, data); if (alive) setSrc(data) }).catch(() => { if (alive) setSrc(aulaImage(aula)) })
    return () => { alive = false }
  }, [aula])
  return <img className={className} style={style} src={src} alt={alt ?? aula.curso} />
}

/** Agrupa los registros de Gestión académica en aulas (un aula por curso). */
export function aulasFromGrades(grades: GradeSection[]): Aula[] {
  const map = new Map<string, Aula>()
  for (const g of grades) {
    if (!isRealSubject(asignaturaDe(g))) continue
    const curso = cursoNombre(g)
    if (!curso) continue
    let a = map.get(curso)
    if (!a) {
      a = { curso, level: g.level, nivel: nivelShort(g.level), grado: gradoDe(g), section: seccionDe(g), records: [], imageUrl: undefined }
      map.set(curso, a)
    }
    a.records.push(g)
    if (!a.imageUrl && g.imageUrl) a.imageUrl = g.imageUrl
    if (!a.imageRef && g.imageRef) a.imageRef = g.imageRef
  }
  return ordenarCursos([...map.values()].map((a) => a.records[0])).map((g) => map.get(cursoNombre(g))!).filter(Boolean)
}

/** Id del catálogo de asignaturas correspondiente a un registro del curso. */
export const subjectIdOf = (record: GradeSection, subjects: { id: string; name: string }[]): string => {
  const name = asignaturaDe(record).trim().toLowerCase()
  return subjects.find((s) => s.name.trim().toLowerCase() === name)?.id ?? asignaturaDe(record)
}

/** Guarda la imagen en todos los registros del curso (url o referencia de OneDrive). */
async function guardarImagenCurso(records: GradeSection[], patch: { imageUrl?: string; imageRef?: string }) {
  for (const r of records) {
    const next: GradeSection = { ...r, ...patch }
    if (patch.imageUrl) next.imageRef = undefined
    if (patch.imageRef) next.imageUrl = undefined
    await dataService.saveGrade(next)
  }
}

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '18px' },
  card: { padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'transform .2s ease, box-shadow .2s ease', ':hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,130,173,0.18)' } },
  img: { width: '100%', height: '140px', objectFit: 'cover', display: 'block', background: tokens.colorNeutralBackground3 },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  imgWrap: { position: 'relative' },
  imgBtn: { position: 'absolute', top: '8px', right: '8px' },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chip: { padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontSize: '12px', fontWeight: 600 },
  link: { display: 'flex', alignItems: 'center', gap: '6px', color: '#0082AD', fontWeight: 700, fontSize: '13px' },
  subjGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '14px' },
  subjCard: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  preset: { border: '2px solid transparent', borderRadius: '10px', padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'none' },
})

/** Selector de imagen del aula (presets + URL). */
function AulaImagenModal({ aula, open, onClose, onSaved }: { aula: Aula | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles()
  const toaster = useToastController()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!aula) return null
  const aplicar = async (patch: { imageUrl?: string; imageRef?: string }, mensaje: string) => {
    setBusy(true)
    try {
      await guardarImagenCurso(aula.records, patch)
      onSaved()
      toaster.dispatchToast(mensaje, { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const subir = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const ref = await uploadFile('Aulas', file.name, file)
      try { imgCache.set(ref.id, await downloadFileAsDataUrl(ref.id)) } catch { /* se resolverá al mostrar */ }
      await guardarImagenCurso(aula.records, { imageRef: ref.id })
      onSaved()
      toaster.dispatchToast('Imagen subida y asignada al aula.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>Imagen del aula · {aula.curso}</DialogTitle>
          <DialogContent>
            <div style={{ marginBottom: '14px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <AulaImg aula={aula} style={{ width: '150px', height: '84px', objectFit: 'cover', borderRadius: '10px' }} />
              <div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subir(e.target.files?.[0])} />
                <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? 'Subiendo…' : 'Subir imagen desde mi equipo'}
                </Button>
                <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '6px' }}>Se guarda en OneDrive (carpeta «Aulas»).</Text>
              </div>
            </div>
            <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>O elige una imagen predeterminada:</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {AULA_IMAGENES.map((src) => (
                <button key={src} className={styles.preset} onClick={() => void aplicar({ imageUrl: src }, 'Imagen del aula actualizada.')} disabled={busy} title="Usar esta imagen">
                  <img src={src} alt="Imagen de aula" style={{ width: '100%', height: '92px', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
            <FormField label="O pega la URL de una imagen">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="dx-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/imagen.jpg" style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--borde)' }} />
                <Button appearance="primary" disabled={!url.trim() || busy} onClick={() => void aplicar({ imageUrl: url.trim() }, 'Imagen del aula actualizada.')}>Usar</Button>
              </div>
            </FormField>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>Cerrar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** Relaciona una asignatura con un aula de Teams existente. */
function TeamModal({ record, open, onClose, onSaved }: { record: GradeSection | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toaster = useToastController()
  const [teams, setTeams] = useState<Array<{ id: string; displayName: string }> | null>(null)
  const [teamId, setTeamId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) { setTeams(null); setTeamId(''); return }
    let alive = true
    void (async () => {
      setBusy(true)
      try {
        const list = await listTenantTeams()
        if (alive) setTeams(list)
      } catch (e) {
        if (alive) toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => { alive = false }
  }, [open, toaster])
  if (!record) return null
  const guardar = async () => {
    const team = teams?.find((t) => t.id === teamId)
    if (!team) return
    setBusy(true)
    try {
      const webUrl = await resolveTeamUrl(team.id)
      await dataService.saveGrade({ ...record, teamId: team.id, teamUrl: webUrl })
      onSaved()
      toaster.dispatchToast('Asignatura relacionada con el aula de Teams.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle>Relacionar con un aula de Teams · {asignaturaDe(record)}</DialogTitle>
          <DialogContent>
            {busy && !teams ? <Spinner label="Buscando aulas de Teams…" /> : (
              <FormField label="Aula de Teams">
                <Select value={teamId} onChange={(_, d) => setTeamId(d.value)}>
                  <option value="">— Selecciona un aula —</option>
                  {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                </Select>
              </FormField>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button appearance="primary" disabled={!teamId || busy} onClick={() => void guardar()}>Relacionar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** Panel de asignaturas de un aula, con acceso y gestión del aula de Teams. */
export function AulaSubjectsPanel({ subjects, canManage, onOpenSubject, onChanged }: {
  subjects: GradeSection[]
  canManage: boolean
  onOpenSubject?: (g: GradeSection) => void
  onChanged: () => void
}) {
  const styles = useStyles()
  const toaster = useToastController()
  const [teamRecord, setTeamRecord] = useState<GradeSection | null>(null)
  const [teamOpen, setTeamOpen] = useState(false)
  const [creando, setCreando] = useState<string | null>(null)

  const quitar = async (g: GradeSection) => {
    try {
      await dataService.saveGrade({ ...g, teamId: undefined, teamUrl: undefined })
      onChanged()
      toaster.dispatchToast('Relación con Teams eliminada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    }
  }
  const crear = async (g: GradeSection) => {
    setCreando(g.id)
    try {
      const team = await createClassTeam(g)
      await dataService.saveGrade({ ...g, teamId: team.teamId, teamUrl: team.webUrl })
      onChanged()
      toaster.dispatchToast('Aula de Teams creada y relacionada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setCreando(null)
    }
  }

  return (
    <>
      <div className={styles.subjGrid}>
        {subjects.map((g) => (
          <Card key={g.id} className={styles.subjCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg,#0082AD,#2AA9D8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpenRegular /></span>
              <Text weight="semibold" size={400}>{asignaturaDe(g)}</Text>
            </div>
            <div className={styles.actions}>
              {g.teamUrl ? (
                <>
                  <Button size="small" appearance="primary" icon={<VideoRegular />} as="a" href={g.teamUrl} target="_blank" rel="noopener noreferrer">Abrir Teams</Button>
                  {canManage && <Button size="small" appearance="secondary" icon={<DeleteRegular />} onClick={() => void quitar(g)}>Quitar relación</Button>}
                </>
              ) : canManage ? (
                <>
                  <Button size="small" appearance="secondary" icon={<AddRegular />} onClick={() => { setTeamRecord(g); setTeamOpen(true) }}>Relacionar Teams</Button>
                  <Button size="small" appearance="secondary" icon={<VideoRegular />} disabled={creando === g.id} onClick={() => void crear(g)}>
                    {creando === g.id ? 'Creando…' : 'Crear en Teams'}
                  </Button>
                </>
              ) : (
                <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin aula de Teams relacionada.</Text>
              )}
              {onOpenSubject && <Button size="small" appearance="outline" icon={<ArrowRightRegular />} onClick={() => onOpenSubject(g)}>Abrir</Button>}
            </div>
          </Card>
        ))}
      </div>
      <TeamModal record={teamRecord} open={teamOpen} onClose={() => setTeamOpen(false)} onSaved={onChanged} />
    </>
  )
}

export type AulaScope =
  | { kind: 'todos'; level?: string }
  | { kind: 'docente'; teacherId: string }
  | { kind: 'estudiante'; studentId: string }

/**
 * Vista de aulas (un aula por curso) con imagen y sus asignaturas.
 * - `todos`: todas las aulas (opcionalmente filtradas por nivel).
 * - `docente`: solo las aulas/asignaturas asignadas al docente.
 * - `estudiante`: solo las aulas de los cursos en que está matriculado.
 */
export function AulasView({ scope, subtitle, pageTitle = 'Aulas', onOpenSubject }: {
  scope: AulaScope
  subtitle?: string
  pageTitle?: string
  onOpenSubject?: (g: GradeSection) => void
}) {
  const styles = useStyles()
  const { grades, studentById, gradeById } = useApp()
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const [selected, setSelected] = useState<string | null>(null)
  const [imgAula, setImgAula] = useState<Aula | null>(null)

  const notas: GradeSection[] = gradesCol.items.length ? gradesCol.items : grades

  const aulas = useMemo(() => {
    const todas = aulasFromGrades(notas)
    if (scope.kind === 'todos') return scope.level ? todas.filter((a) => nivelShort(a.level) === scope.level) : todas
    if (scope.kind === 'docente') {
      const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
      return todas
        .map((a) => ({ ...a, records: a.records.filter((r) => ids.has(r.id)) }))
        .filter((a) => a.records.length > 0)
    }
    const cursos = new Set<string>()
    const st = studentById(scope.studentId)
    if (st?.gradeId) { const g = gradeById(st.gradeId) ?? notas.find((x) => x.id === st.gradeId); if (g) cursos.add(cursoNombre(g)) }
    for (const e of enrollmentsCol.items.filter((e) => e.studentId === scope.studentId)) {
      const g = gradeById(e.gradeId) ?? notas.find((x) => x.id === e.gradeId)
      if (g) cursos.add(cursoNombre(g))
    }
    return todas.filter((a) => cursos.has(a.curso))
  }, [notas, scope, assignmentsCol.items, enrollmentsCol.items, studentById, gradeById])

  const canManage = scope.kind !== 'estudiante'
  const seleccion = aulas.find((a) => a.curso === selected) ?? null

  return (
    <div>
      <PageHeader title={pageTitle} subtitle={subtitle ?? 'Aulas del colegio. Entre a un aula para ver y gestionar sus asignaturas.'} />
      {aulas.length === 0 ? (
        <EmptyStateView title="Sin aulas" message="No hay aulas disponibles para este usuario." icon={<VideoRegular />} />
      ) : (
        <div className={styles.grid}>
          {aulas.map((a) => (
            <Card key={a.curso} className={styles.card} onClick={() => setSelected(a.curso)}>
              <div className={styles.imgWrap}>
                <AulaImg aula={a} className={styles.img} />
                {canManage && (
                  <Button className={styles.imgBtn} size="small" appearance="secondary" icon={<ImageRegular />} onClick={(e) => { e.stopPropagation(); setImgAula(a) }} aria-label="Cambiar imagen" />
                )}
              </div>
              <div className={styles.body}>
                <Text weight="semibold" size={400}>{a.curso}</Text>
                <div className={styles.chips}>
                  <span className={styles.chip}>{a.nivel}</span>
                  <span className={styles.chip}>{a.records.length} asignatura(s)</span>
                </div>
                <span className={styles.link}>Abrir aula <ArrowRightRegular /></span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!seleccion} onOpenChange={(_, d) => { if (!d.open) setSelected(null) }}>
        <DialogSurface style={{ maxWidth: 960 }}>
          <DialogBody>
            <DialogTitle>Aula · {seleccion?.curso ?? ''}</DialogTitle>
            <DialogContent>
              {seleccion && (
                <>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <AulaImg aula={seleccion} style={{ width: '180px', height: '100px', objectFit: 'cover', borderRadius: '12px' }} />
                    <div>
                      <Text weight="semibold" size={500} block>{seleccion.curso}</Text>
                      <Text size={200} style={{ color: 'var(--texto-suave)' }}>{seleccion.nivel} · {seleccion.records.length} asignatura(s)</Text>
                    </div>
                    {canManage && <Button appearance="secondary" icon={<ImageRegular />} onClick={() => setImgAula(seleccion)}>Cambiar imagen</Button>}
                  </div>
                  <AulaSubjectsPanel
                    subjects={seleccion.records}
                    canManage={canManage}
                    onOpenSubject={onOpenSubject}
                    onChanged={() => { void gradesCol.refresh() }}
                  />
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <AulaImagenModal aula={imgAula} open={!!imgAula} onClose={() => setImgAula(null)} onSaved={() => { void gradesCol.refresh() }} />
    </div>
  )
}

/** Vista de aulas para el portal de estudiantes (solo lectura de asignaturas y Teams). */
export function StudentAulasView({ studentId }: { studentId: string }) {
  return <AulasView scope={{ kind: 'estudiante', studentId }} pageTitle="Mis Aulas" subtitle="Aulas y asignaturas en las que estás matriculado." />
}
