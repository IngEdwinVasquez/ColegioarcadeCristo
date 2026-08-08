import type { ReactNode } from 'react'
import { Badge, makeStyles } from '@fluentui/react-components'

const useStyles = makeStyles({
  root: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
})

const STATUS_MAP: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'informative' | 'subtle' | 'brand' }> = {
  presente: { label: 'Presente', tone: 'success' },
  ausente: { label: 'Ausente', tone: 'danger' },
  tarde: { label: 'Tarde', tone: 'warning' },
  justificado: { label: 'Justificado', tone: 'informative' },
  completada: { label: 'Completada', tone: 'success' },
  en_progreso: { label: 'En progreso', tone: 'warning' },
  programada: { label: 'Programada', tone: 'informative' },
  pendiente: { label: 'Pendiente', tone: 'warning' },
  planificada: { label: 'Planificada', tone: 'informative' },
  impartida: { label: 'Impartida', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'subtle' },
  publicado: { label: 'Publicado', tone: 'brand' },
  publicada: { label: 'Publicada', tone: 'brand' },
  borrador: { label: 'Borrador', tone: 'subtle' },
  cerrada: { label: 'Cerrada', tone: 'subtle' },
  realizado: { label: 'Realizado', tone: 'success' },
  activo: { label: 'Activo', tone: 'success' },
  alto: { label: 'Alto', tone: 'danger' },
  medio: { label: 'Medio', tone: 'warning' },
  bajo: { label: 'Bajo', tone: 'informative' },
  completado: { label: 'Completado', tone: 'success' },
}

interface StatusBadgeProps {
  status: string
  children?: ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const styles = useStyles()
  const meta = STATUS_MAP[status]
  if (!meta) {
    return (
      <span className={styles.root}>
        <Badge appearance="ghost">{children ?? status}</Badge>
      </span>
    )
  }
  return (
    <span className={styles.root}>
      <Badge appearance="filled" color={meta.tone}>{children ?? meta.label}</Badge>
    </span>
  )
}
