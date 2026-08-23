import { useMemo, useState } from 'react'
import { Button, Card, Checkbox, Input, Spinner, Text, Textarea, makeStyles, tokens, useToastController } from '@fluentui/react-components'
import { SendRegular, MegaphoneRegular, MailRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { emailTemplate, escapeHtml, notify, uniqueRecipients } from '../../services/notifications'
import { formatDate, genId } from '../../utils/helpers'
import type { Announcement } from '../../types'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  circular: { padding: '14px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  subtitle: { color: tokens.colorNeutralForeground2 },
})

export function Comunicados() {
  const styles = useStyles()
  const toaster = useToastController()
  const { role, user, students, guardians, teachers } = useApp()
  const comunicados = useCollection<Announcement>(dataService.getAnnouncements, dataService.saveAnnouncement, dataService.deleteAnnouncement)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [enviarCorreo, setEnviarCorreo] = useState(true)
  const [publicando, setPublicando] = useState(false)

  const isAdmin = role === 'admin' || role === 'docente' || role === 'psicologia'

  const destinatarios = useMemo(
    () =>
      uniqueRecipients([
        ...guardians.map((g) => ({ email: g.email, name: g.fullName })),
        ...students.map((s) => ({ email: s.parentEmail ?? '', name: s.parentName })),
        ...teachers.map((t) => ({ email: t.email, name: t.fullName })),
      ]),
    [guardians, students, teachers],
  )

  const ordered = useMemo(() => comunicados.items.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)), [comunicados.items])

  const publicar = async () => {
    if (!titulo || !contenido) {
      window.alert('Complete el título y el contenido de la circular.')
      return
    }
    setPublicando(true)
    const circular: Announcement = {
      id: genId('com'),
      titulo,
      contenido,
      fecha: new Date().toISOString(),
      autorId: user?.id,
      autorNombre: user?.displayName,
      notificado: false,
    }
    try {
      await comunicados.save(circular)
      if (enviarCorreo && destinatarios.length > 0) {
        try {
          const result = await notify({
            category: 'comunicado',
            to: destinatarios,
            subject: `${titulo} — Arca de Cristo`,
            body: emailTemplate(titulo, `<p>${escapeHtml(contenido)}</p><p style="margin-top:18px;color:#6b7280;font-size:13px">Publicado por ${escapeHtml(user?.displayName ?? 'Dirección')} · ${formatDate(circular.fecha)}</p>`),
            metadata: { announcementId: circular.id },
          })
          await comunicados.save({ ...circular, notificado: result.channel !== 'skipped' })
          toaster.dispatchToast(`Circular publicada y enviada a ${result.recipients} destinatario(s)`, { intent: 'success' })
        } catch (error) {
          toaster.dispatchToast(`Circular publicada, pero el correo falló: ${error instanceof Error ? error.message : 'error'}`, { intent: 'warning' })
        }
      } else {
        toaster.dispatchToast('Circular publicada', { intent: 'success' })
      }
      setTitulo('')
      setContenido('')
    } catch (error) {
      toaster.dispatchToast(`No se pudo publicar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setPublicando(false)
    }
  }

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
            <Checkbox
              checked={enviarCorreo}
              onChange={(_, d) => setEnviarCorreo(!!d.checked)}
              label={
                <span>
                  <MailRegular /> Enviar por correo a familias y docentes ({destinatarios.length} destinatarios)
                </span>
              }
            />
            <Button appearance="primary" icon={publicando ? <Spinner size="tiny" /> : <SendRegular />} onClick={() => void publicar()} disabled={publicando}>
              {publicando ? 'Publicando…' : 'Publicar'}
            </Button>
          </Card>
        )}
        <Card className={styles.card} style={{ gridColumn: isAdmin ? 'auto' : '1 / -1' }}>
          <Text weight="semibold" size={400}>Circular del centro</Text>
          {comunicados.loading && <Spinner size="small" label="Cargando comunicados…" />}
          {!comunicados.loading && ordered.length === 0 && <Text size={300} className={styles.subtitle}>No hay comunicados publicados.</Text>}
          {ordered.map((c) => (
            <div key={c.id} className={styles.circular}>
              <Text weight="semibold" size={300} block>{c.titulo}</Text>
              <Text size={200} className={styles.subtitle} block>
                Publicado: {formatDate(c.fecha)}{c.autorNombre ? ` · ${c.autorNombre}` : ''}{c.notificado ? ' · Enviado por correo' : ''}
              </Text>
              <Text size={300} block style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{c.contenido}</Text>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
