import { useEffect, useState } from 'react'
import { Select, makeStyles } from '@fluentui/react-components'
import { useApp } from '../../context/useApp'
import { StudentResumen } from './StudentResumen'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { FormField } from '../../components/shared/form'

const useStyles = makeStyles({
  selector: { maxWidth: '420px', marginBottom: '24px' },
})

export function PadresDashboard() {
  const styles = useStyles()
  const { students, gradeById } = useApp()
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!selected && students.length) setSelected(students[0].id)
  }, [students, selected])

  return (
    <div>
      <WelcomeHero
        title={<span>Hola, familia 👨‍👩‍👧‍👦</span>}
        subtitle="Conéctese con el centro educativo: supervise el progreso académico de sus hijos, consulte los reportes de asistencia y manténgase al día con las circulares oficiales."
      />
      <div className={styles.selector}>
        <FormField label="Seleccione a su hijo(a)">
          <Select value={selected} onChange={(_, d) => setSelected(d.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} · {gradeById(s.gradeId)?.name ?? ''}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {selected && <StudentResumen studentId={selected} />}
    </div>
  )
}
