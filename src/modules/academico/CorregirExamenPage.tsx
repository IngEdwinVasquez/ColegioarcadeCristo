import { useMemo, useRef, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { ArrowDownloadRegular, ArrowUploadRegular, CheckmarkCircleRegular, PlayRegular, SaveRegular, SparkleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { interpretExam, gradeExam } from '../../services/examAi'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { asignaturaDe, cursoNombre, isRealSubject, ordenarCursos } from '../../utils/academic'
import type { ExamAnswer, ExamCorrection, ExamQuestion, ExamSubmission, GradeSection } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' },
  q: { border: '1px solid var(--borde)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' },
  muted: { color: 'var(--texto-suave)' },
})

/**
 * Corrección de exámenes con IA: interpreta el examen, permite marcar las
 * respuestas correctas, califica por estudiante y guarda el registro de notas.
 */
export function CorregirExamenPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, grades, gradeById, user } = useApp()
  const examCol = useCollection<ExamCorrection>(dataService.getExamCorrections, dataService.saveExamCorrection, dataService.deleteExamCorrection)
  const subCol = useCollection<ExamSubmission>(dataService.getExamSubmissions, dataService.saveExamSubmission, dataService.deleteExamSubmission)

  const [titulo, setTitulo] = useState('')
  const [curso, setCurso] = useState('')
  const [examFiles, setExamFiles] = useState<File[]>([])
  const [interpreting, setInterpreting] = useState(false)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [exam, setExam] = useState<ExamCorrection | null>(null)
  const [pages, setPages] = useState<Record<string, File[]>>({})
  const [grading, setGrading] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})

  const examFileRef = useRef<HTMLInputElement>(null)
  const pageFileRef = useRef<HTMLInputElement>(null)
  const pageStudent = useRef<string>('')

  const cursos = useMemo(() => {
    const map = new Map<string, GradeSection>()
    for (const g of ordenarCursos(grades)) {
      if (!isRealSubject(asignaturaDe(g))) continue
      const k = cursoNombre(g)
      if (!map.has(k)) map.set(k, g)
    }
    return [...map.values()]
  }, [grades])

  const alumnos = useMemo(() => {
    if (!curso) return []
    return students
      .filter((s) => { const g = gradeById(s.gradeId); return g && cursoNombre(g) === curso })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [students, gradeById, curso])

  const subDe = (studentId: string) => (exam ? subCol.items.find((s) => s.examId === exam.id && s.studentId === studentId) : undefined)

  const interpretar = async () => {
    if (examFiles.length === 0) { toaster.dispatchToast('Sube la imagen(es) o el documento del examen.', { intent: 'error' }); return }
    setInterpreting(true)
    try {
      const qs = await interpretExam(examFiles)
      setQuestions(qs)
      toaster.dispatchToast(`Se interpretaron ${qs.length} pregunta(s). Marca las respuestas correctas y guarda.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setInterpreting(false)
    }
  }

  const setRespuesta = (id: string, value: string) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, respuesta: value } : q)))

  const guardarExamen = async () => {
    if (!titulo.trim()) { toaster.dispatchToast('Escribe el título del examen.', { intent: 'error' }); return }
    if (!curso) { toaster.dispatchToast('Selecciona el curso.', { intent: 'error' }); return }
    if (questions.length === 0) { toaster.dispatchToast('Primero interpreta el examen con IA.', { intent: 'error' }); return }
    if (questions.some((q) => !q.respuesta.trim())) { toaster.dispatchToast('Marca o escribe la respuesta correcta de todas las preguntas.', { intent: 'error' }); return }
    const nuevo: ExamCorrection = { id: exam?.id ?? genId('exam'), titulo: titulo.trim(), courseId: curso, questions, createdAt: exam?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }
    await examCol.save(nuevo)
    setExam(nuevo)
    toaster.dispatchToast('Examen guardado. Ahora sube las hojas de cada estudiante.', { intent: 'success' })
  }

  const cargarExamen = (id: string) => {
    const e = examCol.items.find((x) => x.id === id)
    if (!e) return
    setExam(e); setQuestions(e.questions); setTitulo(e.titulo); setCurso(e.courseId)
  }

  const subirPaginas = (studentId: string, files: FileList | null) => {
    if (!files) return
    setPages((p) => ({ ...p, [studentId]: [...(p[studentId] ?? []), ...Array.from(files)] }))
  }

  const calificar = async (studentId: string, studentName: string) => {
    if (!exam) return
    const files = pages[studentId] ?? []
    if (files.length === 0) { toaster.dispatchToast('Sube las hojas del examen del estudiante.', { intent: 'error' }); return }
    setGrading(studentId)
    try {
      const result = await gradeExam(exam.questions, files)
      const total = exam.questions.length || 1
      const answers: ExamAnswer[] = exam.questions.map((q) => {
        const r = result.respuestas.find((x) => x.numero === q.numero)
        return { questionId: q.id, numero: q.numero, respuesta: r?.respuesta ?? '', correcta: !!r?.correcta, puntos: r?.correcta ? Math.round(100 / total) : 0, razon: r?.razon }
      })
      const sub: ExamSubmission = {
        id: genId('esub'),
        examId: exam.id,
        courseId: exam.courseId,
        studentId,
        studentName,
        pages: files.length,
        answers,
        score: result.puntaje,
        aiScore: result.puntaje,
        modified: false,
        createdAt: new Date().toISOString(),
        byUserId: user?.id,
        byName: user?.displayName,
      }
      await subCol.save(sub)
      setScores((s) => ({ ...s, [studentId]: String(result.puntaje) }))
      toaster.dispatchToast(`Calificado: ${studentName} → ${result.puntaje}/100 (puedes ajustarlo).`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setGrading(null)
    }
  }

  const guardarNota = async (studentId: string) => {
    const sub = subDe(studentId)
    if (!sub) return
    const val = Math.max(0, Math.min(100, Number(scores[studentId] ?? sub.score)))
    await subCol.save({ ...sub, score: val, modified: true })
    toaster.dispatchToast('Calificación actualizada.', { intent: 'success' })
  }

  return (
    <div>
      <PageHeader title="Corregir examen con IA" subtitle="Sube el examen (imágenes o PDF), marca las respuestas correctas, sube las hojas de cada estudiante y deja que la IA califique. Puedes ajustar la nota." />

      <Card className={styles.card}>
        <FieldRow>
          <FormField label="Título del examen" required>
            <Input value={titulo} onChange={(_, d) => setTitulo(d.value)} placeholder="Ej. Examen de Matemática 1er parcial" />
          </FormField>
          <FormField label="Curso" required>
            <Select value={curso} onChange={(_, d) => setCurso(d.value)}>
              <option value="">Selecciona el curso…</option>
              {cursos.map((g) => <option key={g.id} value={cursoNombre(g)}>{cursoNombre(g)}</option>)}
            </Select>
          </FormField>
        </FieldRow>
        <input ref={examFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={(e) => { setExamFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        <div className={styles.row}>
          <Button appearance="secondary" icon={<ArrowUploadRegular />} onClick={() => examFileRef.current?.click()}>Subir imágenes / PDF del examen</Button>
          <Text size={200} className={styles.muted}>{examFiles.length} archivo(s) cargado(s)</Text>
          <Button appearance="primary" icon={interpreting ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={interpreting || examFiles.length === 0} onClick={() => void interpretar()}>
            {interpreting ? 'Interpretando…' : 'Interpretar examen con IA'}
          </Button>
          {examCol.items.length > 0 && (
            <Select onChange={(_, d) => d.value && cargarExamen(d.value)} style={{ minWidth: '220px' }}>
              <option value="">Cargar examen guardado…</option>
              {examCol.items.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
            </Select>
          )}
        </div>
      </Card>

      {questions.length > 0 && (
        <Card className={styles.card}>
          <Text weight="semibold" size={400}>Preguntas interpretadas ({questions.length})</Text>
          <Text size={200} className={styles.muted}>Marca la opción correcta o escribe la respuesta correcta en las preguntas de texto.</Text>
          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {questions.map((q, i) => (
              <div key={q.id} className={styles.q}>
                <Text weight="semibold" block>{i + 1}. {q.enunciado}</Text>
                {q.tipo === 'opcion' && q.opciones.length > 0 ? (
                  <Select value={q.respuesta} onChange={(_, d) => setRespuesta(q.id, d.value)} style={{ marginTop: '6px', maxWidth: '360px' }}>
                    <option value="">— Marca la opción correcta —</option>
                    {q.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input value={q.respuesta} onChange={(_, d) => setRespuesta(q.id, d.value)} placeholder="Respuesta correcta (texto)" style={{ marginTop: '6px' }} />
                )}
              </div>
            ))}
          </div>
          <div><Button appearance="primary" icon={<SaveRegular />} onClick={() => void guardarExamen()}>Guardar examen y respuestas correctas</Button></div>
        </Card>
      )}

      {exam && (
        <Card className={styles.card}>
          <Text weight="semibold" size={400}>Estudiantes del curso · {exam.courseId}</Text>
          <Text size={200} className={styles.muted}>Sube una hoja por cada hoja del examen ({examFiles.length || 'las'} hoja(s)); puedes subir más si hace falta.</Text>
          <input ref={pageFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={(e) => { subirPaginas(pageStudent.current, e.target.files); e.target.value = '' }} />
          {alumnos.length === 0 ? (
            <Text size={200} className={styles.muted}>No hay estudiantes en ese curso.</Text>
          ) : (
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Hojas subidas</TableHeaderCell>
                  <TableHeaderCell>Nota IA</TableHeaderCell>
                  <TableHeaderCell>Nota final</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alumnos.map((s) => {
                  const sub = subDe(s.id)
                  const nPag = (pages[s.id] ?? []).length
                  return (
                    <TableRow key={s.id}>
                      <TableCell><Text weight="semibold">{s.fullName}</Text></TableCell>
                      <TableCell>{nPag} hoja(s)</TableCell>
                      <TableCell>{sub ? `${sub.aiScore}/100` : '—'}</TableCell>
                      <TableCell>
                        {sub ? (
                          <Input value={scores[s.id] ?? String(sub.score)} onChange={(_, d) => setScores((m) => ({ ...m, [s.id]: d.value }))} style={{ width: '80px' }} />
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <Button size="small" appearance="secondary" icon={<ArrowUploadRegular />} onClick={() => { pageStudent.current = s.id; pageFileRef.current?.click() }}>Subir hojas</Button>
                          <Button size="small" appearance="primary" icon={grading === s.id ? <Spinner size="tiny" /> : <PlayRegular />} disabled={grading === s.id || nPag === 0} onClick={() => void calificar(s.id, s.fullName)}>
                            {grading === s.id ? 'Calificando…' : 'Calificar con IA'}
                          </Button>
                          {sub && <Button size="small" appearance="subtle" icon={<CheckmarkCircleRegular />} onClick={() => void guardarNota(s.id)}>Guardar nota</Button>}
                          {sub && sub.answers.length > 0 && <Button size="small" appearance="subtle" icon={<ArrowDownloadRegular />} onClick={() => imprimir(sub)}>Detalle</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}

/** Muestra el detalle de la corrección en una ventana imprimible. */
function imprimir(sub: ExamSubmission) {
  const win = window.open('', '_blank')
  if (!win) return
  const rows = sub.answers.map((a) => `<tr><td>${a.numero}</td><td>${a.respuesta || '—'}</td><td>${a.correcta ? '✔' : '✘'}</td><td>${a.razon ?? ''}</td></tr>`).join('')
  win.document.write(`<h2>Corrección · ${sub.studentName}</h2><p>Nota: <b>${sub.score}/100</b> · ${sub.createdAt.slice(0,10)}</p><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>#</th><th>Respuesta</th><th>Correcta</th><th>Observación</th></tr></thead><tbody>${rows}</tbody></table>`)
  win.document.close()
  win.focus()
  win.print()
}
