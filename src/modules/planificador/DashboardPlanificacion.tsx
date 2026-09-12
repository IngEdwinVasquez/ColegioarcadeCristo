import { Badge, Button, Input, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, SearchRegular } from '@fluentui/react-icons'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { BarraAccionesRapidas } from './BarraAccionesRapidas'
import type { PlanificacionDinamica, PlanEstado } from '../../types'
import { formatDate } from '../../utils/helpers'

const ALCANCE_LABEL: Record<PlanificacionDinamica['alcance'], string> = {
  anual: 'Anual',
  mensual: 'Mensual',
  semanal: 'Semanal',
  actividad: 'Actividad',
}
const ESTADO_COLOR: Record<PlanEstado, string> = { activa: '#15803D', borrador: '#EA580C', archivada: '#6B7280' }

const useStyles = makeStyles({
  bar: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' },
  search: { minWidth: '240px' },
  grow: { flex: 1 },
})

interface Props {
  plans: PlanificacionDinamica[]
  loading: boolean
  filter: string
  onFilter: (v: string) => void
  search: string
  onSearch: (v: string) => void
  onNew: () => void
  onEdit: (plan: PlanificacionDinamica) => void
  onShare: (plan: PlanificacionDinamica) => void
  onDownload: (plan: PlanificacionDinamica) => void
  onDelete: (plan: PlanificacionDinamica) => void
  busyId?: string
  gradeName: (id: string) => string
  subjectName: (id: string) => string
  counts: { todas: number; activa: number; borrador: number; archivada: number }
}

/** Vista principal: lista de planificaciones del docente con filtros rápidos y acciones. */
export function DashboardPlanificacion(props: Props) {
  const { plans, loading, filter, onFilter, search, onSearch, onNew, onEdit, onShare, onDownload, onDelete, busyId, gradeName, subjectName, counts } = props
  const styles = useStyles()

  return (
    <div>
      <div className={styles.bar}>
        <TabList selectedValue={filter} onTabSelect={(_, d) => onFilter(String(d.value))}>
          <Tab value="">Todas ({counts.todas})</Tab>
          <Tab value="activa">Activas ({counts.activa})</Tab>
          <Tab value="borrador">Borradores ({counts.borrador})</Tab>
          <Tab value="archivada">Archivadas ({counts.archivada})</Tab>
        </TabList>
        <span className={styles.grow} />
        <Input className={styles.search} contentBefore={<SearchRegular />} value={search} onChange={(_, d) => onSearch(d.value)} placeholder="Buscar por tema…" />
        <Button appearance="primary" icon={<AddRegular />} onClick={onNew}>Nueva planificación</Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner label="Cargando planificaciones…" /></div>
      ) : plans.length === 0 ? (
        <EmptyStateView
          title="Sin planificaciones"
          message="Crea tu primera planificación con el asistente de IA: solo indica grado, asignatura y tema."
          action={<Button appearance="primary" icon={<AddRegular />} onClick={onNew}>Nueva planificación</Button>}
        />
      ) : (
        <Table aria-label="Planificaciones">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Tema</TableHeaderCell>
              <TableHeaderCell>Alcance</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Actualizado</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Text weight="semibold" block>{p.tema}</Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{gradeName(p.gradeId)} · {subjectName(p.subjectId)}{p.generadoPorIA ? ' · ✨ IA' : ''}</Text>
                </TableCell>
                <TableCell><Badge appearance="tint" color="brand">{ALCANCE_LABEL[p.alcance]}</Badge></TableCell>
                <TableCell><Badge appearance="filled" style={{ background: ESTADO_COLOR[p.estado], color: '#fff' }}>{p.estado[0].toUpperCase() + p.estado.slice(1)}</Badge></TableCell>
                <TableCell>{formatDate((p.updatedAt ?? p.createdAt).slice(0, 10))}</TableCell>
                <TableCell>
                  <BarraAccionesRapidas plan={p} onEdit={onEdit} onShare={onShare} onDownload={onDownload} onDelete={onDelete} busy={busyId === p.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
