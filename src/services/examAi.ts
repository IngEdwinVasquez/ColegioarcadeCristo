import { aiChat, parseAiJson } from './ai'
import { extractPdfText } from './pdf'
import type { ExamQuestion } from '../types'

const esImagen = (f: File) => /^image\//.test(f.type)
const esPdf = (f: File) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    r.readAsDataURL(file)
  })
}

/** Construye el contenido multimodal (texto de PDF + imágenes) para la IA. */
async function buildContent(files: File[], prompt: string): Promise<unknown[]> {
  const parts: unknown[] = [{ type: 'text', text: prompt }]
  for (const f of files) {
    if (esPdf(f)) {
      try {
        const t = await extractPdfText(f)
        if (t.trim()) parts.push({ type: 'text', text: `Documento ${f.name}:\n${t.slice(0, 12000)}` })
      } catch {
        /* ignora PDF sin texto */
      }
    } else if (esImagen(f)) {
      parts.push({ type: 'image_url', image_url: { url: await fileToDataUrl(f) } })
    }
  }
  return parts
}

interface ParsedQuestion { numero?: string; enunciado?: string; tipo?: string; opciones?: string[]; respuesta?: string }

/** Interpreta un examen (PDF/imágenes) y devuelve la lista de preguntas y opciones. */
export async function interpretExam(files: File[]): Promise<ExamQuestion[]> {
  const prompt = 'Eres un asistente que interpreta exámenes. A partir del documento o las imágenes, extrae TODAS las preguntas con sus opciones de respuesta. Responde SOLO con JSON válido: '
    + '{"preguntas":[{"numero":"1","enunciado":"...","tipo":"opcion","opciones":["A) ...","B) ..."],"respuesta":""}]}. '
    + 'Usa "opcion" para selección múltiple y "texto" cuando la respuesta sea escrita.'
  const content = await buildContent(files, prompt)
  const raw = await aiChat([{ role: 'user', content } as unknown as { role: 'user'; content: string }], { jsonMode: true, temperature: 0.1, maxTokens: 3000 })
  const data = parseAiJson<{ preguntas: ParsedQuestion[] }>(raw)
  if (!data?.preguntas?.length) throw new Error('La IA no pudo interpretar las preguntas del examen.')
  return data.preguntas.map((q, i) => ({
    id: `q${i + 1}`,
    numero: q.numero ?? String(i + 1),
    enunciado: q.enunciado ?? '',
    tipo: q.tipo === 'texto' ? 'texto' : 'opcion',
    opciones: Array.isArray(q.opciones) ? q.opciones : [],
    respuesta: q.respuesta ?? '',
  }))
}

export interface GradeResult {
  respuestas: Array<{ numero: string; respuesta: string; correcta: boolean; razon?: string }>
  puntaje: number
}

/** Califica el examen respondido por un estudiante comparando con las respuestas correctas. */
export async function gradeExam(questions: ExamQuestion[], files: File[]): Promise<GradeResult> {
  const answersText = questions.map((q) => `#${q.numero} (${q.tipo}): ${q.enunciado} | opciones: ${q.opciones.join(' ; ')} | correcta: ${q.respuesta}`).join('\n')
  const prompt = `Eres un evaluador. Las respuestas correctas son:\n${answersText}\n\n`
    + 'A partir de las imágenes/documentos del examen respondido por el estudiante, identifica la respuesta de cada pregunta y califícala. '
    + 'Para preguntas de texto, si el estudiante expresa una idea cercana a la respuesta correcta, marca correcta=true. '
    + 'Responde SOLO con JSON válido: {"respuestas":[{"numero":"1","respuesta":"lo que respondió","correcta":true,"razon":"..."}],"puntaje":0}'
  const content = await buildContent(files, prompt)
  const raw = await aiChat([{ role: 'user', content } as unknown as { role: 'user'; content: string }], { jsonMode: true, temperature: 0.1, maxTokens: 2500 })
  const data = parseAiJson<GradeResult>(raw)
  if (!data) throw new Error('La IA no devolvió una calificación válida.')
  return { respuestas: data.respuestas ?? [], puntaje: Math.max(0, Math.min(100, Math.round(data.puntaje ?? 0))) }
}
