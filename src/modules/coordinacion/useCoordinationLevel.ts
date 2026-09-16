import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CoordinationLevel } from '../../types'
import { useApp } from '../../context/useApp'
import { nivelShort } from '../../utils/academic'

const LEVELS: CoordinationLevel[] = ['Inicial', 'Primaria', 'Secundaria']
const KEY = 'arca_coord_nivel'

/** Deduce el nivel desde un texto (p. ej. el cargo: "Coordinador de Primaria"). */
function nivelDesdeTexto(texto?: string): CoordinationLevel | null {
  const t = (texto ?? '').toLowerCase()
  if (/inicial|preprimar|preescolar|kinder|maternal|nido/.test(t)) return 'Inicial'
  if (/secundar|bachiller|\bmedia\b|liceo/.test(t)) return 'Secundaria'
  if (/primar|b[aá]sica/.test(t)) return 'Primaria'
  return null
}

/**
 * Nivel de coordinación (Inicial/Primaria/Secundaria). Si el usuario no ha
 * elegido uno manualmente, se deduce de su cargo (jobTitle) o de los grados de
 * su ficha de docente.
 */
export function useCoordinationLevel(): { level: CoordinationLevel; setLevel: (l: CoordinationLevel) => void; levels: CoordinationLevel[] } {
  const { user, teachers, grades } = useApp()

  const derivado = useMemo<CoordinationLevel | null>(() => {
    const porCargo = nivelDesdeTexto(user?.jobTitle)
    if (porCargo) return porCargo
    const teacher = teachers.find((t) => t.userId === user?.id) ?? teachers.find((t) => t.id === user?.teacherId)
    const ids = new Set(teacher?.grades ?? [])
    const conteo = new Map<CoordinationLevel, number>()
    for (const g of grades.filter((g) => ids.has(g.id))) {
      const n = nivelShort(g.level) as CoordinationLevel
      if (LEVELS.includes(n)) conteo.set(n, (conteo.get(n) ?? 0) + 1)
    }
    const top = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]
    return top?.[0] ?? null
  }, [user, teachers, grades])

  const [level, setLevelState] = useState<CoordinationLevel>(() => {
    const stored = sessionStorage.getItem(KEY) as CoordinationLevel | null
    return stored && LEVELS.includes(stored) ? stored : (derivado ?? 'Primaria')
  })

  // Mientras el usuario no elija manualmente, sigue el nivel deducido.
  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return
    if (derivado && derivado !== level) setLevelState(derivado)
  }, [derivado, level])

  const setLevel = useCallback((l: CoordinationLevel) => {
    setLevelState(l)
    sessionStorage.setItem(KEY, l)
  }, [])

  return { level, setLevel, levels: LEVELS }
}
