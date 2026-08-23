import { Button, Card, Text, makeStyles, tokens } from '@fluentui/react-components'
import { OpenRegular, SparkleRegular, CopyRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { useApp } from '../../context/useApp'
import { appConfig } from '../../config/appConfig'
import { ROLE_LABELS } from '../../types/roles'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  frameWrap: {
    background: 'var(--superficie)',
    border: '1px solid var(--borde)',
    borderRadius: '14px',
    overflow: 'hidden',
    height: 'calc(100vh - 220px)',
    minHeight: '520px',
  },
  frame: { width: '100%', height: '100%', border: 'none' },
  prompt: {
    padding: '12px 14px',
    borderRadius: '10px',
    background: tokens.colorNeutralBackground2,
    fontSize: '13.5px',
    lineHeight: 1.5,
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'flex-start',
  },
})

const PROMPTS: Record<string, string[]> = {
  docente: [
    'Redacta una planificación de clase de 45 minutos sobre fracciones para 5to grado con objetivos, actividades y evaluación.',
    'Genera 10 preguntas de opción múltiple sobre la fotosíntesis para un quiz de Ciencias Naturales de 6to grado.',
    'Escribe una retroalimentación constructiva para un estudiante cuyo proyecto tuvo buena investigación pero débil presentación.',
  ],
  estudiante: [
    'Explícame el teorema de Pitágoras con un ejemplo de la vida real y tres ejercicios resueltos paso a paso.',
    'Ayúdame a crear un plan de estudio de una semana para prepararme para mi examen de Historia.',
    'Resume en 5 puntos clave el siguiente texto que pegaré a continuación.',
  ],
  padre: [
    'Dame ideas para apoyar a mi hijo(a) con la lectura en casa, 20 minutos al día.',
    'Redacta un correo cordial para el docente solicitando una reunión sobre el rendimiento de mi hijo(a).',
  ],
  admin: [
    'Redacta una circular formal para las familias anunciando la reunión de entrega de boletines.',
    'Analiza estos datos de asistencia y propón tres acciones para mejorar la puntualidad.',
    'Prepara el orden del día para el consejo de docentes del próximo lunes.',
  ],
}

export function CopilotPage() {
  const styles = useStyles()
  const { role } = useApp()
  const prompts = PROMPTS[role ?? 'docente'] ?? PROMPTS.docente
  const embedUrl = appConfig.copilot.embedUrl

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text)
  }

  return (
    <div>
      <PageHeader
        title="Copilot"
        subtitle={`Asistente de inteligencia artificial de Microsoft 365 para ${ROLE_LABELS[role ?? 'docente'].toLowerCase()}s: planificación, redacción, análisis y apoyo al aprendizaje.`}
        actions={
          <Button appearance="primary" icon={<OpenRegular />} onClick={() => window.open(appConfig.copilot.m365ChatUrl, '_blank', 'noopener')}>
            Abrir Microsoft 365 Copilot
          </Button>
        }
      />

      {embedUrl ? (
        <div className={styles.frameWrap}>
          <iframe className={styles.frame} src={embedUrl} title="Copilot Arca de Cristo" allow="microphone; clipboard-write" />
        </div>
      ) : (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}><SparkleRegular /> Copilot con su cuenta institucional</Text>
            <Text size={300}>
              Microsoft 365 Copilot Chat está disponible para todas las cuentas del colegio en{' '}
              <a href={appConfig.copilot.m365ChatUrl} target="_blank" rel="noopener noreferrer">m365.cloud.microsoft/chat</a>, en Teams y en las aplicaciones de Office.
              Las conversaciones están protegidas por las políticas de datos de la organización.
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
              Para insertar aquí un agente personalizado del colegio (Copilot Studio), defina <code>VITE_COPILOT_EMBED_URL</code> con la URL de inserción del agente.
            </Text>
          </Card>
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Indicaciones sugeridas</Text>
            {prompts.map((p) => (
              <div key={p} className={styles.prompt}>
                <span>{p}</span>
                <Button size="small" appearance="subtle" icon={<CopyRegular />} aria-label="Copiar" onClick={() => copy(p)} />
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
