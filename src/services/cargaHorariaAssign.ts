import { aiChat } from './ai'
import { dataService } from './dataService'
import { genId } from '../utils/helpers'
import { cicloFromGrade, GRADOS, gradoDe, gradoInicialDe, nivelShort, seccionDe } from '../utils/academic'
import type { GradeSection, Period, Subject, Teacher, TeacherAssignment } from '../types'

/** Item de asignatura detectado en la carga horaria. */
export interface CargaItem {
  asignatura: string
  /** Grados/secciones como aparecen ("5to", "6to A", "6to B"). */
  grados: string[]
}

/** Fila de docente detectada en la carga horaria. */
export interface CargaDocente {
  docente: string
  grado: string
  carga?: string
  items: CargaItem[]
}

export interface ItemResuelto {
  asignatura: string
  subjectId?: string
  nuevaAsignatura: boolean
  cursos: string[]
  /** En Inicial: el docente es titular del aula (no lleva asignaturas). */
  titular?: boolean
  gradoInicial?: string
  seccionInicial?: string
}

export interface DocentePlan {
  nombreCarga: string
  docenteId?: string
  docenteNombre?: string
  gradoTexto: string
  score: number
  combinaciones: number
  titulares: number
  ambiguo: boolean
  items: ItemResuelto[]
  advertencias: string[]
}

export interface PlanCarga {
  nivel: string
  docentes: DocentePlan[]
  totalAsignaciones: number
  totalTitulares: number
  cursosNuevos: number
  asignaturasNuevas: string[]
  advertencias: string[]
}

export interface CargaContexto {
  grades: GradeSection[]
  subjects: Subject[]
  teachers: Teacher[]
  periods: Period[]
}

/* ------------------------------- utilidades ------------------------------- */

const norm = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

const tokens = (s: string): string[] => norm(s).split(' ').filter(Boolean)

const ORD: Record<string, string> = {
  '1ro': '1ro', '2do': '2do', '3ro': '3ro', '4to': '4to', '5to': '5to', '6to': '6to',
  primer: '1ro', primero: '1ro', segundo: '2do', tercero: '3ro', cuarto: '4to', quinto: '5to', sexto: '6to',
}

/** Extrae el grado (1roâ€¦6to) y las secciones (Aâ€“G) de un texto como "5to", "6to A", "4to. A,B". */
function parseGrado(texto: string): { grado: string; secciones: string[]; general: boolean } {
  const t = norm(texto)
  let grado = ''
  const gm = t.match(/\b(1ro|2do|3ro|4to|5to|6to|primer|primero|segundo|tercero|cuarto|quinto|sexto)\b/)
  if (gm) grado = ORD[gm[1]] ?? ''
  const secciones = [...t.matchAll(/\b([a-g])\b/g)].map((m) => m[1].toUpperCase())
  const general = /secundari|primari|inicial|todos|todas|nivel/.test(t) && !grado
  return { grado, secciones, general }
}

/** Empareja el nombre de la carga horaria con un docente de la plataforma (por tokens). */
function emparejarDocente(nombre: string, teachers: Teacher[]): { teacher?: Teacher; score: number; ambiguo: boolean } {
  const carga = tokens(nombre)
  if (carga.length === 0) return { score: 0, ambiguo: false }
  let mejor: Teacher | undefined
  let mejorScore = 0
  let empates = 0
  for (const t of teachers) {
    const set = new Set(tokens(t.fullName))
    const score = carga.filter((x) => set.has(x)).length
    if (score > mejorScore) { mejorScore = score; mejor = t; empates = 1 }
    else if (score === mejorScore && score > 0) empates++
  }
  return { teacher: mejorScore > 0 ? mejor : undefined, score: mejorScore, ambiguo: empates > 1 }
}

/** Busca (o describe) la asignatura en el catÃ¡logo. */
function emparejarAsignatura(nombre: string, subjects: Subject[]): { id?: string; nombre: string; nueva: boolean } {
  const n = norm(nombre)
  const exacto = subjects.find((s) => norm(s.name) === n)
  if (exacto) return { id: exacto.id, nombre: exacto.name, nueva: false }
  const parcial = subjects.find((s) => n.includes(norm(s.name)) || norm(s.name).includes(n))
  if (parcial) return { id: parcial.id, nombre: parcial.name, nueva: false }
  return { nombre: nombre.trim(), nueva: true }
}

/** Cursos objetivo (grado + secciÃ³n + nivel) para un item de la carga horaria. */
function resolverCursos(grados: string[], nivelLargo: string, grades: GradeSection[]): Array<{ grado: string; seccion: string; level: string }> {
  const delNivel = grades.filter((g) => nivelShort(g.level) === nivelShort(nivelLargo))
  const objetivos: Array<{ grado: string; seccion: string; level: string }> = []
  const push = (grado: string, seccion: string) => {
    if (!objetivos.some((o) => o.grado === grado && o.seccion === seccion)) objetivos.push({ grado, seccion, level: nivelLargo })
  }
  for (const raw of grados) {
    const { grado, secciones, general } = parseGrado(raw)
    if (general) {
      for (const g of GRADOS) for (const sec of seccionesDe(g, delNivel)) push(g, sec)
      continue
    }
    if (!grado) continue
    const secs = secciones.length ? secciones : seccionesDe(grado, delNivel)
    for (const sec of secs) push(grado, sec)
  }
  return objetivos
}

/** Secciones existentes para un grado (o ['A'] si no hay registros). */
function seccionesDe(grado: string, grades: GradeSection[]): string[] {
  const s = [...new Set(grades.filter((g) => gradoDe(g) === grado).map((g) => seccionDe(g)))].sort()
  return s.length ? s : ['A']
}

/** Resuelve el aula de Inicial (Pre-Kínder/Kínder/Pre-Primaria) a partir del texto del grado. */
function resolverCursoInicial(gradoTexto: string, grades: GradeSection[]): { grado: string; seccion: string } | null {
  const delNivel = grades.filter((g) => nivelShort(g.level) === 'Inicial')
  const secMatch = norm(gradoTexto).match(/\b([a-g])\b/)
  const seccion = secMatch ? secMatch[1].toUpperCase() : 'A'
  const gi = gradoInicialDe(gradoTexto)
  if (!gi) {
    const directo = delNivel.find((g) => norm(gradoTexto).includes(norm(g.name)) || norm(g.name).includes(norm(gradoTexto)))
    return directo ? { grado: gradoDe(directo), seccion: seccionDe(directo) } : null
  }
  const candidatos = delNivel.filter((g) => gradoDe(g) === gi.nombre)
  const match = candidatos.find((g) => seccionDe(g) === seccion) ?? candidatos[0]
  return match ? { grado: gradoDe(match), seccion: seccionDe(match) } : { grado: gi.nombre, seccion }
}

/* ------------------------------- extracciÃ³n IA ------------------------------- */

const EXTRACCION_PROMPT = (nivel: string) => `Eres un asistente que extrae la informaciÃ³n de un documento "DistribuciÃ³n de la carga horaria" del Nivel ${nivel} (RepÃºblica Dominicana).
Devuelve un JSON vÃ¡lido con esta forma exacta:
{"docentes":[{"docente":"nombre tal como aparece","grado":"texto de la columna Grado/SecciÃ³n","carga":"30 horas","items":[{"asignatura":"MatemÃ¡ticas","grados":["5to","6to A","6to B"]}]}]}
Reglas para "grados" de cada asignatura:
- Interpreta la columna "Grado/SecciÃ³n" y cualquier grado/ciclo mencionado en el texto de la asignatura.
- "5to, 6to A y B" â†’ ["5to","6to A","6to B"]. "4to. A,B" â†’ ["4to A","4to B"]. "5to, 6to" â†’ ["5to","6to"].
- "Secundario" â†’ ["1ro","2do","3ro","4to","5to","6to"]. "Primario" â†’ ["1ro","2do","3ro","4to","5to","6to"].
- Si la asignatura dice "Primer Ciclo" (1er ciclo) usa solo ["1ro","2do","3ro"]; si dice "Segundo Ciclo" (2do ciclo) usa solo ["4to","5to","6to"].
- Si en "Secundario" una asignatura menciona un grado concreto (p. ej. "Optativa de 5to", "Ciencias Sociales en 1ro", "Arte en 5to y 6to A y B") usa esos grados para ESA asignatura.
- Separa cada asignatura distinta en un item. No inventes asignaturas ni docentes.
- En "asignatura" usa el nombre del Ã¡rea/materia (sin las horas ni el grado).
Responde ÃšNICAMENTE el JSON.`

/** Analiza el PDF de la carga horaria y devuelve las filas de docentes (una sola llamada a la IA). */
export async function extraerCargaHoraria(textoPdf: string, nivel: string): Promise<CargaDocente[]> {
  const res = await aiChat(
    [
      { role: 'system', content: 'Asistente curricular MINERD. Responde solo JSON vÃ¡lido.' },
      { role: 'user', content: `${EXTRACCION_PROMPT(nivel)}\n\nDocumento:\n"""${textoPdf.slice(0, 20000)}"""` },
    ],
    { temperature: 0.2, jsonMode: true, maxTokens: 4000 },
  )
  const json = res.match(/\{[\s\S]*\}/)?.[0] ?? res
  const parsed = JSON.parse(json) as { docentes?: CargaDocente[] }
  return (parsed.docentes ?? []).map((d) => ({
    docente: String(d.docente ?? '').trim(),
    grado: String(d.grado ?? '').trim(),
    carga: d.carga,
    items: (d.items ?? [])
      .map((i) => ({ asignatura: String(i.asignatura ?? '').trim(), grados: (i.grados ?? []).map((x) => String(x ?? '').trim()).filter(Boolean) }))
      .filter((i) => i.asignatura && i.grados.length),
  })).filter((d) => d.docente && d.items.length)
}

/* ------------------------------- plan / aplicaciÃ³n ------------------------------- */

/** Construye el plan (sin escribir) a partir de las filas extraÃ­das. */
export function construirPlan(nivel: string, filas: CargaDocente[], ctx: CargaContexto): PlanCarga {
  const docentes: DocentePlan[] = []
  const asignaturasNuevas = new Set<string>()
  const nuevasAulas = new Set<string>()
  let totalAsignaciones = 0
  let totalTitulares = 0

  for (const fila of filas) {
    const { teacher, score, ambiguo } = emparejarDocente(fila.docente, ctx.teachers)
    const advertencias: string[] = []
    if (!teacher) advertencias.push(`No se encontró el docente "${fila.docente}" en la plataforma.`)
    else if (ambiguo) advertencias.push(`Varios docentes coinciden con "${fila.docente}"; verifique el emparejamiento.`)

    const itemsResueltos: ItemResuelto[] = []
    const pares = new Set<string>()
    let titulares = 0
    if (nivelShort(nivel) === 'Inicial') {
      // En Inicial la carga es "Docente de aula": el docente es titular del aula (no lleva asignaturas).
      const curso = resolverCursoInicial(fila.grado, ctx.grades)
      if (curso) {
        itemsResueltos.push({ asignatura: 'Docente titular del aula', nuevaAsignatura: false, cursos: [`${curso.grado}.${curso.seccion}`], titular: true, gradoInicial: curso.grado, seccionInicial: curso.seccion })
        titulares++
        const existe = ctx.grades.some((g) => nivelShort(g.level) === 'Inicial' && gradoDe(g) === curso.grado && seccionDe(g) === curso.seccion)
        if (!existe) nuevasAulas.add(`Inicial|${curso.grado}.${curso.seccion}`)
      } else {
        advertencias.push(`No se pudo determinar el aula de Inicial para "${fila.grado}".`)
      }
    } else for (const item of fila.items) {
      const asign = emparejarAsignatura(item.asignatura, ctx.subjects)
      if (asign.nueva) asignaturasNuevas.add(asign.nombre)
      const objetivos = resolverCursos(item.grados, nivel, ctx.grades)
      if (objetivos.length === 0) { advertencias.push(`No se pudo determinar el curso para "${item.asignatura}".`); continue }
      const cursos: string[] = []
      for (const o of objetivos) {
        const existente = ctx.grades.some((g) => gradoDe(g) === o.grado && seccionDe(g) === o.seccion && nivelShort(g.level) === nivelShort(o.level))
        if (!existente) nuevasAulas.add(`${o.grado}.${o.seccion}`)
        cursos.push(`${o.grado}.${o.seccion}`)
        pares.add(`${o.grado}.${o.seccion}|${norm(asign.nombre)}`)
      }
      itemsResueltos.push({ asignatura: asign.nombre, subjectId: asign.id, nuevaAsignatura: asign.nueva, cursos })
    }
    totalAsignaciones += pares.size
    totalTitulares += titulares
    docentes.push({
      nombreCarga: fila.docente,
      docenteId: teacher?.id,
      docenteNombre: teacher?.fullName,
      gradoTexto: fila.grado,
      score,
      combinaciones: pares.size,
      titulares,
      ambiguo,
      items: itemsResueltos,
      advertencias,
    })
  }

  const advertencias = docentes.flatMap((d) => d.advertencias)
  return { nivel, docentes, totalAsignaciones, totalTitulares, cursosNuevos: nuevasAulas.size, asignaturasNuevas: [...asignaturasNuevas], advertencias }
}

/**
 * Aplica el plan: crea cursos/asignaturas que falten en Aulas por curso, reasigna
 * exactamente las asignaturas de la carga horaria y quita las que no figuren.
 */
export async function aplicarPlan(
  plan: PlanCarga,
  ctx: CargaContexto,
): Promise<{ cursosCreados: number; asignacionesCreadas: number; asignacionesEliminadas: number; asignaturasCreadas: number; titularesAsignados: number }> {
  const period = ctx.periods.find((p) => p.isActive) ?? ctx.periods[0]
  const grades = [...ctx.grades]
  const subjects = [...ctx.subjects]
  let cursosCreados = 0
  let asignaturasCreadas = 0
  let creadas = 0
  let eliminadas = 0
  let titularesAsignados = 0

  for (const fila of plan.docentes) {
    if (!fila.docenteId) continue
    const wanted = new Map<string, { gradeId: string; subjectId: string }>()

    for (const item of fila.items) {
      // Inicial: el docente es titular del aula (se marca como docente titular del curso).
      if (item.titular) {
        let objetivo = grades.filter((g) => nivelShort(g.level) === 'Inicial' && gradoDe(g) === item.gradoInicial && seccionDe(g) === item.seccionInicial)
        if (objetivo.length === 0 && item.gradoInicial) {
          const nuevo: GradeSection = {
            id: genId('g'),
            name: item.gradoInicial,
            grado: item.gradoInicial,
            section: item.seccionInicial,
            level: 'Nivel Inicial',
            nivel: 'Inicial',
            asignatura: 'Asignaturas Generales',
          }
          await dataServiceSaveGrade(nuevo)
          grades.push(nuevo)
          objetivo = [nuevo]
          cursosCreados++
        }
        for (const g of objetivo) {
          if (g.leadTeacherId !== fila.docenteId) { await dataServiceSaveGrade({ ...g, leadTeacherId: fila.docenteId }); titularesAsignados++ }
        }
        continue
      }
      // Asignatura: usar la del catálogo o crear una nueva.
      let subject = subjects.find((s) => norm(s.name) === norm(item.asignatura))
      if (!subject) {
        subject = { id: genId('sub'), name: item.asignatura, shortName: item.asignatura.slice(0, 14) }
        await dataServiceSaveSubject(subject)
        subjects.push(subject)
        asignaturasCreadas++
      }
      for (const curso of item.cursos) {
        const [grado, seccion] = curso.split('.')
        const gradeId = await asegurarCursoAsignatura(plan.nivel, grado, seccion, subject, grades, () => cursosCreados++)
        wanted.set(`${gradeId}|${subject.id}`, { gradeId, subjectId: subject.id })
      }
    }

    // Reconciliar asignaciones del docente en el perÃ­odo activo.
    const todas = await dataServiceGetAssignments()
    const mias = todas.filter((a) => a.teacherId === fila.docenteId && (!period || a.periodId === period.id))
    for (const { gradeId, subjectId } of wanted.values()) {
      if (!mias.some((a) => a.gradeId === gradeId && a.subjectId === subjectId)) {
        const assignment: TeacherAssignment = { id: genId('ta'), teacherId: fila.docenteId, gradeId, subjectId, periodId: period?.id ?? '' }
        await dataServiceSaveAssignment(assignment)
        creadas++
      }
    }
    for (const a of mias) {
      if (!wanted.has(`${a.gradeId}|${a.subjectId}`)) { await dataServiceDeleteAssignment(a.id); eliminadas++ }
    }

    // Actualizar la ficha del docente para que refleje solo la carga horaria.
    const teacher = ctx.teachers.find((t) => t.id === fila.docenteId)
    if (teacher) {
      await dataServiceSaveTeacher({
        ...teacher,
        grades: [...new Set([...wanted.values()].map((v) => v.gradeId))],
        subjects: [...new Set([...wanted.values()].map((v) => v.subjectId))],
      })
    }
  }

  return { cursosCreados, asignacionesCreadas: creadas, asignacionesEliminadas: eliminadas, asignaturasCreadas, titularesAsignados }
}

/** Asegura que exista un registro del curso+asignatura y devuelve su id. */
async function asegurarCursoAsignatura(
  nivel: string,
  grado: string,
  seccion: string,
  subject: Subject,
  grades: GradeSection[],
  onCreado: () => void,
): Promise<string> {
  const existente = grades.find(
    (g) => gradoDe(g) === grado && seccionDe(g) === seccion && nivelShort(g.level) === nivelShort(nivel) && norm(g.asignatura ?? '') === norm(subject.name),
  )
  if (existente) return existente.id
  const base = grades.find((g) => gradoDe(g) === grado && seccionDe(g) === seccion && nivelShort(g.level) === nivelShort(nivel))
  const nuevo: GradeSection = {
    id: genId('g'),
    name: `${grado}.${seccion}`,
    grado,
    section: seccion,
    level: base?.level ?? nivel,
    nivel: base?.nivel ?? nivelShort(nivel),
    ciclo: base?.ciclo ?? cicloFromGrade(base?.level ?? nivel, grado),
    asignatura: subject.name,
  }
  await dataServiceSaveGrade(nuevo)
  grades.push(nuevo)
  onCreado()
  return nuevo.id
}

/* Envoltorios para no acoplar el servicio al dataService en las pruebas. */
const dataServiceSaveSubject = (s: Subject) => dataService.saveSubject(s)
const dataServiceSaveGrade = (g: GradeSection) => dataService.saveGrade(g)
const dataServiceGetAssignments = () => dataService.getTeacherAssignments()
const dataServiceSaveAssignment = (a: TeacherAssignment) => dataService.saveTeacherAssignment(a)
const dataServiceDeleteAssignment = (id: string) => dataService.deleteTeacherAssignment(id)
const dataServiceSaveTeacher = (t: Teacher) => dataService.saveTeacher(t)
