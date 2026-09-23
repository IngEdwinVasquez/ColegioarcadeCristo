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
  if (levels.length <= 1) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>Nivel de coordinación</span>
        <span style={{ fontWeight: 600 }}>{levels[0] ?? value}</span>
      </div>
    )
  }
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
