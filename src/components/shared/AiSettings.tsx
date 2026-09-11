import { useEffect, useState } from 'react'
import { Button, Input, Select, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { PersonLockRegular, SaveRegular, DeleteRegular, SparkleRegular } from '@fluentui/react-icons'
import { ModalForm } from './ModalForm'
import { FormField, FieldRow } from './form'
import { useApp } from '../../context/useApp'
import {
  USER_AI_PROVIDERS,
  userAiProviderInfo,
  getUserAiSettings,
  saveUserAiSettings,
  clearUserAiSettings,
  setAiCurrentUser,
  isUserAiReady,
  type UserAiProvider,
} from '../../services/aiConfig'

const useStyles = makeStyles({
  panel: {
    background: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(8px)',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.6)',
    padding: '22px 26px',
    display: 'flex',
    gap: '18px',
    alignItems: 'center',
    flexWrap: 'wrap',
    boxShadow: '0 10px 30px rgba(4,54,80,0.25)',
    color: 'var(--azul-oscuro)',
  },
  icon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#fff',
    background: 'linear-gradient(135deg,#0082AD,#1AA3CE)',
    boxShadow: '0 8px 18px rgba(0,0,0,0.16)',
    flexShrink: 0,
  },
  panelText: { flex: 1, minWidth: '220px' },
  panelTitle: { fontWeight: 800, fontSize: '16px' },
  panelDesc: { fontSize: '13px', color: 'var(--texto-suave)', lineHeight: 1.55, marginTop: '2px' },
  info: {
    background: '#F2F8FC',
    border: '1px solid #D6E9F3',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '14px',
  },
})

const PROVIDERS = USER_AI_PROVIDERS

function AiSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const [provider, setProvider] = useState<UserAiProvider>('copilot')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    if (!open) return
    setAiCurrentUser(user?.id)
    const s = getUserAiSettings(user?.id)
    setProvider(s?.provider ?? 'copilot')
    setApiKey(s?.apiKey ?? '')
    setModel(s?.model ?? '')
    setBaseUrl(s?.baseUrl ?? '')
  }, [open, user?.id])

  const info = userAiProviderInfo(provider)
  const needsKey = info?.needsKey ?? true
  const needsUrl = provider === 'azure'

  const guardar = () => {
    setAiCurrentUser(user?.id)
    saveUserAiSettings(
      { provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() },
      user?.id,
    )
    toaster.dispatchToast('Tu configuración de IA se guardó en este navegador.', { intent: 'success' })
    onOpenChange(false)
  }

  const quitar = () => {
    clearUserAiSettings(user?.id)
    setProvider('copilot')
    setApiKey('')
    setModel('')
    setBaseUrl('')
    toaster.dispatchToast('Se eliminó tu configuración de IA de este navegador.', { intent: 'success' })
    onOpenChange(false)
  }

  const puedeGuardar = provider === 'copilot' || (apiKey.trim().length > 0 && (!needsUrl || baseUrl.trim().length > 0))

  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="Mi IA · Conecta tu propia cuenta"
      subtitle="Tus credenciales se guardan solo en este navegador"
      width={680}
      actions={
        <>
          <Button appearance="secondary" icon={<DeleteRegular />} onClick={quitar}>Quitar mi configuración</Button>
          <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button appearance="primary" icon={<SaveRegular />} onClick={guardar} disabled={!puedeGuardar}>Guardar</Button>
        </>
      }
    >
      <div>
        <div className={styles.info}>
          <Text size={300} weight="semibold" block style={{ marginBottom: '4px' }}>¿Por qué se te pide tu clave de IA?</Text>
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            <strong>Microsoft 365 Copilot</strong> es la única IA de uso libre para todos los usuarios del centro (con tu
            cuenta institucional, sin costo adicional). Cualquier <strong>otra IA</strong> (OpenAI, DeepSeek, Anthropic,
            Azure) consume tokens de pago, por lo que debes conectar <strong>tu propia clave API</strong>: así usas tu
            cuota y no la del centro.
          </Text>
          <Text size={300} weight="semibold" block style={{ margin: '8px 0 4px' }}>Beneficios</Text>
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            • Usas Copilot sin restricción con tu cuenta del centro.{'\n'}
            • Si necesitas otro modelo, usas tu propia cuota sin afectar al colegio.{'\n'}
            • Tus credenciales quedan guardadas <strong>solo en este navegador</strong> y no se comparten.
          </Text>
        </div>

        <FormField label="Proveedor de IA" required>
          <Select value={provider} onChange={(_, d) => setProvider(d.value as UserAiProvider)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </FormField>
        {info?.hint && <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '-8px', marginBottom: '12px' }}>{info.hint}</Text>}

        {needsKey && (
          <FieldRow>
            <FormField label="Clave API" required>
              <Input type="password" value={apiKey} onChange={(_, d) => setApiKey(d.value)} placeholder="Pega aquí tu clave API" />
            </FormField>
            <FormField label="Modelo" hint="Opcional; se usa el predeterminado si lo dejas vacío.">
              <Input value={model} onChange={(_, d) => setModel(d.value)} placeholder={info?.defaultModel || 'modelo'} />
            </FormField>
          </FieldRow>
        )}

        {needsUrl && (
          <FormField label="URL del recurso de Azure OpenAI" required hint="Ej. https://mi-recurso.openai.azure.com">
            <Input value={baseUrl} onChange={(_, d) => setBaseUrl(d.value)} placeholder="https://mi-recurso.openai.azure.com" />
          </FormField>
        )}

        {provider === 'copilot' && (
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            Se usará tu sesión de Microsoft 365 del centro. No necesitas pegar ninguna clave.
          </Text>
        )}
      </div>
    </ModalForm>
  )
}

/** Botón compacto para abrir la configuración de IA (para usar en cabeceras). */
export function AiSettingsButton({ appearance = 'subtle' }: { appearance?: 'subtle' | 'secondary' | 'primary' | 'outline' | 'transparent' }) {
  const [open, setOpen] = useState(false)
  const { user } = useApp()
  const ready = isUserAiReady(getUserAiSettings(user?.id))
  return (
    <>
      <Button appearance={appearance} icon={<PersonLockRegular />} onClick={() => setOpen(true)} title="Configurar mi cuenta de IA">
        {ready ? 'Mi IA' : 'Configurar mi IA'}
      </Button>
      <AiSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** Tarjeta informativa para la pantalla principal. */
export function AiSettingsCard() {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  const { user } = useApp()
  const ready = isUserAiReady(getUserAiSettings(user?.id))
  return (
    <>
      <div className={styles.panel}>
        <span className={styles.icon}><PersonLockRegular /></span>
        <div className={styles.panelText}>
          <div className={styles.panelTitle}>Tu IA, tus tokens</div>
          <div className={styles.panelDesc}>
            <strong>Microsoft 365 Copilot</strong> está disponible para todos los usuarios del centro con su cuenta institucional.
            Si lo deseas, conecta tu propia cuenta de IA. Tus credenciales se guardan solo en este navegador.
          </div>
        </div>
        <Button appearance="primary" icon={ready ? <PersonLockRegular /> : <SparkleRegular />} onClick={() => setOpen(true)}>
          {ready ? 'Editar mi IA' : 'Configurar mi IA'}
        </Button>
      </div>
      <AiSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
