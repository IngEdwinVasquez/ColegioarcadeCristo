import { useCallback, useState } from 'react'
import type { CoordinationLevel } from '../../types'

const LEVELS: CoordinationLevel[] = ['Inicial', 'Primaria', 'Secundaria']
const KEY = 'arca_coord_nivel'

/** Hook compartido del nivel de coordinación (Inicial/Primaria/Secundaria). */
export function useCoordinationLevel(): { level: CoordinationLevel; setLevel: (l: CoordinationLevel) => void; levels: CoordinationLevel[] } {
  const [level, setLevelState] = useState<CoordinationLevel>(() => {
    const stored = sessionStorage.getItem(KEY) as CoordinationLevel | null
    return stored && LEVELS.includes(stored) ? stored : 'Primaria'
  })

  const setLevel = useCallback((l: CoordinationLevel) => {
    setLevelState(l)
    sessionStorage.setItem(KEY, l)
  }, [])

  return { level, setLevel, levels: LEVELS }
}
