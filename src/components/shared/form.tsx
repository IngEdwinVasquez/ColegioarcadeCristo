import type { ReactNode } from 'react'
import { Button, DialogTrigger, makeStyles, Text, tokens } from '@fluentui/react-components'
import { SaveRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  field: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' },
  label: { fontWeight: 600 },
  hint: { color: tokens.colorNeutralForeground2 },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '0 16px',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' },
})

export function FormField({ label, hint, children, required }: { label: string; hint?: string; children: ReactNode; required?: boolean }) {
  const styles = useStyles()
  return (
    <div className={styles.field}>
      <Text size={300} className={styles.label}>
        {label} {required && <span style={{ color: tokens.colorPaletteRedForeground1 }}>*</span>}
      </Text>
      {children}
      {hint && <Text size={200} className={styles.hint}>{hint}</Text>}
    </div>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <div className={styles.row}>{children}</div>
}

export function FormActions({ onCancel, onSubmit, saving = false, submitLabel = 'Guardar' }: { onCancel?: () => void; onSubmit: () => void; saving?: boolean; submitLabel?: string }) {
  const styles = useStyles()
  return (
    <div className={styles.actions}>
      {onCancel && (
        <DialogTrigger disableButtonEnhancement>
          <Button appearance="secondary" onClick={onCancel}>Cancelar</Button>
        </DialogTrigger>
      )}
      <Button appearance="primary" icon={<SaveRegular />} onClick={onSubmit} disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </Button>
    </div>
  )
}
