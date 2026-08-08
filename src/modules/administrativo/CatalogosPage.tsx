import { useState } from 'react'
import { Input, Select, Tab, TabList, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { GradeSection, Period, Subject } from '../../types'
import { formatDate, genId, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
  chip: { padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#fff' },
})

export function CatalogosPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, subjects, periods } = useApp()
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade, dataService.deleteGrade)
  const subjectsCol = useCollection<Subject>(dataService.getSubjects, dataService.saveSubject, dataService.deleteSubject)
  const periodsCol = useCollection<Period>(dataService.getPeriods, dataService.savePeriod, dataService.deletePeriod)

  const [tab, setTab] = useState('cursos')

  const gradeColumns: CrudColumn<GradeSection>[] = [
    { header: 'Curso', render: (g) => <Text weight="semibold">{g.name}</Text> },
    { header: 'Nivel', render: (g) => g.level },
  ]

  const subjectColumns: CrudColumn<Subject>[] = [
    { header: 'Asignatura', render: (s) => <Text weight="semibold">{s.name}</Text> },
    { header: 'Código', render: (s) => s.shortName },
    {
      header: 'Color',
      render: (s) => (
        <span className={styles.chip} style={{ background: s.color ?? '#999' }}>{s.color ?? '—'}</span>
      ),
    },
  ]

  const periodColumns: CrudColumn<Period>[] = [
    { header: 'Período', render: (p) => <Text weight="semibold">{p.name}</Text> },
    { header: 'Inicio', render: (p) => formatDate(p.startDate) },
    { header: 'Fin', render: (p) => formatDate(p.endDate) },
    {
      header: 'Estado',
      render: (p) => (
        <span className={styles.chip} style={{ background: p.isActive ? '#15803D' : '#9AA4B2' }}>
          {p.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  const saveGrade = async (g: GradeSection) => {
    await gradesCol.save(g)
    toaster.dispatchToast('Curso guardado', { intent: 'success' })
  }
  const saveSubject = async (s: Subject) => {
    await subjectsCol.save(s)
    toaster.dispatchToast('Asignatura guardada', { intent: 'success' })
  }
  const savePeriod = async (p: Period) => {
    await periodsCol.save(p)
    toaster.dispatchToast('Período guardado', { intent: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Catálogos académicos"
        subtitle="Mantenimiento de cursos, asignaturas y períodos escolares."
      />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="cursos">Cursos ({grades.length})</Tab>
        <Tab value="asignaturas">Asignaturas ({subjects.length})</Tab>
        <Tab value="periodos">Períodos ({periods.length})</Tab>
      </TabList>

      {tab === 'cursos' && (
        <EntityCrud
          title="Cursos y grados"
          items={gradesCol.items}
          loading={gradesCol.loading}
          columns={gradeColumns}
          searchText={(g) => `${g.name} ${g.level}`}
          newLabel="Nuevo curso"
          createDefault={() => ({ id: genId('g'), name: '', level: 'Nivel Primario' })}
          renderForm={(g, set) => (
            <div>
              <FieldRow>
                <FormField label="Nombre del curso" required>
                  <Input value={g.name} onChange={(_, d) => set({ ...g, name: d.value })} placeholder="Ej. 6to A" />
                </FormField>
                <FormField label="Nivel">
                  <Select value={g.level} onChange={(_, d) => set({ ...g, level: d.value })}>
                    <option value="Nivel Inicial">Nivel Inicial</option>
                    <option value="Nivel Primario">Nivel Primario</option>
                    <option value="Nivel Secundario">Nivel Secundario</option>
                  </Select>
                </FormField>
              </FieldRow>
            </div>
          )}
          onSave={saveGrade}
          onDelete={(id) => gradesCol.remove(id)}
        />
      )}

      {tab === 'asignaturas' && (
        <EntityCrud
          title="Asignaturas"
          items={subjectsCol.items}
          loading={subjectsCol.loading}
          columns={subjectColumns}
          searchText={(s) => `${s.name} ${s.shortName}`}
          newLabel="Nueva asignatura"
          createDefault={() => ({ id: genId('subj'), name: '', shortName: '', color: '#103F7E' })}
          renderForm={(s, set) => (
            <div>
              <FieldRow>
                <FormField label="Nombre" required>
                  <Input value={s.name} onChange={(_, d) => set({ ...s, name: d.value })} />
                </FormField>
                <FormField label="Código corto">
                  <Input value={s.shortName} onChange={(_, d) => set({ ...s, shortName: d.value })} placeholder="Ej. MAT" />
                </FormField>
              </FieldRow>
              <FormField label="Color identificador">
                <input
                  name="color"
                  type="color"
                  value={s.color ?? '#103F7E'}
                  onChange={(e) => set({ ...s, color: e.target.value })}
                  style={{ width: '80px', height: '36px', borderRadius: '8px', border: '1px solid var(--borde)', background: 'none' }}
                />
              </FormField>
            </div>
          )}
          onSave={saveSubject}
          onDelete={(id) => subjectsCol.remove(id)}
        />
      )}

      {tab === 'periodos' && (
        <EntityCrud
          title="Períodos escolares"
          items={periodsCol.items}
          loading={periodsCol.loading}
          columns={periodColumns}
          searchText={(p) => p.name}
          newLabel="Nuevo período"
          createDefault={() => ({
            id: genId('p'),
            name: '',
            startDate: todayIso(),
            endDate: todayIso(),
            isActive: false,
          })}
          renderForm={(p, set) => (
            <div>
              <FormField label="Nombre del período" required>
                <Input value={p.name} onChange={(_, d) => set({ ...p, name: d.value })} placeholder="Ej. Año escolar 2027-2028" />
              </FormField>
              <FieldRow>
                <FormField label="Inicio">
                  <Input type="date" value={p.startDate} onChange={(_, d) => set({ ...p, startDate: d.value })} />
                </FormField>
                <FormField label="Fin">
                  <Input type="date" value={p.endDate} onChange={(_, d) => set({ ...p, endDate: d.value })} />
                </FormField>
              </FieldRow>
              <FormField label="Estado">
                <Select value={p.isActive ? 'activo' : 'inactivo'} onChange={(_, d) => set({ ...p, isActive: d.value === 'activo' })}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </Select>
              </FormField>
            </div>
          )}
          onSave={savePeriod}
          onDelete={(id) => periodsCol.remove(id)}
          emptyMessage="Defina los períodos escolares (años lectivos, trimestres)."
        />
      )}
    </div>
  )
}
