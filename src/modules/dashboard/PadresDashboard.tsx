import { useEffect, useState } from 'react'
import { Select, Text, makeStyles } from '@fluentui/react-components'
import { useApp } from '../../context/useApp'
import { useMyChildren } from '../../hooks/useMyChildren'
import { StudentResumen } from './StudentResumen'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { FormField } from '../../components/shared/form'

const useStyles = makeStyles({
  selector: { maxWidth: '420px', marginBottom: '24px' },
})

export function PadresDashboard() {
  const styles = useStyles()
  const { gradeById } = useApp()
  // Privacidad: solo los hijos vinculados a la cuenta del padre/tutor.
  const children = useMyChildren()
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!selected && children.length) setSelected(children[0].id)
    if (selected && !children.some((c) => c.id === selected)) setSelected('')
  }, [children, selected])

  return (
    <div>
      <WelcomeHero
        title={<span>Hola, familia 👨‍👩‍👧‍👦</span>}
        subtitle="Conéctese con el centro educativo: supervise el progreso académico de sus hijos, consulte los reportes de asistencia y manténgase al día con las circulares oficiales."
      />
      {children.length === 0 ? (
        <Text size={300} block style={{ color: 'var(--texto-suave)' }}>
          Su cuenta no tiene estudiantes vinculados. Solicite a la administración del colegio que lo registre como padre o tutor de su hijo(a).
        </Text>
      ) : (
        <div className={styles.selector}>
          <FormField label="Seleccione a su hijo(a)">
            <Select value={selected} onChange={(_, d) => setSelected(d.value)}>
              {children.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} · {gradeById(s.gradeId)?.name ?? ''}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}
      {selected && <StudentResumen studentId={selected} />}
    </div>
  )
}
