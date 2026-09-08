import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { ArrowLeftRegular, ArrowRightRegular } from '@fluentui/react-icons'
import type { DailyPlan } from '../../types'

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'linear-gradient(160deg, #06324A 0%, #0A4E6E 50%, #0E6B8F 100%)',
    color: '#fff',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '18px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
  },
  title: {
    fontWeight: 800,
    fontSize: '24px',
    letterSpacing: '-0.01em',
    lineHeight: 1.15,
    color: '#fff',
    '@media (max-width: 720px)': { fontSize: '18px' },
  },
  sub: { color: '#9CD9EE', fontSize: '13px', marginTop: '2px' },
  close: {
    background: '#E62327',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '10px',
    padding: '9px 18px',
    fontWeight: 700,
    fontSize: '14px',
    ':hover': { background: '#C21E22' },
  },
  stage: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 60px',
    overflowY: 'auto',
    '@media (max-width: 720px)': { padding: '16px' },
  },
  slide: {
    width: '100%',
    maxWidth: '900px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '20px',
    padding: '40px 48px',
    backdropFilter: 'blur(6px)',
    '@media (max-width: 720px)': { padding: '24px' },
  },
  slideTitle: {
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontSize: '14px',
    color: '#9CD9EE',
    marginBottom: '20px',
  },
  text: {
    fontSize: '26px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    color: '#fff',
    '@media (max-width: 720px)': { fontSize: '19px' },
  },
  list: {
    margin: 0,
    paddingLeft: '26px',
    fontSize: '24px',
    lineHeight: 1.75,
    color: '#fff',
    '@media (max-width: 720px)': { fontSize: '18px' },
  },
  big: {
    fontWeight: 800,
    fontSize: '40px',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    '@media (max-width: 720px)': { fontSize: '26px' },
  },
  bigSub: {
    color: '#9CD9EE',
    fontSize: '20px',
    marginTop: '12px',
    '@media (max-width: 720px)': { fontSize: '15px' },
  },
  b: { fontWeight: 800 },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 32px',
    borderTop: '1px solid rgba(255,255,255,0.15)',
  },
  nav: { display: 'flex', alignItems: 'center', gap: '12px' },
  btn: {
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '12px',
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: '15px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    ':hover': { background: 'rgba(255,255,255,0.24)' },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
  },
  count: { color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '14px' },
})

interface SlideItem {
  title: string
  body: ReactNode
}

export function ProyectarUnidad({ open, onClose, unidad, subjectName, gradeName }: { open: boolean; onClose: () => void; unidad: DailyPlan | null; subjectName: string; gradeName: string }) {
  const styles = useStyles()
  const u = unidad
  const [idx, setIdx] = useState(0)

  const slides = useMemo<SlideItem[]>(() => {
    if (!u) return []
    const arr: SlideItem[] = []
    arr.push({ title: 'Inicio', body: <></> })
    if (u.recuerda) arr.push({ title: 'Recuerda', body: <div className={styles.text}>{u.recuerda}</div> })
    if (u.situacionAprendizaje) arr.push({ title: 'Situación de aprendizaje', body: <div className={styles.text}>{u.situacionAprendizaje}</div> })
    arr.push({ title: 'Competencias fundamentales', body: <ul className={styles.list}>{u.competenciasFundamentales.map((c) => <li key={c}>{c}</li>)}</ul> })
    arr.push({ title: 'Competencias específicas', body: <ul className={styles.list}>{u.competenciasEspecificas.map((c) => <li key={c}>{c}</li>)}</ul> })
    arr.push({ title: 'Contenidos', body: <div className={styles.text}><span className={styles.b}>Conceptuales:</span> {u.contenidos.conceptuales}<br /><span className={styles.b}>Procedimentales:</span> {u.contenidos.procedimentales}<br /><span className={styles.b}>Actitudinales:</span> {u.contenidos.actitudinales}</div> })
    arr.push({ title: 'Cronograma de la actividad', body: <div className={styles.text}><span className={styles.b}>Inicio:</span> {u.actividades.inicio}<br /><span className={styles.b}>Desarrollo:</span> {u.actividades.desarrollo}<br /><span className={styles.b}>Cierre:</span> {u.actividades.cierre}</div> })
    arr.push({ title: 'Estrategias', body: <ul className={styles.list}>{u.estrategias.map((e) => <li key={e}>{e}</li>)}</ul> })
    arr.push({ title: 'Recursos y materiales', body: <ul className={styles.list}>{[...u.recursos, ...(u.materiales ?? [])].map((r) => <li key={r}>{r}</li>)}</ul> })
    if (u.recursosDigitales?.length) arr.push({ title: 'Recursos digitales', body: <ul className={styles.list}>{u.recursosDigitales.map((r) => <li key={r}>{r}</li>)}</ul> })
    arr.push({ title: 'Indicadores de logro', body: <ul className={styles.list}>{u.indicadoresLogro.map((i) => <li key={i}>{i}</li>)}</ul> })
    arr.push({ title: 'Evaluación', body: <div className={styles.text}><span className={styles.b}>{u.evaluacion.tipo}</span> · {u.evaluacion.instrumento}<br />{u.evaluacion.criterios}</div> })
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u])

  useEffect(() => {
    setIdx(0)
  }, [open, u?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, slides.length - 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0))
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slides.length])

  if (!open || !u || slides.length === 0) return null
  const cur = slides[Math.min(idx, slides.length - 1)]
  const isFirst = idx === 0
  const isLast = idx === slides.length - 1

  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>{u.tema}</div>
          <div className={styles.sub}>{subjectName} · {gradeName} · {u.tipo === 'unidad' ? 'Unidad de Aprendizaje' : 'Clase'} · {u.duracion}</div>
        </div>
        <button className={styles.close} onClick={onClose}>Salir</button>
      </div>

      <div className={styles.stage}>
        <div className={styles.slide}>
          <div className={styles.slideTitle}>{cur.title}</div>
          {isFirst ? (
            <div>
              <div className={styles.big}>{u.tema}</div>
              <div className={styles.bigSub}>{subjectName} · {gradeName}<br />Use las flechas para recorrer la secuencia.</div>
            </div>
          ) : cur.body}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.nav}>
          <button className={styles.btn} disabled={isFirst} onClick={() => setIdx((i) => Math.max(i - 1, 0))}><ArrowLeftRegular /> Anterior</button>
          <button className={styles.btn} disabled={isLast} onClick={() => setIdx((i) => Math.min(i + 1, slides.length - 1))}>Siguiente <ArrowRightRegular /></button>
        </div>
        <span className={styles.count}>{idx + 1} / {slides.length}</span>
      </div>
    </div>
  )
}
