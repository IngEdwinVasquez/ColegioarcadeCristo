import { useMemo, useState } from 'react'
import { Card, Tab, TabList, makeStyles } from '@fluentui/react-components'
import { CalendarCheckmarkRegular, ChartMultipleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { TomarAsistencia } from './TomarAsistencia'
import { AsistenciaReportes } from './AsistenciaReportes'
import type { SchoolClassRecord } from '../../types'

const useStyles = makeStyles({
  card: { padding: '20px' },
})

export function AsistenciaPage() {
  const styles = useStyles()
  const [tab, setTab] = useState('tomar')
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)

  const sortedClasses = useMemo(
    () => [...classesCol.items].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [classesCol.items],
  )

  return (
    <div>
      <PageHeader
        title="Control de Asistencia"
        subtitle="Registre la asistencia por asignatura impartida, guarde el registro y genere informes gráficos del rendimiento de asistencia de los estudiantes."
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '16px' }}>
        <Tab value="tomar" icon={<CalendarCheckmarkRegular />}>Tomar asistencia</Tab>
        <Tab value="reportes" icon={<ChartMultipleRegular />}>Informes gráficos</Tab>
      </TabList>

      {tab === 'tomar' && (
        <Card className={styles.card}>
          <TomarAsistencia classes={sortedClasses} />
        </Card>
      )}
      {tab === 'reportes' && <AsistenciaReportes />}
    </div>
  )
}
