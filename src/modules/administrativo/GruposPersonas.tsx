import { useMemo, useState, type ReactNode } from 'react'
import { Button, Card, Input, ProgressBar, Select, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList, Tooltip as RTooltip } from 'recharts'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { GRADOS, cursoNombre, gradoDe, seccionDe, nivelShort, nivelDeTanda, isRealSubject, asignaturaDe, ordenarCursos } from '../../utils/academic'
import { PERSON_GROUPS, peopleInGroup, transferPerson, type PersonRef } from '../../services/personGroups'
import type { Enrollment, GradeSection, Persona, SigerdReport, Student, StudentGuardian, Teacher } from '../../types'

const GRADO_WORDS: Record<string, number> = {
  '1ro': 1, '1er': 1, primero: 1, primer: 1, '2do': 2, segundo: 2, '3ro': 3, tercero: 3, '4to': 4, cuarto: 4, '5to': 5, quinto: 5, '6to': 6, sexto: 6,
}
const numGrado = (g?: string): number | null => {
  const t = ` ${(g ?? '').toLowerCase()} `
  for (const [k, v] of Object.entries(GRADO_WORDS)) if (t.includes(k)) return v
  const m = (g ?? '').match(/\b([1-6])\b/)
  return m ? Number(m[1]) : null
}

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '16px' },
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' },
  count: { fontWeight: 800, fontSize: '24px' },
  row: { display: 'flex', gap: '8px' },
})

/**
 * Panel "Grupos de personas": un cuadro por grupo (rol) con la cantidad, un gráfico,
 * un buscador para ver los nombres y la opción de transferir una persona a otro grupo.
 */
/** Cuadro informativo (cantidad + gráfico + búsqueda por nombre) para un grupo de estudiantes. */
function MiniGroupCard({ label, color, people, total, max = 0, distribucion, action, rowAction }: { label: string; color: string; people: Array<{ id: string; fullName: string }>; total: number; max?: number; distribucion?: Array<{ name: string; value: number }>; action?: ReactNode; rowAction?: (p: { id: string; fullName: string }) => ReactNode }) {
  const styles = useStyles()
  const [q, setQ] = useState('')
  const filt = q ? people.filter((p) => p.fullName.toLowerCase().includes(q.toLowerCase())) : people
  const tieneDist = !!distribucion && distribucion.some((d) => d.value > 0)
  const colores = [color, '#7FB069', '#EF6C00']
  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <Text weight="semibold" size={400}>{label}</Text>
        <span className={styles.count} style={{ color }}>{people.length}</span>
      </div>
      {tieneDist ? (
        <ResponsiveContainer width="100%" height={132}>
          <BarChart data={distribucion} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <XAxis dataKey="name" fontSize={10} interval={0} />
            <YAxis allowDecimals={false} fontSize={10} />
            <RTooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {distribucion!.map((d, i) => <Cell key={d.name} fill={colores[i % colores.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ padding: '14px 4px 8px' }}>
          <ProgressBar value={max ? Math.min(people.length / max, 1) : 0} color="brand" thickness="large" />
          <Text size={200} block style={{ marginTop: '8px', color: 'var(--texto-suave)' }}>
            {people.length} de {total} ({total ? Math.round((people.length / total) * 100) : 0}%)
          </Text>
        </div>
      )}
      <Input placeholder="Filtrar por nombre…" value={q} onChange={(_, d) => setQ(d.value)} />
      <div style={{ maxHeight: '160px', overflow: 'auto', border: '1px solid var(--borde)', borderRadius: '6px', padding: '6px 10px' }}>
        {filt.length === 0
          ? <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin resultados.</Text>
          : filt.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '3px 0' }}>
              <Text size={200}>{p.fullName}</Text>
              {rowAction?.(p)}
            </div>
          ))}
      </div>
      {action}
    </Card>
  )
}

export function GruposPersonas({ scopeIds, levelFilter }: { scopeIds?: Set<string> | null; levelFilter?: string }) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const teachersCol = useCollection<Teacher>(dataService.getTeachers, dataService.saveTeacher)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians, dataService.saveGuardian)
  const personasCol = useCollection<Persona>(dataService.getPersonas, dataService.savePersona)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports)
  const [matriculando, setMatriculando] = useState(false)
  const [asig, setAsig] = useState<Record<string, string>>({})
  const inScope = (gradeId?: string) => !scopeIds || (!!gradeId && scopeIds.has(gradeId))

  // Clasificación robusta del nivel (curso o, si falta, el SIGERD).
  const norm = (v?: string | null): string => {
    const s = (v ?? '').toLowerCase()
    if (s.includes('inicial')) return 'Inicial'
    if (s.includes('primar')) return 'Primaria'
    if (s.includes('secund')) return 'Secundaria'
    return ''
  }
  const nivelDeCurso = (g?: GradeSection) => (g ? norm(g.level) || norm(g.nivel) || norm(g.name) : '')
  const nivelDeEstudiante = (s: Student): string => {
    const porCurso = nivelDeCurso(s.gradeId ? grades.find((x) => x.id === s.gradeId) : undefined)
    if (porCurso) return porCurso
    const rep = s.sigerdReportId ? reportsCol.items.find((r) => r.id === s.sigerdReportId) : undefined
    return norm(s.sigerd?.nivel) || norm(rep?.nivel) || norm(nivelDeTanda(rep?.header.tandaServicio))
  }

  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<Record<string, string>>({})

  const data = useMemo(
    () => ({
      students: studentsCol.items.filter((s) => (levelFilter ? nivelDeEstudiante(s) === levelFilter : inScope(s.gradeId))),
      teachers: teachersCol.items.filter((t) => (levelFilter
        ? t.grades.some((id) => nivelDeCurso(grades.find((x) => x.id === id)) === levelFilter)
        : (!scopeIds || t.grades.some((g) => scopeIds.has(g))))),
      guardians: guardiansCol.items.filter((g) => {
        const st = studentsCol.items.find((s) => s.id === g.studentId)
        if (levelFilter) return !!st && nivelDeEstudiante(st) === levelFilter
        if (!scopeIds) return true
        return !!st && inScope(st.gradeId)
      }),
      personas: personasCol.items,
    }),
    [studentsCol.items, teachersCol.items, guardiansCol.items, personasCol.items, scopeIds, levelFilter, grades, reportsCol.items],
  )
  const total = data.students.length + data.teachers.length + data.guardians.length + data.personas.length

  // Nivel de una persona (para el gráfico por nivel de cada grupo).
  const nivelPersona = (ref: PersonRef): string => {
    if (ref.kind === 'estudiante') { const s = studentsCol.items.find((x) => x.id === ref.id); return s ? nivelDeEstudiante(s) : '' }
    if (ref.kind === 'docente') { const t = teachersCol.items.find((x) => x.id === ref.id); return t ? (t.grades.map((id) => nivelDeCurso(grades.find((x) => x.id === id))).find((n) => !!n) ?? '') : '' }
    if (ref.kind === 'padre') { const g = guardiansCol.items.find((x) => x.id === ref.id); const s = g ? studentsCol.items.find((x) => x.id === g.studentId) : undefined; return s ? nivelDeEstudiante(s) : '' }
    return ''
  }
  const distribucionDe = (refs: PersonRef[]): Array<{ name: string; value: number }> | undefined => {
    const c: Record<string, number> = { Inicial: 0, Primaria: 0, Secundaria: 0 }
    for (const ref of refs) { const n = nivelPersona(ref); if (n in c) c[n] += 1 }
    return Object.values(c).some((v) => v > 0) ? Object.entries(c).map(([name, value]) => ({ name, value })) : undefined
  }
  const maxGroup = Math.max(1, ...PERSON_GROUPS.map((g) => peopleInGroup(g, data).length))

  const distNivel = (list: Student[]): Array<{ name: string; value: number }> | undefined => {
    const c: Record<string, number> = { Inicial: 0, Primaria: 0, Secundaria: 0 }
    for (const s of list) { const n = nivelDeEstudiante(s); if (n in c) c[n] += 1 }
    return Object.values(c).some((v) => v > 0) ? Object.entries(c).map(([name, value]) => ({ name, value })) : undefined
  }

  const activePeriod = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''
  const matriculados = useMemo(() => {
    const ids = new Set(enrollmentsCol.items.filter((e) => !activePeriod || e.periodId === activePeriod).map((e) => e.studentId))
    return data.students.filter((s) => ids.has(s.id))
  }, [data.students, enrollmentsCol.items, activePeriod])
  const noMatriculados = useMemo(() => {
    const ids = new Set(matriculados.map((s) => s.id))
    return data.students.filter((s) => !ids.has(s.id))
  }, [data.students, matriculados])

  const cursos = useMemo(() => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => cursoNombre(g)), [grades])
  const seleccionados = Object.entries(asig).filter(([, c]) => c)

  /** Matricula a los estudiantes seleccionados en el curso indicado por cada uno. */
  const matricularSeleccionados = async () => {
    if (!activePeriod) { toaster.dispatchToast('No hay un período activo.', { intent: 'error' }); return }
    setMatriculando(true)
    try {
      let ok = 0
      for (const [studentId, cursoSel] of seleccionados) {
        const grade = grades.find((g) => cursoNombre(g) === cursoSel)
        if (!grade) continue
        const st = studentsCol.items.find((s) => s.id === studentId)
        await dataService.saveEnrollment({ id: genId('enr'), studentId, gradeId: grade.id, periodId: activePeriod })
        if (st && st.gradeId !== grade.id) await dataService.saveStudent({ ...st, gradeId: grade.id })
        ok += 1
      }
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh()])
      setAsig({})
      toaster.dispatchToast(`${ok} estudiante(s) matriculado(s).`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setMatriculando(false)
    }
  }

  /** Determina el curso del estudiante con la evidencia existente (curso asignado o registro SIGERD). */
  const cursoEvidente = (s: Student): GradeSection | undefined => {
    const directo = s.gradeId ? grades.find((g) => g.id === s.gradeId) : undefined
    if (directo) return directo
    const sg = s.sigerd
    const rep = s.sigerdReportId ? reportsCol.items.find((r) => r.id === s.sigerdReportId) : undefined
    const n = numGrado(sg?.grado) ?? numGrado(rep?.header.grado)
    if (!n) return undefined
    const sec = (sg?.seccion || rep?.header.seccion || '').trim().toUpperCase()
    const nivel = sg?.nivel || rep?.nivel || nivelDeTanda(rep?.header.tandaServicio) || undefined
    const exacto = grades.find((g) => cursoNombre(g) === `${GRADOS[n - 1]}.${sec}${nivel ? ` · ${nivelShort(nivel)}` : ''}`)
    if (exacto) return exacto
    return grades.find((g) => gradoDe(g) === GRADOS[n - 1] && seccionDe(g) === sec && (!nivel || g.level === nivel || nivelShort(g.level) === nivelShort(nivel)))
      ?? grades.find((g) => gradoDe(g) === GRADOS[n - 1] && seccionDe(g) === sec)
  }

  /** Matricula a los no matriculados solo cuando hay evidencia del curso (asignado o SIGERD). */
  const matricularNoMatriculados = async () => {
    if (!activePeriod) { toaster.dispatchToast('No hay un período activo.', { intent: 'error' }); return }
    if (!window.confirm(`¿Intentar matricular a los ${noMatriculados.length} estudiantes no matriculados usando la evidencia del curso/SIGERD? Solo se matricularán los que tengan curso identificable.`)) return
    setMatriculando(true)
    try {
      let ok = 0
      let sinEvidencia = 0
      for (const s of noMatriculados) {
        const curso = cursoEvidente(s)
        if (!curso) { sinEvidencia += 1; continue }
        await dataService.saveEnrollment({ id: genId('enr'), studentId: s.id, gradeId: curso.id, periodId: activePeriod })
        if (s.gradeId !== curso.id) await dataService.saveStudent({ ...s, gradeId: curso.id })
        ok += 1
      }
      await Promise.all([studentsCol.refresh(), enrollmentsCol.refresh()])
      toaster.dispatchToast(`Matriculados: ${ok}. Sin evidencia de curso (no matriculados): ${sinEvidencia}.`, { intent: ok ? 'success' : 'warning' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setMatriculando(false)
    }
  }

  const transferir = async (groupKey: string) => {
    const group = PERSON_GROUPS.find((g) => g.key === groupKey)
    const tgt = PERSON_GROUPS.find((g) => g.key === target[groupKey])
    const ref = group && peopleInGroup(group, data).find((p) => p.id === sel[groupKey])
    if (!group || !tgt || !ref) return
    setBusy(true)
    try {
      await transferPerson(ref, tgt, grades[0]?.id ?? '')
      await Promise.all([studentsCol.refresh(), teachersCol.refresh(), guardiansCol.refresh(), personasCol.refresh()])
      toaster.dispatchToast(`${ref.fullName} transferido(a) a ${tgt.label}.`, { intent: 'success' })
      setSel((s) => ({ ...s, [groupKey]: '' }))
      setTarget((s) => ({ ...s, [groupKey]: '' }))
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.grid}>
      <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
        <Text weight="semibold" size={400} block>Personas por grupo (rol)</Text>
        <ResponsiveContainer width="100%" height={Math.max(240, PERSON_GROUPS.length * 30)}>
          <BarChart
            layout="vertical"
            data={PERSON_GROUPS.map((g) => ({ name: g.label, value: peopleInGroup(g, data).length, color: g.color })).sort((a, b) => b.value - a.value)}
            margin={{ top: 8, right: 40, left: 10, bottom: 0 }}
          >
            <XAxis type="number" allowDecimals={false} fontSize={10} />
            <YAxis type="category" dataKey="name" width={170} fontSize={12} tick={{ fontSize: 12 }} />
            <RTooltip />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
              {PERSON_GROUPS.map((g) => <Cell key={g.key} fill={g.color} />)}
              <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#0A1F2B' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <MiniGroupCard label="Estudiantes matriculados" color="#00695C" people={matriculados} total={data.students.length} max={maxGroup} distribucion={distNivel(matriculados)} />
      <MiniGroupCard
        label="Estudiantes no matriculados"
        color="#B42318"
        people={noMatriculados}
        total={data.students.length}
        max={maxGroup}
        distribucion={distNivel(noMatriculados)}
        rowAction={(p) => (
          <Select value={asig[p.id] ?? ''} onChange={(_, d) => setAsig((a) => ({ ...a, [p.id]: d.value }))} style={{ minWidth: '150px' }}>
            <option value="">Matricular en…</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
        action={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {seleccionados.length > 0 && (
              <Button appearance="primary" size="small" disabled={matriculando} onClick={() => void matricularSeleccionados()}>
                {matriculando ? 'Matriculando…' : `Matricular seleccionados (${seleccionados.length})`}
              </Button>
            )}
            <Button appearance="secondary" size="small" disabled={matriculando || noMatriculados.length === 0} onClick={() => void matricularNoMatriculados()}>
              {matriculando ? 'Matriculando…' : 'Matricular (comparar con SIGERD)'}
            </Button>
          </div>
        }
      />
      {PERSON_GROUPS.map((group) => {
        const people = peopleInGroup(group, data)
        const q = (search[group.key] ?? '').toLowerCase()
        const filtrados = q ? people.filter((p) => p.fullName.toLowerCase().includes(q)) : people
        const dist = distribucionDe(people)
        return (
          <Card key={group.key} className={styles.card}>
            <div className={styles.head}>
              <Text weight="semibold" size={400}>{group.label}</Text>
              <span className={styles.count} style={{ color: group.color }}>{people.length}</span>
            </div>
            {dist ? (
              <ResponsiveContainer width="100%" height={132}>
                <BarChart data={dist} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="name" fontSize={10} interval={0} />
                  <YAxis allowDecimals={false} fontSize={10} />
                  <RTooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {dist.map((d, i) => <Cell key={d.name} fill={[group.color, '#7FB069', '#EF6C00'][i % 3]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '14px 4px 8px' }}>
                <ProgressBar value={Math.min(people.length / maxGroup, 1)} color="brand" thickness="large" />
                <Text size={200} block style={{ marginTop: '8px', color: 'var(--texto-suave)' }}>
                  {people.length} de {total} ({total ? Math.round((people.length / total) * 100) : 0}%)
                </Text>
              </div>
            )}
            <Input placeholder="Filtrar por nombre…" value={search[group.key] ?? ''} onChange={(_, d) => setSearch((s) => ({ ...s, [group.key]: d.value }))} />
            <Select value={sel[group.key] ?? ''} onChange={(_, d) => setSel((s) => ({ ...s, [group.key]: d.value }))}>
              <option value="">{filtrados.length} persona(s)…</option>
              {filtrados.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </Select>
            {sel[group.key] && (
              <div className={styles.row}>
                <Select value={target[group.key] ?? ''} onChange={(_, d) => setTarget((s) => ({ ...s, [group.key]: d.value }))} style={{ flex: 1 }}>
                  <option value="">Transferir a…</option>
                  {PERSON_GROUPS.filter((g) => g.key !== group.key).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </Select>
                <Button appearance="primary" disabled={busy || !target[group.key]} onClick={() => void transferir(group.key)}>Transferir</Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
