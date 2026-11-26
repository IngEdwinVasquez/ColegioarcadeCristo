import { useRef, useState } from 'react'
import { Button, Tab, TabList } from '@fluentui/react-components'
import { ArrowSyncRegular, OpenRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'

const DASHBOARDS = {
  Secundaria: '/auditoria-tic/Dashboard_Auditoria_TIC.html',
  Inicial: '/auditoria-tic/Dashboard_Auditoria_TIC_Inicial.html',
} as const

type Nivel = keyof typeof DASHBOARDS

const SUBTITLES: Record<Nivel, string> = {
  Secundaria: 'Trabajo de los docentes TIC de Secundaria: puntajes, dimensiones, evolución mensual y cobertura por curso/asignatura. Datos al día de hoy.',
  Inicial: 'Trabajo de los docentes de Inicial por curso: puntajes, dimensiones, evolución mensual y cobertura por área. Datos al día de hoy.',
}

/**
 * Informe de Auditoría TIC Docentes por nivel (Inicial y Secundaria).
 * Cada nivel muestra su dashboard generado a partir del análisis de su carpeta.
 */
export function AuditoriaTicDocentesPage() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [nivel, setNivel] = useState<Nivel>('Secundaria')
  const url = DASHBOARDS[nivel]

  /** Abre, dentro del panel, la ventana de «Re-analizar carpeta» para buscar información nueva. */
  const abrirReanalisis = () => {
    try {
      const doc = frameRef.current?.contentWindow?.document
      const btn = doc?.getElementById('btnRefresh') as HTMLButtonElement | null
      btn?.click()
    } catch {
      /* mismo origen: si el panel aún no carga, se ignora */
    }
  }

  return (
    <div>
      <PageHeader
        title="Auditoría TIC Docentes"
        subtitle={SUBTITLES[nivel]}
        actions={
          <>
            <Button appearance="secondary" icon={<ArrowSyncRegular />} onClick={abrirReanalisis}>Re-analizar carpeta</Button>
            <Button appearance="secondary" icon={<OpenRegular />} as="a" href={url} target="_blank" rel="noopener noreferrer">Abrir en pestaña completa</Button>
          </>
        }
      />
      <TabList selectedValue={nivel} onTabSelect={(_, d) => setNivel(d.value as Nivel)} style={{ marginBottom: '12px' }}>
        <Tab value="Secundaria">Secundaria</Tab>
        <Tab value="Inicial">Inicial</Tab>
      </TabList>
      <iframe
        key={nivel}
        ref={frameRef}
        title={`Auditoría TIC Docentes · ${nivel}`}
        src={url}
        style={{ width: '100%', height: 'calc(100vh - 250px)', minHeight: '740px', border: '1px solid var(--borde)', borderRadius: '12px', background: '#fff' }}
      />
    </div>
  )
}
