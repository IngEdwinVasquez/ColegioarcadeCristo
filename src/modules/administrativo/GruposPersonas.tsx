import { useMemo, useState } from 'react'
import { Button, Card, Input, Select, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from 'recharts'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { graphErrorMessage } from '../../services/graph'
import { PERSON_GROUPS, peopleInGroup, transferPerson } from '../../services/personGroups'
import type { Persona, Student, StudentGuardian, Teacher } from '../../types'

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
export function GruposPersonas() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const teachersCol = useCollection<Teacher>(dataService.getTeachers, dataService.saveTeacher)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians, dataService.saveGuardian)
  const personasCol = useCollection<Persona>(dataService.getPersonas, dataService.savePersona)

  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<Record<string, string>>({})

  const data = useMemo(
    () => ({ students: studentsCol.items, teachers: teachersCol.items, guardians: guardiansCol.items, personas: personasCol.items }),
    [studentsCol.items, teachersCol.items, guardiansCol.items, personasCol.items],
  )
  const total = data.students.length + data.teachers.length + data.guardians.length + data.personas.length

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
      {PERSON_GROUPS.map((group) => {
        const people = peopleInGroup(group, data)
        const q = (search[group.key] ?? '').toLowerCase()
        const filtrados = q ? people.filter((p) => p.fullName.toLowerCase().includes(q)) : people
        const chart = [
          { name: group.label, value: people.length, color: group.color },
          { name: 'Resto', value: Math.max(total - people.length, 0), color: '#E4E4E4' },
        ]
        return (
          <Card key={group.key} className={styles.card}>
            <div className={styles.head}>
              <Text weight="semibold" size={400}>{group.label}</Text>
              <span className={styles.count} style={{ color: group.color }}>{people.length}</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={chart} dataKey="value" innerRadius={32} outerRadius={54} startAngle={90} endAngle={-270} stroke="none">
                  {chart.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
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
