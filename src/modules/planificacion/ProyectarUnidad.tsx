import type { ReactNode } from 'react'
import { makeStyles } from '@fluentui/react-components'
import type { DailyPlan } from '../../types'

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'linear-gradient(160deg, #06324A 0%, #0A4E6E 50%, #0E6B8F 100%)',
    color: '#fff',
    overflowY: 'auto',
    padding: '28px 40px',
    '@media (max-width: 720px)': { padding: '16px' },
  },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '14px' },
  title: { fontWeight: 800, fontSize: '28px', letterSpacing: '-0.01em', lineHeight: 1.15, color: '#fff', '@media (max-width: 720px)': { fontSize: '20px' } },
  sub: { color: '#9CD9EE', fontSize: '14px', marginTop: '2px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: '16px' },
  card: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '16px', padding: '20px 24px', backdropFilter: 'blur(6px)' },
  h: { fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '13px', color: '#9CD9EE', marginBottom: '10px' },
  text: { fontSize: '18px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#fff' },
  list: { margin: 0, paddingLeft: '20px', fontSize: '17px', lineHeight: 1.7, color: '#fff' },
  b: { fontWeight: 800 },
  close: { background: '#E62327', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '10px', padding: '9px 18px', fontWeight: 700, fontSize: '14px', ':hover': { background: '#C21E22' } },
})

interface ProyectarUnidadProps {
  open: boolean
  onClose: () => void
  unidad: DailyPlan | null
  subjectName: string
  gradeName: string
}

/** Pizarra (PDI) a pantalla completa para proyectar la Unidad de Aprendizaje con sus recursos y actividades. */
export function ProyectarUnidad({ open, onClose, unidad, subjectName, gradeName }: ProyectarUnidadProps) {
  const styles = useStyles()
  if (!open || !unidad) return null
  const u = unidad
  const section = (title: string, body: ReactNode) => (
    <div className={styles.card}>
      <div className={styles.h}>{title}</div>
      {body}
    </div>
  )
  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>{u.tema}</div>
          <div className={styles.sub}>{subjectName} · {gradeName} · {u.tipo === 'unidad' ? 'Unidad de Aprendizaje' : 'Clase'} · {u.duracion}</div>
        </div>
        <button className={styles.close} onClick={onClose}>Salir</button>
      </div>
      <div className={styles.grid}>
        {u.recuerda ? section('Recuerda', <div className={styles.text}>{u.recuerda}</div>) : null}
        {u.situacionAprendizaje ? section('Situación de aprendizaje', <div className={styles.text}>{u.situacionAprendizaje}</div>) : null}
        {section('Competencias fundamentales', <ul className={styles.list}>{u.competenciasFundamentales.map((c) => <li key={c}>{c}</li>)}</ul>)}
        {section('Competencias específicas', <ul className={styles.list}>{u.competenciasEspecificas.map((c) => <li key={c}>{c}</li>)}</ul>)}
        {section('Contenidos', <div className={styles.text}><span className={styles.b}>Conceptuales:</span> {u.contenidos.conceptuales}<br /><span className={styles.b}>Procedimentales:</span> {u.contenidos.procedimentales}<br /><span className={styles.b}>Actitudinales:</span> {u.contenidos.actitudinales}</div>)}
        {section('Cronograma de la actividad', <div className={styles.text}><span className={styles.b}>Inicio:</span> {u.actividades.inicio}<br /><span className={styles.b}>Desarrollo:</span> {u.actividades.desarrollo}<br /><span className={styles.b}>Cierre:</span> {u.actividades.cierre}</div>)}
        {section('Estrategias', <ul className={styles.list}>{u.estrategias.map((e) => <li key={e}>{e}</li>)}</ul>)}
        {section('Recursos y materiales', <ul className={styles.list}>{[...u.recursos, ...(u.materiales ?? [])].map((r) => <li key={r}>{r}</li>)}</ul>)}
        {u.recursosDigitales?.length ? section('Recursos digitales', <ul className={styles.list}>{u.recursosDigitales.map((r) => <li key={r}>{r}</li>)}</ul>) : null}
        {section('Indicadores de logro', <ul className={styles.list}>{u.indicadoresLogro.map((i) => <li key={i}>{i}</li>)}</ul>)}
        {section('Evaluación', <div className={styles.text}><span className={styles.b}>{u.evaluacion.tipo}</span> · {u.evaluacion.instrumento}<br />{u.evaluacion.criterios}</div>)}
      </div>
    </div>
  )
}
