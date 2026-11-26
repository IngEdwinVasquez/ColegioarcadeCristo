import { useRef } from 'react'
import { Button } from '@fluentui/react-components'
import { ArrowSyncRegular, OpenRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'

const DASHBOARD_URL = '/auditoria-tic/Dashboard_Auditoria_TIC.html'

/**
 * Informe de Auditoría TIC Docentes (dashboard generado a partir del análisis
 * de las carpetas de evidencias). Los datos se muestran "al día de hoy".
 */
export function AuditoriaTicDocentesPage() {
  const frameRef = useRef<HTMLIFrameElement>(null)

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
        subtitle="Trabajo de los docentes TIC: puntajes, dimensiones, evolución mensual y cobertura por curso/asignatura. Datos al día de hoy."
        actions={
          <>
            <Button appearance="secondary" icon={<ArrowSyncRegular />} onClick={abrirReanalisis}>Re-analizar carpeta</Button>
            <Button appearance="secondary" icon={<OpenRegular />} as="a" href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Abrir en pestaña completa</Button>
          </>
        }
      />
      <iframe
        ref={frameRef}
        title="Auditoría TIC Docentes"
        src={DASHBOARD_URL}
        style={{ width: '100%', height: 'calc(100vh - 210px)', minHeight: '760px', border: '1px solid var(--borde)', borderRadius: '12px', background: '#fff' }}
      />
    </div>
  )
}
