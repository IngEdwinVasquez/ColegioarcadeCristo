import { makeStyles, Select } from '@fluentui/react-components'
import type { CoordinationLevel } from '../../types'

const useStyles = makeStyles({
  wrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  label: { fontWeight: 700, fontSize: '13px', color: 'var(--texto-suave)', whiteSpace: 'nowrap' },
})

interface NivelSelectorProps {
  value: CoordinationLevel
  onChange: (level: CoordinationLevel) => void
  levels: CoordinationLevel[]
}

/** Selector del nivel de coordinación (Inicial / Primaria / Secundaria). */
export function NivelSelector({ value, onChange, levels }: NivelSelectorProps) {
  const styles = useStyles()
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Nivel de coordinación</span>
      <Select value={value} onChange={(_, d) => onChange(d.value as CoordinationLevel)}>
        {levels.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </Select>
    </div>
  )
}
