import { useState } from 'react'
import { Button, Card, Input, Text, Textarea, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { SendRegular, MegaphoneRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { useLocalList } from '../../hooks/useLocalList'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  circular: { padding: '14px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  subtitle: { color: tokens.colorNeutralForeground2 },
})

export function Comunicados() {
  const styles = useStyles()
  const toaster = useToastController()
  const { role } = useApp()
  const comunicados = useLocalList<{ id: string; titulo: string; contenido: string; fecha: string }>('arca_comunicados')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')

  const publicar = () => {
    if (!titulo || !contenido) {
      window.alert('Complete el título y el contenido de la circular.')
      return
    }
    comunicados.add({ titulo, contenido, fecha: new Date().toISOString() })
    toaster.dispatchToast("Circular publicada", { intent: "success" })
    setTitulo('')
    setContenido('')
  }

  const isAdmin = role === 'admin' || role === 'docente'

  return (
    <div>
      <PageHeader
        title="Comunicaciones Institucionales"
        subtitle="Circulares oficiales, avisos y comunicados del centro educativo para las familias."
      />
      <div className={styles.grid}>
        {isAdmin && (
          <Card className={styles.card}>
            <Text weight="semibold" size={400}><MegaphoneRegular /> Publicar circular</Text>
            <FormField label="Título">
              <Input value={titulo} onChange={(_, d) => setTitulo(d.value)} placeholder="Ej. Circular #12 — Inicio del período de evaluaciones" />
            </FormField>
            <FormField label="Contenido">
              <Textarea value={contenido} onChange={(_, d) => setContenido(d.value)} resize="vertical" placeholder="Redacte el comunicado…" />
            </FormField>
            <Button appearance="primary" icon={<SendRegular />} onClick={publicar}>Publicar</Button>
          </Card>
        )}
        <Card className={styles.card} style={{ gridColumn: isAdmin ? 'auto' : '1 / -1' }}>
          <Text weight="semibold" size={400}>Circular del centro</Text>
          {comunicados.items.length === 0 && <Text size={300} className={styles.subtitle}>No hay comunicados publicados.</Text>}
          {comunicados.items.map((c) => (
            <div key={c.id} className={styles.circular}>
              <Text weight="semibold" size={300} block>{c.titulo}</Text>
              <Text size={200} className={styles.subtitle} block>Publicado: {formatDate(c.fecha)}</Text>
              <Text size={300} block style={{ marginTop: '6px' }}>{c.contenido}</Text>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
