import { useMemo, useState } from 'react'
import { Badge, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Tab, TabList, makeStyles } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import { PersonSupportRegular, PeopleRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  filter: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  small: { color: 'var(--texto-suave)' },
})

export function PersonasNivel() {
  const styles = useStyles()
  const { teachers, students, grades, gradeById, subjectById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()
  const [tab, setTab] = useState<'docentes' | 'estudiantes'>('docentes')
  const [gradeFilter, setGradeFilter] = useState('')

  const levelGradeIds = useMemo(() => grades.filter((g) => g.level === level).map((g) => g.id), [grades, level])

  const docentes = useMemo(() => {
    const gradesOfLevel = new Set(levelGradeIds)
    const items = teachers.filter((t) => t.grades.some((g) => gradesOfLevel.has(g)))
    return gradeFilter ? items.filter((t) => t.grades.includes(gradeFilter)) : items
  }, [teachers, levelGradeIds, gradeFilter])

  const estudiantes = useMemo(() => {
    const gradesOfLevel = new Set(levelGradeIds)
    const items = students.filter((s) => gradesOfLevel.has(s.gradeId))
    return gradeFilter ? items.filter((s) => s.gradeId === gradeFilter) : items
  }, [students, levelGradeIds, gradeFilter])

  const levelGrades = useMemo(() => grades.filter((g) => levelGradeIds.includes(g.id)), [grades, levelGradeIds])

  return (
    <div>
      <PageHeader
        title="Docentes y estudiantes por curso"
        subtitle={`Padrón de docentes y estudiantes de ${level}, agrupado por curso y sección.`}
      />
      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>

      <div className={styles.filter}>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los cursos</option>
          {levelGrades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as 'docentes' | 'estudiantes')}>
          <Tab value="docentes">Docentes ({docentes.length})</Tab>
          <Tab value="estudiantes">Estudiantes ({estudiantes.length})</Tab>
        </TabList>
      </div>

      {tab === 'docentes' && (
        <>
          {docentes.length === 0 && (
            <EmptyStateView title="Sin docentes" message={`No hay docentes asignados a ${gradeFilter ? gradeById(gradeFilter)?.name : 'este nivel'} .`} icon={<PersonSupportRegular />} />
          )}
          {docentes.length > 0 && (
            <Table aria-label="Docentes del nivel">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Docente</TableHeaderCell>
                  <TableHeaderCell>Correo</TableHeaderCell>
                  <TableHeaderCell>Cursos</TableHeaderCell>
                  <TableHeaderCell>Asignaturas</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docentes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className={styles.cell}>
                      <Text weight="semibold">{t.fullName}</Text>
                    </TableCell>
                    <TableCell className={styles.cell}><span className={styles.small}>{t.email}</span></TableCell>
                    <TableCell className={styles.cell}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {t.grades.map((g) => (
                          <Badge key={g} appearance="tint" color="informative">{gradeById(g)?.name ?? g}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className={styles.cell}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {t.subjects.map((s) => (
                          <Badge key={s} appearance="tint" color="brand">{subjectById(s)?.shortName ?? s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {tab === 'estudiantes' && (
        <>
          {estudiantes.length === 0 && (
            <EmptyStateView title="Sin estudiantes" message="No hay estudiantes registrados en este nivel/curso." icon={<PeopleRegular />} />
          )}
          {estudiantes.length > 0 && (
            <Table aria-label="Estudiantes del nivel">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Curso</TableHeaderCell>
                  <TableHeaderCell>Sección</TableHeaderCell>
                  <TableHeaderCell>Tutor</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estudiantes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className={styles.cell}><Text weight="semibold">{s.fullName}</Text></TableCell>
                    <TableCell className={styles.cell}>{gradeById(s.gradeId)?.name ?? '—'}</TableCell>
                    <TableCell className={styles.cell}>{s.section || '—'}</TableCell>
                    <TableCell className={styles.cell}><span className={styles.small}>{s.parentName ?? '—'}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
