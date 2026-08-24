import { useMemo } from 'react'
import { useApp } from '../context/useApp'
import type { Student } from '../types'

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Hijos vinculados al usuario conectado (privacidad del portal de Padres):
 *  - registros de Padres/Tutores cuya cuenta (userId) o correo coincide con el usuario;
 *  - estudiantes cuyo correo de padre/tutor coincide con el del usuario.
 * Un padre solo ve a sus propios hijos; nunca la matrícula completa.
 */
export function useMyChildren(): Student[] {
  const { user, students, guardians } = useApp()
  return useMemo(() => {
    if (!user) return []
    const ids = new Set<string>()
    for (const g of guardians) {
      if (g.userId === user.id || sameEmail(g.email, user.email)) ids.add(g.studentId)
    }
    for (const s of students) {
      if (sameEmail(s.parentEmail, user.email)) ids.add(s.id)
    }
    return students.filter((s) => ids.has(s.id))
  }, [user, students, guardians])
}
