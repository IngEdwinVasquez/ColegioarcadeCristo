import { useEffect, useRef, useState } from 'react'
import { Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Divider, Input, Spinner, Text, makeStyles, tokens } from '@fluentui/react-components'
import { SparkleRegular, SendRegular, DismissRegular, OpenRegular } from '@fluentui/react-icons'
import { modifyPlanWithAi } from '../../services/planningPrompts'
import type { DailyPlan } from '../../types'

const useStyles = makeStyles({
  chatList: { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '4px' },
  msg: { maxWidth: '90%', padding: '10px 14px', borderRadius: '14px', lineHeight: 1.5, fontSize: '13.5px', wordBreak: 'break-word' },
  user: { alignSelf: 'flex-end', background: '#0082AD', color: '#fff', borderBottomRightRadius: '4px' },
  ai: { alignSelf: 'flex-start', background: '#EEF4F9', color: 'var(--texto)', borderBottomLeftRadius: '4px' },
  tool: { alignSelf: 'flex-start', background: 'transparent', color: '#15803D', fontWeight: 600, fontSize: '12.5px', padding: '2px 4px' },
  inputBar: { display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '12px' },
  hint: { fontSize: '12px', color: tokens.colorNeutralForeground2, marginBottom: '10px' },
  chip: { alignSelf: 'flex-start', padding: '6px 12px', borderRadius: '999px', background: 'rgba(21,128,61,0.12)', color: '#15803D', fontWeight: 700, fontSize: '12px' },
  spinnerRow: { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--texto-suave)', fontSize: '13px' },
})

interface Message { role: 'user' | 'ai' | 'tool'; content: string }

interface ModifyChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: DailyPlan | null
  onPlanUpdated: (plan: DailyPlan) => void
}

export function ModifyChatPanel({ open, onOpenChange, plan, onPlanUpdated }: ModifyChatPanelProps) {
  const styles = useStyles()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [latestPlan, setLatestPlan] = useState<DailyPlan | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && plan) {
      setMessages([
        { role: 'ai', content: `Voy a ayudarte con la planificación "${plan.tema}". Describe qué deseas modificar (duración, actividades, evaluación, estrategias…) y lo aplico al plan.` },
      ])
      setInput('')
      setLatestPlan(null)
    }
  }, [open, plan])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || !plan || busy) return
    setBusy(true)
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    try {
      const updated = await modifyPlanWithAi(plan, text)
      setLatestPlan(updated)
      setMessages((m) => [
        ...m,
        { role: 'ai', content: 'Listo. Apliqué la modificación solicitada al plan. Puedes revisarlo con "Ver plan actualizado".' },
        { role: 'tool', content: 'plan-actualizado' },
      ])
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', content: `No pude aplicar la modificación: ${e instanceof Error ? e.message : 'error'}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer type="overlay" position="end" open={open} onOpenChange={(_, d) => onOpenChange(d.open)} style={{ width: '400px' }}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button appearance="subtle" aria-label="Cerrar" icon={<DismissRegular />} onClick={() => onOpenChange(false)} />
          }
        >
          Modificar con IA
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <Text size={200} className={styles.hint}>{plan ? `${plan.tema} · ${plan.duracion}` : 'Seleccione una planificación'}</Text>
        <div className={styles.chatList} ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.user : m.role === 'ai' ? styles.ai : styles.tool}`}>
              {m.role === 'tool' && m.content === 'plan-actualizado'
                ? <Button size="small" appearance="subtle" icon={<OpenRegular />} onClick={() => latestPlan && onPlanUpdated(latestPlan)}>Ver plan actualizado</Button>
                : m.content}
            </div>
          ))}
          {busy && <div className={styles.spinnerRow}><Spinner size="tiny" /> Aplicando…</div>}
        </div>
        <Divider />
        <div className={styles.inputBar}>
          <Input
            value={input}
            onChange={(_, d) => setInput(d.value)}
            placeholder="Ej: ajusta a 40 minutos y agrega una rúbrica"
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
          />
          <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <SendRegular />} onClick={() => void send()} disabled={busy || !input.trim()}>
            <SparkleRegular />
          </Button>
        </div>
      </DrawerBody>
    </Drawer>
  )
}
