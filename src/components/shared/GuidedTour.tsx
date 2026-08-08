import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, makeStyles, Text } from '@fluentui/react-components'
import { ArrowRightRegular, DismissRegular, ArrowLeftRegular } from '@fluentui/react-icons'

export interface TourStep {
  target: string
  title: string
  description: string
}

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#fff',
    borderRadius: '18px',
    padding: '28px 28px 20px',
    maxWidth: '420px',
    width: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    textAlign: 'center',
  },
  stepBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#103F7E',
    color: '#fff',
    fontWeight: 800,
    fontSize: '16px',
    margin: '0 auto',
  },
  title: { fontWeight: 800, fontSize: '20px', color: 'var(--azul-oscuro)' },
  desc: { fontSize: '14px', color: 'var(--texto-suave)', lineHeight: 1.6 },
  actions: { display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '6px' },
  dots: { display: 'flex', gap: '6px', justifyContent: 'center' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#d1d5db' },
  dotActive: { background: '#103F7E', width: '22px', borderRadius: '10px' },
})

interface GuidedTourProps {
  steps: TourStep[]
  startLabel?: string
  children?: ReactNode
  onStart?: () => void
}

export function GuidedTour({ steps, startLabel = 'Iniciar tour', children }: GuidedTourProps) {
  const styles = useStyles()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  const start = useCallback(() => {
    setStep(0)
    setActive(true)
  }, [])

  const next = useCallback(() => {
    if (step < steps.length - 1) setStep((s) => s + 1)
    else setActive(false)
  }, [step, steps.length])

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  useEffect(() => {
    const selector = steps[step]?.target
    if (!selector) return
    if (!active) {
      const target = document.querySelector(selector) as HTMLElement | null
      if (target) target.style.boxShadow = ''
      return
    }
    const target = document.querySelector(selector) as HTMLElement | null
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.style.transition = 'box-shadow 0.3s, outline 0.3s'
      target.style.outline = '3px solid #103F7E'
      target.style.outlineOffset = '4px'
      target.style.borderRadius = '10px'
    }
    return () => {
      if (target) {
        target.style.outline = ''
        target.style.outlineOffset = ''
        target.style.borderRadius = ''
      }
    }
  }, [active, step, steps])

  const dismiss = () => setActive(false)

  return (
    <>
      {children ?? <Button appearance="subtle" onClick={start}>{startLabel}</Button>}
      {active && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}>
          <div className={styles.card}>
            <div className={styles.dots} style={{ marginBottom: '-6px' }}>
              {steps.map((_, i) => (
                <div key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
              ))}
            </div>
            <div className={styles.stepBadge}>{step + 1}</div>
            <Text className={styles.title}>{steps[step].title}</Text>
            <Text className={styles.desc}>{steps[step].description}</Text>
            <div className={styles.actions}>
              {step > 0 && (
                <Button appearance="outline" icon={<ArrowLeftRegular />} onClick={prev}>Anterior</Button>
              )}
              <Button appearance="primary" icon={<ArrowRightRegular />} onClick={next}>
                {step < steps.length - 1 ? 'Siguiente' : 'Entendido'}
              </Button>
              <Button appearance="subtle" icon={<DismissRegular />} onClick={dismiss} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
