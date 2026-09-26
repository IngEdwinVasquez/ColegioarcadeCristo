import { dataService } from './dataService'
import { GRADOS, INICIAL_GRADOS, gradoDe, cursoNombre, asignaturaDe } from '../utils/academic'
import type { GradeSection } from '../types'

const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const gradosValidos = new Set([...GRADOS, ...INICIAL_GRADOS.map((gi) => gi.nombre)].map(norm))

/**
 * Normaliza los cursos/aulas:
 *  - Elimina los que no tienen grado válido (o cuyo grado/nombre es una asignatura).
 *  - Elimina duplicados (mismo curso + misma asignatura).
 * Devuelve cuántos se eliminaron de cada tipo.
 */
export async function normalizarCursos(items: GradeSection[]): Promise<{ duplicados: number; invalidos: number }> {
  const vistos = new Set<string>()
  let duplicados = 0
  let invalidos = 0
  for (const g of items) {
    const gd = norm(gradoDe(g))
    if (!gd || !gradosValidos.has(gd)) {
      await dataService.deleteGrade(g.id)
      invalidos += 1
      continue
    }
    const clave = `${cursoNombre(g).toLowerCase()}|${asignaturaDe(g).trim().toLowerCase()}`
    if (vistos.has(clave)) {
      await dataService.deleteGrade(g.id)
      duplicados += 1
      continue
    }
    vistos.add(clave)
  }
  return { duplicados, invalidos }
}
