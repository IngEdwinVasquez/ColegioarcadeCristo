import { Spinner, Toolbar, ToolbarButton, ToolbarDivider } from '@fluentui/react-components'
import { EditRegular, CopyRegular, DocumentPdfRegular, DeleteRegular } from '@fluentui/react-icons'
import type { PlanificacionDinamica } from '../../types'

interface Props {
  plan: PlanificacionDinamica
  onEdit: (plan: PlanificacionDinamica) => void
  onShare: (plan: PlanificacionDinamica) => void
  onDownload: (plan: PlanificacionDinamica) => void
  onDelete: (plan: PlanificacionDinamica) => void
  busy?: boolean
}

/** Acciones rápidas por fila: Editar · Compartir · Descargar · Eliminar. */
export function BarraAccionesRapidas({ plan, onEdit, onShare, onDownload, onDelete, busy }: Props) {
  return (
    <Toolbar size="small" aria-label={`Acciones de ${plan.tema}`}>
      <ToolbarButton icon={<EditRegular />} onClick={() => onEdit(plan)}>Editar</ToolbarButton>
      <ToolbarButton icon={busy ? <Spinner size="tiny" /> : <CopyRegular />} disabled={busy} onClick={() => onShare(plan)}>Compartir</ToolbarButton>
      <ToolbarButton icon={<DocumentPdfRegular />} onClick={() => onDownload(plan)}>Descargar PDF</ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton icon={<DeleteRegular />} onClick={() => onDelete(plan)} aria-label="Eliminar" title="Eliminar" />
    </Toolbar>
  )
}
