import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Accompaniment, CoordinationLevel } from '../../types'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { nivelShort } from '../../utils/academic'

const LEVELS: CoordinationLevel[] = ['Inicial', 'Primaria', 'Secundaria']
const KEY = 'arca_coord_nivel'

// Los acompañamientos se cargan una sola vez por sesión (varias pantallas usan este hook).
let accCache: Promise<Accompaniment[]> | null = null
const loadAccompaniments = () => (accCache ??= dataService.getAccompaniments())

/** Deduce el nivel desde un texto (p. ej. el cargo: "Coordinador de Primaria"). */
function nivelDesdeTexto(texto?: string): CoordinationLevel | null {
  const t = (texto ?? '').toLowerCase()
  if (/inicial|preprimar|preescolar|kinder|maternal|nido/.test(t)) return 'Inicial'
  if (/secundar|bachiller|\bmedia\b|liceo/.test(t)) return 'Secundaria'
  if (/primar|b[aá]sica/.test(t)) return 'Primaria'
  return null
}

/** Nivel más frecuente de un conjunto de niveles. */
function masFrecuente(niveles: CoordinationLevel[]): CoordinationLevel | null {
  const conteo = new Map<CoordinationLevel, number>()
  for (const n of niveles) if (LEVELS.includes(n)) conteo.set(n, (conteo.get(n) ?? 0) + 1)
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Nivel de coordinación (Inicial/Primaria/Secundaria). Si el usuario no ha
 * elegido uno manualmente, se deduce (en este orden) de:
 *   1. Su cargo (jobTitle): "Coordinador de Primaria" → Primaria.
 *   2. Los acompañamientos que ha realizado (nivel predominante).
 *   3. Los grados de su ficha de docente (nivel predominante).
 */
export function useCoordinationLevel(): { level: CoordinationLevel; setLevel: (l: CoordinationLevel) => void; levels: CoordinationLevel[] } {
  const { user, teachers, grades } = useApp()
  const [porAcompanamientos, setPorAcompanamientos] = useState<CoordinationLevel | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    void loadAccompaniments()
      .then((list) => {
        if (!alive) return
        setPorAcompanamientos(masFrecuente(list.filter((a) => a.coordinatorId === user.id).map((a) => a.level)))
      })
      .catch(() => { /* sin acceso: se ignora */ })
    return () => { alive = false }
  }, [user?.id])

  const derivado = useMemo<CoordinationLevel | null>(() => {
    const porCargo = nivelDesdeTexto(user?.jobTitle)
    if (porCargo) return porCargo
    if (porAcompanamientos) return porAcompanamientos
    const teacher = teachers.find((t) => t.userId === user?.id) ?? teachers.find((t) => t.id === user?.teacherId)
    const ids = new Set(teacher?.grades ?? [])
    return masFrecuente(grades.filter((g) => ids.has(g.id)).map((g) => nivelShort(g.level) as CoordinationLevel))
  }, [user, teachers, grades, porAcompanamientos])

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
